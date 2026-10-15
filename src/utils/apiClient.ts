/**
 * 共通 API クライアント (fetch ラッパー)
 * 
 * Cloudflare Access セッション失効時の検知 (401/403/HTML返却/CORS遮断) および
 * セッション失効イベント (session-expired) の一元ディスパッチを行います。
 * fetch 自体が失敗した場合は、ヘルスチェックで「セッション切れ」と「通信エラー」を判別します。
 */

export class SessionExpiredError extends Error {
  constructor(message = 'セッションの有効期限が切れました。再ログインしてください。') {
    super(message);
    this.name = 'SessionExpiredError';
  }
}

// サーバー停止・回線断など、認証以外の理由で通信できなかったことを表すエラー
export class NetworkError extends Error {
  constructor(message = '通信に失敗しました。再試行してください') {
    super(message);
    this.name = 'NetworkError';
  }
}

// 直近のイベント発行タイムスタンプ（重複発火のスロットリング用）
let lastExpiredDispatchedAt = 0;
const DISPATCH_THROTTLE_MS = 1500;

/**
 * セッション失効イベントの発行（短時間の連続発火を抑制）
 */
export function dispatchSessionExpired(reason?: string) {
  if (typeof window === 'undefined') return;

  const now = Date.now();
  if (now - lastExpiredDispatchedAt < DISPATCH_THROTTLE_MS) {
    return;
  }
  lastExpiredDispatchedAt = now;

  window.dispatchEvent(
    new CustomEvent('session-expired', {
      detail: { reason: reason || 'セッション期限切れ', timestamp: now },
    })
  );
}

export interface ApiRequestOptions extends RequestInit {
  /** セッション失効イベントの発行をスキップする場合は true */
  skipSessionExpiredNotice?: boolean;
}

/**
 * fetch が例外を投げた場合に、認証切れか一時的な通信エラーかを判別する
 * - Access の認証が切れていると /api/health もログイン画面へリダイレクトされる
 * - health も届かない場合はサーバー停止・回線断とみなす
 */
export async function probeSession(): Promise<'expired' | 'network'> {
  try {
    const res = await fetch('/api/health', {
      redirect: 'manual',
      cache: 'no-store',
      credentials: 'same-origin',
    });
    if (res.type === 'opaqueredirect' || res.status === 401 || res.status === 403) return 'expired';
    if ((res.headers.get('content-type') || '').includes('text/html')) return 'expired';
    return 'network'; // health は通るのに本リクエストが失敗 = 一時的な通信エラー
  } catch {
    return 'network'; // health も届かない = サーバー停止・回線断
  }
}

/**
 * 共通 fetchJson ラッパー
 */
export async function apiFetch<T = unknown>(
  url: string,
  options: ApiRequestOptions = {}
): Promise<T> {
  const { skipSessionExpiredNotice = false, ...fetchOptions } = options;

  const mergedOptions: RequestInit = {
    ...fetchOptions,
    credentials: fetchOptions.credentials || 'same-origin',
    headers: {
      Accept: 'application/json',
      ...fetchOptions.headers,
    },
  };

  let response: Response;
  try {
    response = await fetch(url, mergedOptions);
  } catch (err: unknown) {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      throw new NetworkError('オフラインのため通信できません。接続を確認してください');
    }
    // オンラインなのに fetch が失敗した場合は、Access 未認証（CORS 遮断）か通信エラーかを判別する
    console.warn('[apiClient] fetch に失敗しました。セッション状態を確認します:', err);
    if ((await probeSession()) === 'expired') {
      if (!skipSessionExpiredNotice) {
        dispatchSessionExpired('通信が遮断されました');
      }
      throw new SessionExpiredError();
    }
    throw new NetworkError();
  }

  // 1. Cloudflare Access へのリダイレクト検知
  if (response.redirected && response.url.includes('cloudflareaccess.com')) {
    if (!skipSessionExpiredNotice) {
      dispatchSessionExpired('Cloudflare Access 認証リダイレクト');
    }
    throw new SessionExpiredError();
  }

  // 2. 401 Unauthorized / 403 Forbidden 検知
  if (response.status === 401 || response.status === 403) {
    if (!skipSessionExpiredNotice) {
      dispatchSessionExpired(`認証エラー (${response.status})`);
    }
    throw new SessionExpiredError();
  }

  // 3. レスポンスの Content-Type 検知 (JSON期待に対しHTMLが返ってきた場合)
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('text/html')) {
    if (!skipSessionExpiredNotice) {
      dispatchSessionExpired('認証画面HTMLを受信');
    }
    throw new SessionExpiredError();
  }

  // 4. HTTP ステータスエラーハンドリング
  if (!response.ok) {
    let errorMessage = `APIリクエストに失敗しました (${response.status})`;
    try {
      const errorBody = (await response.json()) as { message?: string };
      if (errorBody && errorBody.message) {
        errorMessage = errorBody.message;
      }
    } catch {
      // JSON でない場合はデフォルトメッセージ
    }
    throw new Error(errorMessage);
  }

  // 5. 204 No Content または空本文への安全な対応
  if (response.status === 204) {
    return undefined as unknown as T;
  }

  const text = await response.text();
  if (!text || text.trim().length === 0) {
    return undefined as unknown as T;
  }

  try {
    return JSON.parse(text) as T;
  } catch (err) {
    console.error('[apiClient] JSONパース失敗:', text);
    throw new Error('APIレスポンスのJSON解析に失敗しました');
  }
}
