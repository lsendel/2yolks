// Multimodal AI Kitchen Co-Editor (Gemini 3.8 Flash via official Interactions API)
// + atomic D1 free-tier budget guard (ai_log) + zero-network deterministic fallback.
import {
  isRecipeCategorySlug,
  RECIPE_CATEGORY_SLUGS,
  type RecipeCategorySlug,
  type IngredientEntry,
  type StructuredIngredient,
  isStructured,
  ingredientText,
  checkTranslation,
  checkStructuredTranslation,
  checkAllergens,
} from '@2yolks/contracts';
import { parseRecipeText } from './parse';

export const AI_MODEL = 'gemini-3.8-flash';
export const GEMINI_INTERACTIONS_URL = 'https://generativelanguage.googleapis.com/v1beta/interactions';
export const GEMINI_API_REVISION = '2026-05-20';
export const DEFAULT_AI_DAILY_CAP = 40;
export const DEFAULT_AI_USER_10MIN_CAP = 6;

const ALLOWED_IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const ALLOWED_AUDIO_MIMES = new Set(['audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/wav', 'audio/ogg']);
const MAX_MEDIA_BASE64_LEN = 800_000; // ~600 KB raw binary

export interface AiMediaPart {
  mimeType: string;
  data: string;
}

export interface AiDraftInput {
  title?: string;
  category?: string;
  intro?: string;
  ingredients?: string[];
  steps?: string[];
  prep?: string;
  cook?: string;
  servings?: string;
}

export interface AiAssistRequest {
  mode: 'extract' | 'polish' | 'translate';
  uiLang: 'en' | 'es' | 'fr';
  recipeLocale: string;
  targetLocale?: string;
  notes?: string;
  image?: AiMediaPart | null;
  audio?: AiMediaPart | null;
  draft?: AiDraftInput;
}

export interface AiFollowUpQuestion {
  id: string;
  question: string;
  field: 'ingredients' | 'steps' | 'servings' | 'prepMinutes' | 'cookMinutes';
  quickChoices: string[];
}

export interface AiAssistResult {
  provider: 'gemini' | 'deterministic';
  recipe: {
    title: string;
    category: RecipeCategorySlug | '';
    intro: string;
    ingredients: string[];
    steps: string[];
    prepMinutes: number | null;
    cookMinutes: number | null;
    servings: number | null;
  };
  improvements: string[];
  followUpQuestions: AiFollowUpQuestion[];
}

const makeId = () => crypto.randomUUID().replace(/-/g, '').slice(0, 16);

/**
 * Atomically reserves one AI invocation in D1 against BOTH the per-user 10-minute
 * window cap and the global rolling 24-hour free-tier budget cap.
 */
export async function reserveAiBudget(
  db: D1Database,
  userId: string,
  kind: 'extract' | 'polish' | 'translate',
  dailyCap = DEFAULT_AI_DAILY_CAP,
  perUserWindowCap = DEFAULT_AI_USER_10MIN_CAP,
): Promise<boolean> {
  const now = Date.now();
  try {
    await db.prepare('DELETE FROM ai_log WHERE created_at < ?').bind(now - 2 * 86_400_000).run();
  } catch {
    // Housekeeping must never block a valid request if cleanup races.
  }
  const res = await db
    .prepare(
      `INSERT INTO ai_log (id, user_id, kind, created_at)
       SELECT ?, ?, ?, ?
       WHERE (SELECT count(*) FROM ai_log WHERE user_id = ? AND created_at > ?) < ?
         AND (SELECT count(*) FROM ai_log WHERE created_at > ?) < ?`,
    )
    .bind(
      makeId(),
      userId,
      kind,
      now,
      userId,
      now - 10 * 60_000,
      perUserWindowCap,
      now - 86_400_000,
      dailyCap,
    )
    .run();
  return res.meta.changes === 1;
}

export function sanitizeMediaPart(raw: unknown, kind: 'image' | 'audio'): AiMediaPart | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const mimeType = typeof o['mimeType'] === 'string' ? o['mimeType'].split(';')[0]!.trim().toLowerCase() : '';
  const data = typeof o['data'] === 'string' ? o['data'].replace(/\s+/g, '') : '';
  const allowed = kind === 'image' ? ALLOWED_IMAGE_MIMES : ALLOWED_AUDIO_MIMES;
  if (!allowed.has(mimeType)) return null;
  if (!data || data.length > MAX_MEDIA_BASE64_LEN || !/^[A-Za-z0-9+/=]+$/.test(data)) return null;
  return { mimeType, data };
}

const RESPONSE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'category', 'intro', 'ingredients', 'steps', 'prepMinutes', 'cookMinutes', 'servings', 'improvements', 'followUpQuestions'],
  properties: {
    title: { type: 'string', description: 'Concise, appetizing dish title in the recipe language.' },
    category: {
      type: 'string',
      enum: ['', ...RECIPE_CATEGORY_SLUGS],
      description: 'Best matching 2yolks category slug, or empty string if uncertain.',
    },
    intro: { type: 'string', description: 'Warm 1-2 sentence headnote preserving the cook’s own voice (no SEO fluff).' },
    ingredients: {
      type: 'array',
      items: { type: 'string' },
      description: 'Ingredients, one per item, each starting with a numeric quantity and unit where possible (e.g. "250 g all-purpose flour" or "1/2 yellow onion, finely diced").',
    },
    steps: {
      type: 'array',
      items: { type: 'string' },
      description: 'Clear single-action cooking steps optimized for step-by-step Cook Mode, including heat levels and sensory doneness cues.',
    },
    prepMinutes: { type: ['integer', 'null'] },
    cookMinutes: { type: ['integer', 'null'] },
    servings: { type: ['number', 'null'] },
    improvements: {
      type: 'array',
      items: { type: 'string' },
      description: 'Short bullet notes (in uiLang) explaining what was structured or clarified.',
    },
    followUpQuestions: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'question', 'field', 'quickChoices'],
        properties: {
          id: { type: 'string' },
          question: { type: 'string' },
          field: { type: 'string', enum: ['ingredients', 'steps', 'servings', 'prepMinutes', 'cookMinutes'] },
          quickChoices: { type: 'array', items: { type: 'string' } },
        },
      },
      description: 'Up to 3 friendly follow-up questions (in uiLang) for genuinely missing critical details like oven temperature, pan size, liquid amount, or servings.',
    },
  },
};

function cleanLine(s: unknown, max = 500): string {
  return typeof s === 'string'
    ? s.replace(/^\s*(?:[-*•·▪◦]|\d{1,3}[.)])\s*/, '').replace(/\s+/g, ' ').trim().slice(0, max)
    : '';
}

function normalizeModelOutput(raw: unknown, fallbackDraft?: AiDraftInput): AiAssistResult['recipe'] & { improvements: string[]; followUpQuestions: AiFollowUpQuestion[] } {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const catRaw = typeof o['category'] === 'string' ? o['category'].trim() : '';
  const category: RecipeCategorySlug | '' = isRecipeCategorySlug(catRaw) ? catRaw : (isRecipeCategorySlug(fallbackDraft?.category ?? '') ? (fallbackDraft!.category as RecipeCategorySlug) : '');
  const title = cleanLine(o['title'], 200) || cleanLine(fallbackDraft?.title, 200);
  const intro = cleanLine(o['intro'], 1200) || cleanLine(fallbackDraft?.intro, 1200);
  const ingredients = Array.isArray(o['ingredients'])
    ? o['ingredients'].map((x) => cleanLine(x, 300)).filter(Boolean).slice(0, 60)
    : (fallbackDraft?.ingredients ?? []).map((x) => cleanLine(x, 300)).filter(Boolean);
  const steps = Array.isArray(o['steps'])
    ? o['steps'].map((x) => cleanLine(x, 800)).filter(Boolean).slice(0, 50)
    : (fallbackDraft?.steps ?? []).map((x) => cleanLine(x, 800)).filter(Boolean);
  const numOrNull = (v: unknown, max: number): number | null => {
    const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
    return Number.isFinite(n) && n > 0 && n <= max ? Math.round(n * 10) / 10 : null;
  };
  const prepMinutes = numOrNull(o['prepMinutes'], 20000);
  const cookMinutes = numOrNull(o['cookMinutes'], 20000);
  const servings = numOrNull(o['servings'], 1000);
  const improvements = Array.isArray(o['improvements'])
    ? o['improvements'].map((x) => cleanLine(x, 240)).filter(Boolean).slice(0, 5)
    : [];
  const validFields = new Set(['ingredients', 'steps', 'servings', 'prepMinutes', 'cookMinutes']);
  const followUpQuestions: AiFollowUpQuestion[] = Array.isArray(o['followUpQuestions'])
    ? o['followUpQuestions']
        .map((q, idx): AiFollowUpQuestion | null => {
          if (!q || typeof q !== 'object') return null;
          const qo = q as Record<string, unknown>;
          const question = cleanLine(qo['question'], 240);
          if (!question) return null;
          const field = typeof qo['field'] === 'string' && validFields.has(qo['field'])
            ? (qo['field'] as AiFollowUpQuestion['field'])
            : 'steps';
          const quickChoices = Array.isArray(qo['quickChoices'])
            ? qo['quickChoices'].map((c) => cleanLine(c, 80)).filter(Boolean).slice(0, 4)
            : [];
          return {
            id: cleanLine(qo['id'], 40) || `q${idx + 1}`,
            question,
            field,
            quickChoices,
          };
        })
        .filter((x): x is AiFollowUpQuestion => x !== null)
        .slice(0, 3)
    : [];

  return { title, category, intro, ingredients, steps, prepMinutes, cookMinutes, servings, improvements, followUpQuestions };
}

function extractInteractionText(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const obj = payload as Record<string, unknown>;
  if (typeof obj['output_text'] === 'string' && obj['output_text'].trim()) {
    return obj['output_text'].trim();
  }
  if (Array.isArray(obj['outputs'])) {
    for (const out of obj['outputs']) {
      if (out && typeof out === 'object' && typeof (out as Record<string, unknown>)['text'] === 'string') {
        return ((out as Record<string, unknown>)['text'] as string).trim();
      }
    }
  }
  if (Array.isArray(obj['steps'])) {
    for (let i = obj['steps'].length - 1; i >= 0; i--) {
      const step = obj['steps'][i] as Record<string, unknown> | undefined;
      if (!step || step['type'] !== 'model_output' || !Array.isArray(step['content'])) continue;
      for (const part of step['content']) {
        if (part && typeof part === 'object' && (part as Record<string, unknown>)['type'] === 'text') {
          const text = (part as Record<string, unknown>)['text'];
          if (typeof text === 'string' && text.trim()) return text.trim();
        }
      }
    }
  }
  return null;
}

export async function assistRecipeWithGemini(
  req: AiAssistRequest,
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
): Promise<AiAssistResult> {
  const recipeLang = (req.recipeLocale.split(':')[1] || req.uiLang || 'en').slice(0, 5);
  const systemInstruction = [
    'You are the 2yolks Kitchen Co-Editor, an expert culinary editor helping home cooks capture and refine their own original recipes.',
    `Write recipe fields (title, intro, ingredients, steps) in language "${recipeLang}".`,
    `Write feedback fields (improvements, followUpQuestions, quickChoices) in UI language "${req.uiLang}".`,
    'Rules:',
    '1. Preserve the cook’s authentic culinary voice—never invent fake blog backstory or generic filler.',
    '2. Every ingredient line MUST start with a clear numeric quantity when known (prefer metric grams/ml or unambiguous counts; avoid bare unquantified lines unless truly "to taste").',
    '3. Split dense multi-action paragraphs into crisp, single-action steps suitable for mobile Cook Mode, keeping heat levels and visual/aroma doneness cues.',
    '4. NEVER invent critical missing facts (such as oven temperature, baking time, or missing amounts). If a critical detail is missing or ambiguous, ask up to 3 concise followUpQuestions with 2-3 clickable quickChoices.',
    '5. Never reproduce copyrighted headnotes verbatim; summarize techniques cleanly in original home-kitchen prose.',
  ].join('\n');

  const promptParts: string[] = [
    `Mode: ${req.mode}`,
    `Target recipe locale: ${req.recipeLocale}`,
  ];
  if (req.notes?.trim()) {
    promptParts.push(`Cook's rough notes:\n${req.notes.trim().slice(0, 12_000)}`);
  }
  if (req.draft) {
    promptParts.push(`Current form draft JSON:\n${JSON.stringify(req.draft)}`);
  }
  const input: Record<string, unknown>[] = [{ type: 'text', text: promptParts.join('\n\n') }];
  if (req.image) {
    input.push({ type: 'image', data: req.image.data, mime_type: req.image.mimeType });
  }
  if (req.audio) {
    input.push({ type: 'audio', data: req.audio.data, mime_type: req.audio.mimeType });
  }

  const res = await fetchImpl(GEMINI_INTERACTIONS_URL, {
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
      input,
      response_format: {
        type: 'text',
        mime_type: 'application/json',
        schema: RESPONSE_SCHEMA,
      },
    }),
  });

  if (!res.ok) {
    throw new Error(`Gemini Interactions API status ${res.status}`);
  }
  const payload = await res.json();
  const text = extractInteractionText(payload);
  if (!text) {
    throw new Error('Empty model output from Gemini Interactions API');
  }
  const parsed = JSON.parse(text) as unknown;
  const norm = normalizeModelOutput(parsed, req.draft);
  return {
    provider: 'gemini',
    recipe: {
      title: norm.title,
      category: norm.category,
      intro: norm.intro,
      ingredients: norm.ingredients,
      steps: norm.steps,
      prepMinutes: norm.prepMinutes,
      cookMinutes: norm.cookMinutes,
      servings: norm.servings,
    },
    improvements: norm.improvements,
    followUpQuestions: norm.followUpQuestions,
  };
}

function inferCategory(text: string): RecipeCategorySlug | '' {
  const s = text.toLowerCase();
  if (/\b(soup|stew|pozole|broth|chili|caldo|sopa|guiso|rago[uû]t|bouillon)\b/.test(s)) return 'soups-stews';
  if (/\b(taco|tortilla|enchilada|quesadilla|tostada|tamal|fajita)\b/.test(s)) return 'tacos-tortillas';
  if (/\b(dumpling|potsticker|gyoza|wonton|pierogi|ravioli|empanada)\b/.test(s)) return 'dumplings';
  if (/\b(cookie|cake|brownie|pie|tart|pastry|sweet|chocolate|galleta|pastel|postre|g[aâ]teau|biscuit)\b/.test(s)) return 'desserts-baking';
  if (/\b(wine|cocktail|tea|coffee|smoothie|lemonade|agua fresca|bebida|boisson|ponche)\b/.test(s)) return 'drinks';
  if (/\b(pancake|waffle|omelet|omelette|granola|french toast|desayuno|breakfast)\b/.test(s)) return 'breakfast';
  if (/\b(salsa|guacamole|dip|snack|chips|botana|trempette)\b/.test(s)) return 'snacks-dips';
  if (/\b(salad|slaw|roasted vegetables|ensalada|guarnici[oó]n)\b/.test(s)) return 'sides';
  return '';
}

const QTY_LINE_RE = /^(?:\d+|\u00bc|\u00bd|\u00be|\u2153|\u2154|\u215b)\s*(?:\/\d+|\.\d+)?\s*(?:kg|g|mg|ml|l|oz|lb|lbs|cups?|tbsp|tsp|tablespoons?|teaspoons?|tazas?|cdas?|cdtas?|cucharadas?|tasses?|cloves?|dientes?|gousses?|cans?|latas?|bunche?s?|pinch(?:es)?|pieces?|piezas?|eggs?|huevos?|oeufs?|chiles?|onions?|cebollas?|tomatoes?|tomates?)?\b/i;

/**
 * Smart deterministic recipe structurer & co-editor used when GEMINI_API_KEY is
 * unset in local dev so the full capture & polish UX works offline out of the box.
 */
export function assistRecipeDeterministic(req: AiAssistRequest): AiAssistResult {
  const lang = req.uiLang;
  const notes = (req.notes ?? '').trim();
  const draft = req.draft ?? {};
  let title = cleanLine(draft.title, 200);
  let intro = cleanLine(draft.intro, 1200);
  let ingredients = (draft.ingredients ?? []).map((x) => cleanLine(x, 300)).filter(Boolean);
  let rawSteps = (draft.steps ?? []).map((x) => cleanLine(x, 800)).filter(Boolean);

  if (notes) {
    const parsed = parseRecipeText(notes);
    if (parsed.ingredients.length > 0 || parsed.steps.length > 0) {
      if (!title && parsed.title) title = parsed.title;
      if (!intro && parsed.intro) intro = parsed.intro;
      if (parsed.ingredients.length > 0) ingredients = parsed.ingredients;
      if (parsed.steps.length > 0) rawSteps = parsed.steps;
    } else {
      const rawLines = notes.split(/\r?\n/).map((l) => cleanLine(l, 800)).filter(Boolean);
      const extractedIngs: string[] = [];
      const extractedSteps: string[] = [];
      for (const line of rawLines) {
        if (!title && rawLines.length > 1 && line === rawLines[0] && line.length <= 75 && !/[.!?]$/.test(line) && !QTY_LINE_RE.test(line)) {
          title = line;
          continue;
        }
        if (line.length <= 95 && QTY_LINE_RE.test(line) && !/\b(boil|simmer|bake|fry|blend|roast|cook|stir|heat|hervir|licuar|dorar|hornear|cuire|mijoter)\b/i.test(line)) {
          extractedIngs.push(line);
        } else {
          // Also extract inline quantified items from narrative prose when ingredients list is empty
          const inlineMatches = line.match(/\b\d+(?:\.\d+)?\s*(?:kg|g|ml|l|oz|lb|cups?|tbsp|tsp|tazas?|guajillos?|anchos?|chiles?)\s+[a-zA-ZáéíóúñÁÉÍÓÚÑàâçèéêëîïôûùüÿœæ\s]{2,28}/gi);
          if (inlineMatches && ingredients.length === 0) {
            for (const m of inlineMatches) {
              const cleaned = cleanLine(m.replace(/\b(with|and|con|y|avec|et)\s*$/i, ''), 120);
              if (cleaned && !extractedIngs.includes(cleaned)) extractedIngs.push(cleaned);
            }
          }
          extractedSteps.push(line);
        }
      }
      if (extractedIngs.length > 0 && ingredients.length === 0) ingredients = extractedIngs;
      if (extractedSteps.length > 0) rawSteps = extractedSteps;
    }
  }

  // Split dense multi-sentence paragraphs into crisp Cook Mode steps
  const steps: string[] = [];
  let splitCount = 0;
  for (const s of rawSteps) {
    const parts = s
      .split(/(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÀÂÇÈÉÊË])/)
      .map((p) => cleanLine(p, 600))
      .filter(Boolean);
    if (parts.length > 1) splitCount++;
    for (const p of parts) {
      const sentence = /[.!?]$/.test(p) ? p : `${p}.`;
      steps.push(sentence.charAt(0).toUpperCase() + sentence.slice(1));
    }
  }

  const combinedText = `${title} ${intro} ${notes} ${ingredients.join(' ')} ${steps.join(' ')}`;
  const category = isRecipeCategorySlug(draft.category ?? '')
    ? (draft.category as RecipeCategorySlug)
    : inferCategory(combinedText);

  // Infer cookMinutes & servings if absent
  let cookMinutes = draft.cook && Number(draft.cook) > 0 ? Number(draft.cook) : null;
  if (cookMinutes == null) {
    const minsMatch = /(\d+)\s*(?:min(?:ute)?s?|minutos?)/i.exec(combinedText);
    if (minsMatch) cookMinutes = Number(minsMatch[1]);
  }
  const prepMinutes = draft.prep && Number(draft.prep) > 0 ? Number(draft.prep) : null;
  let servings = draft.servings && Number(draft.servings) > 0 ? Number(draft.servings) : null;
  if (servings == null) {
    const servMatch = /(?:serves?|porciones|portions)\s*:?\s*(\d+)/i.exec(combinedText);
    if (servMatch) servings = Number(servMatch[1]);
  }

  if (!title) {
    title = lang === 'es' ? 'Receta de casa' : lang === 'fr' ? 'Recette maison' : 'Home Kitchen Recipe';
  }

  const improvements: string[] = [];
  if (splitCount > 0) {
    improvements.push(
      lang === 'es'
        ? 'Se dividieron los párrafos largos en pasos individuales para el Modo Cocina.'
        : lang === 'fr'
          ? 'Les paragraphes denses ont été découpés en étapes simples pour le Mode Cuisine.'
          : 'Split multi-action paragraphs into single-step instructions for Cook Mode.',
    );
  }
  if (category && !draft.category) {
    improvements.push(
      lang === 'es'
        ? `Categoría sugerida automáticamente (${category}).`
        : lang === 'fr'
          ? `Catégorie suggérée automatiquement (${category}).`
          : `Suggested dish category (${category}).`,
    );
  }
  if (improvements.length === 0) {
    improvements.push(
      lang === 'es'
        ? 'Formato de ingredientes y pasos normalizado.'
        : lang === 'fr'
          ? 'Format des ingrédients et des étapes normalisé.'
          : 'Normalized ingredient lines and step formatting.',
    );
  }

  const followUpQuestions: AiFollowUpQuestion[] = [];
  const mentionsOven = /\b(bake|baked|oven|roast|hornear|horno|asar|four|r[oô]tir)\b/i.test(combinedText);
  const hasTemp = /\b\d{3}\s*°?\s*[FCfc]\b/.test(combinedText);
  if (mentionsOven && !hasTemp) {
    followUpQuestions.push({
      id: 'oven_temp',
      field: 'steps',
      question:
        lang === 'es'
          ? 'Mencionas hornear, pero falta la temperatura del horno. ¿Cuál usaste?'
          : lang === 'fr'
            ? 'Vous mentionnez une cuisson au four sans préciser la température. Laquelle utilisez-vous ?'
            : 'You mention baking/roasting without an oven temperature — what heat should cooks preheat to?',
      quickChoices: ['180°C (350°F)', '190°C (375°F)', '200°C (400°F)'],
    });
  }

  const missingQty = ingredients.filter((l) => !/^[0-9\u00BC-\u00BE\u2150-\u215E]/.test(l));
  if (missingQty.length > 0) {
    const sample = missingQty[0]!;
    followUpQuestions.push({
      id: 'ing_qty',
      field: 'ingredients',
      question:
        lang === 'es'
          ? `¿Qué cantidad aproximada usas para "${sample}"?`
          : lang === 'fr'
            ? `Quelle quantité approximative utilisez-vous pour « ${sample} » ?`
            : `Roughly how much "${sample}" should a cook measure out?`,
      quickChoices: [`1 tsp ${sample}`, `100 g ${sample}`, `2 ${sample}`],
    });
  }

  if (servings == null && followUpQuestions.length < 3) {
    followUpQuestions.push({
      id: 'servings',
      field: 'servings',
      question:
        lang === 'es'
          ? '¿Para cuántas porciones rinde aproximadamente esta receta?'
          : lang === 'fr'
            ? 'Pour combien de portions environ est cette recette ?'
            : 'Roughly how many servings does this batch make?',
      quickChoices: ['2 servings', '4 servings', '6 servings'],
    });
  }

  return {
    provider: 'deterministic',
    recipe: {
      title,
      category,
      intro,
      ingredients,
      steps,
      prepMinutes,
      cookMinutes,
      servings,
    },
    improvements,
    followUpQuestions: followUpQuestions.slice(0, 3),
  };
}

export interface TranslateRecipeInput {
  sourceLang: string;
  targetLang: 'en' | 'es' | 'fr';
  title: string;
  intro: string | null;
  ingredients: IngredientEntry[];
  steps: string[];
}

export interface TranslateRecipeOutput {
  title: string;
  intro: string | null;
  ingredients: IngredientEntry[];
  steps: string[];
}

const LANG_FULL: Record<string, string> = {
  en: 'English',
  es: 'Spanish (Español)',
  fr: 'French (Français)',
};

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
    steps: {
      type: 'array',
      items: { type: 'string' },
    },
  },
};

function qaIssuesForTranslation(src: TranslateRecipeInput, dst: TranslateRecipeOutput): string[] {
  const ing = checkStructuredTranslation(src.ingredients, dst.ingredients);
  const st = checkTranslation({ steps: src.steps }, { steps: dst.steps });
  const al = checkAllergens(ingredientText(src.ingredients), ingredientText(dst.ingredients));
  return [...ing.problems, ...st.problems, ...al.problems];
}

async function callGeminiInteraction(
  body: Record<string, unknown>,
  apiKey: string,
  fetchImpl: typeof fetch,
  retryDelaysMs: readonly number[],
): Promise<unknown> {
  let attempt = 0;
  for (;;) {
    const res = await fetchImpl(GEMINI_INTERACTIONS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Api-Revision': GEMINI_API_REVISION,
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify(body),
    });
    if ((res.status === 429 || res.status === 503) && attempt < retryDelaysMs.length) {
      const wait = retryDelaysMs[attempt++]!;
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      continue;
    }
    if (!res.ok) {
      throw new Error(`Gemini Interactions API status ${res.status}`);
    }
    return res.json();
  }
}

export async function translateStructuredRecipeWithGemini(
  input: TranslateRecipeInput,
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
  retryDelaysMs: readonly number[] = [1000, 2500],
): Promise<TranslateRecipeOutput> {
  const srcName = LANG_FULL[input.sourceLang] ?? input.sourceLang;
  const dstName = LANG_FULL[input.targetLang] ?? input.targetLang;
  const ingDescriptors = input.ingredients.map((entry, index) => {
    if (isStructured(entry)) {
      return { index, kind: 'structured', ref: entry.ref, qty: entry.qty, qtyEnd: entry.qtyEnd ?? null, unit: entry.unit ?? null, name: entry.name, note: entry.note ?? null };
    }
    const nums = entry.match(/\d+(?:[.,]\d+)?/g) ?? [];
    return { index, kind: 'string', text: entry, requiredNumbers: nums };
  });
  const stepDescriptors = input.steps.map((s, index) => {
    const tokens = s.match(/\{(?:[it]:[a-z0-9_]+|d:\d+[mh])\}/gi) ?? [];
    const bare = s.replace(/\{[^}]+\}/g, ' ').match(/\d+(?:[.,]\d+)?/g) ?? [];
    return { index, text: s, requiredTokens: tokens, requiredNumbersOutsideTokens: bare };
  });

  const systemInstruction = [
    `You are a bilingual culinary editor translating a recipe from ${srcName} into natural, idiomatic ${dstName} for home cooks.`,
    'CRITICAL QA INVARIANTS (must pass automated validation):',
    '1. Preserve arrays length: output EXACTLY ingredients.length items (with matching index 0..N-1) and EXACTLY steps.length strings.',
    '2. For kind="structured" ingredients: keep `text: null`, translate ONLY `name` (singular/plural culinary noun) and optional `note` (e.g. prep like "finely chopped"). Do NOT invent notes if source note is null.',
    '3. For kind="string" ingredients: populate `text` with the translated ingredient string, keeping EVERY number in `requiredNumbers` verbatim in the SAME order (e.g. keep "1/2" as "1/2", never "media" or "0.5"). Set `name: null, note: null`.',
    '4. Allergens: explicitly translate any allergen words so they match canonical allergen terms (egg->huevo/oeuf, milk/butter/cream/cheese->leche/mantequilla/crema/queso or lait/beurre/crème/fromage, wheat/flour->trigo/harina or blé/farine, peanut->cacahuate/cacahuète, soy->soya/soja, shrimp->camarón/crevette, sesame->sésamo/ajonjolí/sésame).',
    '5. For every step: preserve EVERY `{i:...}`, `{t:...}`, and `{d:...}` token CHARACTER-FOR-CHARACTER inside the sentence, and preserve EVERY number in `requiredNumbersOutsideTokens` as matching Arabic digits (never spell numbers as words like "two" or change temperatures/counts).',
    '6. Keep intro warm and concise (or null if source intro is null).',
  ].join('\n');

  const basePayload = {
    sourceLang: input.sourceLang,
    targetLang: input.targetLang,
    title: input.title,
    intro: input.intro,
    ingredients: ingDescriptors,
    steps: stepDescriptors,
  };

  const mapResponse = (parsed: unknown): TranslateRecipeOutput => {
    const o = (parsed && typeof parsed === 'object' ? parsed : {}) as Record<string, unknown>;
    const rawIngs = Array.isArray(o['ingredients']) ? (o['ingredients'] as Record<string, unknown>[]) : [];
    const mappedIngs: IngredientEntry[] = input.ingredients.map((srcEntry, idx) => {
      const item = rawIngs.find((x) => x && Number(x['index']) === idx) ?? rawIngs[idx] ?? {};
      if (isStructured(srcEntry)) {
        const name = cleanLine(item['name'], 120) || srcEntry.name;
        const note = srcEntry.note != null ? (cleanLine(item['note'], 120) || srcEntry.note) : undefined;
        const out: StructuredIngredient = {
          ref: srcEntry.ref,
          qty: srcEntry.qty,
          ...(srcEntry.qtyEnd !== undefined ? { qtyEnd: srcEntry.qtyEnd } : {}),
          ...(srcEntry.unit !== undefined ? { unit: srcEntry.unit } : {}),
          name,
          ...(note !== undefined ? { note } : {}),
        };
        return out;
      }
      return cleanLine(item['text'], 300) || srcEntry;
    });
    const rawSteps = Array.isArray(o['steps']) ? (o['steps'] as unknown[]) : [];
    const mappedSteps = input.steps.map((srcStep, idx) => cleanLine(rawSteps[idx], 800) || srcStep);
    return {
      title: cleanLine(o['title'], 200) || input.title,
      intro: input.intro === null ? null : (cleanLine(o['intro'], 1200) || input.intro),
      ingredients: mappedIngs,
      steps: mappedSteps,
    };
  };

  let attemptPrompt = `Translate this recipe JSON into ${dstName}:\n${JSON.stringify(basePayload)}`;
  for (let pass = 0; pass < 2; pass++) {
    const payload = await callGeminiInteraction(
      {
        model: AI_MODEL,
        store: false,
        system_instruction: systemInstruction,
        input: [{ type: 'text', text: attemptPrompt }],
        response_format: { type: 'text', mime_type: 'application/json', schema: TRANSLATION_SCHEMA },
      },
      apiKey,
      fetchImpl,
      retryDelaysMs,
    );
    const text = extractInteractionText(payload);
    if (!text) throw new Error('Empty model output from Gemini translation');
    const out = mapResponse(JSON.parse(text));
    const issues = qaIssuesForTranslation(input, out);
    if (issues.length === 0) return out;
    if (pass === 1) {
      throw new Error(`Translation failed QA gate: ${issues.join('; ')}`);
    }
    attemptPrompt = `Your previous translation failed these exact automated QA checks:\n${issues.map((e) => `- ${e}`).join('\n')}\n\nFix those issues while keeping idiomatic ${dstName} phrasing.\nOriginal JSON:\n${JSON.stringify(basePayload)}\n\nPrevious translation output:\n${JSON.stringify(out)}`;
  }
  throw new Error('Unreachable translation failure');
}

export async function assistRecipe(
  req: AiAssistRequest,
  opts: { apiKey?: string; fetchImpl?: typeof fetch } = {},
): Promise<AiAssistResult> {
  const apiKey = opts.apiKey?.trim();
  const fetchImpl = opts.fetchImpl ?? fetch;
  if (req.mode === 'translate') {
    const targetRaw = req.targetLocale || req.recipeLocale || 'us:es';
    const targetLang = (targetRaw.split(':')[1] || req.uiLang || 'es').slice(0, 2);
    const dstLang = (targetLang === 'es' || targetLang === 'fr' ? targetLang : 'en') as 'en' | 'es' | 'fr';
    const srcLang = (req.recipeLocale.split(':')[1] || req.uiLang || 'en').slice(0, 2);
    const draft = req.draft ?? {};
    const ings = (draft.ingredients ?? []).map((x) => cleanLine(x, 300)).filter(Boolean);
    const stps = (draft.steps ?? []).map((x) => cleanLine(x, 800)).filter(Boolean);
    if (apiKey && (draft.title || ings.length || stps.length)) {
      const translated = await translateStructuredRecipeWithGemini(
        {
          sourceLang: srcLang,
          targetLang: dstLang,
          title: cleanLine(draft.title, 200) || 'Recipe',
          intro: cleanLine(draft.intro, 1200) || null,
          ingredients: ings,
          steps: stps,
        },
        apiKey,
        fetchImpl,
      );
      return {
        provider: 'gemini',
        recipe: {
          title: translated.title,
          category: isRecipeCategorySlug(draft.category ?? '') ? (draft.category as RecipeCategorySlug) : '',
          intro: translated.intro ?? '',
          ingredients: translated.ingredients.map((e) => (typeof e === 'string' ? e : e.name)),
          steps: translated.steps,
          prepMinutes: draft.prep && Number(draft.prep) > 0 ? Number(draft.prep) : null,
          cookMinutes: draft.cook && Number(draft.cook) > 0 ? Number(draft.cook) : null,
          servings: draft.servings && Number(draft.servings) > 0 ? Number(draft.servings) : null,
        },
        improvements: [
          req.uiLang === 'es'
            ? `Receta traducida al ${dstLang.toUpperCase()} superando las pruebas automáticas de cantidades, alérgenos y temporizadores.`
            : req.uiLang === 'fr'
              ? `Recette traduite en ${dstLang.toUpperCase()} avec vérification des quantités, allergènes et minuteurs.`
              : `Translated recipe to ${dstLang.toUpperCase()} and verified numeric quantities, allergens, and timer tokens.`,
        ],
        followUpQuestions: [],
      };
    }
    return assistRecipeDeterministic({ ...req, mode: 'polish', uiLang: dstLang });
  }
  if (apiKey) {
    return assistRecipeWithGemini(req, apiKey, fetchImpl);
  }
  return assistRecipeDeterministic(req);
}
