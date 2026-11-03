# Trending recipes, wave 1 (editorial drafts)

Status: DRAFT. Original wording, no images, not kitchen-tested. Rows are `draft` and the source has `cleared_at` NULL, so nothing is served. Applying `0003_trending_wave1.sql` to production D1 is a separate, unapproved step.

## Why these dishes (popularity signals, with their limits)
- Cabbage-centred meals, including cabbage dumplings and golumpki soup: Pinterest Predicts 2026 report, https://business.pinterest.com/pdf/pinterest-predicts/2026-trend-report/ (Pinterest's own search data, Sep 2023 to Aug 2025). The specific percentages (dumplings +110%, golumpki soup +95%) come from a secondary summary, https://foodshot.ai/blog/pinterest-food-trends, and are not confirmed against the primary report here. Pinterest is a prediction report, not a current search ranking.
- Mexican food: tacos are the top Mexican dish searched on Google per El Informador (Google Trends, Jun 2026), https://www.informador.mx/estilo/el-mapa-del-antojo-las-8-comidas-mexicanas-que-dominan-google-trends-20260618-0133.html , which also names tamales, pozole and enchiladas as high-interest dishes. Mexican cuisine is the most searched international cuisine in 36 US states per a TripleTrad analysis of Google Trends data, https://www.tripletrad.com/most-searched-cuisine-by-state/ (secondary analysis).
- Birria specifically: only blog-level signals found, no primary measurement. It is included as a taco recipe, not as a claim that birria is trending.

## Before publishing any recipe
1. A person cooks it and records real yield, timing and changes.
2. Check internal consistency (yield, times, ingredient use in steps) and food-safety temperatures.
3. Add a photo only with a licensed or self-shot image.
4. Then set the recipe `published` and set the source `cleared_at` through an approved release.
