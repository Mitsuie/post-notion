/**
 * 日付・時刻のフォーマット共通ユーティリティ
 */

// 表示用日時フォーマット (今年: "9/23 00:45"、過去年・未来年: "2025/9/23 00:45")
export function formatDate(isoString: string): string {
  try {
    const d = new Date(isoString);
    const now = new Date();
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    const day = d.getDate();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    if (year !== now.getFullYear()) {
      return `${year}/${month}/${day} ${hours}:${minutes}`;
    }
    return `${month}/${day} ${hours}:${minutes}`;
  } catch {
    return isoString;
  }
}

// 完全日時フォーマット (ツールチップ用: "2026/9/23 00:45:00")
export function formatFullDate(isoString: string): string {
  try {
    return new Date(isoString).toLocaleString('ja-JP');
  } catch {
    return isoString;
  }
}

// クライアントのローカル当日日付文字列 (YYYY-MM-DD 形式)
export function getTodayLocalDateString(): string {
  return new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .format(new Date())
    .replace(/\//g, '-');
}
