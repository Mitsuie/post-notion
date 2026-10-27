import { useQuery } from '@tanstack/react-query';
import type { AppConfig } from '../types';
import { apiFetch } from '../utils/apiClient';

// タグ DB・日報 DB が設定済みか（環境変数のみで判定され、Notion API は呼ばれない）
export function useAppConfig() {
  return useQuery<AppConfig>({
    queryKey: ['app-config'],
    queryFn: async () => {
      return apiFetch<AppConfig>('/api/config');
    },
    staleTime: 1000 * 60 * 60 * 24, // 24時間キャッシュ保持
    gcTime: 1000 * 60 * 60 * 48,
  });
}
