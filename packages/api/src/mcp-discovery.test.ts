import { describe, expect, it } from 'vitest';
import app from './index';

describe('public MCP discovery', () => {
  it('serves metadata without a DB or credentials and pins the production origin', async () => {
    const response = await app.request('https://untrusted.example/.well-known/mcp.json');
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('public, max-age=300');
    const manifest = await response.json();
    const server = manifest.servers['2yolks-admin'];
    expect(server.url).toBe('https://2yolks.com/api/admin/mcp');
    expect(server.toolsUrl).toBe('https://2yolks.com/api/admin/mcp/tools');
    expect(server.authentication).toEqual({ type: 'bearer', required: true });
    expect(server.toolCount).toBeGreaterThan(0);
    expect(JSON.stringify(manifest)).not.toContain('untrusted.example');
  });
  it('does not open the protected tool catalog when keys are not configured', async () => {
    const response = await app.request('https://2yolks.com/api/admin/mcp/tools', {}, {} as any);
    expect(response.status).toBe(503);
  });
});
