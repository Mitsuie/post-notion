/**
 * Notion API のエラーをクライアント向けの定型メッセージへ変換するユーティリティ
 * - Notion の生のエラーメッセージ（内部情報を含みうる）はクライアントに返さず、サーバーログにのみ出力する
 */

export type ClientErrorStatus = 400 | 404 | 500 | 502 | 503;

export type ClientError = { status: ClientErrorStatus; message: string };

export const TAG_LIMIT_MESSAGE =
  'タグのリレーション設定が1件に制限されているため、複数タグを登録できません。タグを1件のみ選択して再送信してください。';

export const NOTION_UNAVAILABLE_MESSAGE =
  'Notion が一時的に応答していません。少し待って再試行してください';

export const CREATE_TIMEOUT_MESSAGE =
  'Notion の応答が時間内に返りませんでした。投稿されている可能性があるため、タイムラインで確認してから再送してください';

export const TAG_LIMIT_HINT = 'タグを 1 件にすると投稿できる場合があります';

export type ClientErrorOptions = {
  /** 送信したタグの件数（タグ1件制限の案内に使う） */
  tagCount?: number;
  /** 作成系のリクエストか（タイムアウト時に作成済みの可能性を案内し、再送による重複を防ぐ） */
  isCreate?: boolean;
};

function errorCode(error: unknown): string | undefined {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === 'string' ? code : undefined;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error ?? '');
}

export function toClientError(
  error: unknown,
  fallback: string,
  options: ClientErrorOptions = {}
): ClientError {
  const code = errorCode(error);
  switch (code) {
    case 'object_not_found':
      return { status: 404, message: '対象が見つかりません' };
    case 'unauthorized':
    case 'restricted_resource':
      return {
        status: 502,
        message: 'Notion への接続権限がありません。インテグレーション設定を確認してください',
      };
    case 'rate_limited':
      return { status: 503, message: 'Notion が混み合っています。少し待って再試行してください' };
    // Notion 側の一時障害と SDK のリクエストタイムアウト（RequestTimeoutError）
    case 'gateway_timeout':
    case 'notionhq_client_request_timeout':
      if (options.isCreate) return { status: 503, message: CREATE_TIMEOUT_MESSAGE };
      return { status: 503, message: NOTION_UNAVAILABLE_MESSAGE };
    case 'internal_server_error':
    case 'service_unavailable':
    case 'conflict_error':
      return { status: 503, message: NOTION_UNAVAILABLE_MESSAGE };
    case 'validation_error':
      // タグのリレーションが1件に制限されている DB へ複数タグを送った場合
      if (errorMessage(error).includes('limit')) {
        return { status: 400, message: TAG_LIMIT_MESSAGE };
      }
      // Notion 側の文言が変わっても、複数タグを送っていれば1件制限の可能性を案内する
      if ((options.tagCount ?? 0) >= 2) {
        return { status: 500, message: `${fallback}。${TAG_LIMIT_HINT}` };
      }
      return { status: 500, message: fallback };
    default:
      return { status: 500, message: fallback };
  }
}
