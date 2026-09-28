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

/**
 * Post-Notion で利用される DB_Post-Notion のプロパティ定義一覧
 */
export const POSTS_DB_USED_PROPERTY_DEFINITIONS = [
  {
    name: 'タイトル',
    candidates: ['Title', 'タイトル', '名前', 'Name'],
    type: 'title',
    allowTypeFallback: true, // title型はNotion DBに1つのみ存在
  },
  {
    name: 'タグ',
    candidates: ['Tags', 'タグ'],
    type: 'relation',
    allowTypeFallback: false,
  },
  {
    name: 'ピン留め',
    candidates: ['ピン止め', 'ピン留め', '固定', 'Pinned'],
    type: 'checkbox',
    allowTypeFallback: false,
  },
  {
    name: '日報リレーション',
    candidates: ['DB_日報', '日報', 'Daily Report', 'デイリー'],
    type: 'relation',
    allowTypeFallback: false,
  },
  {
    name: 'コメント追加回数',
    candidates: ['コメント追加回数', 'Comments Count', 'コメント数', 'comments_count'],
    type: 'number',
    allowTypeFallback: false,
  },
  {
    name: '作成日時',
    candidates: ['作成日時', '作成日', 'Created time', 'Created Time'],
    type: 'created_time',
    allowTypeFallback: true,
  },
  {
    name: '作成者',
    candidates: ['作成者', 'Created by', 'Created By'],
    type: 'created_by',
    allowTypeFallback: true,
  },
] as const;

/**
 * DB_Post-Notion の全プロパティから、本アプリで利用しているプロパティ名のみを抽出するヘルパー
 */
export function filterUsedPostsProperties(properties: Record<string, any>): string[] {
  const usedKeySet = new Set<string>();

  for (const def of POSTS_DB_USED_PROPERTY_DEFINITIONS) {
    // 1. 候補名との完全一致（大文字小文字無視）かつ型一致
    const nameMatched = Object.keys(properties).find(
      (k) =>
        def.candidates.some((c) => c.toLowerCase() === k.toLowerCase()) &&
        properties[k].type === def.type
    );

    if (nameMatched) {
      usedKeySet.add(nameMatched);
      continue;
    }

    // 2. フォールバック（型一致）
    if (def.allowTypeFallback) {
      const typeMatched = Object.keys(properties).find((k) => properties[k].type === def.type);
      if (typeMatched) {
        usedKeySet.add(typeMatched);
      }
    }
  }

  // 元のデータベースのプロパティ定義順序を維持して返却
  return Object.keys(properties).filter((key) => usedKeySet.has(key));
}

