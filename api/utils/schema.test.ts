import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Client } from '@notionhq/client';
import { filterUsedPostsProperties } from './notion.ts';
import {
  resolvePostsSchema,
  pickDataSource,
  getDataSourceId,
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

// 改善提案一覧 v1.4.0 BUG-01 の構成（タイトル・日報以外の列名が候補名に一致しない）
const UNRELATED_COLUMNS_PROPERTIES = {
  Name: { type: 'title' },
  DB_日報: { type: 'relation' },
  完了: { type: 'checkbox' },
  重要度: { type: 'number' },
};

// データベース → データソース（ds-<データベースID>）→ プロパティ定義を返すテスト用の Notion クライアント
// retrieve は dataSources.retrieve（プロパティ定義の取得）の呼び出し回数を数える
function fakeNotion(properties: Record<string, any>) {
  const retrieveDatabase = vi.fn(async ({ database_id }: { database_id: string }) => ({
    data_sources: [{ id: `ds-${database_id}`, name: 'main' }],
  }));
  const retrieve = vi.fn(async () => ({ properties }));
  return {
    client: { databases: { retrieve: retrieveDatabase }, dataSources: { retrieve } } as unknown as Client,
    retrieve,
    retrieveDatabase,
  };
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

  it('タイトル以外は候補名に一致しない列を同じ型でも拾わない', () => {
    expect(resolvePostsSchema(UNRELATED_COLUMNS_PROPERTIES)).toEqual({
      titleKey: 'Name',
      tagsKey: undefined,
      pinnedKey: undefined,
      dailyReportKey: 'DB_日報',
      commentsCountKey: undefined,
    });
  });
});

// 作成日時・作成者（Notion が自動で設定する列）。接続状況画面には表示するが、resolvePostsSchema の解決対象ではない
const AUTO_COLUMNS_PROPERTIES = {
  作成日時: { type: 'created_time' },
  作成者: { type: 'created_by' },
};

// resolvePostsSchema の 5 項目（titleKey・tagsKey・pinnedKey・dailyReportKey・commentsCountKey）で解決された列名
// - DB に存在しない既定名（titleKey の 'タイトル'）と未解決（undefined）は除く
function resolvedKeys(properties: Record<string, any>): string[] {
  return [...new Set(Object.values(resolvePostsSchema(properties)))]
    .filter((k): k is string => !!k && k in properties)
    .sort();
}

// filterUsedPostsProperties の結果のうち、resolvePostsSchema の 5 項目の対象となる列（作成日時・作成者を除く）
function displayedSchemaKeys(properties: Record<string, any>): string[] {
  return filterUsedPostsProperties(properties)
    .filter((k) => !['created_time', 'created_by'].includes(properties[k].type))
    .sort();
}

describe('filterUsedPostsProperties と resolvePostsSchema の 5 項目の一致', () => {
  it('候補名に一致しない列を含む DB で、接続状況の表示と resolvePostsSchema の 5 項目の解決結果が一致する', () => {
    expect(filterUsedPostsProperties(UNRELATED_COLUMNS_PROPERTIES)).toEqual(['Name', 'DB_日報']);
    expect(displayedSchemaKeys(UNRELATED_COLUMNS_PROPERTIES)).toEqual(resolvedKeys(UNRELATED_COLUMNS_PROPERTIES));
  });

  it('候補名どおりの列名の DB でも、resolvePostsSchema の 5 項目の解決結果と一致する', () => {
    expect(displayedSchemaKeys(POSTS_PROPERTIES)).toEqual(resolvedKeys(POSTS_PROPERTIES));
  });

  it('作成日時・作成者を含む DB では、それらを除いた部分が resolvePostsSchema の 5 項目の解決結果と一致する', () => {
    for (const base of [UNRELATED_COLUMNS_PROPERTIES, POSTS_PROPERTIES]) {
      const properties = { ...base, ...AUTO_COLUMNS_PROPERTIES };
      expect(filterUsedPostsProperties(properties)).toEqual(expect.arrayContaining(['作成日時', '作成者']));
      expect(displayedSchemaKeys(properties)).toEqual(resolvedKeys(properties));
    }
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

  it('2回目以降はキャッシュを返し dataSources.retrieve を呼ばない', async () => {
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
    const { client, retrieve } = fakeNotion(POSTS_PROPERTIES);
    retrieve.mockRejectedValueOnce(new Error('network'));
    await expect(getPostsSchema(client, 'db1')).rejects.toThrow('network');
    await expect(getPostsSchema(client, 'db1')).resolves.toMatchObject({ titleKey: 'Name' });
  });
});

describe('データソースの解決', () => {
  beforeEach(() => invalidateSchemaCache());

  it('pickDataSource は先頭のデータソースと件数を返す', () => {
    expect(pickDataSource({ data_sources: [{ id: 'a' }] }, 'db')).toEqual({ dataSourceId: 'a', dataSourceCount: 1 });
    expect(pickDataSource({ data_sources: [{ id: 'a' }, { id: 'b' }] }, 'db')).toEqual({ dataSourceId: 'a', dataSourceCount: 2 });
  });

  it('データソースがない応答はエラーにする', () => {
    expect(() => pickDataSource({ data_sources: [] }, 'db')).toThrow('no data sources');
    expect(() => pickDataSource({}, 'db')).toThrow('no data sources');
    expect(() => pickDataSource(null, 'db')).toThrow('no data sources');
  });

  it('データソース ID をキャッシュし、スキーマ取得とも databases.retrieve を共有する', async () => {
    const { client, retrieve, retrieveDatabase } = fakeNotion(POSTS_PROPERTIES);
    expect(await getDataSourceId(client, 'db1')).toBe('ds-db1');
    await getPostsSchema(client, 'db1');
    expect(await getDataSourceId(client, 'db1')).toBe('ds-db1');
    expect(retrieveDatabase).toHaveBeenCalledTimes(1);
    expect(retrieve).toHaveBeenCalledWith({ data_source_id: 'ds-db1' });
  });

  it('invalidateSchemaCache でデータソース ID も取得し直す', async () => {
    const { client, retrieveDatabase } = fakeNotion(POSTS_PROPERTIES);
    await getDataSourceId(client, 'db1');
    invalidateSchemaCache('db1');
    await getDataSourceId(client, 'db1');
    expect(retrieveDatabase).toHaveBeenCalledTimes(2);
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

  it('候補名に一致しなくても date 型の列にフォールバックする', async () => {
    const { client } = fakeNotion({ 名前: { type: 'title' }, いつ: { type: 'date' } });
    expect(await getDailyReportDateKey(client, 'daily')).toBe('いつ');
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
