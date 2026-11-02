//! schema.org Recipe extraction: JSON-LD first (most recipe pages embed it),
//! normalized into the 2yolks ingestion shape so the review queue records are
//! directly compatible with validateRecipeSubmission upstream.

use scraper::{Html, Selector};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct NormalizedRecipe {
    pub name: String,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub ingredients: Vec<String>,
    #[serde(default)]
    pub steps: Vec<String>,
    /// ISO-639 language tag when the page declares one.
    #[serde(default)]
    pub lang: Option<String>,
}

/// Extract the first schema.org Recipe from a page's JSON-LD blocks.
pub fn extract_recipe(html: &str) -> Option<NormalizedRecipe> {
    let doc = Html::parse_document(html);
    let lang = doc
        .select(&Selector::parse("html[lang]").ok()?)
        .next()
        .and_then(|el| el.value().attr("lang"))
        .map(|s| s.split('-').next().unwrap_or(s).to_string());
    let sel = Selector::parse(r#"script[type="application/ld+json"]"#).ok()?;
    for el in doc.select(&sel) {
        let text: String = el.text().collect();
        let Ok(ld) = serde_json::from_str::<serde_json::Value>(text.trim()) else {
            continue;
        };
        // Unwrap: a bare node, an array of nodes, or an @graph wrapper.
        let owned;
        let nodes: Vec<&serde_json::Value> = if let Some(graph) = ld.get("@graph").and_then(|g| g.as_array()) {
            graph.iter().collect()
        } else if ld.is_array() {
            ld.as_array().map(|a| a.iter().collect()).unwrap_or_default()
        } else {
            owned = [ld];
            owned.iter().collect()
        };
        for node in nodes {
            let ty = node.get("@type").and_then(|t| match t {
                serde_json::Value::String(s) => Some(s.clone()),
                serde_json::Value::Array(a) => a
                    .iter()
                    .filter_map(|v| v.as_str())
                    .find(|s| *s == "Recipe")
                    .map(str::to_string),
                _ => None,
            });
            let Some(ty) = ty else {
                continue;
            };
            if ty != "Recipe" {
                continue;
            }
            return Some(from_jsonld(node, lang.clone()));
        }
    }
    None
}

fn from_jsonld(node: &serde_json::Value, lang: Option<String>) -> NormalizedRecipe {
    let name = node
        .get("name")
        .and_then(|v| v.as_str())
        .unwrap_or_default()
        .trim()
        .to_string();
    let description = node
        .get("description")
        .and_then(|v| v.as_str())
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty());
    let ingredients = node
        .get("recipeIngredient")
        .and_then(|v| v.as_array())
        .map(|a| {
            a.iter()
                .filter_map(|v| v.as_str().map(|s| s.trim().to_string()))
                .filter(|s| !s.is_empty())
                .collect()
        })
        .unwrap_or_default();
    let mut steps = Vec::new();
    if let Some(arr) = node.get("recipeInstructions").and_then(|v| v.as_array()) {
        for step in arr {
            match step {
                serde_json::Value::String(s) => steps.push(s.trim().to_string()),
                serde_json::Value::Object(_) => {
                    if let Some(s) = step.get("text").and_then(|v| v.as_str()) {
                        steps.push(s.trim().to_string());
                    }
                }
                _ => {}
            }
        }
    }
    steps.retain(|s| !s.is_empty());
    NormalizedRecipe {
        name,
        description,
        ingredients,
        steps,
        lang,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const FIXTURE: &str = r#"<!doctype html><html lang="es"><head>
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Recipe",
  "name": "Enchiladas de Frijol",
  "description": "Frijoles en salsa de chile.",
  "recipeIngredient": ["8 tortillas", "2 tazas de frijoles", "sal al gusto"],
  "recipeInstructions": [
    {"@type": "HowToStep", "text": "Calentar las tortillas."},
    {"@type": "HowToStep", "text": "Rellenar con frijoles."},
    "Servir caliente."
  ]
}
</script></head><body></body></html>"#;

    #[test]
    fn extracts_recipe_from_jsonld() {
        let r = extract_recipe(FIXTURE).expect("recipe present");
        assert_eq!(r.name, "Enchiladas de Frijol");
        assert_eq!(r.lang.as_deref(), Some("es"));
        assert_eq!(r.ingredients.len(), 3);
        assert_eq!(
            r.steps,
            vec![
                "Calentar las tortillas.".to_string(),
                "Rellenar con frijoles.".to_string(),
                "Servir caliente.".to_string()
            ]
        );
    }

    #[test]
    fn handles_graph_wrapper() {
        let html = r#"<html><head><script type="application/ld+json">
        {"@context":"https://schema.org","@graph":[{"@type":"WebPage"},{"@type":"Recipe","name":"Toast","recipeIngredient":["bread"],"recipeInstructions":["Toast it."]}]}
        </script></head></html>"#;
        let r = extract_recipe(html).expect("recipe in graph");
        assert_eq!(r.name, "Toast");
        assert_eq!(r.steps, vec!["Toast it.".to_string()]);
    }

    #[test]
    fn returns_none_without_recipe() {
        assert!(extract_recipe("<html><body>no ld</body></html>").is_none());
    }
}
