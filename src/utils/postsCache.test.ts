import { describe, it, expect, beforeEach } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import type { Post, PostsPage } from '../types';
import {
  POSTS_QUERY_KEY,
  type PostsData,
  updatePost,
  prependPost,
  removePost,
  snapshotPosts,
  restorePosts,
} from './postsCache';

function post(id: string, extra: Partial<Post> = {}): Post {
  return { id, title: id, createdTime: '', createdBy: { id: 'u', name: 'u' }, tags: [], pinned: false, ...extra };
}

function page(ids: string[], hasMore = false): PostsPage {
  return { posts: ids.map((id) => post(id)), nextCursor: hasMore ? 'next' : null, hasMore };
}

function data(...pages: PostsPage[]): PostsData {
  return { pages, pageParams: pages.map((_, i) => (i === 0 ? null : `c${i}`)) };
}

function idsOf(qc: QueryClient, key: readonly unknown[] = POSTS_QUERY_KEY): string[][] {
  return qc.getQueryData<PostsData>(key)!.pages.map((p) => p.posts.map((x) => x.id));
}

describe('postsCache', () => {
  let qc: QueryClient;

  beforeEach(() => {
    qc = new QueryClient();
  });

  it('キャッシュ未取得のときは何もしない', () => {
    prependPost(qc, post('x'));
    updatePost(qc, 'x', (p) => ({ ...p, pinned: true }));
    removePost(qc, 'x');
    expect(qc.getQueryData(POSTS_QUERY_KEY)).toBeUndefined();
  });

  it('prependPost は1ページ目の先頭に挿入する', () => {
    qc.setQueryData(POSTS_QUERY_KEY, data(page(['a', 'b'], true), page(['c'])));
    prependPost(qc, post('new'));
    expect(idsOf(qc)).toEqual([['new', 'a', 'b'], ['c']]);
  });

  it('updatePost は2ページ目以降の投稿も更新し、ページ情報を保つ', () => {
    qc.setQueryData(POSTS_QUERY_KEY, data(page(['a'], true), page(['b'])));
    updatePost(qc, 'b', (p) => ({ ...p, commentsCount: 3 }));
    const cached = qc.getQueryData<PostsData>(POSTS_QUERY_KEY)!;
    expect(cached.pages[1].posts[0].commentsCount).toBe(3);
    expect(cached.pages[0].hasMore).toBe(true);
    expect(cached.pageParams).toEqual([null, 'c1']);
  });

  it('removePost はどのページからでも取り除く', () => {
    qc.setQueryData(POSTS_QUERY_KEY, data(page(['a', 'b'], true), page(['c', 'd'])));
    removePost(qc, 'c');
    expect(idsOf(qc)).toEqual([['a', 'b'], ['d']]);
  });

  it('クエリキーに条件が付いたエントリにも反映する', () => {
    const filteredKey = [...POSTS_QUERY_KEY, { tags: 't1' }];
    qc.setQueryData(POSTS_QUERY_KEY, data(page(['a'])));
    qc.setQueryData(filteredKey, data(page(['a'])));
    updatePost(qc, 'a', (p) => ({ ...p, pinned: true }));
    expect(qc.getQueryData<PostsData>(filteredKey)!.pages[0].posts[0].pinned).toBe(true);
  });

  it('snapshotPosts / restorePosts で操作前の状態に戻せる', () => {
    qc.setQueryData(POSTS_QUERY_KEY, data(page(['a', 'b'])));
    const snapshot = snapshotPosts(qc);
    prependPost(qc, post('new'));
    removePost(qc, 'a');
    restorePosts(qc, snapshot);
    expect(idsOf(qc)).toEqual([['a', 'b']]);
  });
});
