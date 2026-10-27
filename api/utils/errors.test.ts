import { describe, it, expect } from 'vitest';
import { RequestTimeoutError } from '@notionhq/client';
import { toClientError, TAG_LIMIT_MESSAGE, TAG_LIMIT_HINT, NOTION_UNAVAILABLE_MESSAGE } from './errors.ts';

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

  it('rate_limited の文言は変えない', () => {
    expect(toClientError(notionError('rate_limited'), 'fb').message).toBe(
      'Notion が混み合っています。少し待って再試行してください'
    );
  });

  it('Notion の一時障害は 503 で再試行を促す', () => {
    for (const code of ['internal_server_error', 'service_unavailable', 'gateway_timeout', 'conflict_error']) {
      expect(toClientError(notionError(code), 'fb')).toEqual({ status: 503, message: NOTION_UNAVAILABLE_MESSAGE });
    }
  });

  it('SDK のリクエストタイムアウトは 503 で再試行を促す', () => {
    expect(toClientError(new RequestTimeoutError(), 'fb')).toEqual({ status: 503, message: NOTION_UNAVAILABLE_MESSAGE });
  });

  it('タグ1件制限の validation_error は 400 と案内メッセージ', () => {
    const error = notionError('validation_error', 'Relation property X has a limit of 1, but 2 values were provided.');
    expect(toClientError(error, 'fb')).toEqual({ status: 400, message: TAG_LIMIT_MESSAGE });
  });

  it('limit を含む validation_error はタグ件数に関わらず 400 と案内メッセージ', () => {
    const error = notionError('validation_error', 'Relation property X has a limit of 1, but 2 values were provided.');
    expect(toClientError(error, 'fb', { tagCount: 2 })).toEqual({ status: 400, message: TAG_LIMIT_MESSAGE });
  });

  it('limit を含まない validation_error でタグを2件以上送った場合は fallback にタグ1件の補足を付ける', () => {
    const error = notionError('validation_error', 'Relation property X accepts only one value.');
    expect(toClientError(error, 'fb', { tagCount: 2 })).toEqual({ status: 500, message: `fb。${TAG_LIMIT_HINT}` });
    expect(toClientError(error, 'fb', { tagCount: 3 }).message).toContain(TAG_LIMIT_HINT);
  });

  it('limit を含まない validation_error でタグが1件以下の場合は補足を付けない', () => {
    const error = notionError('validation_error', 'Relation property X accepts only one value.');
    expect(toClientError(error, 'fb', { tagCount: 1 })).toEqual({ status: 500, message: 'fb' });
    expect(toClientError(error, 'fb', { tagCount: 0 })).toEqual({ status: 500, message: 'fb' });
  });

  it('タグ件数は validation_error 以外の判定に影響しない', () => {
    expect(toClientError(new Error('boom'), 'fb', { tagCount: 2 })).toEqual({ status: 500, message: 'fb' });
  });

  it('その他の validation_error・未知のエラーは 500 と fallback', () => {
    expect(toClientError(notionError('validation_error', 'body.x should be ...'), 'fb')).toEqual({ status: 500, message: 'fb' });
    expect(toClientError(new Error('boom'), 'fb')).toEqual({ status: 500, message: 'fb' });
    expect(toClientError('string error', 'fb')).toEqual({ status: 500, message: 'fb' });
  });

  it('Notion の生のメッセージを返さない', () => {
    for (const code of [
      'object_not_found',
      'unauthorized',
      'rate_limited',
      'internal_server_error',
      'service_unavailable',
      'gateway_timeout',
      'conflict_error',
    ]) {
      expect(toClientError(notionError(code, 'SECRET-DETAIL'), 'fb').message).not.toContain('SECRET-DETAIL');
    }
  });
});
