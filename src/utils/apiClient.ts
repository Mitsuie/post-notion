/**
 * 共通 API クライアント (fetch ラッパー)
 * 
 * Cloudflare Access セッション失効時の検知 (401/403/HTML返却/CORS遮断) および
 * セッション失効イベント (session-expired) の一元ディスパッチを行います。
 */

export class SessionExpiredError extends Error {
  constructor(message = 'セッションの有効期限が切れました。再ログインしてください。') {
    super(message);
    this.name = 'SessionExpiredError';
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
    // オフラインでないのに Failed to fetch が発生した場合は CORS 遮断 (Access未認証) の可能性が高い
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      console.warn('[apiClient] ネットワークエラー (CORS遮断または未認証の可能性):', err);
      if (!skipSessionExpiredNotice) {
        dispatchSessionExpired('通信が遮断されました');
      }
      throw new SessionExpiredError();
    }
    throw err;
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
