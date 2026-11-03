//! Local review queue: append-only JSONL. Records stay pending-review until
//! a human clears the source; nothing here ever publishes.

use serde::{Deserialize, Serialize};
use std::io;
use std::path::{Path, PathBuf};

use crate::normalize::NormalizedRecipe;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueueRecord {
    pub id: String,
    pub source_url: String,
    pub license: String,
    pub fetched_at: String,
    pub status: String,
    pub recipe: NormalizedRecipe,
}

fn queue_path(out: &Path) -> PathBuf {
    out.join("review-queue.jsonl")
}

/// Stable record id from the URL (readable + collision-safe enough for a
/// local queue): host + slugified path + short FNV hash.
pub fn record_id(url: &str) -> String {
    let parsed = url::Url::parse(url).ok();
    let host = parsed
        .as_ref()
        .map(|u| u.host_str().unwrap_or("unknown").to_string())
        .unwrap_or_else(|| "unknown".into());
    let path = parsed.map(|u| u.path().to_string()).unwrap_or_default();
    let slug: String = path
        .trim_matches('/')
        .split('/')
        .last()
        .unwrap_or("page")
        .chars()
        .map(|c| if c.is_ascii_alphanumeric() { c.to_ascii_lowercase() } else { '-' })
        .collect();
    let mut hash: u64 = 0xcbf29ce484222325;
    for b in url.as_bytes() {
        hash ^= *b as u64;
        hash = hash.wrapping_mul(0x100000001b3);
    }
    format!("{host}-{slug}-{hash:08x}")
}

pub fn append(out: &Path, record: &QueueRecord) -> io::Result<usize> {
    std::fs::create_dir_all(out)?;
    let path = queue_path(out);
    let mut line = serde_json::to_string(record).map_err(io::Error::other)?;
    line.push('\n');
    use std::io::Write;
    let mut f = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&path)?;
    f.write_all(line.as_bytes())?;
    Ok(list(out)?.len())
}

pub fn list(out: &Path) -> io::Result<Vec<QueueRecord>> {
    let path = queue_path(out);
    let Ok(body) = std::fs::read_to_string(&path) else {
        return Ok(Vec::new());
    };
    let mut records = Vec::new();
    for line in body.lines() {
        if line.trim().is_empty() {
            continue;
        }
        if let Ok(r) = serde_json::from_str(line) {
            records.push(r);
        }
    }
    Ok(records)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::normalize::NormalizedRecipe;

    fn rec(url: &str) -> QueueRecord {
        QueueRecord {
            id: record_id(url),
            source_url: url.into(),
            license: "unknown".into(),
            fetched_at: "2026-11-01T00:00:00Z".into(),
            status: "pending-review".into(),
            recipe: NormalizedRecipe {
                name: "Test".into(),
                description: None,
                ingredients: vec![],
                steps: vec![],
                lang: None,
            },
        }
    }

    #[test]
    fn append_then_list_roundtrips() {
        let dir = std::env::temp_dir().join(format!("yolk-harvest-test-{}", std::process::id()));
        let r = rec("https://example.com/recipes/toast");
        append(&dir, &r).unwrap();
        append(&dir, &rec("https://example.com/recipes/soup")).unwrap();
        let all = list(&dir).unwrap();
        assert_eq!(all.len(), 2);
        assert_eq!(all[0].id, r.id);
        assert_eq!(all[0].status, "pending-review");
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn record_id_is_stable_and_distinct() {
        assert_eq!(record_id("https://a.com/x"), record_id("https://a.com/x"));
        assert_ne!(record_id("https://a.com/x"), record_id("https://a.com/y"));
    }
}
