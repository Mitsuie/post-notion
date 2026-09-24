import { Hono } from 'hono';
import type { Bindings, PostItem, CreatePostPayload } from '../types.ts';
import { getNotionClient, validateEnv } from '../notion.ts';

export const postsRouter = new Hono<{ Bindings: Bindings }>();

// プロパティキーの自動検出ヘルパー
function findPropertyKey(properties: Record<string, any>, candidateNames: string[], type: string): string | undefined {
  // 1. 完全一致（大文字小文字無視）
  for (const name of candidateNames) {
    const found = Object.keys(properties).find(
      (k) => k.toLowerCase() === name.toLowerCase() && properties[k].type === type
    );
    if (found) return found;
  }
  // 2. タイプ一致の最初のもの
  return Object.keys(properties).find((k) => properties[k].type === type);
}

// タイムライン一覧取得
postsRouter.get('/', async (c) => {
  const env = c.env;
  const validation = validateEnv(env);
  if (!validation.valid) {
    return c.json(
      { error: 'Environment variables not configured', missing: validation.missing },
      500
    );
  }

  const notion = getNotionClient(env.NOTION_API_KEY);

  try {
    const response = await notion.databases.query({
      database_id: env.NOTION_POSTS_DATABASE_ID,
      sorts: [
        {
          timestamp: 'created_time',
          direction: 'descending',
        },
      ],
      page_size: 50,
    });

    const posts: PostItem[] = response.results.map((page: any) => {
      const props = page.properties;

      // Title
      const titleKey = findPropertyKey(props, ['Title', 'タイトル', '名前', 'Name'], 'title');
      const title = titleKey ? props[titleKey]?.title?.[0]?.plain_text || '' : '';

      // Tags (Relation)
      const tagsKey = findPropertyKey(props, ['Tags', 'タグ'], 'relation');
      const tagRelations = tagsKey ? props[tagsKey]?.relation || [] : [];
      const tags = tagRelations.map((rel: any) => ({
        id: rel.id,
        name: '', // 詳細名はクライアント側でタグ一覧から解決可能
      }));

      // Pinned
      const pinnedKey = findPropertyKey(props, ['ピン止め', 'ピン留め', '固定', 'Pinned'], 'checkbox');
      const pinned = pinnedKey ? !!props[pinnedKey]?.checkbox : false;

      // Parent Post
      const parentKey = findPropertyKey(props, ['Parent Post', '親投稿', '親'], 'relation');
      const parentId = parentKey ? props[parentKey]?.relation?.[0]?.id : undefined;

      // Created By
      const createdBy = {
        id: page.created_by?.id || '',
        name: page.created_by?.name || 'User',
        avatarUrl: page.created_by?.avatar_url,
      };

      return {
        id: page.id,
        title,
        createdTime: page.created_time,
        createdBy,
        tags,
        pinned,
        parentId,
      };
    });

    return c.json({ posts });
  } catch (error: any) {
    console.error('Failed to fetch posts from Notion:', error);
    return c.json(
      { error: 'Failed to fetch posts', message: error.message || String(error) },
      500
    );
  }
});

// 新規投稿作成
postsRouter.post('/', async (c) => {
  const env = c.env;
  const validation = validateEnv(env);
  if (!validation.valid) {
    return c.json(
      { error: 'Environment variables not configured', missing: validation.missing },
      500
    );
  }

  const payload = await c.req.json<CreatePostPayload>();
  if (!payload.title || !payload.title.trim()) {
    return c.json({ error: 'Title is required' }, 400);
  }

  const notion = getNotionClient(env.NOTION_API_KEY);

  try {
    // データベーススキーマを取得してプロパティ名を自動解決
    const db = await notion.databases.retrieve({ database_id: env.NOTION_POSTS_DATABASE_ID });
    const props = db.properties;

    const titleKey = findPropertyKey(props, ['タイトル', '名前', 'Title', 'Name'], 'title') || 'タイトル';
    const tagsKey = findPropertyKey(props, ['タグ', 'Tags'], 'relation') || 'タグ';
    const pinnedKey = findPropertyKey(props, ['ピン止め', 'ピン留め', '固定', 'Pinned'], 'checkbox') || 'ピン止め';
    const parentKey = findPropertyKey(props, ['親投稿', 'Parent Post', '親'], 'relation') || '親投稿';

    const properties: Record<string, any> = {
      [titleKey]: {
        title: [
          {
            text: {
              content: payload.title,
            },
          },
        ],
      },
    };

    // タグリレーション設定
    if (payload.tagIds && payload.tagIds.length > 0 && props[tagsKey]) {
      properties[tagsKey] = {
        relation: payload.tagIds.map((id) => ({ id })),
      };
    }

    // ピン留め設定
    if (typeof payload.pinned === 'boolean' && props[pinnedKey]) {
      properties[pinnedKey] = {
        checkbox: payload.pinned,
      };
    }

    // 親投稿リレーション設定
    if (payload.parentId && props[parentKey]) {
      properties[parentKey] = {
        relation: [{ id: payload.parentId }],
      };
    }

    const createdPage = await notion.pages.create({
      parent: { database_id: env.NOTION_POSTS_DATABASE_ID },
      properties,
    });

    return c.json({
      success: true,
      id: createdPage.id,
    });
  } catch (error: any) {
    console.error('Failed to create post in Notion:', error);
    return c.json(
      { error: 'Failed to create post', message: error.message || String(error) },
      500
    );
  }
});
