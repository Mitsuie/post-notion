import type { Client } from '@notionhq/client';
import { getDailyReportDateKey } from './schema.ts';
import { toClientError } from './errors.ts';

export interface ResolveDailyReportResult {
  dailyPageId?: string;
  warning?: string;
}

/**
 * 日本時間（Asia/Tokyo）の当日日付（YYYY-MM-DD）を取得
 */
export function getJapanTodayDateString(): string {
  return new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .format(new Date())
    .replace(/\//g, '-');
}

/**
 * 日報データベースから指定日付（または当日）の日報ページIDを検索・解決するヘルパー
 */
export async function resolveDailyReportPageId(
  notion: Client,
  dailyDbId: string,
  clientDate?: string
): Promise<ResolveDailyReportResult> {
  try {
    // ターゲット日付の決定（クライアント指定またはAsia/Tokyo当日）
    let targetDate = clientDate;
    if (!targetDate || !/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
      targetDate = getJapanTodayDateString();
    }

    // 日報DBのプロパティから日付プロパティ名を自動解決（5分間キャッシュ）
    const dateKey = await getDailyReportDateKey(notion, dailyDbId);

    // 当日の日報ページをクエリ検索
    const dailyQuery = await notion.databases.query({
      database_id: dailyDbId,
      filter: {
        property: dateKey,
        date: {
          equals: targetDate,
        },
      },
      page_size: 1,
    });

    if (dailyQuery.results.length > 0) {
      return {
        dailyPageId: dailyQuery.results[0].id,
      };
    }

    const warning = `日付 ${targetDate} の日報ページが見つからなかったため、日報リレーション付与をスキップしました`;
    console.warn(`[dailyReport] ${warning}`);
    return { warning };
  } catch (error: unknown) {
    console.warn('[dailyReport] 日報リレーション解決中にエラーが発生:', error);
    // Notion の生のエラーメッセージは返さず、定型文に変換する
    const { message } = toClientError(error, '日報の検索に失敗しました');
    return {
      warning: `日報連携処理中にエラーが発生したためスキップしました（${message}）`,
    };
  }
}
