import { describe, it, expect } from 'vitest';
import { app } from './app.ts';

// Notion を呼ぶ前に拒否される経路のみを検証する（Notion のモックは不要）
const ORIGIN = 'http://localhost';

function post(path: string, headers: Record<string, string>, body = 'x') {
  return app.request(`${ORIGIN}${path}`, { method: 'POST', headers, body });
}

describe('CSRF 対策・Content-Type 検証', () => {
  it('別オリジンからの text/plain の POST は 403', async () => {
    const res = await post('/api/posts', { Origin: 'https://evil.example', 'Content-Type': 'text/plain' });
    expect(res.status).toBe(403);
  });

  it('別オリジンからのフォーム送信（urlencoded）は 403', async () => {
    const res = await post('/api/posts', {
      Origin: 'https://evil.example',
      'Content-Type': 'application/x-www-form-urlencoded',
    });
    expect(res.status).toBe(403);
  });

  it('Sec-Fetch-Site が cross-site のフォーム送信は 403', async () => {
    const res = await post('/api/posts', { 'Sec-Fetch-Site': 'cross-site', 'Content-Type': 'text/plain' });
    expect(res.status).toBe(403);
  });

  it('同一オリジンでも JSON 以外の書き込みは 415', async () => {
    const res = await post('/api/posts', { Origin: ORIGIN, 'Content-Type': 'text/plain' });
    expect(res.status).toBe(415);
  });

  it('PATCH も JSON 以外は 415', async () => {
    const res = await app.request(`${ORIGIN}/api/posts/abc`, {
      method: 'PATCH',
      headers: { Origin: ORIGIN, 'Content-Type': 'text/plain' },
      body: 'x',
    });
    expect(res.status).toBe(415);
  });

  it('JSON の書き込みは検証を通過してルートに到達する', async () => {
    // 環境変数がないためルート側で 500 を返す（= 403 / 415 で止まっていない）
    const res = await app.request(
      `${ORIGIN}/api/posts`,
      { method: 'POST', headers: { Origin: ORIGIN, 'Content-Type': 'application/json' }, body: '{}' },
      {}
    );
    expect(res.status).toBe(500);
  });

  it('GET は検証の対象外', async () => {
    const res = await app.request(`${ORIGIN}/api/health`, { headers: { Origin: 'https://evil.example' } });
    expect(res.status).toBe(200);
  });

  it('CORS ヘッダーを返さない', async () => {
    const res = await app.request(`${ORIGIN}/api/health`, { headers: { Origin: 'https://evil.example' } });
    expect(res.headers.get('access-control-allow-origin')).toBeNull();
  });
});

describe('セキュリティヘッダー', () => {
  it('/api/health のレスポンスに付与される', async () => {
    const res = await app.request(`${ORIGIN}/api/health`);
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('x-frame-options')).toBe('DENY');
    expect(res.headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin');
    expect(res.headers.get('permissions-policy')).toBe('camera=(), microphone=(), geolocation=()');
  });
});
