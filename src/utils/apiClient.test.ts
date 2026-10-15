import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { apiFetch, probeSession, NetworkError, SessionExpiredError } from './apiClient';

// 本リクエストは常に失敗させ、/api/health の応答だけを差し替える
function mockFetch(health: () => Promise<Response> | Response) {
  const fetchMock = vi.fn(async (url: string) => {
    if (url === '/api/health') return health();
    throw new TypeError('Failed to fetch');
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function jsonResponse(status = 200): Response {
  return new Response(JSON.stringify({ status: 'ok' }), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('probeSession / apiFetch の通信失敗時の判別', () => {
  beforeEach(() => {
    vi.stubGlobal('navigator', { onLine: true });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('health が正常に返るなら一時的な通信エラー（NetworkError）', async () => {
    mockFetch(() => jsonResponse());
    expect(await probeSession()).toBe('network');
    await expect(apiFetch('/api/posts')).rejects.toBeInstanceOf(NetworkError);
  });

  it('health も届かないならサーバー停止・回線断（NetworkError）', async () => {
    mockFetch(() => {
      throw new TypeError('Failed to fetch');
    });
    expect(await probeSession()).toBe('network');
    await expect(apiFetch('/api/posts')).rejects.toBeInstanceOf(NetworkError);
  });

  it('health がリダイレクトされるならセッション切れ（SessionExpiredError）', async () => {
    mockFetch(() => ({ type: 'opaqueredirect', status: 0, headers: new Headers() }) as Response);
    expect(await probeSession()).toBe('expired');
    await expect(apiFetch('/api/posts')).rejects.toBeInstanceOf(SessionExpiredError);
  });

  it('health が 401 / 403 ならセッション切れ', async () => {
    mockFetch(() => jsonResponse(401));
    expect(await probeSession()).toBe('expired');
    mockFetch(() => jsonResponse(403));
    expect(await probeSession()).toBe('expired');
  });

  it('health が HTML（ログイン画面）ならセッション切れ', async () => {
    mockFetch(() => new Response('<html></html>', { headers: { 'content-type': 'text/html' } }));
    expect(await probeSession()).toBe('expired');
  });

  it('health はリダイレクトを追わず、キャッシュを使わずに確認する', async () => {
    const fetchMock = mockFetch(() => jsonResponse());
    await probeSession();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/health',
      expect.objectContaining({ redirect: 'manual', cache: 'no-store', credentials: 'same-origin' })
    );
  });

  it('オフライン時は health を確認せず NetworkError', async () => {
    vi.stubGlobal('navigator', { onLine: false });
    const fetchMock = mockFetch(() => jsonResponse());
    await expect(apiFetch('/api/posts')).rejects.toBeInstanceOf(NetworkError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
