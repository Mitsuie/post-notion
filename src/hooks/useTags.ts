import { useQuery } from '@tanstack/react-query';
import type { TagsResponse } from '../types';
import { apiFetch } from '../utils/apiClient';

export function useTags() {
  return useQuery<TagsResponse>({
    queryKey: ['tags'],
    queryFn: async () => {
      return apiFetch<TagsResponse>('/api/tags');
    },
    staleTime: 1000 * 60 * 60 * 24, // 24時間キャッシュ保持
    gcTime: 1000 * 60 * 60 * 48,
  });
}
