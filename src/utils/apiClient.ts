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

// セッション失効イベントの発行
export function dispatchSessionExpired(reason?: string) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('session-expired', {
        detail: { reason: reason || 'セッション期限切れ' },
      })
    );
  }
}

interface RequestOptions extends RequestInit {
  // 追加のオプションがあれば定義
}

/**
 * 共通 fetchJson ラッパー
 */
export async function apiFetch<T = any>(url: string, options: RequestOptions = {}): Promise<T> {
  const mergedOptions: RequestInit = {
    ...options,
    credentials: options.credentials || 'same-origin',
    headers: {
      Accept: 'application/json',
      ...options.headers,
    },
  };

  let response: Response;
  try {
    response = await fetch(url, mergedOptions);
  } catch (err: any) {
    // オフラインでないのに Failed to fetch が発生した場合は CORS 遮断 (Access未認証) の可能性が高い
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      console.warn('[apiClient] ネットワークエラー (CORS遮断または未認証の可能性):', err);
      dispatchSessionExpired('通信が遮断されました');
      throw new SessionExpiredError();
    }
    throw err;
  }

  // 1. Cloudflare Access へのリダイレクト検知
  if (response.redirected && response.url.includes('cloudflareaccess.com')) {
    dispatchSessionExpired('Cloudflare Access 認証リダイレクト');
    throw new SessionExpiredError();
  }

  // 2. 401 Unauthorized / 403 Forbidden 検知
  if (response.status === 401 || response.status === 403) {
    dispatchSessionExpired(`認証エラー (${response.status})`);
    throw new SessionExpiredError();
  }

  // 3. レスポンスの Content-Type 検知 (JSON期待に対しHTMLが返ってきた場合)
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('text/html')) {
    dispatchSessionExpired('認証画面HTMLを受信');
    throw new SessionExpiredError();
  }

  // 4. HTTP ステータスエラーハンドリング
  if (!response.ok) {
    const errorBody = (await response.json().catch(() => ({}))) as { message?: string };
    throw new Error(errorBody.message || `APIリクエストに失敗しました (${response.status})`);
  }

  // 5. JSON パース
  return (await response.json()) as T;
}
