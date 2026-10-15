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
import { mapPageToPost } from '../utils/postMapper.ts';
import {
  getPostsSchema,
  invalidateSchemaCache,
  isValidationError,
} from '../utils/schema.ts';
import { parseMarkdownToNotionBlocks } from '../utils/markdownToNotion.ts';
import { toRichText } from '../utils/richText.ts';
import { chunk, CHILDREN_MAX } from '../utils/blocks.ts';
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

  // ページング用カーソル（前回レスポンスの nextCursor）。空の場合は先頭ページ
  const cursor = c.req.query('cursor')?.trim() || undefined;
  const notion = getNotionClient(env.NOTION_API_KEY);

  try {
    const response = await notion.databases.query({
      database_id: env.NOTION_POSTS_DATABASE_ID,
      start_cursor: cursor,
      sorts: [
        {
          timestamp: 'created_time',
          direction: 'descending',
        },
      ],
      page_size: 50,
    });

    const posts: PostItem[] = response.results.map(mapPageToPost);

    return c.json({
      posts,
      nextCursor: response.next_cursor,
      hasMore: response.has_more,
    });
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
    // データベースのプロパティ名を解決（5分間キャッシュ）
    const { titleKey, tagsKey, pinnedKey, dailyReportKey, commentsCountKey } =
      await getPostsSchema(notion, env.NOTION_POSTS_DATABASE_ID);

    const sanitizedTitle = payload.title.replace(/[\r\n]+/g, ' ').trim();

    const properties: Record<string, any> = {
      [titleKey]: {
        title: toRichText(sanitizedTitle).richText,
      },
    };

    // タグリレーション設定
    if (payload.tagIds && payload.tagIds.length > 0 && tagsKey) {
      properties[tagsKey] = {
        relation: payload.tagIds.map((id) => ({ id })),
      };
    }

    // ピン留め設定
    if (typeof payload.pinned === 'boolean' && pinnedKey) {
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
        if (dailyReportKey) {
          properties[dailyReportKey] = {
            relation: [{ id: dailyResult.dailyPageId }],
          };
          dailyReportLinked = true;
        }
      } else {
        dailyReportWarning = dailyResult.warning;
      }
    }

    // コメント追加回数の初期化（0）
    if (commentsCountKey) {
      properties[commentsCountKey] = {
        number: 0,
      };
    }

    // Markdown本文をNotionネイティブ階層ブロック（children）へ変換し、100件ずつに分割
    const blockChunks =
      payload.body && payload.body.trim()
        ? chunk(parseMarkdownToNotionBlocks(payload.body), CHILDREN_MAX)
        : [];

    // ページ作成時は先頭の100件のみ渡す
    const createdPage = await notion.pages.create({
      parent: { database_id: env.NOTION_POSTS_DATABASE_ID },
      properties,
      children: blockChunks[0],
    });

    // 残りのブロックは順番を保つため1件ずつ直列に追記する
    // ページ作成後に追記が失敗しても 500 は返さない（入力復元→再送による投稿の重複を防ぐ）
    const warnings: string[] = dailyReportWarning ? [dailyReportWarning] : [];
    for (const children of blockChunks.slice(1)) {
      try {
        await notion.blocks.children.append({ block_id: createdPage.id, children });
      } catch (appendError: unknown) {
        console.error(`Failed to append blocks to post ${createdPage.id}:`, appendError);
        warnings.push('本文の一部を Notion に追記できませんでした。Notion で確認してください。');
        break;
      }
    }

    return c.json({
      success: true,
      id: createdPage.id,
      dailyReportLinked,
      warning: warnings.length > 0 ? warnings.join('\n') : undefined,
    });
  } catch (error: any) {
    console.error('Failed to create post in Notion:', error);
    // Notion 側でプロパティ名が変更された可能性があるため、次回はスキーマを取得し直す
    if (isValidationError(error)) invalidateSchemaCache(env.NOTION_POSTS_DATABASE_ID);
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
    const { pinnedKey } = await getPostsSchema(notion, env.NOTION_POSTS_DATABASE_ID);

    const properties: Record<string, any> = {};
    if (typeof payload.pinned === 'boolean' && pinnedKey) {
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
    if (isValidationError(error)) invalidateSchemaCache(env.NOTION_POSTS_DATABASE_ID);
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
      rich_text: toRichText(text).richText,
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
