import { describe, it, expect, vi } from 'vitest';
import { findPropertyKey, filterUsedPostsProperties, parseTagsLimit, queryAll } from './notion.ts';

// has_more が false になるまで pages 件のページを返すテスト用の databases.query
function fakeNotion(pages: number) {
  const query = vi.fn(async ({ start_cursor }: { start_cursor?: string }) => {
    const index = start_cursor ? Number(start_cursor) : 0;
    const hasMore = index + 1 < pages;
    return {
      results: [{ id: `p${index}` }],
      has_more: hasMore,
      next_cursor: hasMore ? String(index + 1) : null,
    };
  });
  return { notion: { databases: { query } } as any, query };
}

describe('queryAll', () => {
  it('has_more がなくなるまで start_cursor で取得を続ける', async () => {
    const { notion, query } = fakeNotion(3);
    const results = await queryAll(notion, { database_id: 'db' });
    expect(results.map((r: any) => r.id)).toEqual(['p0', 'p1', 'p2']);
    expect(query).toHaveBeenCalledTimes(3);
    expect(query.mock.calls[0][0]).toMatchObject({ database_id: 'db', page_size: 100, start_cursor: undefined });
    expect(query.mock.calls[1][0]).toMatchObject({ start_cursor: '1' });
  });

  it('maxPages で打ち切る', async () => {
    const { notion, query } = fakeNotion(50);
    const results = await queryAll(notion, { database_id: 'db' }, 10);
    expect(results).toHaveLength(10);
    expect(query).toHaveBeenCalledTimes(10);
  });
});

describe('parseTagsLimit', () => {
  it('正の整数を返す（前後の空白は無視）', () => {
    expect(parseTagsLimit('1')).toBe(1);
    expect(parseTagsLimit(' 3 ')).toBe(3);
  });

  it('未指定・空文字・0以下・数値でない値は null（無制限）', () => {
    expect(parseTagsLimit(undefined)).toBeNull();
    expect(parseTagsLimit('')).toBeNull();
    expect(parseTagsLimit('0')).toBeNull();
    expect(parseTagsLimit('-1')).toBeNull();
    expect(parseTagsLimit('abc')).toBeNull();
  });
});

describe('findPropertyKey', () => {
  const properties = {
    名前: { type: 'title' },
    tags: { type: 'relation' },
    関連: { type: 'relation' },
    固定: { type: 'checkbox' },
  };

  it('候補名と大文字小文字を無視して一致し、型も一致するキーを返す', () => {
    expect(findPropertyKey(properties, ['Tags', 'タグ'], 'relation')).toBe('tags');
  });

  it('候補名の並び順を優先する', () => {
    expect(findPropertyKey(properties, ['関連', 'Tags'], 'relation')).toBe('関連');
  });

  it('名前が一致しても型が異なれば候補として扱わない', () => {
    expect(findPropertyKey(properties, ['固定'], 'relation')).toBe('tags');
  });

  it('候補名に一致しない場合は同じ型の最初のキーにフォールバックする', () => {
    expect(findPropertyKey(properties, ['Title'], 'title')).toBe('名前');
  });

  it('同じ型のプロパティがなければ undefined を返す', () => {
    expect(findPropertyKey(properties, ['数'], 'number')).toBeUndefined();
  });
});

describe('filterUsedPostsProperties', () => {
  it('利用中のプロパティのみを DB の定義順で返す', () => {
    const properties = {
      作成者: { type: 'created_by' },
      メモ: { type: 'rich_text' },
      Pinned: { type: 'checkbox' },
      Name: { type: 'title' },
      タグ: { type: 'relation' },
      作成日時: { type: 'created_time' },
      コメント数: { type: 'number' },
      日報: { type: 'relation' },
    };
    expect(filterUsedPostsProperties(properties)).toEqual([
      '作成者',
      'Pinned',
      'Name',
      'タグ',
      '作成日時',
      'コメント数',
      '日報',
    ]);
  });

  it('型フォールバックが許可された定義のみ、名前不一致でも型一致で拾う', () => {
    const properties = {
      見出し: { type: 'title' }, // title は型フォールバック可
      関連タグ: { type: 'relation' }, // relation は型フォールバック不可
      チェック: { type: 'checkbox' }, // checkbox は型フォールバック不可
      いつ: { type: 'created_time' }, // created_time は型フォールバック可
    };
    expect(filterUsedPostsProperties(properties)).toEqual(['見出し', 'いつ']);
  });

  it('候補名は大文字小文字を無視して一致する', () => {
    const properties = {
      TITLE: { type: 'title' },
      'comments count': { type: 'number' },
    };
    expect(filterUsedPostsProperties(properties)).toEqual(['TITLE', 'comments count']);
  });
});
