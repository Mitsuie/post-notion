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
import { parsePostsQueryParams, buildPostsQuery } from '../utils/postsQuery.ts';
import {
  getDataSourceId,
  getPostsSchema,
  invalidateSchemaCache,
  isValidationError,
} from '../utils/schema.ts';
import { parseMarkdownToNotionBlocks } from '../utils/markdownToNotion.ts';
import { toRichText } from '../utils/richText.ts';
import { chunk, CHILDREN_MAX } from '../utils/blocks.ts';
import { resolveDailyReportPageId } from '../utils/dailyReport.ts';
import { syncCommentsCount, incrementCommentsCount, listAllComments } from '../utils/comments.ts';
import { isNotionId, readJson, assertPostsPage } from '../utils/validate.ts';
import { toClientError } from '../utils/errors.ts';

export const postsRouter = new Hono<{ Bindings: Bindings }>();

const INVALID_ID_RESPONSE = { error: 'Invalid post id', message: '投稿IDの形式が正しくありません' };
const INVALID_JSON_RESPONSE = { error: 'Invalid request body', message: 'リクエストの形式が正しくありません' };

const isOptionalBoolean = (v: unknown) => v === undefined || typeof v === 'boolean';
const isOptionalString = (v: unknown) => v === undefined || typeof v === 'string';

// /:id 配下（本文・コメント）は投稿IDの形式を検証してから処理する
postsRouter.use('/:id/*', async (c, next) => {
  if (!isNotionId(c.req.param('id') ?? '')) {
    return c.json(INVALID_ID_RESPONSE, 400);
  }
  await next();
});

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

  // 作成日・タグ・並び順・カーソルの条件（不正な値は無視）
  const params = parsePostsQueryParams(c.req.query());
  const notion = getNotionClient(env.NOTION_API_KEY);

  try {
    // タグ・ピン留め・キーワードの条件があるときのみプロパティ名を解決する（5分間キャッシュ）
    const schema =
      params.tags.length > 0 || params.pin || params.q
        ? await getPostsSchema(notion, env.NOTION_POSTS_DATABASE_ID)
        : {};
    const query = buildPostsQuery(params, schema);
    // タグ条件があるのにタグプロパティが存在しない場合は該当なし
    if (!query) {
      return c.json({ posts: [], nextCursor: null, hasMore: false });
    }

    const response = await notion.dataSources.query({
      data_source_id: await getDataSourceId(notion, env.NOTION_POSTS_DATABASE_ID),
      ...query,
      page_size: 50,
    });

    const posts: PostItem[] = response.results.map(mapPageToPost);

    return c.json({
      posts,
      nextCursor: response.next_cursor,
      hasMore: response.has_more,
    });
  } catch (error: unknown) {
    console.error('Failed to fetch posts from Notion:', error);
    const { status, message } = toClientError(error, '投稿一覧の取得に失敗しました');
    return c.json({ error: 'Failed to fetch posts', message }, status);
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

  const payload = await readJson<CreatePostPayload>(c);
  if (
    !payload ||
    !isOptionalString(payload.body) ||
    !isOptionalBoolean(payload.pinned) ||
    !isOptionalBoolean(payload.linkDailyReport) ||
    !isOptionalString(payload.clientDate) ||
    (payload.tagIds !== undefined &&
      (!Array.isArray(payload.tagIds) ||
        !payload.tagIds.every((id) => typeof id === 'string' && isNotionId(id))))
  ) {
    return c.json(INVALID_JSON_RESPONSE, 400);
  }
  if (typeof payload.title !== 'string' || !payload.title.trim()) {
    return c.json({ error: 'Title is required', message: 'タイトルを入力してください' }, 400);
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
      parent: { data_source_id: await getDataSourceId(notion, env.NOTION_POSTS_DATABASE_ID) },
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
  } catch (error: unknown) {
    console.error('Failed to create post in Notion:', error);
    // Notion 側でプロパティ名が変更された可能性があるため、次回はスキーマを取得し直す
    if (isValidationError(error)) invalidateSchemaCache(env.NOTION_POSTS_DATABASE_ID);
    // タグ1件制限の超過は 400 と案内メッセージに変換される
    const { status, message } = toClientError(error, '投稿の作成に失敗しました');
    return c.json({ error: 'Failed to create post', message }, status);
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
  if (!isNotionId(id)) {
    return c.json(INVALID_ID_RESPONSE, 400);
  }
  const payload = await readJson<UpdatePostPayload>(c);
  const isArchive = payload?.archived === true;
  if (
    !payload ||
    !isOptionalBoolean(payload.archived) ||
    !isOptionalBoolean(payload.pinned) ||
    !isOptionalString(payload.title) ||
    (!isArchive && payload.pinned === undefined && payload.title === undefined)
  ) {
    return c.json(INVALID_JSON_RESPONSE, 400);
  }
  // タイトルは投稿時と同じく改行をスペースに置換して前後の空白を除く（空文字は不可）
  const newTitle = payload.title?.replace(/[\r\n]+/g, ' ').trim();
  if (payload.title !== undefined && !newTitle) {
    return c.json({ error: 'Title is required', message: 'タイトルを入力してください' }, 400);
  }
  const notion = getNotionClient(env.NOTION_API_KEY);

  try {
    // Posts DB に属するページのみ更新できる
    await assertPostsPage(notion, id, env.NOTION_POSTS_DATABASE_ID);

    // アーカイブ（Notion のゴミ箱へ移動。30日間は Notion 上で復元できる）
    if (isArchive) {
      await notion.pages.update({ page_id: id, archived: true });
      return c.json({ success: true, id, archived: true });
    }
    const { pinnedKey, titleKey } = await getPostsSchema(notion, env.NOTION_POSTS_DATABASE_ID);

    const properties: Record<string, any> = {};
    if (typeof payload.pinned === 'boolean' && pinnedKey) {
      properties[pinnedKey] = {
        checkbox: payload.pinned,
      };
    }
    if (newTitle) {
      // 2,000 文字を超えるタイトルも rich_text の複数要素に分割して保存する
      properties[titleKey] = { title: toRichText(newTitle).richText };
    }

    await notion.pages.update({
      page_id: id,
      properties,
    });

    return c.json({
      success: true,
      id,
      pinned: payload.pinned,
      title: newTitle,
    });
  } catch (error: unknown) {
    console.error(`Failed to update post ${id}:`, error);
    if (isValidationError(error)) invalidateSchemaCache(env.NOTION_POSTS_DATABASE_ID);
    const { status, message } = toClientError(
      error,
      isArchive ? '投稿の削除に失敗しました' : '投稿の更新に失敗しました'
    );
    return c.json({ error: 'Failed to update post', message }, status);
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
    // Posts DB に属するページの本文のみ返す（取得したページの url を使い回す）
    const page = await assertPostsPage(notion, id, env.NOTION_POSTS_DATABASE_ID);
    const n2m = new NotionToMarkdown({ notionClient: notion });
    const mdblocks = await n2m.pageToMarkdown(id);
    const mdString = n2m.toMarkdownString(mdblocks);

    return c.json({
      markdown: mdString.parent || '',
      url: page.url || `https://notion.so/${id.replace(/-/g, '')}`,
    });
  } catch (error: unknown) {
    console.error(`Failed to fetch blocks for post ${id}:`, error);
    const { status, message } = toClientError(error, '本文の取得に失敗しました');
    return c.json({ error: 'Failed to fetch blocks', message }, status);
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
    // Posts DB に属するページのみ（取得したページはコメント件数の同期で使い回す）
    const page = await assertPostsPage(notion, id, env.NOTION_POSTS_DATABASE_ID);

    const { results, truncated } = await listAllComments(notion, id);
    const comments: CommentItem[] = results.map((comment: any) => {
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

    // 上限ページ数で打ち切った場合は実数が分からないため、件数を同期せず返さない
    if (truncated) {
      return c.json({ comments });
    }

    const actualCount = results.length;

    // ハイブリッド補正: Notionページの「コメント追加回数」プロパティと実数を同期
    await syncCommentsCount(notion, id, actualCount, page);

    return c.json({ comments, commentsCount: actualCount });
  } catch (error: unknown) {
    console.error(`Failed to fetch comments for post ${id}:`, error);
    const { status, message } = toClientError(error, 'コメントの取得に失敗しました');
    return c.json({ error: 'Failed to fetch comments', message }, status);
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
  const payload = await readJson<CreateCommentPayload>(c);
  if (
    !payload ||
    !isOptionalString(payload.text) ||
    (payload.discussionId !== undefined &&
      (typeof payload.discussionId !== 'string' || !isNotionId(payload.discussionId)))
  ) {
    return c.json(INVALID_JSON_RESPONSE, 400);
  }
  const text = payload.text?.trim();

  if (!text) {
    return c.json({ error: 'Comment text is required', message: 'コメントを入力してください' }, 400);
  }

  const notion = getNotionClient(env.NOTION_API_KEY);

  try {
    // Posts DB に属するページのみコメントできる（取得したページはコメント件数の更新で使い回す）
    const page = await assertPostsPage(notion, id, env.NOTION_POSTS_DATABASE_ID);

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
    const updatedCount = await incrementCommentsCount(notion, id, page);

    return c.json({ comment: resultItem, commentsCount: updatedCount }, 201);
  } catch (error: unknown) {
    console.error(`Failed to create comment for post ${id}:`, error);
    const { status, message } = toClientError(error, 'コメントの送信に失敗しました');
    return c.json({ error: 'Failed to create comment', message }, status);
  }
});
