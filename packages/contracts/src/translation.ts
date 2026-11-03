// Fail-closed translation adapter contract.
// No model is called from this repo. A provider must be injected by the
// caller; with none, every request is refused. Whatever a provider returns is
// only ever a DRAFT: machine method, no reviewer, never published here.
import { checkTranslation, checkAllergens, checkStructuredTranslation, ingredientText, type IngredientEntry } from './units';

export const TRANSLATION_LANGS = ['en', 'es', 'fr'] as const;
export type TranslationLang = (typeof TRANSLATION_LANGS)[number];

export interface TranslationSource {
  recipeId: string;
  country: string;
  lang: string;
  title: string;
  intro: string | null;
  ingredients: IngredientEntry[];
  steps: string[];
}

export interface TranslationDraftBody {
  title: string;
  intro: string | null;
  ingredients: IngredientEntry[];
  steps: string[];
}

export interface TranslationProvider {
  /** Caller-supplied. Must not be paid/Workers-AI unless the owner approved spend. */
  translate(source: TranslationSource, target: TranslationLang): Promise<TranslationDraftBody>;
}

export interface TranslationDraft extends TranslationDraftBody {
  recipeId: string;
  country: string;
  lang: TranslationLang;
  /** Always a draft; this module has no path to 'published'. */
  status: 'draft';
  translationOf: { country: string; lang: string };
  translationMethod: 'machine';
  translationReviewedAt: null;
  translationReviewedBy: null;
  translationReviewerKind: null;
}

export type TranslationResult =
  | { ok: true; draft: TranslationDraft }
  | { ok: false; reason: string; problems?: string[] };

export async function requestTranslation(
  source: TranslationSource,
  target: string,
  provider?: TranslationProvider,
): Promise<TranslationResult> {
  if (!provider) return { ok: false, reason: 'no translation provider configured (fail-closed)' };
  if (!(TRANSLATION_LANGS as readonly string[]).includes(target)) return { ok: false, reason: `unsupported target language: ${target}` };
  if (target === source.lang) return { ok: false, reason: 'target equals source language' };
  let body: TranslationDraftBody;
  try {
    body = await provider.translate(source, target as TranslationLang);
  } catch (e) {
    return { ok: false, reason: `provider error: ${e instanceof Error ? e.message : 'unknown'}` };
  }
  const problems = [
    ...checkTranslation({ steps: source.steps }, { steps: body.steps }).problems,
    ...checkStructuredTranslation(source.ingredients, body.ingredients).problems,
    ...checkAllergens(ingredientText(source.ingredients), ingredientText(body.ingredients)).problems,
  ];
  if (!body.title.trim()) problems.push('empty title');
  if (problems.length) return { ok: false, reason: 'translation failed consistency checks', problems };
  return {
    ok: true,
    draft: {
      ...body,
      recipeId: source.recipeId,
      country: source.country,
      lang: target as TranslationLang,
      status: 'draft',
      translationOf: { country: source.country, lang: source.lang },
      translationMethod: 'machine',
      translationReviewedAt: null,
      translationReviewedBy: null,
      translationReviewerKind: null,
    },
  };
}
