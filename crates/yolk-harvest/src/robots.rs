//! Minimal robots.txt evaluation (RFC 9309 subset): User-agent groups,
//! Allow/Disallow path prefixes, longest match wins. Fails closed: when
//! robots.txt cannot be fetched, the caller must not fetch.

use thiserror::Error;

#[derive(Debug, Error)]
pub enum RobotsError {
    #[error("robots.txt fetch failed: {0}")]
    Fetch(String),
}

pub struct Rules {
    groups: Vec<(String, Vec<(bool, String)>)>, // (agent, [(allow, prefix)])
}

impl Rules {
    pub fn parse(body: &str) -> Rules {
        let mut groups = Vec::new();
        let mut agents: Vec<String> = Vec::new();
        let mut rules: Vec<(bool, String)> = Vec::new();
        let mut seen_rule = false;
        let flush = |agents: &mut Vec<String>,
                     rules: &mut Vec<(bool, String)>,
                     groups: &mut Vec<(String, Vec<(bool, String)>)>| {
            for a in agents.drain(..) {
                groups.push((a, rules.clone()));
            }
            rules.clear();
        };
        for raw in body.lines() {
            let line = raw.split('#').next().unwrap_or("").trim();
            let Some((k, v)) = line.split_once(':') else {
                continue;
            };
            let k = k.trim().to_ascii_lowercase();
            let v = v.trim();
            match k.as_str() {
                "user-agent" => {
                    if seen_rule {
                        flush(&mut agents, &mut rules, &mut groups);
                        seen_rule = false;
                    }
                    agents.push(v.to_ascii_lowercase());
                }
                "allow" | "disallow" => {
                    if !agents.is_empty() {
                        seen_rule = true;
                        if !v.is_empty() {
                            rules.push((k == "allow", v.to_string()));
                        }
                    }
                }
                _ => {}
            }
        }
        flush(&mut agents, &mut rules, &mut groups);
        Rules { groups }
    }

    pub fn allows(&self, agent: &str, path: &str) -> bool {
        let agent = agent.to_ascii_lowercase();
        let mut best: Option<(usize, bool)> = None; // (prefix len, allow?)
        for (a, rules) in &self.groups {
            if a != "*" && !agent.contains(a.as_str()) {
                continue;
            }
            for (allow, prefix) in rules {
                if path.starts_with(prefix.as_str()) {
                    let len = prefix.len();
                    if best.map(|(l, _)| len >= l).unwrap_or(true) {
                        best = Some((len, *allow));
                    }
                }
            }
        }
        best.map(|(_, allow)| allow).unwrap_or(true)
    }
}

pub fn fetch_rules(agent: &ureq::Agent, url: &url::Url) -> Result<Rules, String> {
    let robots_url = format!("{}://{}/robots.txt", url.scheme(), url.authority());
    let mut resp = agent
        .get(&robots_url)
        .call()
        .map_err(|e| RobotsError::Fetch(e.to_string()).to_string())?;
    if resp.status() == 404 {
        return Ok(Rules::parse("")); // no robots file: everything allowed
    }
    if !resp.status().is_success() {
        return Err(RobotsError::Fetch(format!("status {}", resp.status())).to_string());
    }
    let body = resp
        .body_mut()
        .read_to_string()
        .map_err(|e| RobotsError::Fetch(e.to_string()).to_string())?;
    Ok(Rules::parse(&body))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn disallow_blocks_matching_prefix() {
        let r = Rules::parse("User-agent: *\nDisallow: /recipes/private\n");
        assert!(!r.allows("yolk-harvest", "/recipes/private/x"));
        assert!(r.allows("yolk-harvest", "/recipes/public"));
    }

    #[test]
    fn longest_match_wins() {
        let r = Rules::parse("User-agent: *\nDisallow: /a\nAllow: /a/b\n");
        assert!(r.allows("yolk-harvest", "/a/b/c"));
        assert!(!r.allows("yolk-harvest", "/a/c"));
    }

    #[test]
    fn agent_specific_group() {
        let r = Rules::parse("User-agent: googlebot\nDisallow: /\nUser-agent: *\nDisallow: /tmp\n");
        assert!(!r.allows("googlebot", "/anything"));
        assert!(r.allows("yolk-harvest", "/anything"));
        assert!(!r.allows("yolk-harvest", "/tmp/x"));
    }
}
