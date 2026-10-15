import { describe, it, expect } from 'vitest';
import { parsePostsQueryParams, buildPostsQuery, MAX_TAG_FILTERS, type PostsQueryParams } from './postsQuery.ts';
import { isNotionId } from './validate.ts';

const TAG_A = '0123456789abcdef0123456789abcdef';
const TAG_B = '01234567-89ab-cdef-0123-456789abcdef';
const SCHEMA = { tagsKey: 'タグ', pinnedKey: 'ピン止め' };

function params(patch: Partial<PostsQueryParams> = {}): PostsQueryParams {
  return { tags: [], order: 'desc', pin: false, ...patch };
}

describe('parsePostsQueryParams', () => {
  it('未指定なら既定値（降順・ピン優先なし・条件なし）', () => {
    expect(parsePostsQueryParams({})).toEqual({
      from: undefined,
      to: undefined,
      tags: [],
      order: 'desc',
      pin: false,
      cursor: undefined,
    });
  });

  it('日付は ISO 8601 に正規化し、解釈できない値は無視する', () => {
    const parsed = parsePostsQueryParams({ from: '2026-10-01T00:00:00+09:00', to: 'not-a-date' });
    expect(parsed.from).toBe('2026-09-30T15:00:00.000Z');
    expect(parsed.to).toBeUndefined();
  });

  it('タグは ID 形式のもののみ採用し、件数を制限する', () => {
    expect(parsePostsQueryParams({ tags: `${TAG_A}, ${TAG_B},bad,,x"y` }).tags).toEqual([TAG_A, TAG_B]);
    const many = Array.from({ length: MAX_TAG_FILTERS + 5 }, () => TAG_A).join(',');
    expect(parsePostsQueryParams({ tags: many }).tags).toHaveLength(MAX_TAG_FILTERS);
  });

  it('order は asc 以外を desc、pin は 1 のみ true とする', () => {
    expect(parsePostsQueryParams({ order: 'asc', pin: '1' })).toMatchObject({ order: 'asc', pin: true });
    expect(parsePostsQueryParams({ order: 'DROP', pin: 'true' })).toMatchObject({ order: 'desc', pin: false });
  });

  it('cursor は前後の空白を除き、空なら undefined', () => {
    expect(parsePostsQueryParams({ cursor: ' abc ' }).cursor).toBe('abc');
    expect(parsePostsQueryParams({ cursor: '' }).cursor).toBeUndefined();
  });
});

describe('buildPostsQuery', () => {
  it('条件なしなら filter を付けず、作成日時の降順のみ', () => {
    expect(buildPostsQuery(params(), SCHEMA)).toEqual({
      sorts: [{ timestamp: 'created_time', direction: 'descending' }],
    });
  });

  it('作成日の範囲を and で結合する', () => {
    const query = buildPostsQuery(params({ from: 'F', to: 'T' }), SCHEMA)!;
    expect(query.filter).toEqual({
      and: [
        { timestamp: 'created_time', created_time: { on_or_after: 'F' } },
        { timestamp: 'created_time', created_time: { on_or_before: 'T' } },
      ],
    });
  });

  it('タグは OR 条件で、日付条件と and で結合する', () => {
    const query = buildPostsQuery(params({ from: 'F', tags: [TAG_A, TAG_B] }), SCHEMA)!;
    expect(query.filter).toEqual({
      and: [
        { timestamp: 'created_time', created_time: { on_or_after: 'F' } },
        {
          or: [
            { property: 'タグ', relation: { contains: TAG_A } },
            { property: 'タグ', relation: { contains: TAG_B } },
          ],
        },
      ],
    });
  });

  it('タグ条件があるのにタグプロパティがなければ null（該当なし）', () => {
    expect(buildPostsQuery(params({ tags: [TAG_A] }), {})).toBeNull();
  });

  it('ピン留め優先はピン留めプロパティの降順を先頭に加える', () => {
    expect(buildPostsQuery(params({ pin: true, order: 'asc' }), SCHEMA)!.sorts).toEqual([
      { property: 'ピン止め', direction: 'descending' },
      { timestamp: 'created_time', direction: 'ascending' },
    ]);
  });

  it('ピン留めプロパティがなければピン留め優先は無視する', () => {
    expect(buildPostsQuery(params({ pin: true }), {})!.sorts).toEqual([
      { timestamp: 'created_time', direction: 'descending' },
    ]);
  });

  it('cursor を start_cursor に渡す', () => {
    expect(buildPostsQuery(params({ cursor: 'c1' }), SCHEMA)!.start_cursor).toBe('c1');
  });
});

describe('isNotionId', () => {
  it('32桁の16進数とハイフン付き UUID を受け付ける', () => {
    expect(isNotionId(TAG_A)).toBe(true);
    expect(isNotionId(TAG_B)).toBe(true);
    expect(isNotionId(TAG_A.toUpperCase())).toBe(true);
  });

  it('それ以外は受け付けない', () => {
    expect(isNotionId('')).toBe(false);
    expect(isNotionId(TAG_A.slice(1))).toBe(false);
    expect(isNotionId(`${TAG_A}0`)).toBe(false);
    expect(isNotionId('../etc/passwd')).toBe(false);
  });
});
