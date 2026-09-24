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
  parentId?: string;
  repliesCount?: number;
};

export type TagItem = {
  id: string;
  name: string;
};

export type CreatePostPayload = {
  title: string;
  tagIds?: string[];
  pinned?: boolean;
  parentId?: string;
};
