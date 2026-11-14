// AXI-style compact/TOON response shaping for the 2yolks admin MCP.
// Opt-in per tools/call via arguments { format: 'toon', fields?: string[] }.
// Default responses (format omitted or 'json') are byte-identical to before.

export type CompactFormat = 'json' | 'toon';

export function requestedFormat(args: Record<string, unknown>): CompactFormat {
  return args['format'] === 'toon' ? 'toon' : 'json';
}

export function parseFieldsArg(raw: unknown): string[] | undefined {
  if (Array.isArray(raw)) {
    const fields = raw.filter((f): f is string => typeof f === 'string' && f.length > 0);
    return fields.length > 0 ? fields : undefined;
  }
  if (typeof raw === 'string' && raw.trim().length > 0) {
    return raw
      .split(',')
      .map((f) => f.trim())
      .filter((f) => f.length > 0);
  }
  return undefined;
}

const TRUNCATE_AT = 200;

function truncateString(value: string): string {
  if (value.length <= TRUNCATE_AT) return value;
  return `${value.slice(0, TRUNCATE_AT)}…(truncated, ${value.length} chars total)`;
}

const NO_TRUNCATE_EXACT = /^(ids?|slugs?|uuids?)$/i;
const NO_TRUNCATE_SUFFIX = /(url|uri|link|cursor)$/i;

function truncateDeep(value: unknown, key?: string): unknown {
  if (typeof value === 'string') {
    // Identifiers, cursors and links must stay intact to remain usable.
    return key !== undefined && (NO_TRUNCATE_EXACT.test(key) || NO_TRUNCATE_SUFFIX.test(key))
      ? value
      : truncateString(value);
  }
  if (Array.isArray(value)) return value.map((v) => truncateDeep(v, key));
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, truncateDeep(v, k)]),
    );
  }
  return value;
}

function projectItem(item: unknown, fields: string[]): unknown {
  if (item === null || typeof item !== 'object' || Array.isArray(item)) return item;
  const src = item as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const field of fields) {
    if (field in src) out[field] = src[field];
  }
  // Keep at least an identifier so items stay addressable.
  if (Object.keys(out).length === 0) {
    for (const idKey of ['id', 'uuid', 'slug', 'name']) {
      if (idKey in src) {
        out[idKey] = src[idKey];
        break;
      }
    }
  }
  return out;
}

// Minimal default projection (AXI principle 2: 3-4 fields per list item):
// the first four primitive-typed keys of each object item.
function defaultFields(item: Record<string, unknown>): string[] {
  const fields: string[] = [];
  for (const [key, value] of Object.entries(item)) {
    if (value === null || typeof value !== 'object') fields.push(key);
    if (fields.length === 4) break;
  }
  return fields.length > 0 ? fields : Object.keys(item).slice(0, 4);
}

function projectLists(value: unknown, fields?: string[]): unknown {
  if (Array.isArray(value)) {
    if (
      value.length > 0 &&
      value.every((v) => v !== null && typeof v === 'object' && !Array.isArray(v))
    ) {
      const chosen = fields ?? defaultFields(value[0] as Record<string, unknown>);
      return value.map((item) => projectItem(item, chosen));
    }
    return value.map((v) => projectLists(v, fields));
  }
  if (value !== null && typeof value === 'object') {
    // Explicit fields apply to every uniform object list; the default
    // projection is recomputed per list.
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, projectLists(v, fields)]),
    );
  }
  return value;
}

function toonScalar(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  const s = String(value);
  return /[",\n:]/.test(s) ? JSON.stringify(s) : s;
}

// Minimal TOON rendering (AXI principle 1): uniform object arrays become a
// header row plus comma-joined rows; everything else is key: value lines.
// Empty arrays render as `name[0]:`, an explicit zero-result state (AXI 5).
export function toToon(value: unknown, key?: string, indent = ''): string {
  if (Array.isArray(value)) {
    const name = key ?? 'items';
    if (value.length === 0) return `${indent}${name}[0]:`;
    const uniformObjects = value.every(
      (v) => v !== null && typeof v === 'object' && !Array.isArray(v),
    );
    if (uniformObjects) {
      const fields = [...new Set(value.flatMap((v) => Object.keys(v as Record<string, unknown>)))];
      const header = `${indent}${name}[${value.length}]{${fields.join(',')}}:`;
      const rows = value.map(
        (v) =>
          `${indent}  ${fields.map((f) => toonScalar((v as Record<string, unknown>)[f])).join(',')}`,
      );
      return [header, ...rows].join('\n');
    }
    return `${indent}${name}[${value.length}]: ${value.map(toonScalar).join(',')}`;
  }
  if (value !== null && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .map(([k, v]) =>
        v !== null && typeof v === 'object'
          ? toToon(v, k, indent)
          : `${indent}${k}: ${toonScalar(v)}`,
      )
      .join('\n');
  }
  return `${indent}${key ? `${key}: ` : ''}${toonScalar(value)}`;
}

// Shape a JSON payload into the compact TOON body.
export function shapeCompact(value: unknown, fields?: string[]): unknown {
  return truncateDeep(projectLists(value, fields));
}

// Shape a tool result payload for a tools/call: returns the TOON text when
// format='toon', else the unchanged pretty-JSON text (byte-identical).
export function shapeToolText(data: unknown, format: CompactFormat, fields?: string[]): string {
  if (format !== 'toon') return JSON.stringify(data, null, 2);
  return toToon(shapeCompact(data, fields));
}
