/**
 * Notion API のエラーをクライアント向けの定型メッセージへ変換するユーティリティ
 * - Notion の生のエラーメッセージ（内部情報を含みうる）はクライアントに返さず、サーバーログにのみ出力する
 */

export type ClientErrorStatus = 400 | 404 | 500 | 502 | 503;

export type ClientError = { status: ClientErrorStatus; message: string };

export const TAG_LIMIT_MESSAGE =
  'タグのリレーション設定が1件に制限されているため、複数タグを登録できません。タグを1件のみ選択して再送信してください。';

function errorCode(error: unknown): string | undefined {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === 'string' ? code : undefined;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error ?? '');
}

export function toClientError(error: unknown, fallback: string): ClientError {
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
    case 'validation_error':
      // タグのリレーションが1件に制限されている DB へ複数タグを送った場合
      if (errorMessage(error).includes('limit')) {
        return { status: 400, message: TAG_LIMIT_MESSAGE };
      }
      return { status: 500, message: fallback };
    default:
      return { status: 500, message: fallback };
  }
}
