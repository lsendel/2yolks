// SSRF guard for server-side recipe URL import (Cloudflare Worker).
// Controls: https only, no credentials, ports 80/443 only, no IP literals,
// no internal-looking hostnames, DNS-over-HTTPS resolution with EVERY A/AAAA
// answer checked, manual redirects (<=5) re-validated per hop, size and time
// caps. Known limit: the Workers runtime resolves again at connect time, so a
// DNS-rebinding race cannot be fully excluded at the application layer;
// Cloudflare's network also refuses its own internal ranges.

const BLOCKED_SUFFIXES = ['.local', '.localhost', '.internal', '.lan', '.home', '.corp', '.intranet', '.arpa', '.onion'];
export const MAX_IMPORT_BYTES = 2 * 1024 * 1024;
const MAX_REDIRECTS = 5;
const TIMEOUT_MS = 10_000;

export class SsrfError extends Error {}

export function isPrivateIPv4(ip: string): boolean {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(ip);
  if (!m) return true; // unparseable: fail closed
  const [a, b] = [Number(m[1]), Number(m[2])];
  if ([1, 2, 3, 4].some((i) => Number(m[i]) > 255)) return true;
  return (
    a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51) || (a === 203 && b === 0)
  );
}

/** Expand an IPv6 string into 8 16-bit groups, or null when unparseable. */
function expandIPv6(ip: string): number[] | null {
  let s = ip.toLowerCase().split('%')[0]!;
  const v4 = /(\d+\.\d+\.\d+\.\d+)$/.exec(s);
  if (v4) {
    const parts = v4[1]!.split('.').map(Number);
    if (parts.some((p) => p > 255)) return null;
    s = s.slice(0, -v4[1]!.length) + ((parts[0]! << 8) | parts[1]!).toString(16) + ':' + ((parts[2]! << 8) | parts[3]!).toString(16);
  }
  const halves = s.split('::');
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(':') : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
  const missing = 8 - head.length - tail.length;
  if (halves.length === 1 ? head.length !== 8 : missing < 1) return null;
  const all = halves.length === 1 ? head : [...head, ...Array(missing).fill('0'), ...tail];
  const out = all.map((g) => (/^[0-9a-f]{1,4}$/.test(g) ? parseInt(g, 16) : NaN));
  return out.some(Number.isNaN) ? null : out;
}

export function isPrivateIPv6(ip: string): boolean {
  const g = expandIPv6(ip);
  if (!g) return true;
  const v4of = (hi: number, lo: number) => `${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`;
  if (g.every((x) => x === 0)) return true; // ::
  if (g.slice(0, 7).every((x) => x === 0) && g[7] === 1) return true; // ::1
  // IPv4-mapped ::ffff:a.b.c.d, IPv4-compatible ::a.b.c.d, NAT64 64:ff9b::/96
  if (g.slice(0, 5).every((x) => x === 0) && (g[5] === 0xffff || g[5] === 0)) return isPrivateIPv4(v4of(g[6]!, g[7]!));
  if (g[0] === 0x64 && g[1] === 0xff9b && g.slice(2, 6).every((x) => x === 0)) return isPrivateIPv4(v4of(g[6]!, g[7]!));
  if (g[0] === 0x2002) return isPrivateIPv4(v4of(g[1]!, g[2]!)); // 6to4 embeds v4
  if (g[0] === 0x2001 && g[1] === 0) return true; // Teredo
  if ((g[0]! & 0xfe00) === 0xfc00) return true; // fc00::/7 ULA
  if ((g[0]! & 0xffc0) === 0xfe80) return true; // link-local
  if ((g[0]! & 0xffc0) === 0xfec0) return true; // site-local
  if ((g[0]! & 0xff00) === 0xff00) return true; // multicast
  if (g[0] === 0x2001 && g[1] === 0xdb8) return true; // documentation
  return false;
}

export function validateImportUrl(raw: string): URL {
  if (raw.length > 2000) throw new SsrfError('URL too long');
  let u: URL;
  try { u = new URL(raw); } catch { throw new SsrfError('not a valid URL'); }
  if (u.protocol !== 'https:') throw new SsrfError('only https links can be imported');
  if (u.username || u.password) throw new SsrfError('links with credentials are not allowed');
  if (u.port && u.port !== '443') throw new SsrfError('only the standard https port is allowed');
  const host = u.hostname.toLowerCase().replace(/\.$/, '');
  if (!host.includes('.') || host.startsWith('[') || /^[\d.]+$/.test(host) || host.includes(':'))
    throw new SsrfError('IP addresses and single-label hosts are not allowed');
  if (BLOCKED_SUFFIXES.some((s) => host.endsWith(s)) || host === 'localhost')
    throw new SsrfError('internal hostnames are not allowed');
  return u;
}

type DohAnswer = { type: number; data: string };
async function resolveAll(host: string, doh: typeof fetch): Promise<string[]> {
  const ips: string[] = [];
  for (const type of ['A', 'AAAA']) {
    const res = await doh(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(host)}&type=${type}`, {
      headers: { accept: 'application/dns-json' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) throw new SsrfError('could not resolve host');
    const j = (await res.json()) as { Answer?: DohAnswer[] };
    for (const a of j.Answer ?? []) if (a.type === 1 || a.type === 28) ips.push(a.data);
  }
  return ips;
}

/** Throws unless every resolved address of the host is public. */
export async function assertPublicHost(host: string, doh: typeof fetch = fetch): Promise<void> {
  const ips = await resolveAll(host, doh);
  if (ips.length === 0) throw new SsrfError('host did not resolve');
  for (const ip of ips) {
    const bad = ip.includes(':') ? isPrivateIPv6(ip) : isPrivateIPv4(ip);
    if (bad) throw new SsrfError('host resolves to a non-public address');
  }
}

/** Fetch a public https page as text, following redirects manually. */
export async function safeFetchText(
  rawUrl: string,
  opts: { fetcher?: typeof fetch; doh?: typeof fetch } = {},
): Promise<{ url: string; text: string }> {
  const fetcher = opts.fetcher ?? fetch;
  let url = validateImportUrl(rawUrl);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertPublicHost(url.hostname.toLowerCase().replace(/\.$/, ''), opts.doh ?? fetch);
    const res = await fetcher(url.toString(), {
      redirect: 'manual',
      headers: { accept: 'text/html,application/xhtml+xml', 'user-agent': '2yolks-importer/1.0 (+https://2yolks.com)' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get('location');
      if (!loc) throw new SsrfError('redirect without a location');
      url = validateImportUrl(new URL(loc, url).toString());
      continue;
    }
    if (!res.ok) throw new SsrfError(`the page answered ${res.status}`);
    const ct = res.headers.get('content-type') ?? '';
    if (!/text\/html|application\/xhtml|text\/plain/i.test(ct)) throw new SsrfError('the link is not a web page');
    const declared = Number(res.headers.get('content-length') ?? 0);
    if (declared > MAX_IMPORT_BYTES) throw new SsrfError('page too large');
    const reader = res.body?.getReader();
    if (!reader) throw new SsrfError('empty response');
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_IMPORT_BYTES) { await reader.cancel(); throw new SsrfError('page too large'); }
      chunks.push(value);
    }
    const buf = new Uint8Array(total);
    let off = 0;
    for (const c of chunks) { buf.set(c, off); off += c.byteLength; }
    return { url: url.toString(), text: new TextDecoder().decode(buf) };
  }
  throw new SsrfError('too many redirects');
}
