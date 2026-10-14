import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { formatDate } from './date';

describe('formatDate', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // タイムゾーンに依存しないよう、現在時刻・入力ともローカル時刻で組み立てる
    vi.setSystemTime(new Date(2026, 9, 14, 12, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('今年の日時は年を省略し、時・分を2桁で表示する', () => {
    expect(formatDate(new Date(2026, 8, 3, 7, 5).toISOString())).toBe('9/3 07:05');
  });

  it('過去年の日時は年を含めて表示する', () => {
    expect(formatDate(new Date(2025, 11, 31, 23, 59).toISOString())).toBe('2025/12/31 23:59');
  });

  it('未来年の日時は年を含めて表示する', () => {
    expect(formatDate(new Date(2027, 0, 1, 0, 0).toISOString())).toBe('2027/1/1 00:00');
  });
});
