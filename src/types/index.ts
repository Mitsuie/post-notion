export interface Tag {
  id: string;
  name: string; // 例: "02_運用 - Obsidian"
}

export interface TagsResponse {
  tags: Tag[];
  configured?: boolean;
  limit?: number | null;
}

export interface Post {
  id: string;
  title: string;
  createdTime: string;
  createdBy: {
    id: string;
    name: string;
    avatarUrl?: string;
  };
  tags: {
    id: string;
    name?: string;
  }[];
  pinned: boolean;
  dailyReport?: {
    id: string;
  } | null;
  commentsCount?: number;
  url?: string;
  isOptimistic?: boolean; // 楽観的更新フラグ
}

// GET /api/posts の1ページ分のレスポンス
export interface PostsPage {
  posts: Post[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface CreatePostInput {
  title: string;
  body?: string;
  tagIds?: string[];
  pinned?: boolean;
  linkDailyReport?: boolean;
  clientDate?: string;
}

// POST /api/posts のレスポンス
export interface CreatePostResult {
  success: boolean;
  id: string;
  dailyReportLinked: boolean;
  // 日報未連携・本文の一部追記失敗など、投稿自体は成功したが利用者に知らせたい内容
  warning?: string;
}

export interface PostComment {
  id: string;
  discussionId: string;
  text: string;
  createdTime: string;
  createdBy: {
    id: string;
    name: string;
    avatarUrl?: string;
  };
  isOptimistic?: boolean;
}

export interface CreateCommentInput {
  text: string;
  discussionId?: string;
}

export interface StatusData {
  status: 'ok' | 'degraded' | 'error';
  timestamp: string;
  environment?: {
    configured: boolean;
    notionApiKeyConfigured?: boolean;
    missing?: string[];
  };
  postsDb?: {
    connected: boolean;
    title?: string;
    idMasked?: string;
    properties?: string[];
    error?: string;
  };
  tagsDb?: {
    connected: boolean;
    configured?: boolean;
    title?: string;
    idMasked?: string;
    tagsCount?: number;
    error?: string;
  };
  dailyReportDb?: {
    connected: boolean;
    configured?: boolean;
    title?: string;
    idMasked?: string;
    properties?: string[];
    error?: string;
  };
}

