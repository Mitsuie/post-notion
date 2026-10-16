import { describe, it, expect } from 'vitest';
import { toClientError, TAG_LIMIT_MESSAGE } from './errors.ts';

function notionError(code: string, message = 'raw notion message') {
  return Object.assign(new Error(message), { code });
}

describe('toClientError', () => {
  it('object_not_found は 404', () => {
    expect(toClientError(notionError('object_not_found'), 'fb')).toEqual({ status: 404, message: '対象が見つかりません' });
  });

  it('権限エラーは 502 で設定確認を促す', () => {
    for (const code of ['unauthorized', 'restricted_resource']) {
      const { status, message } = toClientError(notionError(code), 'fb');
      expect(status).toBe(502);
      expect(message).toContain('インテグレーション設定');
    }
  });

  it('rate_limited は 503', () => {
    expect(toClientError(notionError('rate_limited'), 'fb').status).toBe(503);
  });

  it('タグ1件制限の validation_error は 400 と案内メッセージ', () => {
    const error = notionError('validation_error', 'Relation property X has a limit of 1, but 2 values were provided.');
    expect(toClientError(error, 'fb')).toEqual({ status: 400, message: TAG_LIMIT_MESSAGE });
  });

  it('その他の validation_error・未知のエラーは 500 と fallback', () => {
    expect(toClientError(notionError('validation_error', 'body.x should be ...'), 'fb')).toEqual({ status: 500, message: 'fb' });
    expect(toClientError(new Error('boom'), 'fb')).toEqual({ status: 500, message: 'fb' });
    expect(toClientError('string error', 'fb')).toEqual({ status: 500, message: 'fb' });
  });

  it('Notion の生のメッセージを返さない', () => {
    for (const code of ['object_not_found', 'unauthorized', 'rate_limited', 'internal_server_error']) {
      expect(toClientError(notionError(code, 'SECRET-DETAIL'), 'fb').message).not.toContain('SECRET-DETAIL');
    }
  });
});
