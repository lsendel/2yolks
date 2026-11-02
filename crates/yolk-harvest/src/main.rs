//! yolk-harvest: provenance-first recipe source harvester.
//!
//! Ground rules (approved plan):
//! - robots.txt is respected; one request per domain per `--delay` seconds.
//! - Every record carries provenance: source URL, license, fetched-at.
//! - Output goes to a local review queue (JSONL). Nothing publishes
//!   automatically; a source needs a clearance review before any bulk run.

mod normalize;
mod robots;
mod store;

use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

fn main() {
    let args: Vec<String> = std::env::args().collect();
    let usage = "usage:\n  yolk-harvest fetch <url> [--license <spdx>] [--out <dir>]\n  yolk-harvest normalize <file.html> <url> [--license <spdx>] [--out <dir>]\n  yolk-harvest review [--out <dir>]";
    let Some(cmd) = args.get(1) else {
        eprintln!("{usage}");
        std::process::exit(2);
    };
    let license = flag_value(&args, "--license").unwrap_or_else(|| "unknown".to_string());
    let out = flag_value(&args, "--out")
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from(".yolk-harvest"));
    let result = match cmd.as_str() {
        "fetch" => args
            .get(2)
            .ok_or("fetch needs a url".to_string())
            .and_then(|url| fetch_and_queue(url, &license, &out)),
        "normalize" => {
            let (file, url) = (args.get(2), args.get(3));
            match (file, url) {
                (Some(file), Some(url)) => match std::fs::read_to_string(file) {
                    Ok(html) => normalize_to_queue(&html, url, &license, &out),
                    Err(e) => Err(e.to_string()),
                },
                _ => Err("normalize needs a file and the source url".to_string()),
            }
        }
        "review" => review(&out),
        _ => Err(format!("unknown command {cmd}\n{usage}")),
    };
    if let Err(e) = result {
        eprintln!("error: {e}");
        std::process::exit(1);
    }
}

fn flag_value(args: &[String], name: &str) -> Option<String> {
    args.iter()
        .position(|a| a == name)
        .and_then(|i| args.get(i + 1))
        .cloned()
}

fn now_iso() -> String {
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    // days since epoch -> civil date (Howard Hinnant's algorithm)
    let z = (secs / 86400) as i64 + 719468;
    let era = if z >= 0 { z } else { z - 146096 } / 146097;
    let doe = (z - era * 146097) as u64;
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
    let y = yoe as i64 + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    let y = if m <= 2 { y + 1 } else { y };
    let t = secs % 86400;
    format!(
        "{y:04}-{m:02}-{d:02}T{:02}:{:02}:{:02}Z",
        t / 3600,
        (t % 3600) / 60,
        t % 60
    )
}

/// Hosts that must never be fetched (SSRF guard): loopback, private,
/// link-local, and unspecified ranges for IPv4 and IPv6.
pub fn is_forbidden_host(host: &str) -> bool {
    let h = host.trim_matches(['[', ']']).to_ascii_lowercase();
    if h == "localhost" || h == "localhost." || h.ends_with(".localhost") || h == "metadata.google.internal" {
        return true;
    }
    if let Ok(ip) = h.parse::<std::net::Ipv4Addr>() {
        return ip.is_loopback()
            || ip.is_private()
            || ip.is_link_local()
            || ip.is_unspecified()
            || ip.is_broadcast()
            || ip.is_documentation()
            || ip.octets()[0] == 0
            || (ip.octets()[0] == 100 && (64..=127).contains(&ip.octets()[1])) // CGNAT
            || (ip.octets()[0] == 169 && ip.octets()[1] == 254) // cloud metadata
            || (ip.octets()[0] == 192 && ip.octets()[1] == 168)
            || ip.octets()[0] == 127
            || ip.octets()[0] == 10
            || (ip.octets()[0] == 172 && (16..=31).contains(&ip.octets()[1]));
    }
    if let Ok(ip) = h.parse::<std::net::Ipv6Addr>() {
        return ip.is_loopback() || ip.is_unspecified();
    }
    false
}

fn fetch_and_queue(url: &str, license: &str, out: &std::path::Path) -> Result<(), String> {
    let agent: ureq::Agent = ureq::Agent::config_builder()
        .user_agent("yolk-harvest/0.1 (private pilot; contact: site owner)")
        // Redirects handled manually: every hop re-validates scheme, host
        // (SSRF guard) and robots for the NEW host - a redirect must never
        // bypass the origin's robots evaluation.
        .max_redirects(0)
        .build()
        .into();
    let mut current = url::Url::parse(url).map_err(|e| format!("bad url: {e}"))?;
    let mut hops = 0;
    let html = loop {
        if current.scheme() != "https" {
            return Err("https only".into());
        }
        let host = current.host_str().ok_or("url has no host")?;
        if is_forbidden_host(host) {
            return Err(format!("forbidden host (SSRF guard): {host}"));
        }
        // robots.txt check for THIS host; a fetch failure here fails closed.
        let rules = robots::fetch_rules(&agent, &current)?;
        let path = current.path();
        if !rules.allows("yolk-harvest", path) {
            return Err(format!("robots.txt disallows {path}"));
        }
        let resp = agent
            .get(current.as_str())
            .call()
            .map_err(|e| format!("fetch failed: {e}"))?;
        if resp.status().is_redirection() {
            hops += 1;
            if hops > 3 {
                return Err("too many redirects".into());
            }
            let loc = resp
                .headers()
                .get("location")
                .and_then(|v| v.to_str().ok())
                .ok_or("redirect without location")?;
            current = current.join(loc).map_err(|e| format!("bad redirect: {e}"))?;
            continue;
        }
        if !resp.status().is_success() {
            return Err(format!("fetch failed: status {}", resp.status()));
        }
        break resp
            .into_body()
            .read_to_string()
            .map_err(|e| format!("read failed: {e}"))?;
    };
    normalize_to_queue(&html, current.as_str(), license, out)
}

fn normalize_to_queue(
    html: &str,
    url: &str,
    license: &str,
    out: &std::path::Path,
) -> Result<(), String> {
    let Some(recipe) = normalize::extract_recipe(html) else {
        return Err("no schema.org Recipe found in page".into());
    };
    let record = store::QueueRecord {
        id: store::record_id(url),
        source_url: url.to_string(),
        license: license.to_string(),
        fetched_at: now_iso(),
        status: "pending-review".into(),
        recipe,
    };
    let n = store::append(out, &record).map_err(|e| e.to_string())?;
    println!("queued {} ({} pending review)", record.id, n);
    Ok(())
}

fn review(out: &std::path::Path) -> Result<(), String> {
    let records = store::list(out).map_err(|e| e.to_string())?;
    for r in &records {
        println!(
            "{}\t{}\t{}\t{}",
            r.id, r.status, r.license, r.recipe.name
        );
    }
    println!("{} record(s)", records.len());
    Ok(())
}

#[cfg(test)]
mod ssrf_tests {
    use super::is_forbidden_host;

    #[test]
    fn blocks_private_and_metadata_hosts() {
        for h in ["127.0.0.1", "10.0.0.5", "192.168.1.1", "172.16.0.1", "169.254.169.254", "100.64.0.1", "localhost", "0.0.0.0", "::1", "[::1]", "metadata.google.internal"] {
            assert!(is_forbidden_host(h), "{h} should be blocked");
        }
    }

    #[test]
    fn allows_public_hosts() {
        for h in ["93.184.216.34", "myplate.gov", "1.1.1.1"] {
            assert!(!is_forbidden_host(h), "{h} should be allowed");
        }
    }
}

