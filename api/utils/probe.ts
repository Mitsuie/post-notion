import type { Client } from '@notionhq/client';
import type { Bindings } from '../types.ts';
import { findPropertyKey } from './notion.ts';

// サーバー起動中のインメモリキャッシュ
let cachedTagRelationLimit: number | null | undefined = undefined;

/**
 * テスト等でキャッシュをリセットするためのヘルパー
 */
export function resetTagRelationLimitCache(): void {
  cachedTagRelationLimit = undefined;
}

/**
 * 現在のキャッシュされた制限値を取得（同期）
 */
export function getCachedTagRelationLimit(): number | null | undefined {
  return cachedTagRelationLimit;
}

/**
 * タグリレーションの制限数（1件制限 or 無制限）を自動プローブ検知する
 * - 環境変数 NOTION_TAGS_LIMIT が指定されていればそれを最優先
 * - 既に判定結果がキャッシュされていればそれを即時返却
 * - タグが2件以上ある場合、ダミー作成を試行して判定
 *   - 1件制限の場合: Notionが400エラーを返しページは作成されない（完全クリーン）
 *   - 複数可の場合: 作成成功後、直ちにアーカイブ（ゴミ箱へ移動）
 */
export async function detectTagRelationLimit(
  env: Bindings,
  notion: Client,
  availableTagIds: string[]
): Promise<number | null> {
  // 1. キャッシュ済みなら即時返却
  if (cachedTagRelationLimit !== undefined) {
    return cachedTagRelationLimit;
  }

  // 2. 環境変数の指定があれば優先
  if (env.NOTION_TAGS_LIMIT && env.NOTION_TAGS_LIMIT.trim()) {
    const parsed = parseInt(env.NOTION_TAGS_LIMIT.trim(), 10);
    if (!isNaN(parsed) && parsed > 0) {
      cachedTagRelationLimit = parsed;
      return cachedTagRelationLimit;
    }
  }

  // 3. タグが2件未満の場合は2件プローブが実行不能なため未検出（null）
  if (!availableTagIds || availableTagIds.length < 2) {
    return null;
  }

  // 4. ダミー作成による自動プローブ
  try {
    const db = await notion.databases.retrieve({ database_id: env.NOTION_POSTS_DATABASE_ID });
    const props = db.properties;

    const titleKey = findPropertyKey(props, ['タイトル', '名前', 'Title', 'Name'], 'title') || 'タイトル';
    const tagsKey = findPropertyKey(props, ['タグ', 'Tags'], 'relation');

    if (!tagsKey || !props[tagsKey]) {
      cachedTagRelationLimit = null;
      return null;
    }

    try {
      const probePage = await notion.pages.create({
        parent: { database_id: env.NOTION_POSTS_DATABASE_ID },
        properties: {
          [titleKey]: {
            title: [
              {
                text: {
                  content: '[System Probe] Tag Limit Check',
                },
              },
            ],
          },
          [tagsKey]: {
            relation: [
              { id: availableTagIds[0] },
              { id: availableTagIds[1] },
            ],
          },
        },
      });

      // 成功した場合: 複数選択可能。作成されたダミーページは直ちにアーカイブしてゴミ箱へ
      try {
        await notion.pages.update({
          page_id: probePage.id,
          archived: true,
        });
      } catch (archiveErr: any) {
        console.warn('[probe] Failed to archive probe page:', archiveErr.message);
      }

      cachedTagRelationLimit = null; // null は無制限を表す
      console.log('[probe] Tag relation limit detection result: No limit (multiple allowed)');
      return null;
    } catch (probeError: any) {
      const errMsg = probeError?.message || String(probeError);
      // "Relation property ... has a limit of 1, but 2 values were provided." 判定
      if (errMsg.includes('limit of 1') || probeError?.code === 'validation_error' && errMsg.includes('limit')) {
        cachedTagRelationLimit = 1;
        console.log('[probe] Tag relation limit detection result: 1 page limit');
        return 1;
      }

      console.warn('[probe] Unexpected error during probe creation:', errMsg);
      // 予期しないエラー時はキャッシュを固定せず null を返す
      return null;
    }
  } catch (dbError: any) {
    console.warn('[probe] Failed to retrieve posts db schema for probe:', dbError.message);
    return null;
  }
}
