import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { matchesDateFilter, matchesTagFilter, DEFAULT_FILTER, type FilterState } from './useTimelineFilter';

const DAY_MS = 24 * 60 * 60 * 1000;
// タイムゾーンに依存しないよう、現在時刻はローカル時刻で固定する
const NOW = new Date(2026, 9, 14, 12, 0, 0);

function filterOf(patch: Partial<FilterState>): FilterState {
  return { ...DEFAULT_FILTER, ...patch };
}

function iso(date: Date | number): string {
  return new Date(date).toISOString();
}

describe('matchesDateFilter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('all はすべて一致する', () => {
    expect(matchesDateFilter(iso(new Date(2000, 0, 1)), filterOf({ datePreset: 'all' }))).toBe(true);
  });

  it('today はローカル日付の 0:00 以降のみ一致する', () => {
    const todayStart = new Date(2026, 9, 14, 0, 0, 0).getTime();
    const filter = filterOf({ datePreset: 'today' });
    expect(matchesDateFilter(iso(todayStart), filter)).toBe(true);
    expect(matchesDateFilter(iso(todayStart - 1), filter)).toBe(false);
  });

  it('7d は現在時刻から7日前以降のみ一致する', () => {
    const filter = filterOf({ datePreset: '7d' });
    expect(matchesDateFilter(iso(NOW.getTime() - 7 * DAY_MS), filter)).toBe(true);
    expect(matchesDateFilter(iso(NOW.getTime() - 7 * DAY_MS - 1), filter)).toBe(false);
  });

  it('30d は現在時刻から30日前以降のみ一致する', () => {
    const filter = filterOf({ datePreset: '30d' });
    expect(matchesDateFilter(iso(NOW.getTime() - 30 * DAY_MS), filter)).toBe(true);
    expect(matchesDateFilter(iso(NOW.getTime() - 30 * DAY_MS - 1), filter)).toBe(false);
  });

  it('custom の開始日は 00:00 を含む', () => {
    const filter = filterOf({ datePreset: 'custom', customStartDate: '2026-10-01' });
    const start = new Date(2026, 9, 1, 0, 0, 0).getTime();
    expect(matchesDateFilter(iso(start), filter)).toBe(true);
    expect(matchesDateFilter(iso(start - 1), filter)).toBe(false);
  });

  it('custom の終了日は 23:59:59.999 を含む', () => {
    const filter = filterOf({ datePreset: 'custom', customEndDate: '2026-10-10' });
    const end = new Date(2026, 9, 10, 23, 59, 59, 999).getTime();
    expect(matchesDateFilter(iso(end), filter)).toBe(true);
    expect(matchesDateFilter(iso(end + 1), filter)).toBe(false);
  });

  it('custom で開始日・終了日の両方を指定すると範囲内のみ一致する', () => {
    const filter = filterOf({ datePreset: 'custom', customStartDate: '2026-10-01', customEndDate: '2026-10-10' });
    expect(matchesDateFilter(iso(new Date(2026, 9, 5, 9, 0)), filter)).toBe(true);
    expect(matchesDateFilter(iso(new Date(2026, 8, 30, 9, 0)), filter)).toBe(false);
    expect(matchesDateFilter(iso(new Date(2026, 9, 11, 9, 0)), filter)).toBe(false);
  });

  it('custom で日付が未指定ならすべて一致する', () => {
    expect(matchesDateFilter(iso(new Date(2000, 0, 1)), filterOf({ datePreset: 'custom' }))).toBe(true);
  });
});

describe('matchesTagFilter', () => {
  const postTags = [{ id: 'a' }, { id: 'b' }];

  it('タグ未選択ならすべて一致する', () => {
    expect(matchesTagFilter([], [])).toBe(true);
    expect(matchesTagFilter(postTags, [])).toBe(true);
  });

  it('選択タグのいずれかを含めば一致する（OR 条件）', () => {
    expect(matchesTagFilter(postTags, ['x', 'b'])).toBe(true);
  });

  it('選択タグを1つも含まなければ一致しない', () => {
    expect(matchesTagFilter(postTags, ['x', 'y'])).toBe(false);
    expect(matchesTagFilter([], ['a'])).toBe(false);
  });
});
