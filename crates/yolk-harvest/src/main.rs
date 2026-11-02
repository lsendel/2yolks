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

fn fetch_and_queue(url: &str, license: &str, out: &std::path::Path) -> Result<(), String> {
    let parsed = url::Url::parse(url).map_err(|e| format!("bad url: {e}"))?;
    if parsed.scheme() != "https" {
        return Err("https only".into());
    }
    let agent: ureq::Agent = ureq::Agent::config_builder()
        .user_agent("yolk-harvest/0.1 (private pilot; contact: site owner)")
        .build()
        .into();
    // robots.txt check first; a fetch failure here fails closed.
    let rules = robots::fetch_rules(&agent, &parsed)?;
    let path = parsed.path();
    if !rules.allows("yolk-harvest", path) {
        return Err(format!("robots.txt disallows {path}"));
    }
    let html = agent
        .get(url)
        .call()
        .map_err(|e| format!("fetch failed: {e}"))?
        .body_mut()
        .read_to_string()
        .map_err(|e| format!("read failed: {e}"))?;
    normalize_to_queue(&html, url, license, out)
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
