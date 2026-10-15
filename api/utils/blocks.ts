/**
 * Notion のブロック送信上限に合わせた分割ユーティリティ
 * - children 配列は 1 リクエスト（1 階層）あたり 100 件まで
 */

export const CHILDREN_MAX = 100;

// 配列を size 件ずつに分割する
export function chunk<T>(items: T[], size: number): T[][] {
  if (size <= 0) throw new Error('size must be positive');
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size));
  }
  return result;
}

/**
 * ネストした children が 100 件を超える場合、超過分を親と同じ階層の兄弟として親の直後に出す
 * - 実用上まれなケースの簡易フォールバック（階層は 1 段浅くなるが、内容と順序は失わない）
 * - ルート配列自体の件数は制限しない（送信時に chunk で分割する）
 */
export function limitNestedChildren(blocks: any[]): any[] {
  const result: any[] = [];
  for (const block of blocks) {
    const body = block[block.type];
    if (body && Array.isArray(body.children)) {
      const children = limitNestedChildren(body.children);
      body.children = children.slice(0, CHILDREN_MAX);
      result.push(block, ...children.slice(CHILDREN_MAX));
    } else {
      result.push(block);
    }
  }
  return result;
}
