import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { debounce } from './debounce';

describe('debounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('連続呼び出しでは、最後の呼び出しの引数で 1 回だけ実行する', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 400);

    debounced('a');
    vi.advanceTimersByTime(300);
    debounced('ab');
    vi.advanceTimersByTime(300);
    debounced('abc');
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(399);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('abc');
  });

  it('flush で待機中の呼び出しを即時に実行し、その後タイマーでは再実行しない', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 400);

    debounced('abc');
    debounced.flush();
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('abc');

    vi.advanceTimersByTime(1000);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('待機中の呼び出しがなければ flush しても実行しない', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 400);

    debounced.flush();
    debounced('a');
    vi.advanceTimersByTime(400);
    debounced.flush();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('cancel で待機中の呼び出しを破棄し、タイマー経過後も flush 後も実行しない', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 400);

    debounced('古い内容');
    debounced.cancel();
    vi.advanceTimersByTime(1000);
    debounced.flush();
    expect(fn).not.toHaveBeenCalled();
  });

  it('cancel 後の新しい呼び出しは通常どおり実行する', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 400);

    debounced('古い内容');
    debounced.cancel();
    debounced('新しい内容');
    vi.advanceTimersByTime(400);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('新しい内容');
  });
});
