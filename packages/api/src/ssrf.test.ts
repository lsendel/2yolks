import { describe, expect, it } from 'vitest';
import { isPrivateIPv4, isPrivateIPv6, validateImportUrl, assertPublicHost, safeFetchText, SsrfError } from './ssrf';

const doh = (map: Record<string, { A?: string[]; AAAA?: string[] }>): typeof fetch =>
  (async (input: RequestInfo | URL) => {
    const u = new URL(String(input));
    const name = u.searchParams.get('name')!;
    const type = u.searchParams.get('type') as 'A' | 'AAAA';
    const ips = map[name]?.[type] ?? [];
    return new Response(JSON.stringify({ Answer: ips.map((d) => ({ type: type === 'A' ? 1 : 28, data: d })) }), { status: 200 });
  }) as typeof fetch;

describe('ip classification', () => {
  it('blocks private and reserved IPv4', () => {
    for (const ip of ['127.0.0.1', '10.1.2.3', '172.16.0.1', '172.31.255.255', '192.168.1.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '224.0.0.1', '255.255.255.255']) expect(isPrivateIPv4(ip), ip).toBe(true);
    for (const ip of ['8.8.8.8', '1.1.1.1', '172.32.0.1', '93.184.216.34']) expect(isPrivateIPv4(ip), ip).toBe(false);
  });
  it('blocks private IPv6 including embedded IPv4 forms', () => {
    for (const ip of ['::1', '::', 'fc00::1', 'fd12:3456::1', 'fe80::1', '::ffff:127.0.0.1', '::ffff:7f00:1', '::ffff:a9fe:a9fe', '64:ff9b::7f00:1', '2002:7f00:1::', '2001:db8::1', 'ff02::1', '2001:0:4136:e378::1']) expect(isPrivateIPv6(ip), ip).toBe(true);
    for (const ip of ['2606:4700:4700::1111', '2001:4860:4860::8888', '::ffff:8.8.8.8']) expect(isPrivateIPv6(ip), ip).toBe(false);
  });
  it('fails closed on junk', () => { expect(isPrivateIPv6('nonsense')).toBe(true); expect(isPrivateIPv4('1.2.3')).toBe(true); });
});

describe('url validation', () => {
  it('accepts a plain https URL', () => { expect(validateImportUrl('https://example.com/r/1').hostname).toBe('example.com'); });
  it.each([
    'http://example.com', 'ftp://example.com', 'https://user:pw@example.com', 'https://example.com:8443/x', 'https://127.0.0.1/', 'https://[::1]/',
    'https://2130706433/', 'https://localhost/', 'https://printer.local/', 'https://metadata.internal/', 'https://intranet/', 'not a url', 'https://example.com./x'.replace('example.com.', 'foo.arpa'),
  ])('rejects %s', (u) => { expect(() => validateImportUrl(u)).toThrow(SsrfError); });
});

describe('dns checks', () => {
  it('rejects when ANY answer is private', async () => {
    await expect(assertPublicHost('evil.example', doh({ 'evil.example': { A: ['8.8.8.8', '10.0.0.5'] } }))).rejects.toThrow(SsrfError);
    await expect(assertPublicHost('evil.example', doh({ 'evil.example': { A: ['8.8.8.8'], AAAA: ['::ffff:7f00:1'] } }))).rejects.toThrow(SsrfError);
  });
  it('rejects unresolved hosts and accepts public ones', async () => {
    await expect(assertPublicHost('nx.example', doh({}))).rejects.toThrow(SsrfError);
    await expect(assertPublicHost('ok.example', doh({ 'ok.example': { A: ['93.184.216.34'] } }))).resolves.toBeUndefined();
  });
});

describe('safeFetchText', () => {
  const dns = doh({ 'a.example': { A: ['93.184.216.34'] }, 'b.example': { A: ['93.184.216.35'] }, 'inner.example': { A: ['10.0.0.1'] } });
  const html = (body: string, extra: Record<string, string> = {}) => new Response(body, { status: 200, headers: { 'content-type': 'text/html', ...extra } });
  it('returns the page text', async () => {
    const r = await safeFetchText('https://a.example/x', { doh: dns, fetcher: (async () => html('hello')) as typeof fetch });
    expect(r.text).toBe('hello');
  });
  it('re-checks every redirect hop', async () => {
    const f = (async (u: string) => (u.startsWith('https://a.example') ? new Response(null, { status: 302, headers: { location: 'https://inner.example/' } }) : html('secret'))) as unknown as typeof fetch;
    await expect(safeFetchText('https://a.example/x', { doh: dns, fetcher: f })).rejects.toThrow(/non-public/);
    const g = (async (u: string) => (u.startsWith('https://a.example') ? new Response(null, { status: 302, headers: { location: 'http://b.example/' } }) : html('x'))) as unknown as typeof fetch;
    await expect(safeFetchText('https://a.example/x', { doh: dns, fetcher: g })).rejects.toThrow(/https/);
  });
  it('stops redirect loops, oversize and non-html', async () => {
    const loop = (async () => new Response(null, { status: 302, headers: { location: 'https://b.example/' } })) as unknown as typeof fetch;
    await expect(safeFetchText('https://a.example/', { doh: dns, fetcher: loop })).rejects.toThrow(/redirects/);
    const big = (async () => html('x'.repeat(2 * 1024 * 1024 + 10))) as unknown as typeof fetch;
    await expect(safeFetchText('https://a.example/', { doh: dns, fetcher: big })).rejects.toThrow(/large/);
    const bin = (async () => new Response('x', { headers: { 'content-type': 'application/pdf' } })) as unknown as typeof fetch;
    await expect(safeFetchText('https://a.example/', { doh: dns, fetcher: bin })).rejects.toThrow(/web page/);
  });
});
