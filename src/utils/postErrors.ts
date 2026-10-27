import { NetworkError } from './apiClient';

const RESTORED_SUFFIX = '（入力内容を復元しました）';

/**
 * 投稿の送信に失敗したときにトーストへ表示する案内文を返す
 *
 * 通信エラー（NetworkError）は、Notion へのページ作成は成功して応答だけが届かなかった可能性がある。
 * 復元された入力をそのまま再送すると同じ投稿が 2 件できるため、タイムラインでの確認を促す。
 */
export function getPostErrorMessage(err: unknown): string {
  if (err instanceof NetworkError) {
    return `通信が途中で切れました。投稿されている可能性があるため、タイムラインで確認してから再送してください${RESTORED_SUFFIX}`;
  }
  let message = '投稿の送信に失敗しました';
  if (err instanceof Error && err.message) message = err.message;
  else if (typeof err === 'string') message = err;
  return `${message}${RESTORED_SUFFIX}`;
}
