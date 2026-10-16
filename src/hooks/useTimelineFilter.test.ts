import { describe, it, expect } from 'vitest';
import { toPostsQueryParams, DEFAULT_FILTER, type FilterState } from './useTimelineFilter';

// タイムゾーンに依存しないよう、現在時刻・期待値ともローカル時刻で組み立てる
const NOW = new Date(2026, 9, 14, 12, 34, 56);

function filterOf(patch: Partial<FilterState>): FilterState {
  return { ...DEFAULT_FILTER, ...patch };
}

function localIso(...args: [number, number, number, number?, number?, number?, number?]): string {
  const [y, m, d, h = 0, mi = 0, s = 0, ms = 0] = args;
  return new Date(y, m, d, h, mi, s, ms).toISOString();
}

describe('toPostsQueryParams', () => {
  it('all は日付条件を付けない', () => {
    expect(toPostsQueryParams(filterOf({ datePreset: 'all' }), 'desc', true, NOW)).toEqual({
      order: 'desc',
      pin: '1',
    });
  });

  it('today はローカル日付の 0:00 以降', () => {
    expect(toPostsQueryParams(filterOf({ datePreset: 'today' }), 'desc', false, NOW).from).toBe(
      localIso(2026, 9, 14)
    );
  });

  it('7d / 30d は N 日前の 0:00 以降（現在時刻ではなく日付単位に丸める）', () => {
    expect(toPostsQueryParams(filterOf({ datePreset: '7d' }), 'desc', false, NOW).from).toBe(
      localIso(2026, 9, 7)
    );
    expect(toPostsQueryParams(filterOf({ datePreset: '30d' }), 'desc', false, NOW).from).toBe(
      localIso(2026, 8, 14)
    );
  });

  it('同じ日のうちは現在時刻が変わっても同じ条件になる（キャッシュが効く）', () => {
    const filter = filterOf({ datePreset: '7d' });
    const morning = toPostsQueryParams(filter, 'desc', true, new Date(2026, 9, 14, 0, 0, 1));
    const night = toPostsQueryParams(filter, 'desc', true, new Date(2026, 9, 14, 23, 59, 59));
    expect(morning).toEqual(night);
  });

  it('月をまたぐ日付も正しく計算する', () => {
    expect(
      toPostsQueryParams(filterOf({ datePreset: '7d' }), 'desc', false, new Date(2026, 2, 3, 9)).from
    ).toBe(localIso(2026, 1, 24));
  });

  it('custom は開始日の 00:00 と終了日の 23:59:59.999 を含む', () => {
    const params = toPostsQueryParams(
      filterOf({ datePreset: 'custom', customStartDate: '2026-10-01', customEndDate: '2026-10-10' }),
      'desc',
      false,
      NOW
    );
    expect(params.from).toBe(localIso(2026, 9, 1));
    expect(params.to).toBe(localIso(2026, 9, 10, 23, 59, 59, 999));
  });

  it('custom で片方のみ指定した場合はその条件のみ', () => {
    const onlyEnd = toPostsQueryParams(
      filterOf({ datePreset: 'custom', customEndDate: '2026-10-10' }),
      'desc',
      false,
      NOW
    );
    expect(onlyEnd.from).toBeUndefined();
    expect(onlyEnd.to).toBe(localIso(2026, 9, 10, 23, 59, 59, 999));
  });

  it('custom で不正な日付は無視する', () => {
    const params = toPostsQueryParams(
      filterOf({ datePreset: 'custom', customStartDate: 'invalid' }),
      'desc',
      false,
      NOW
    );
    expect(params.from).toBeUndefined();
  });

  it('タグは並べ替えてカンマ区切りにする（選択順に依存しない）', () => {
    const a = toPostsQueryParams(filterOf({ selectedTagIds: ['t2', 't1'] }), 'desc', false, NOW);
    const b = toPostsQueryParams(filterOf({ selectedTagIds: ['t1', 't2'] }), 'desc', false, NOW);
    expect(a.tags).toBe('t1,t2');
    expect(a).toEqual(b);
  });

  it('タグ未選択なら tags を付けない', () => {
    expect(toPostsQueryParams(filterOf({ selectedTagIds: [] }), 'desc', false, NOW).tags).toBeUndefined();
  });

  it('並び順とピン留め優先を反映する', () => {
    expect(toPostsQueryParams(DEFAULT_FILTER, 'asc', false, NOW)).toMatchObject({ order: 'asc', pin: '0' });
    expect(toPostsQueryParams(DEFAULT_FILTER, 'desc', true, NOW)).toMatchObject({ order: 'desc', pin: '1' });
  });
});

describe('toPostsQueryParams（キーワード）', () => {
  it('前後の空白を除いて q に設定し、空なら付けない', () => {
    expect(toPostsQueryParams(filterOf({ keyword: '  Notion  ' }), 'desc', false, NOW).q).toBe('Notion');
    expect(toPostsQueryParams(filterOf({ keyword: '   ' }), 'desc', false, NOW).q).toBeUndefined();
  });

  it('100 文字で切り詰める（絵文字を分断しない）', () => {
    const q = toPostsQueryParams(filterOf({ keyword: '😀'.repeat(150) }), 'desc', false, NOW).q!;
    expect(Array.from(q)).toHaveLength(100);
  });
});
