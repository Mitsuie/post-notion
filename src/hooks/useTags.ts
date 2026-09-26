import { useQuery } from '@tanstack/react-query';
import type { Tag } from '../types';
import { apiFetch } from '../utils/apiClient';

export function useTags() {
  return useQuery<{ tags: Tag[]; configured?: boolean }>({
    queryKey: ['tags'],
    queryFn: async () => {
      return apiFetch<{ tags: Tag[]; configured?: boolean }>('/api/tags');
    },
    staleTime: 1000 * 60 * 60 * 24, // 24時間キャッシュ保持
    gcTime: 1000 * 60 * 60 * 48,
  });
}
