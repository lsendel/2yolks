// Contributor draft cover photo helpers (S5, migration 0012).
// Photos are validated structurally (JPEG/PNG/WebP container end-to-end via
// imageValidation.ts), stored in R2 ONLY under drafts/<userId>/<recipeId>/...,
// served exclusively to the owning user with private no-store headers, and
// promoted to public /img/recipe/:id only upon explicit admin approval via MCP.
import type { AccountStrings } from '@2yolks/contracts';
import { escapeHtml as esc } from '@2yolks/web/server';
import { MAX_IMAGE_BYTES, validateImage, type ImageInfo } from './imageValidation';

export const MAX_DRAFT_PHOTO_BYTES = MAX_IMAGE_BYTES; // 3 MB
export const MAX_USER_PHOTO_BYTES = 25 * 1024 * 1024; // 25 MB pending storage per user

export type PendingDraftPhoto = {
  id: string;
  recipeId: string;
  userId: string;
  r2Key: string;
  mime: string;
  bytes: number;
  width: number;
  height: number;
  createdAt: string;
};

export type ValidatedDraftPhoto = { bytes: Uint8Array; info: ImageInfo };
export type PhotoRejectReason = 'no_storage' | 'invalid' | 'quota';

export function renderDraftPhotoField(
  t: AccountStrings,
  draft: { id?: string; photoUrl?: string | null },
  errorHtml = '',
  invalidAttr = '',
): string {
  const existingUrl = draft.photoUrl ?? '';
  const noJsRemove = existingUrl
    ? `<noscript><label class="check"><input type="checkbox" name="remove_photo" value="1"> <span>${esc(t.draftPhotoRemove)}</span></label></noscript>`
    : '';
  return `<div class="field draft-photo-field" data-draft-photo-field data-existing-url="${esc(existingUrl)}">
<label for="f-dish_photo">${esc(t.draftPhotoLabel)} <small>${esc(t.draftPhotoHint)}</small></label>
<img class="draft-photo-preview" data-draft-photo-preview${existingUrl ? ` src="${esc(existingUrl)}"` : ''} alt=""${existingUrl ? '' : ' hidden'}>
<input type="file" name="dish_photo" id="f-dish_photo" accept="image/jpeg,image/png,image/webp" data-draft-photo-input${invalidAttr}>
<input type="hidden" name="remove_photo" value="" data-draft-photo-remove-input>
<div class="draft-photo-actions"><button type="button" class="quiet" data-draft-photo-remove${existingUrl ? '' : ' hidden'}>${esc(t.draftPhotoRemove)}</button><span class="hint" data-draft-photo-status data-msg-resizing="${esc(t.draftPhotoResizing)}" role="status" aria-live="polite" hidden></span></div>
${noJsRemove}${errorHtml}</div>`;
}

export function extractUploadedPhoto(raw: unknown): File | null {
  if (!raw || typeof raw !== 'object' || !('arrayBuffer' in raw)) return null;
  const f = raw as File;
  return Number.isFinite(f.size) && f.size > 0 ? f : null;
}

export function wantsRemovePhoto(form: Record<string, unknown>): boolean {
  const v = form['remove_photo'];
  return v === '1' || (Array.isArray(v) && v.includes('1'));
}

export function photoErrorMessage(t: AccountStrings, reason: PhotoRejectReason): string {
  if (reason === 'no_storage') return t.errDraftPhotoStorage;
  if (reason === 'quota') return t.errDraftPhotoQuota;
  return t.errDraftPhotoInvalid;
}

export async function activeDraftPhoto(db: D1Database, recipeId: string, userId?: string): Promise<PendingDraftPhoto | null> {
  const sql = userId
    ? `SELECT id, recipe_id AS recipeId, user_id AS userId, r2_key AS r2Key, mime, bytes, width, height, created_at AS createdAt
       FROM draft_photos WHERE recipe_id = ? AND user_id = ? AND status = 'pending' LIMIT 1`
    : `SELECT id, recipe_id AS recipeId, user_id AS userId, r2_key AS r2Key, mime, bytes, width, height, created_at AS createdAt
       FROM draft_photos WHERE recipe_id = ? AND status = 'pending' LIMIT 1`;
  const row = userId
    ? await db.prepare(sql).bind(recipeId, userId).first<PendingDraftPhoto>()
    : await db.prepare(sql).bind(recipeId).first<PendingDraftPhoto>();
  return row ?? null;
}

export async function prepareDraftPhoto(
  env: { DB: D1Database; IMAGES?: R2Bucket },
  opts: { userId: string; recipeId?: string; file: File },
): Promise<{ ok: true; photo: ValidatedDraftPhoto } | { ok: false; reason: PhotoRejectReason; status: 400 | 503 }> {
  if (!env.IMAGES) return { ok: false, reason: 'no_storage', status: 503 };
  if (opts.file.size <= 0 || opts.file.size > MAX_DRAFT_PHOTO_BYTES) {
    return { ok: false, reason: 'invalid', status: 400 };
  }
  const bytes = new Uint8Array(await opts.file.arrayBuffer());
  if (bytes.length === 0 || bytes.length > MAX_DRAFT_PHOTO_BYTES) {
    return { ok: false, reason: 'invalid', status: 400 };
  }
  const info = await validateImage(bytes);
  if (!info) return { ok: false, reason: 'invalid', status: 400 };

  const usedRow = await env.DB
    .prepare("SELECT COALESCE(SUM(bytes), 0) AS total FROM draft_photos WHERE user_id = ? AND status = 'pending'")
    .bind(opts.userId)
    .first<{ total: number }>();
  const currentDraft = opts.recipeId ? await activeDraftPhoto(env.DB, opts.recipeId, opts.userId) : null;
  const projected = Number(usedRow?.total ?? 0) - (currentDraft?.bytes ?? 0) + bytes.length;
  if (projected > MAX_USER_PHOTO_BYTES) {
    return { ok: false, reason: 'quota', status: 400 };
  }
  return { ok: true, photo: { bytes, info } };
}

export async function commitDraftPhoto(
  env: { DB: D1Database; IMAGES?: R2Bucket },
  opts: { userId: string; recipeId: string; photo: ValidatedDraftPhoto; idGen: () => string },
): Promise<PendingDraftPhoto> {
  if (!env.IMAGES) throw new Error('IMAGES bucket not configured');
  const old = await activeDraftPhoto(env.DB, opts.recipeId, opts.userId);
  const photoId = opts.idGen();
  const r2Key = `drafts/${opts.userId}/${opts.recipeId}/${photoId}.${opts.photo.info.ext}`;
  const now = new Date().toISOString();
  await env.IMAGES.put(r2Key, opts.photo.bytes, { httpMetadata: { contentType: opts.photo.info.mime } });
  try {
    await env.DB.batch([
      env.DB
        .prepare("DELETE FROM draft_photos WHERE recipe_id = ? AND user_id = ? AND status = 'pending'")
        .bind(opts.recipeId, opts.userId),
      env.DB
        .prepare(
          "INSERT INTO draft_photos (id, recipe_id, user_id, r2_key, mime, bytes, width, height, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)",
        )
        .bind(photoId, opts.recipeId, opts.userId, r2Key, opts.photo.info.mime, opts.photo.bytes.length, opts.photo.info.width, opts.photo.info.height, now),
    ]);
  } catch (e) {
    await env.IMAGES.delete(r2Key).catch(() => {});
    throw e;
  }
  if (old && old.r2Key !== r2Key) {
    await env.IMAGES.delete(old.r2Key).catch(() => {});
  }
  return {
    id: photoId,
    recipeId: opts.recipeId,
    userId: opts.userId,
    r2Key,
    mime: opts.photo.info.mime,
    bytes: opts.photo.bytes.length,
    width: opts.photo.info.width,
    height: opts.photo.info.height,
    createdAt: now,
  };
}

export async function deleteDraftPhoto(
  env: { DB: D1Database; IMAGES?: R2Bucket },
  opts: { recipeId: string; userId?: string },
): Promise<boolean> {
  const rows = opts.userId
    ? await env.DB
        .prepare("SELECT id, r2_key AS r2Key FROM draft_photos WHERE recipe_id = ? AND user_id = ? AND status = 'pending'")
        .bind(opts.recipeId, opts.userId)
        .all<{ id: string; r2Key: string }>()
    : await env.DB
        .prepare("SELECT id, r2_key AS r2Key FROM draft_photos WHERE recipe_id = ? AND status = 'pending'")
        .bind(opts.recipeId)
        .all<{ id: string; r2Key: string }>();
  if (!rows.results.length) return false;
  if (opts.userId) {
    await env.DB
      .prepare("DELETE FROM draft_photos WHERE recipe_id = ? AND user_id = ? AND status = 'pending'")
      .bind(opts.recipeId, opts.userId)
      .run();
  } else {
    await env.DB
      .prepare("DELETE FROM draft_photos WHERE recipe_id = ? AND status = 'pending'")
      .bind(opts.recipeId)
      .run();
  }
  if (env.IMAGES) {
    await Promise.all(rows.results.map((r) => env.IMAGES!.delete(r.r2Key).catch(() => {})));
  }
  return true;
}
