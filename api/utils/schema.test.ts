import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Client } from '@notionhq/client';
import {
  resolvePostsSchema,
  getPostsSchema,
  getDailyReportDateKey,
  invalidateSchemaCache,
  isValidationError,
  SCHEMA_CACHE_TTL_MS,
} from './schema.ts';

const POSTS_PROPERTIES = {
  Name: { type: 'title' },
  タグ: { type: 'relation' },
  DB_日報: { type: 'relation' },
  ピン止め: { type: 'checkbox' },
  コメント追加回数: { type: 'number' },
};

// databases.retrieve の呼び出し回数を数えるテスト用の Notion クライアント
function fakeNotion(properties: Record<string, any>) {
  const retrieve = vi.fn(async () => ({ properties }));
  return { client: { databases: { retrieve } } as unknown as Client, retrieve };
}

describe('resolvePostsSchema', () => {
  it('候補名からプロパティ名を解決する', () => {
    expect(resolvePostsSchema(POSTS_PROPERTIES)).toEqual({
      titleKey: 'Name',
      tagsKey: 'タグ',
      pinnedKey: 'ピン止め',
      dailyReportKey: 'DB_日報',
      commentsCountKey: 'コメント追加回数',
    });
  });

  it('title 型は名前が異なっても解決し、見つからなければ既定名を返す', () => {
    expect(resolvePostsSchema({ 見出し: { type: 'title' } }).titleKey).toBe('見出し');
    expect(resolvePostsSchema({}).titleKey).toBe('タイトル');
  });

  it('該当する型がなければ undefined を返す', () => {
    const schema = resolvePostsSchema({ Name: { type: 'title' } });
    expect(schema.tagsKey).toBeUndefined();
    expect(schema.pinnedKey).toBeUndefined();
    expect(schema.dailyReportKey).toBeUndefined();
    expect(schema.commentsCountKey).toBeUndefined();
  });
});

describe('getPostsSchema', () => {
  beforeEach(() => {
    invalidateSchemaCache();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('2回目以降はキャッシュを返し databases.retrieve を呼ばない', async () => {
    const { client, retrieve } = fakeNotion(POSTS_PROPERTIES);
    const first = await getPostsSchema(client, 'db1');
    const second = await getPostsSchema(client, 'db1');
    expect(second).toEqual(first);
    expect(retrieve).toHaveBeenCalledTimes(1);
  });

  it('データベースIDごとに別エントリとして扱う', async () => {
    const { client, retrieve } = fakeNotion(POSTS_PROPERTIES);
    await getPostsSchema(client, 'db1');
    await getPostsSchema(client, 'db2');
    expect(retrieve).toHaveBeenCalledTimes(2);
  });

  it('5分経過すると取得し直す', async () => {
    const { client, retrieve } = fakeNotion(POSTS_PROPERTIES);
    await getPostsSchema(client, 'db1');
    vi.advanceTimersByTime(SCHEMA_CACHE_TTL_MS - 1);
    await getPostsSchema(client, 'db1');
    expect(retrieve).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1);
    await getPostsSchema(client, 'db1');
    expect(retrieve).toHaveBeenCalledTimes(2);
  });

  it('invalidateSchemaCache で破棄すると取得し直す', async () => {
    const { client, retrieve } = fakeNotion(POSTS_PROPERTIES);
    await getPostsSchema(client, 'db1');
    invalidateSchemaCache('db1');
    await getPostsSchema(client, 'db1');
    expect(retrieve).toHaveBeenCalledTimes(2);
  });

  it('取得に失敗した結果はキャッシュしない', async () => {
    const retrieve = vi
      .fn()
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce({ properties: POSTS_PROPERTIES });
    const client = { databases: { retrieve } } as unknown as Client;
    await expect(getPostsSchema(client, 'db1')).rejects.toThrow('network');
    await expect(getPostsSchema(client, 'db1')).resolves.toMatchObject({ titleKey: 'Name' });
  });
});

describe('getDailyReportDateKey', () => {
  beforeEach(() => invalidateSchemaCache());

  it('日付プロパティ名を解決してキャッシュする', async () => {
    const { client, retrieve } = fakeNotion({ 名前: { type: 'title' }, Date: { type: 'date' } });
    expect(await getDailyReportDateKey(client, 'daily')).toBe('Date');
    expect(await getDailyReportDateKey(client, 'daily')).toBe('Date');
    expect(retrieve).toHaveBeenCalledTimes(1);
  });

  it('日付プロパティがなければ既定名を返す', async () => {
    const { client } = fakeNotion({ 名前: { type: 'title' } });
    expect(await getDailyReportDateKey(client, 'daily')).toBe('日付');
  });
});

describe('isValidationError', () => {
  it('Notion の validation_error のみ true', () => {
    expect(isValidationError({ code: 'validation_error' })).toBe(true);
    expect(isValidationError({ code: 'object_not_found' })).toBe(false);
    expect(isValidationError(new Error('x'))).toBe(false);
    expect(isValidationError(null)).toBe(false);
  });
});
