export interface Tag {
  id: string;
  name: string; // 例: "02_運用 - Obsidian"
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
  parentId?: string;
  isOptimistic?: boolean; // 楽観的更新フラグ
}

export interface CreatePostInput {
  title: string;
  tagIds?: string[];
  pinned?: boolean;
  parentId?: string;
}
