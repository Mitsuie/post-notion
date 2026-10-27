export type Bindings = {
  NOTION_API_KEY: string;
  NOTION_POSTS_DATABASE_ID: string;
  NOTION_TAGS_DATABASE_ID?: string;
  NOTION_TAGS_LIMIT?: string;
  NOTION_DAILY_REPORT_DATABASE_ID?: string;
};

export type PostItem = {
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
    name: string;
  }[];
  pinned: boolean;
  dailyReport?: {
    id: string;
  } | null;
  commentsCount?: number;
  url?: string;
};

export type TagItem = {
  id: string;
  name: string;
};

export type TagsResponse = {
  tags: TagItem[];
  configured?: boolean;
  limit?: number | null;
};

// GET /api/config のレスポンス（環境変数のみで判定）
export type AppConfigResponse = {
  tagsConfigured: boolean;
  dailyReportConfigured: boolean;
};

export type CreatePostPayload = {
  title: string;
  body?: string;
  tagIds?: string[];
  pinned?: boolean;
  linkDailyReport?: boolean;
  clientDate?: string;
};

export type UpdatePostPayload = {
  pinned?: boolean;
  archived?: boolean; // true でページをアーカイブ（Notion のゴミ箱へ移動）
  title?: string; // タイトルの変更（改行はスペースに置換）
};

export type CommentItem = {
  id: string;
  discussionId: string;
  text: string;
  createdTime: string;
  createdBy: {
    id: string;
    name: string;
    avatarUrl?: string;
  };
};

export type CreateCommentPayload = {
  text: string;
  discussionId?: string;
};

