/**
 * Notion API関連の共通ユーティリティ
 */

/**
 * Notion データベースのプロパティキーを候補名と型から自動検出するヘルパー
 * 1. 候補名との完全一致（大文字小文字無視）を優先探索
 * 2. 見つからない場合は指定された type に一致する最初のプロパティキーをフォールバックとして返却
 */
export function findPropertyKey(
  properties: Record<string, any>,
  candidateNames: string[],
  type: string
): string | undefined {
  // 1. 完全一致（大文字小文字無視）
  for (const name of candidateNames) {
    const found = Object.keys(properties).find(
      (k) => k.toLowerCase() === name.toLowerCase() && properties[k].type === type
    );
    if (found) return found;
  }
  // 2. タイプ一致の最初のもの
  return Object.keys(properties).find((k) => properties[k].type === type);
}
