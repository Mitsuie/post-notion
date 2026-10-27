import { describe, it, expect } from 'vitest';
import { getPostErrorMessage } from './postErrors';
import { NetworkError, SessionExpiredError } from './apiClient';

describe('getPostErrorMessage', () => {
  it('NetworkError の場合は、投稿済みの可能性とタイムラインでの確認を案内する', () => {
    expect(getPostErrorMessage(new NetworkError())).toBe(
      '通信が途中で切れました。投稿されている可能性があるため、タイムラインで確認してから再送してください（入力内容を復元しました）'
    );
  });

  it('オフライン時の NetworkError も、メッセージに関わらず同じ案内にする', () => {
    expect(getPostErrorMessage(new NetworkError('オフラインのため通信できません。接続を確認してください'))).toBe(
      '通信が途中で切れました。投稿されている可能性があるため、タイムラインで確認してから再送してください（入力内容を復元しました）'
    );
  });

  it('サーバーが拒否したエラーは、エラーのメッセージに復元の旨を付ける', () => {
    expect(getPostErrorMessage(new Error('タイトルは必須です'))).toBe('タイトルは必須です（入力内容を復元しました）');
  });

  it('SessionExpiredError は通信エラー扱いにせず、従来どおりの文言にする', () => {
    expect(getPostErrorMessage(new SessionExpiredError())).toBe(
      'セッションの有効期限が切れました。再ログインしてください。（入力内容を復元しました）'
    );
  });

  it('文字列のエラーはそのまま使う', () => {
    expect(getPostErrorMessage('送信できませんでした')).toBe('送信できませんでした（入力内容を復元しました）');
  });

  it('メッセージを取り出せない場合は既定の文言にする', () => {
    expect(getPostErrorMessage(new Error(''))).toBe('投稿の送信に失敗しました（入力内容を復元しました）');
    expect(getPostErrorMessage(undefined)).toBe('投稿の送信に失敗しました（入力内容を復元しました）');
  });
});
