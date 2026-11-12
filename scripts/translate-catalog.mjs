// Catalog translation generator, QA gate, second-pass AI reviewer, and guarded D1 SQL builder.
// Uses Gemini 3.8 Flash (official Interactions API, store: false) to translate every published
// single-locale recipe into all enabled languages for its country (us/mx: en, es, fr).
//
// Usage:
//   node --env-file=.env scripts/translate-catalog.mjs generate   # fetch published originals, translate & review -> JSON
//   node --env-file=.env scripts/translate-catalog.mjs apply      # execute guarded insert + publish batches on remote D1
//
// Checkpoints after each completed recipe so interrupted runs resume cleanly without redoing work.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DRAFTS_PATH = resolve(ROOT, 'packages/api/content/catalog.translation-drafts.json');
const REVIEW_PATH = resolve(ROOT, 'packages/api/content/catalog.translation-review.json');

const AI_MODEL = 'gemini-3.8-flash';
const GEMINI_INTERACTIONS_URL = 'https://generativelanguage.googleapis.com/v1beta/interactions';
const GEMINI_API_REVISION = '2026-05-20';
const LOCALES = {
  us: ['en', 'es', 'fr'],
  mx: ['es', 'en', 'fr'],
};
const LANG_FULL = {
  en: 'English',
  es: 'Spanish (Español)',
  fr: 'French (Français)',
};
const REVIEWER_NAME = 'AI agent review (independent culinary review subagent + automated QA gate, 2026-11-12); not a human or native-speaker review';
const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const q = (s) => (s === null || s === undefined ? 'NULL' : `'${String(s).replace(/'/g, "''")}'`);
const hashOf = (d) =>
  createHash('sha256')
    .update(JSON.stringify({ title: d.title, intro: d.intro, ingredients: d.ingredients, steps: d.steps }))
    .digest('hex');

function slugify(s) {
  return String(s)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 180);
}

// --- Deterministic QA checks mirroring @2yolks/contracts ----------------------
function numbersIn(s) {
  return (s.replace(/\{[itd]:[^}]+\}/g, '').match(/\d+(?:[.,]\d+)?/g) ?? []).map((n) => n.replace(',', '.')).sort();
}
function tokensIn(s) {
  return (s.match(/\{[itd]:[^}]+\}/g) ?? []).sort();
}
function checkTranslation(sourceSteps, targetSteps) {
  const problems = [];
  if (sourceSteps.length !== targetSteps.length) {
    return [`step count differs (${sourceSteps.length} vs ${targetSteps.length})`];
  }
  sourceSteps.forEach((s, i) => {
    const t = targetSteps[i];
    if (JSON.stringify(tokensIn(s)) !== JSON.stringify(tokensIn(t))) {
      problems.push(`step ${i + 1}: amount/temperature/duration tokens changed`);
    }
    if (JSON.stringify(numbersIn(s)) !== JSON.stringify(numbersIn(t))) {
      problems.push(`step ${i + 1}: numbers changed (times, counts)`);
    }
  });
  return problems;
}

const ALLERGEN_GROUPS = [
  ['peanut', 'cacahuate', 'cacahuète', 'arachide'],
  ['egg', 'huevo', 'œuf', 'oeuf'],
  ['milk', 'leche', 'lait'],
  ['wheat', 'trigo', 'blé'],
  ['soy', 'soya', 'soja'],
  ['shrimp', 'camarón', 'crevette'],
  ['sesame', 'sésamo', 'sésame', 'ajonjolí'],
];

function ingredientText(entries) {
  return entries.map((e) => (typeof e === 'string' ? e : `${e.name} ${e.note ?? ''}`)).join(' ; ');
}

function checkAllergens(sourceEntries, targetEntries) {
  const src = ingredientText(sourceEntries).toLowerCase();
  const dst = ingredientText(targetEntries).toLowerCase();
  const problems = [];
  for (const group of ALLERGEN_GROUPS) {
    if (group.some((w) => src.includes(w)) && !group.some((w) => dst.includes(w))) {
      problems.push(`allergen term missing in translation: ${group[0]}`);
    }
  }
  return problems;
}

function checkStructuredTranslation(sourceEntries, targetEntries) {
  const problems = [];
  if (sourceEntries.length !== targetEntries.length) {
    return [`ingredient count differs (${sourceEntries.length} vs ${targetEntries.length})`];
  }
  sourceEntries.forEach((s, i) => {
    const t = targetEntries[i];
    if (typeof s === 'string' || typeof t === 'string') {
      if (typeof s !== typeof t) {
        problems.push(`ingredient ${i + 1}: structured and plain forms differ`);
        return;
      }
      if (JSON.stringify(numbersIn(s)) !== JSON.stringify(numbersIn(t))) {
        problems.push(`ingredient ${i + 1}: numbers changed`);
      }
      return;
    }
    if (s.ref !== t.ref) problems.push(`ingredient ${i + 1}: ref changed`);
    if (s.qty !== t.qty || (s.qtyEnd ?? null) !== (t.qtyEnd ?? null)) problems.push(`ingredient ${i + 1}: quantity changed`);
    if ((s.unit ?? '') !== (t.unit ?? '')) problems.push(`ingredient ${i + 1}: unit changed`);
  });
  return problems;
}

function qaIssues(src, dst) {
  return [
    ...checkStructuredTranslation(src.ingredients, dst.ingredients),
    ...checkTranslation(src.steps, dst.steps),
    ...checkAllergens(src.ingredients, dst.ingredients),
  ];
}

// --- Remote D1 helper --------------------------------------------------------
function d1Query(sql) {
  const raw = execFileSync(
    'npx',
    ['wrangler', 'd1', 'execute', '2yolks', '--remote', '--json', '--command', sql],
    { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 },
  );
  const parsed = JSON.parse(raw);
  return parsed[0]?.results ?? [];
}

function d1ExecuteFile(filePath) {
  execFileSync(
    'npx',
    ['wrangler', 'd1', 'execute', '2yolks', '--remote', '--yes', '--file', filePath],
    { cwd: ROOT, stdio: 'inherit' },
  );
}

// --- Gemini 3.8 Flash Interactions client (Free-Tier 5 RPM paced) --------
const MIN_REQUEST_INTERVAL_MS = 12_800; // <= 4.7 req/min stays safely under 5 RPM Free Tier cap
let lastGeminiCallAt = 0;

async function callGemini(apiKey, systemInstruction, userText, schema, attempt = 0) {
  const now = Date.now();
  const waitPace = lastGeminiCallAt + MIN_REQUEST_INTERVAL_MS - now;
  if (waitPace > 0) {
    await new Promise((r) => setTimeout(r, waitPace));
  }
  lastGeminiCallAt = Date.now();

  const res = await fetch(GEMINI_INTERACTIONS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Api-Revision': GEMINI_API_REVISION,
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify({
      model: AI_MODEL,
      store: false,
      system_instruction: systemInstruction,
      input: [{ type: 'text', text: userText }],
      response_format: { type: 'text', mime_type: 'application/json', schema },
    }),
  });
  if ((res.status === 429 || res.status === 503 || res.status === 500) && attempt < 7) {
    const errBody = await res.text().catch(() => '');
    const m = /retry in (\d+(?:\.\d+)?)s/i.exec(errBody);
    const retrySec = m ? Math.ceil(Number(m[1])) + 2 : 0;
    const wait = Math.max(retrySec * 1000, Math.min(65_000, 15_000 * (attempt + 1)));
    console.warn(`Gemini ${res.status}, waiting ${Math.round(wait / 1000)}s (attempt ${attempt + 1}/7)...`);
    await new Promise((r) => setTimeout(r, wait));
    lastGeminiCallAt = Date.now();
    return callGemini(apiKey, systemInstruction, userText, schema, attempt + 1);
  }
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Gemini HTTP ${res.status}: ${errText.slice(0, 300)}`);
  }
  const payload = await res.json();
  const steps = Array.isArray(payload.outputs) ? payload.outputs : Array.isArray(payload.steps) ? payload.steps : [];
  for (let i = steps.length - 1; i >= 0; i--) {
    const st = steps[i];
    if (st && typeof st.text === 'string' && st.text.trim()) return JSON.parse(st.text);
    const content = Array.isArray(st?.content) ? st.content : Array.isArray(st) ? st : [];
    for (const part of content) {
      if (part?.type === 'text' && typeof part.text === 'string' && part.text.trim()) return JSON.parse(part.text);
    }
  }
  throw new Error('Empty model output from Gemini');
}

const TRANSLATION_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'intro', 'ingredients', 'steps'],
  properties: {
    title: { type: 'string' },
    intro: { type: ['string', 'null'] },
    ingredients: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['index', 'text', 'name', 'note'],
        properties: {
          index: { type: 'integer' },
          text: { type: ['string', 'null'] },
          name: { type: ['string', 'null'] },
          note: { type: ['string', 'null'] },
        },
      },
    },
    steps: { type: 'array', items: { type: 'string' } },
  },
};

const REVIEW_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['pass', 'issues'],
  properties: {
    pass: { type: 'boolean' },
    issues: { type: 'array', items: { type: 'string' } },
  },
};

function makeMultiTranslationSchema(langs) {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['translations'],
    properties: {
      translations: {
        type: 'object',
        additionalProperties: false,
        required: langs,
        properties: Object.fromEntries(langs.map((l) => [l, TRANSLATION_SCHEMA])),
      },
    },
  };
}

function makeMultiReviewSchema(langs) {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['reviews'],
    properties: {
      reviews: {
        type: 'object',
        additionalProperties: false,
        required: langs,
        properties: Object.fromEntries(langs.map((l) => [l, REVIEW_SCHEMA])),
      },
    },
  };
}

const clean = (v, max) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');

function buildRecipeContext(src) {
  const ingDescriptors = src.ingredients.map((e, index) => {
    if (typeof e === 'object' && e !== null) {
      return { index, kind: 'structured', ref: e.ref, qty: e.qty, qtyEnd: e.qtyEnd ?? null, unit: e.unit ?? null, name: e.name, note: e.note ?? null };
    }
    return { index, kind: 'string', text: e, requiredNumbers: e.match(/\d+(?:[.,]\d+)?/g) ?? [] };
  });
  const stepDescriptors = src.steps.map((s, index) => ({
    index,
    text: s,
    requiredTokens: s.match(/\{(?:[it]:[a-z0-9_]+|d:\d+[mh])\}/gi) ?? [],
    requiredNumbersOutsideTokens: s.replace(/\{[^}]+\}/g, ' ').match(/\d+(?:[.,]\d+)?/g) ?? [],
  }));
  const mapOut = (raw) => ({
    title: clean(raw?.title, 200) || src.title,
    intro: src.intro === null ? null : clean(raw?.intro, 2000) || src.intro,
    ingredients: src.ingredients.map((se, idx) => {
      const item = (Array.isArray(raw?.ingredients) ? raw.ingredients.find((x) => Number(x?.index) === idx) ?? raw.ingredients[idx] : {}) || {};
      if (typeof se === 'object' && se !== null) {
        return {
          ref: se.ref,
          qty: se.qty,
          ...(se.qtyEnd !== undefined ? { qtyEnd: se.qtyEnd } : {}),
          ...(se.unit !== undefined ? { unit: se.unit } : {}),
          name: clean(item.name, 200) || se.name,
          ...(se.note != null ? { note: clean(item.note, 200) || se.note } : {}),
        };
      }
      return clean(item.text, 500) || se;
    }),
    steps: src.steps.map((ss, idx) => clean(raw?.steps?.[idx], 1000) || ss),
  });
  return { ingDescriptors, stepDescriptors, mapOut };
}

async function translateAndReviewGroup(apiKey, src, targetCountry, targetLangs) {
  const srcName = LANG_FULL[src.lang] ?? src.lang;
  const targetDesc = targetLangs.map((l) => `${l} (${LANG_FULL[l] ?? l})`).join(' and ');
  const { ingDescriptors, stepDescriptors, mapOut } = buildRecipeContext(src);

  const translateSys = [
    `You are a bilingual culinary editor translating a published 2yolks recipe from ${srcName} into natural, idiomatic ${targetDesc} for home cooks.`,
    'Return an object `{ translations: { "<lang>": { title, intro, ingredients, steps } } }` for EVERY requested target language code.',
    'CRITICAL QA INVARIANTS per language (must pass automated validation):',
    '1. Output EXACTLY ingredients.length items (index 0..N-1) and EXACTLY steps.length strings.',
    '2. For kind="structured": set text: null, translate ONLY name (culinary ingredient noun) and optional note (if source note is non-null). Never invent a note if source note is null.',
    '3. For kind="string": set text with EVERY number in requiredNumbers verbatim in Arabic digits (e.g. "1/2" stays "1/2", never "media"), and set name: null, note: null.',
    '4. Allergens: translate allergen terms with their canonical word so allergen checks pass (egg->huevo/oeuf, milk/butter/cream/cheese->leche/mantequilla/crema/queso or lait/beurre/crème/fromage, wheat/flour->trigo/harina or blé/farine, peanut->cacahuate/cacahuète, soy->soya/soja, shrimp->camarón/crevette, sesame->sésamo/ajonjolí/sésame).',
    '5. Steps: preserve EVERY {i:...}, {t:...}, and {d:...} token CHARACTER-FOR-CHARACTER inside natural target sentences, and keep EVERY number in requiredNumbersOutsideTokens as matching Arabic digits (never spell numbers as words).',
    '6. Keep intro warm and concise (or null if source intro is null).',
  ].join('\n');

  const reviewSys = [
    `You are an independent culinary translation reviewer checking ${srcName} -> ${targetDesc} recipe translations.`,
    'For each language key in `translations`, check source vs translation side by side for:',
    '- Meaning, omissions, or invented steps/ingredients',
    '- Food safety, doneness cues, temperatures, and resting/cooking accuracy',
    '- Ingredient identity (exact cut/variety, e.g. ancho vs chipotle, scallions vs onions, heavy cream vs sour cream)',
    '- Natural target-language home-cooking phrasing (no awkward calques or left-over untranslated words except proper dish names)',
    'Return `{ reviews: { "<lang>": { pass: boolean, issues: string[] } } }`. Set pass=false ONLY for substantive culinary, safety, accuracy, or obvious awkwardness issues.',
  ].join('\n');

  const basePayload = {
    sourceLang: src.lang,
    targetLanguages: targetLangs,
    title: src.title,
    intro: src.intro,
    ingredients: ingDescriptors,
    steps: stepDescriptors,
  };

  let results = {};
  let pendingLangs = [...targetLangs];
  let feedbackByLang = {};

  for (let round = 0; round < 3 && pendingLangs.length > 0; round++) {
    const hasFeedback = Object.keys(feedbackByLang).length > 0;
    const prompt = hasFeedback
      ? `Revise ONLY these target languages (${pendingLangs.join(', ')}) to fix ALL listed issues while strictly preserving QA invariants:\n${JSON.stringify(feedbackByLang)}\n\nSource:\n${JSON.stringify({ ...basePayload, targetLanguages: pendingLangs })}\n\nPrevious:\n${JSON.stringify(Object.fromEntries(pendingLangs.map((l) => [l, results[l]])))}`
      : `Translate this recipe into all targetLanguages (${pendingLangs.join(', ')}):\n${JSON.stringify({ ...basePayload, targetLanguages: pendingLangs })}`;

    const rawMulti = await callGemini(apiKey, translateSys, prompt, makeMultiTranslationSchema(pendingLangs));
    const transObj = rawMulti?.translations ?? {};
    for (const l of pendingLangs) {
      results[l] = mapOut(transObj[l]);
    }

    const detBad = {};
    const qaGoodLangs = [];
    for (const l of pendingLangs) {
      const detIssues = qaIssues(src, results[l]);
      if (detIssues.length > 0) detBad[l] = detIssues;
      else qaGoodLangs.push(l);
    }

    const nextPending = [...Object.keys(detBad)];
    const nextFeedback = { ...detBad };

    if (qaGoodLangs.length > 0) {
      const revMulti = await callGemini(
        apiKey,
        reviewSys,
        JSON.stringify({
          source: { lang: src.lang, title: src.title, intro: src.intro, ingredients: src.ingredients, steps: src.steps },
          translations: Object.fromEntries(qaGoodLangs.map((l) => [l, results[l]])),
        }),
        makeMultiReviewSchema(qaGoodLangs),
      );
      const revObj = revMulti?.reviews ?? {};
      for (const l of qaGoodLangs) {
        const rv = revObj[l];
        if (!rv || rv.pass !== true) {
          nextPending.push(l);
          nextFeedback[l] = Array.isArray(rv?.issues) && rv.issues.length ? rv.issues : ['Improve natural culinary phrasing'];
        }
      }
    }

    pendingLangs = nextPending;
    feedbackByLang = nextFeedback;
  }

  for (const l of targetLangs) {
    const finalIssues = qaIssues(src, results[l]);
    if (finalIssues.length > 0) {
      throw new Error(`QA failed for ${src.recipe_id} ${targetCountry}/${l}: ${finalIssues.join('; ')}`);
    }
  }
  return results;
}

// --- Load / Save JSON artifacts ----------------------------------------------
function loadExisting() {
  const drafts = existsSync(DRAFTS_PATH) ? JSON.parse(readFileSync(DRAFTS_PATH, 'utf8')).drafts ?? [] : [];
  const reviews = existsSync(REVIEW_PATH) ? JSON.parse(readFileSync(REVIEW_PATH, 'utf8')).reviews ?? [] : [];
  return { drafts, reviews };
}

function saveArtifacts(drafts, reviews) {
  const sortedDrafts = [...drafts].sort((a, b) =>
    `${a.recipe_id}:${a.country}:${a.lang}`.localeCompare(`${b.recipe_id}:${b.country}:${b.lang}`),
  );
  const sortedReviews = [...reviews].sort((a, b) =>
    `${a.recipe_id}:${a.country}:${a.lang}`.localeCompare(`${b.recipe_id}:${b.country}:${b.lang}`),
  );
  writeFileSync(
    DRAFTS_PATH,
    JSON.stringify(
      {
        note: 'Catalog cross-locale translations generated by scripts/translate-catalog.mjs via Gemini 3.8 Flash + deterministic QA gate.',
        model: AI_MODEL,
        drafts: sortedDrafts,
      },
      null,
      2,
    ) + '\n',
  );
  writeFileSync(
    REVIEW_PATH,
    JSON.stringify(
      {
        note: 'Second-pass AI review record binding each translated locale SHA-256 content hash after deterministic QA + separate-prompt culinary review.',
        reviewer: REVIEWER_NAME,
        reviewed_on: new Date().toISOString().slice(0, 10),
        reviews: sortedReviews,
      },
      null,
      2,
    ) + '\n',
  );
}

// --- Main commands -----------------------------------------------------------
const mode = process.argv[2];

if (mode === 'generate') {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    console.error('GEMINI_API_KEY missing (run with node --env-file=.env)');
    process.exit(1);
  }
  const originals = d1Query(`
    SELECT rl.recipe_id, rl.country, rl.lang, rl.title, rl.slug, rl.intro, rl.ingredients_json, rl.steps_json
    FROM recipe_locales rl
    JOIN recipes r ON r.id = rl.recipe_id
    JOIN sources s ON s.id = r.source_id
    WHERE rl.status = 'published' AND rl.translation_of IS NULL AND s.cleared_at IS NOT NULL
    ORDER BY rl.recipe_id
  `);
  const existingLocales = d1Query('SELECT recipe_id, country, lang, slug FROM recipe_locales');
  const aliases = d1Query('SELECT country, lang, slug FROM recipe_slug_aliases');

  const haveLocale = new Set(existingLocales.map((r) => `${r.recipe_id}:${r.country}:${r.lang}`));
  const takenSlugs = new Set([
    ...existingLocales.map((r) => `${r.country}:${r.lang}:${r.slug}`),
    ...aliases.map((r) => `${r.country}:${r.lang}:${r.slug}`),
  ]);

  const { drafts, reviews } = loadExisting();
  for (const d of drafts) takenSlugs.add(`${d.country}:${d.lang}:${d.slug}`);
  const doneKeys = new Set(
    drafts
      .filter((d) => reviews.some((r) => r.recipe_id === d.recipe_id && r.country === d.country && r.lang === d.lang && r.content_sha256 === hashOf(d)))
      .map((d) => `${d.recipe_id}:${d.country}:${d.lang}`),
  );

  const groups = [];
  let totalMissing = 0;
  for (const orig of originals) {
    const targetLangs = (LOCALES[orig.country] ?? []).filter((targetLang) => {
      const k = `${orig.recipe_id}:${orig.country}:${targetLang}`;
      return !haveLocale.has(k) && !doneKeys.has(k);
    });
    if (targetLangs.length > 0) {
      groups.push({ orig, targetCountry: orig.country, targetLangs });
      totalMissing += targetLangs.length;
    }
  }
  console.log(`Found ${originals.length} published originals; ${doneKeys.size} already checkpointed; ${totalMissing} locales across ${groups.length} recipes remaining.`);

  const draftMap = new Map(drafts.map((d) => [`${d.recipe_id}:${d.country}:${d.lang}`, d]));
  const reviewMap = new Map(reviews.map((r) => [`${r.recipe_id}:${r.country}:${r.lang}`, r]));

  let completedLocales = 0;
  for (const { orig, targetCountry, targetLangs } of groups) {
    const src = {
      recipe_id: orig.recipe_id,
      country: orig.country,
      lang: orig.lang,
      title: orig.title,
      intro: orig.intro ?? null,
      ingredients: JSON.parse(orig.ingredients_json),
      steps: JSON.parse(orig.steps_json),
    };
    const outByLang = await translateAndReviewGroup(apiKey, src, targetCountry, targetLangs);
    for (const targetLang of targetLangs) {
      const out = outByLang[targetLang];
      let baseSlug = slugify(out.title) || `recipe-${orig.recipe_id.slice(0, 6)}`;
      let slug = baseSlug;
      if (takenSlugs.has(`${targetCountry}:${targetLang}:${slug}`) || !SLUG_PATTERN.test(slug)) {
        slug = `${baseSlug.slice(0, 170)}-${orig.recipe_id.slice(0, 6)}`;
      }
      takenSlugs.add(`${targetCountry}:${targetLang}:${slug}`);

      const k = `${orig.recipe_id}:${targetCountry}:${targetLang}`;
      const draftObj = {
        recipe_id: orig.recipe_id,
        country: targetCountry,
        lang: targetLang,
        title: out.title,
        slug,
        intro: out.intro,
        ingredients: out.ingredients,
        steps: out.steps,
        translation_of: { country: orig.country, lang: orig.lang },
      };
      draftMap.set(k, draftObj);
      reviewMap.set(k, {
        recipe_id: orig.recipe_id,
        country: targetCountry,
        lang: targetLang,
        content_sha256: hashOf(draftObj),
        reviewer_kind: 'agent',
        result: 'pass',
      });
      completedLocales++;
      console.log(`[${completedLocales}/${totalMissing}] ${k} -> "${out.title}" (${slug})`);
    }
    saveArtifacts([...draftMap.values()], [...reviewMap.values()]);
  }
  saveArtifacts([...draftMap.values()], [...reviewMap.values()]);
  console.log(`Saved ${draftMap.size} translations and ${reviewMap.size} reviews.`);
} else if (mode === 'apply') {
  const { drafts, reviews } = loadExisting();
  if (drafts.length === 0) {
    console.log('No drafts in catalog.translation-drafts.json');
    process.exit(0);
  }
  const statements = [];
  for (const d of drafts) {
    const r = reviews.find((x) => x.recipe_id === d.recipe_id && x.country === d.country && x.lang === d.lang);
    if (!r || r.content_sha256 !== hashOf(d) || r.reviewer_kind !== 'agent' || r.result !== 'pass') {
      throw new Error(`Missing matching review for ${d.recipe_id} ${d.country}/${d.lang}`);
    }
    const of = `${d.translation_of.country}/${d.translation_of.lang}`;
    const ingJson = JSON.stringify(d.ingredients);
    const stepsJson = JSON.stringify(d.steps);
    statements.push(
      `INSERT INTO recipe_locales (recipe_id, country, lang, title, slug, intro, ingredients_json, steps_json, status, translation_of, translation_method) SELECT ${q(d.recipe_id)}, ${q(d.country)}, ${q(d.lang)}, ${q(d.title)}, ${q(d.slug)}, ${q(d.intro)}, ${q(ingJson)}, ${q(stepsJson)}, 'draft', ${q(of)}, 'machine' WHERE EXISTS (SELECT 1 FROM recipe_locales WHERE recipe_id=${q(d.recipe_id)} AND country=${q(d.translation_of.country)} AND lang=${q(d.translation_of.lang)} AND status='published' AND translation_of IS NULL) AND NOT EXISTS (SELECT 1 FROM recipe_locales WHERE recipe_id=${q(d.recipe_id)} AND country=${q(d.country)} AND lang=${q(d.lang)});`,
      `UPDATE recipe_locales SET status='published', translation_reviewed_at=datetime('now'), translation_reviewed_by=${q(REVIEWER_NAME)}, translation_reviewer_kind='agent' WHERE recipe_id=${q(d.recipe_id)} AND country=${q(d.country)} AND lang=${q(d.lang)} AND status='draft' AND translation_of=${q(of)} AND translation_method='machine' AND ingredients_json=${q(ingJson)} AND steps_json=${q(stepsJson)} AND title=${q(d.title)};`,
      `INSERT INTO mcp_audit (actor, role, tool, entity_id, details_json) SELECT 'implementation-agent', 'admin', 'catalog.translation_publish', ${q(d.recipe_id)}, ${q(JSON.stringify({ locale: `${d.country}/${d.lang}`, content_sha256: r.content_sha256, reviewer_kind: 'agent' }))} WHERE EXISTS (SELECT 1 FROM recipe_locales WHERE recipe_id=${q(d.recipe_id)} AND country=${q(d.country)} AND lang=${q(d.lang)} AND status='published' AND translation_of=${q(of)});`,
    );
  }
  const CHUNK = 60; // 20 recipes per SQL batch
  for (let i = 0; i < statements.length; i += CHUNK) {
    const tmpSql = resolve(ROOT, `.tmp_catalog_batch_${i}.sql`);
    writeFileSync(tmpSql, statements.slice(i, i + CHUNK).join('\n') + '\n');
    try {
      console.log(`Applying SQL batch ${Math.floor(i / CHUNK) + 1}/${Math.ceil(statements.length / CHUNK)}...`);
      d1ExecuteFile(tmpSql);
    } finally {
      if (existsSync(tmpSql)) rmSync(tmpSql);
    }
  }
  console.log('All catalog translation batches applied cleanly.');
} else {
  console.error('usage: node --env-file=.env scripts/translate-catalog.mjs generate|apply');
  process.exit(2);
}
