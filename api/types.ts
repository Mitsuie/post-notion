export type Bindings = {
  NOTION_API_KEY: string;
  NOTION_POSTS_DATABASE_ID: string;
  NOTION_TAGS_DATABASE_ID: string;
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
  commentsCount?: number;
  url?: string;
};

export type TagItem = {
  id: string;
  name: string;
};

export type CreatePostPayload = {
  title: string;
  body?: string;
  tagIds?: string[];
  pinned?: boolean;
};

export type UpdatePostPayload = {
  pinned?: boolean;
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

