import { Hono } from 'hono';
import { NotionToMarkdown } from 'notion-to-md';
import type {
  Bindings,
  PostItem,
  CreatePostPayload,
  UpdatePostPayload,
  CommentItem,
  CreateCommentPayload,
} from '../types.ts';
import { getNotionClient, validateEnv } from '../notion.ts';
import { findPropertyKey } from '../utils/notion.ts';
import { parseMarkdownToNotionBlocks } from '../utils/markdownToNotion.ts';
import { resolveDailyReportPageId } from '../utils/dailyReport.ts';
import { syncCommentsCount, incrementCommentsCount } from '../utils/comments.ts';

export const postsRouter = new Hono<{ Bindings: Bindings }>();

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
      const tags = tagRelations.map((rel: { id: string }) => ({
        id: rel.id,
        name: '', // 詳細名はクライアント側でタグ一覧から解決
      }));

      // Pinned
      const pinnedKey = findPropertyKey(props, ['ピン止め', 'ピン留め', '固定', 'Pinned'], 'checkbox');
      const pinned = pinnedKey ? !!props[pinnedKey]?.checkbox : false;

      // Daily Report (Relation)
      const dailyReportKey = findPropertyKey(
        props,
        ['DB_日報', '日報', 'Daily Report', 'デイリー'],
        'relation'
      );
      const dailyRelations = dailyReportKey ? props[dailyReportKey]?.relation || [] : [];
      const dailyReport = dailyRelations.length > 0 ? { id: dailyRelations[0].id } : null;

      // Created By
      const createdBy = {
        id: page.created_by?.id || '',
        name: page.created_by?.name || 'User',
        avatarUrl: page.created_by?.avatar_url,
      };

      // Comments Count (Number)
      const commentsCountKey = findPropertyKey(
        props,
        ['コメント追加回数', 'Comments Count', 'コメント数', 'comments_count'],
        'number'
      );
      const commentsCount =
        commentsCountKey && typeof props[commentsCountKey]?.number === 'number'
          ? props[commentsCountKey].number
          : 0;

      return {
        id: page.id,
        title,
        createdTime: page.created_time,
        createdBy,
        tags,
        pinned,
        dailyReport,
        commentsCount,
        url: page.url,
      };
    });

    return c.json({ posts });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error('Failed to fetch posts from Notion:', error);
    return c.json({ error: 'Failed to fetch posts', message: errMsg }, 500);
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

    const titleKey =
      findPropertyKey(props, ['タイトル', '名前', 'Title', 'Name'], 'title') || 'タイトル';
    const tagsKey = findPropertyKey(props, ['タグ', 'Tags'], 'relation') || 'タグ';
    const pinnedKey =
      findPropertyKey(props, ['ピン止め', 'ピン留め', '固定', 'Pinned'], 'checkbox') ||
      'ピン止め';

    const sanitizedTitle = payload.title.replace(/[\r\n]+/g, ' ').trim();

    const properties: Record<string, any> = {
      [titleKey]: {
        title: [
          {
            text: {
              content: sanitizedTitle,
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

    // 日報リレーション設定（デフォルト適用: linkDailyReport !== false）
    let dailyReportLinked = false;
    let dailyReportWarning: string | undefined = undefined;

    if (
      payload.linkDailyReport !== false &&
      env.NOTION_DAILY_REPORT_DATABASE_ID &&
      env.NOTION_DAILY_REPORT_DATABASE_ID.trim()
    ) {
      const dailyResult = await resolveDailyReportPageId(
        notion,
        env.NOTION_DAILY_REPORT_DATABASE_ID,
        payload.clientDate
      );

      if (dailyResult.dailyPageId) {
        const dailyRelKey =
          findPropertyKey(props, ['DB_日報', '日報', 'Daily Report', 'デイリー'], 'relation') ||
          'DB_日報';
        if (props[dailyRelKey]) {
          properties[dailyRelKey] = {
            relation: [{ id: dailyResult.dailyPageId }],
          };
          dailyReportLinked = true;
        }
      } else {
        dailyReportWarning = dailyResult.warning;
      }
    }

    // コメント追加回数の初期化（0）
    const commentsCountKey = findPropertyKey(
      props,
      ['コメント追加回数', 'Comments Count', 'コメント数', 'comments_count'],
      'number'
    );
    if (commentsCountKey) {
      properties[commentsCountKey] = {
        number: 0,
      };
    }

    // Markdown本文をNotionネイティブ階層ブロック（children）へ変換
    let children: any[] | undefined = undefined;
    if (payload.body && payload.body.trim()) {
      const parsed = parseMarkdownToNotionBlocks(payload.body);
      if (parsed.length > 0) {
        children = parsed;
      }
    }

    const createdPage = await notion.pages.create({
      parent: { database_id: env.NOTION_POSTS_DATABASE_ID },
      properties,
      children,
    });

    return c.json({
      success: true,
      id: createdPage.id,
      dailyReportLinked,
      warning: dailyReportWarning,
    });
  } catch (error: any) {
    console.error('Failed to create post in Notion:', error);
    const errMsg = error?.message || String(error);
    if (
      errMsg.includes('limit of 1') ||
      (error?.code === 'validation_error' && errMsg.includes('limit'))
    ) {
      return c.json(
        {
          error: 'Failed to create post',
          message:
            'タグのリレーション設定が1件に制限されているため、複数タグを登録できません。タグを1件のみ選択して再送信してください。',
        },
        400
      );
    }
    return c.json({ error: 'Failed to create post', message: errMsg }, 500);
  }
});

// 投稿プロパティ更新（ピン留め動的トグルなど）
postsRouter.patch('/:id', async (c) => {
  const env = c.env;
  const validation = validateEnv(env);
  if (!validation.valid) {
    return c.json(
      { error: 'Environment variables not configured', missing: validation.missing },
      500
    );
  }

  const id = c.req.param('id');
  const payload = await c.req.json<UpdatePostPayload>();
  const notion = getNotionClient(env.NOTION_API_KEY);

  try {
    const db = await notion.databases.retrieve({ database_id: env.NOTION_POSTS_DATABASE_ID });
    const props = db.properties;
    const pinnedKey =
      findPropertyKey(props, ['ピン止め', 'ピン留め', '固定', 'Pinned'], 'checkbox') ||
      'ピン止め';

    const properties: Record<string, any> = {};
    if (typeof payload.pinned === 'boolean' && props[pinnedKey]) {
      properties[pinnedKey] = {
        checkbox: payload.pinned,
      };
    }

    await notion.pages.update({
      page_id: id,
      properties,
    });

    return c.json({
      success: true,
      id,
      pinned: payload.pinned,
    });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error(`Failed to update post ${id}:`, error);
    return c.json({ error: 'Failed to update post', message: errMsg }, 500);
  }
});

// 個別投稿の本文ブロックMarkdown取得
postsRouter.get('/:id/blocks', async (c) => {
  const env = c.env;
  const validation = validateEnv(env);
  if (!validation.valid) {
    return c.json(
      { error: 'Environment variables not configured', missing: validation.missing },
      500
    );
  }

  const id = c.req.param('id');
  const notion = getNotionClient(env.NOTION_API_KEY);

  try {
    const page: any = await notion.pages.retrieve({ page_id: id });
    const n2m = new NotionToMarkdown({ notionClient: notion });
    const mdblocks = await n2m.pageToMarkdown(id);
    const mdString = n2m.toMarkdownString(mdblocks);

    return c.json({
      markdown: mdString.parent || '',
      url: page.url || `https://notion.so/${id.replace(/-/g, '')}`,
    });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error(`Failed to fetch blocks for post ${id}:`, error);
    return c.json({ error: 'Failed to fetch blocks', message: errMsg }, 500);
  }
});

// コメント一覧取得
postsRouter.get('/:id/comments', async (c) => {
  const env = c.env;
  const validation = validateEnv(env);
  if (!validation.valid) {
    return c.json(
      { error: 'Environment variables not configured', missing: validation.missing },
      500
    );
  }

  const id = c.req.param('id');
  const notion = getNotionClient(env.NOTION_API_KEY);

  try {
    const res = await notion.comments.list({ block_id: id });
    const comments: CommentItem[] = res.results.map((comment: any) => {
      const text = comment.rich_text?.map((t: any) => t.plain_text).join('') || '';
      return {
        id: comment.id,
        discussionId: comment.discussion_id,
        text,
        createdTime: comment.created_time,
        createdBy: {
          id: comment.created_by?.id || '',
          name: comment.created_by?.name || 'User',
          avatarUrl: comment.created_by?.avatar_url,
        },
      };
    });

    const actualCount = res.results.length;

    // ハイブリッド補正: Notionページの「コメント追加回数」プロパティと実数を同期
    await syncCommentsCount(notion, id, actualCount);

    return c.json({ comments, commentsCount: actualCount });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error(`Failed to fetch comments for post ${id}:`, error);
    return c.json({ error: 'Failed to fetch comments', message: errMsg }, 500);
  }
});

// コメント投稿
postsRouter.post('/:id/comments', async (c) => {
  const env = c.env;
  const validation = validateEnv(env);
  if (!validation.valid) {
    return c.json(
      { error: 'Environment variables not configured', missing: validation.missing },
      500
    );
  }

  const id = c.req.param('id');
  const payload = await c.req.json<CreateCommentPayload>();
  const text = payload.text?.trim();

  if (!text) {
    return c.json({ error: 'Comment text is required' }, 400);
  }

  const notion = getNotionClient(env.NOTION_API_KEY);

  try {
    const createArgs: any = {
      rich_text: [
        {
          text: {
            content: text,
          },
        },
      ],
    };

    if (payload.discussionId) {
      createArgs.discussion_id = payload.discussionId;
    } else {
      createArgs.parent = {
        page_id: id,
      };
    }

    const comment: any = await notion.comments.create(createArgs);
    const resultItem: CommentItem = {
      id: comment.id,
      discussionId: comment.discussion_id,
      text: comment.rich_text?.map((t: any) => t.plain_text).join('') || text,
      createdTime: comment.created_time || new Date().toISOString(),
      createdBy: {
        id: comment.created_by?.id || '',
        name: comment.created_by?.name || 'User',
        avatarUrl: comment.created_by?.avatar_url,
      },
    };

    // コメント追加回数のインクリメント
    const updatedCount = await incrementCommentsCount(notion, id);

    return c.json({ comment: resultItem, commentsCount: updatedCount }, 201);
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error(`Failed to create comment for post ${id}:`, error);
    return c.json({ error: 'Failed to create comment', message: errMsg }, 500);
  }
});
