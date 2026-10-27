/**
 * 最後の呼び出しから waitMs 経過後に 1 回だけ fn を実行するデバウンス関数
 * - flush(): 待機中の呼び出しがあれば即時に実行する（ページ離脱時の保存など）
 * - cancel(): 待機中の呼び出しを実行せずに破棄する
 */
export interface Debounced<A extends unknown[]> {
  (...args: A): void;
  flush(): void;
  cancel(): void;
}

export function debounce<A extends unknown[]>(fn: (...args: A) => void, waitMs: number): Debounced<A> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pendingArgs: A | null = null;

  const cancel = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
    pendingArgs = null;
  };

  const flush = () => {
    if (pendingArgs === null) return;
    const args = pendingArgs;
    cancel();
    fn(...args);
  };

  const debounced = (...args: A) => {
    if (timer !== null) clearTimeout(timer);
    pendingArgs = args;
    timer = setTimeout(flush, waitMs);
  };

  return Object.assign(debounced, { flush, cancel });
}
