import { useQuery } from '@tanstack/react-query';
import type { Tag } from '../types';

export function useTags() {
  return useQuery<{ tags: Tag[]; configured?: boolean }>({
    queryKey: ['tags'],
    queryFn: async () => {
      const res = await fetch('/api/tags');
      if (!res.ok) {
        throw new Error('タグ一覧の取得に失敗しました');
      }
      return res.json();
    },
    staleTime: 1000 * 60 * 60 * 24, // 24時間キャッシュ保持
    gcTime: 1000 * 60 * 60 * 48,
  });
}
