import { useQuery } from '@tanstack/react-query';
import type { StatusData } from '../types';
import { apiFetch } from '../utils/apiClient';

interface UseSystemStatusOptions {
  enabled?: boolean;
}

export function useSystemStatus(options?: UseSystemStatusOptions) {
  const query = useQuery<StatusData>({
    queryKey: ['system-status'],
    queryFn: async () => {
      return apiFetch<StatusData>('/api/status');
    },
    staleTime: 1000 * 60 * 60 * 24, // 24時間キャッシュ
    gcTime: 1000 * 60 * 60 * 48,
    enabled: options?.enabled ?? true,
  });

  // dailyReportDb / tagsDb が明示的に configured: true の場合のみ有効と判定
  const isDailyReportConfigured = !!query.data?.dailyReportDb?.configured;
  const isTagsConfigured = !!query.data?.tagsDb?.configured;

  // dailyReportDb / tagsDb が実際に利用可能（設定済み かつ 接続疎通OK）か判定
  const isDailyReportAccessible = isDailyReportConfigured && !!query.data?.dailyReportDb?.connected;
  const isTagsAccessible = isTagsConfigured && !!query.data?.tagsDb?.connected;

  return {
    ...query,
    statusData: query.data,
    isDailyReportConfigured,
    isTagsConfigured,
    isDailyReportAccessible,
    isTagsAccessible,
  };
}
