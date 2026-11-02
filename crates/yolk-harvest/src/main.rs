//! yolk-harvest: provenance-first recipe source harvester.
//!
//! Ground rules (approved plan):
//! - robots.txt is respected, re-fetched per redirect target host.
//! - No proxy env is honored; DNS is validated at connection time.
//! - Requests are time- and size-bounded; failures fail closed.
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
        if ip.is_loopback() || ip.is_unspecified() {
            return true;
        }
        let seg = ip.segments();
        // fc00::/7 unique-local, fe80::/10 link-local, 2001:db8::/32 documentation
        if seg[0] & 0xfe00 == 0xfc00 || seg[0] & 0xffc0 == 0xfe80 || (seg[0] == 0x2001 && seg[1] == 0x0db8) {
            return true;
        }
        // IPv4-mapped (::ffff:a.b.c.d) and deprecated IPv4-compatible
        // (::a.b.c.d) forms - evaluate the embedded v4 address
        if let Some(v4) = ip.to_ipv4() {
            return is_forbidden_host(&v4.to_string());
        }
        return false;
    }
    false
}


/// DNS resolver that refuses forbidden addresses at CONNECTION time.
/// ureq resolves through this for every request (including each redirect
/// hop), so the validated IP set is the one actually dialed - there is no
/// preflight/re-resolve gap for DNS rebinding to cross. TLS SNI and Host
/// still come from the URL hostname.
#[derive(Debug, Default)]
struct GuardedResolver;

impl ureq::unversioned::resolver::Resolver for GuardedResolver {
    fn resolve(
        &self,
        uri: &ureq::http::Uri,
        _config: &ureq::config::Config,
        _timeout: ureq::unversioned::transport::NextTimeout,
    ) -> Result<ureq::unversioned::resolver::ResolvedSocketAddrs, ureq::Error> {
        use std::net::ToSocketAddrs;
        use ureq::unversioned::resolver::DefaultResolver;
        let scheme = uri.scheme().ok_or(ureq::Error::HostNotFound)?;
        let authority = uri.authority().ok_or(ureq::Error::HostNotFound)?;
        if is_forbidden_host(authority.host()) {
            return Err(ureq::Error::HostNotFound);
        }
        let addr = DefaultResolver::host_and_port(scheme, authority)
            .ok_or(ureq::Error::HostNotFound)?;
        let iter = addr
            .to_socket_addrs()
            .map_err(|_| ureq::Error::HostNotFound)?;
        let mut result = ureq::unversioned::resolver::ResolvedSocketAddrs::from_fn(|_| {
            std::net::SocketAddr::new(std::net::IpAddr::V4(std::net::Ipv4Addr::new(0, 0, 0, 0)), 0)
        });
        let mut any = false;
        for a in iter {
            if is_forbidden_host(&a.ip().to_string()) {
                // Fail closed: a host with ANY forbidden address is refused.
                return Err(ureq::Error::HostNotFound);
            }
            any = true;
            let _ = result.try_push(a);
        }
        if !any {
            return Err(ureq::Error::HostNotFound);
        }
        Ok(result)
    }
}

/// Agent configuration for all harvesting requests. Never honor ambient
/// proxy env vars: an HTTP proxy would move target DNS resolution to the
/// proxy, outside GuardedResolver. Timeouts bound hanging hosts.
fn harvest_config() -> ureq::config::Config {
    ureq::Agent::config_builder()
        .user_agent("yolk-harvest/0.1 (private pilot; contact: site owner)")
        // Redirects handled manually: every hop re-validates scheme, host
        // (SSRF guard) and robots for the NEW host - a redirect must never
        // bypass the origin's robots evaluation.
        .max_redirects(0)
        // Return 4xx/5xx as responses so robots.txt 404 (no rules) and
        // fetch status handling decide explicitly instead of ureq erroring.
        .http_status_as_error(false)
        // CRITICAL: ureq's default config reads ALL_PROXY/HTTPS_PROXY/
        // HTTP_PROXY. A proxy would bypass the connection-time DNS guard.
        .proxy(None)
        .timeout_global(Some(std::time::Duration::from_secs(60)))
        .timeout_per_call(Some(std::time::Duration::from_secs(30)))
        .timeout_resolve(Some(std::time::Duration::from_secs(10)))
        .build()
}

fn fetch_and_queue(url: &str, license: &str, out: &std::path::Path) -> Result<(), String> {
    let config = harvest_config();
    let agent = ureq::Agent::with_parts(
        config,
        ureq::unversioned::transport::DefaultConnector::default(),
        GuardedResolver,
    );
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
        let _ = host; // resolver enforces at connection time
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
            .with_config()
            .limit(5 * 1024 * 1024) // 5 MiB cap: a recipe page never needs more
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
    fn blocks_private_ipv6_forms() {
        for h in ["fc00::1", "fd12::1", "fe80::1", "2001:db8::1", "[fd00::1]", "::ffff:127.0.0.1", "::ffff:10.1.2.3", "::127.0.0.1", "::10.0.0.1", "::192.168.1.1", "[::127.0.0.1]"] {
            assert!(is_forbidden_host(h), "{h} should be blocked");
        }
        assert!(!is_forbidden_host("2606:4700:4700::1111"), "public v6 allowed");
    }

    #[test]
    fn allows_public_hosts() {
        for h in ["93.184.216.34", "myplate.gov", "1.1.1.1"] {
            assert!(!is_forbidden_host(h), "{h} should be allowed");
        }
    }
}


#[cfg(test)]
mod resolver_tests {
    use super::*;
    use ureq::unversioned::resolver::{Resolver, ResolvedSocketAddrs};
    use ureq::unversioned::transport::NextTimeout;

    fn resolve(url: &str) -> Result<ResolvedSocketAddrs, ureq::Error> {
        let uri: ureq::http::Uri = url.parse().unwrap();
        let cfg = ureq::Agent::config_builder().build();
        GuardedResolver.resolve(&uri, &cfg, NextTimeout::default())
    }

    #[test]
    fn resolver_refuses_private_ip_literal() {
        assert!(resolve("http://127.0.0.1:8080/x").is_err());
        assert!(resolve("http://[fd00::1]/x").is_err());
        assert!(resolve("http://[::1]/x").is_err());
        assert!(resolve("http://169.254.169.254/latest/meta-data").is_err());
        assert!(resolve("http://localhost/x").is_err());
    }

    #[test]
    fn resolver_allows_public_ip_literal() {
        // Literal IPs parse without DNS, so this needs no network.
        let out = resolve("https://93.184.215.14/").unwrap();
        assert!(out.iter().any(|a| a.port() == 443));
    }
}


#[cfg(test)]
mod config_tests {
    #[test]
    fn harvest_config_never_uses_ambient_proxy_env() {
        // ureq's default config builder adopts ALL_PROXY/HTTPS_PROXY/
        // HTTP_PROXY when set; harvest_config must override that so target
        // DNS always stays inside GuardedResolver.
        let cfg = super::harvest_config();
        assert!(cfg.proxy().is_none(), "harvesting must not use any proxy");
        let t = cfg.timeouts();
        assert!(t.global.is_some() && t.per_call.is_some() && t.resolve.is_some());
    }
}
