import { Hono } from 'hono';
import { NotionToMarkdown } from 'notion-to-md';
import type { Bindings, PostItem, CreatePostPayload, UpdatePostPayload, CommentItem, CreateCommentPayload } from '../types.ts';
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

// Markdownの行解析用型定義
interface ParsedMarkdownLine {
  level: number;
  type: 'bulleted_list_item' | 'numbered_list_item' | 'to_do' | 'quote' | 'heading_1' | 'heading_2' | 'heading_3' | 'paragraph';
  content: string;
  checked?: boolean;
}

// 1行のMarkdownを行頭インデントとブロック種別にパース
function parseMarkdownLine(line: string): ParsedMarkdownLine {
  const indentMatch = line.match(/^(\s*)/);
  const spaces = indentMatch ? indentMatch[1].replace(/\t/g, '  ').length : 0;
  const level = Math.floor(spaces / 2);
  const trimmed = line.trim();

  if (!trimmed) {
    return { level: 0, type: 'paragraph', content: '' };
  }

  // チェックボックス (To-Do): - [ ] または - [x]
  const todoMatch = trimmed.match(/^[-*+]\s+\[( |x|X)\]\s*(.*)$/);
  if (todoMatch) {
    return {
      level,
      type: 'to_do',
      checked: todoMatch[1].toLowerCase() === 'x',
      content: todoMatch[2],
    };
  }

  // 箇条書きリスト: - , * , +
  const bulletMatch = trimmed.match(/^[-*+]\s+(.*)$/);
  if (bulletMatch) {
    return {
      level,
      type: 'bulleted_list_item',
      content: bulletMatch[1],
    };
  }

  // 番号付きリスト: 1. , 2. 等
  const numberMatch = trimmed.match(/^\d+\.\s+(.*)$/);
  if (numberMatch) {
    return {
      level,
      type: 'numbered_list_item',
      content: numberMatch[1],
    };
  }

  // 引用: >
  const quoteMatch = trimmed.match(/^>\s*(.*)$/);
  if (quoteMatch) {
    return {
      level,
      type: 'quote',
      content: quoteMatch[1],
    };
  }

  // 見出し
  if (trimmed.startsWith('# ')) {
    return { level: 0, type: 'heading_1', content: trimmed.substring(2) };
  }
  if (trimmed.startsWith('## ')) {
    return { level: 0, type: 'heading_2', content: trimmed.substring(3) };
  }
  if (trimmed.startsWith('### ')) {
    return { level: 0, type: 'heading_3', content: trimmed.substring(4) };
  }

  return {
    level,
    type: 'paragraph',
    content: trimmed,
  };
}

// パース結果からNotion API用ブロックオブジェクトを生成
function createNotionBlock(item: ParsedMarkdownLine): any {
  const rich_text = item.content
    ? [{ type: 'text' as const, text: { content: item.content } }]
    : [];

  switch (item.type) {
    case 'bulleted_list_item':
      return {
        object: 'block' as const,
        type: 'bulleted_list_item' as const,
        bulleted_list_item: { rich_text },
      };
    case 'numbered_list_item':
      return {
        object: 'block' as const,
        type: 'numbered_list_item' as const,
        numbered_list_item: { rich_text },
      };
    case 'to_do':
      return {
        object: 'block' as const,
        type: 'to_do' as const,
        to_do: { rich_text, checked: !!item.checked },
      };
    case 'quote':
      return {
        object: 'block' as const,
        type: 'quote' as const,
        quote: { rich_text },
      };
    case 'heading_1':
      return {
        object: 'block' as const,
        type: 'heading_1' as const,
        heading_1: { rich_text },
      };
    case 'heading_2':
      return {
        object: 'block' as const,
        type: 'heading_2' as const,
        heading_2: { rich_text },
      };
    case 'heading_3':
      return {
        object: 'block' as const,
        type: 'heading_3' as const,
        heading_3: { rich_text },
      };
    case 'paragraph':
    default:
      return {
        object: 'block' as const,
        type: 'paragraph' as const,
        paragraph: { rich_text },
      };
  }
}

// Markdown文字列をNotionネイティブ階層ブロック構造（children）へ変換
function parseMarkdownToNotionBlocks(markdown: string): any[] {
  if (!markdown || !markdown.trim()) return [];

  const lines = markdown.split('\n');
  const rootBlocks: any[] = [];

  interface StackEntry {
    level: number;
    block: any;
    children: any[];
  }
  const stack: StackEntry[] = [];

  for (const rawLine of lines) {
    const item = parseMarkdownLine(rawLine);
    const block = createNotionBlock(item);

    // 見出しや空行はネストの親にせず、スタックをクリアしてルートに配置
    if (['heading_1', 'heading_2', 'heading_3'].includes(item.type) || !item.content) {
      stack.length = 0;
      rootBlocks.push(block);
      continue;
    }

    // ネスト深さはNotion API制限を考慮し最大2レベル（0, 1, 2）に丸める
    const targetLevel = Math.min(item.level, 2);

    if (targetLevel === 0) {
      stack.length = 0;
      rootBlocks.push(block);
      if (['bulleted_list_item', 'numbered_list_item', 'to_do', 'quote', 'paragraph'].includes(item.type)) {
        if (!block[item.type].children) {
          block[item.type].children = [];
        }
        stack.push({ level: 0, block, children: block[item.type].children });
      }
    } else {
      while (stack.length > 0 && stack[stack.length - 1].level >= targetLevel) {
        stack.pop();
      }

      if (stack.length > 0) {
        const parent = stack[stack.length - 1];
        parent.children.push(block);
        if (['bulleted_list_item', 'numbered_list_item', 'to_do', 'quote', 'paragraph'].includes(item.type)) {
          if (!block[item.type].children) {
            block[item.type].children = [];
          }
          stack.push({ level: targetLevel, block, children: block[item.type].children });
        }
      } else {
        rootBlocks.push(block);
        if (['bulleted_list_item', 'numbered_list_item', 'to_do', 'quote', 'paragraph'].includes(item.type)) {
          if (!block[item.type].children) {
            block[item.type].children = [];
          }
          stack.push({ level: 0, block, children: block[item.type].children });
        }
      }
    }
  }

  // childrenが空のブロックから children プロパティを削除（APIエラー防止）
  function cleanEmptyChildren(blocks: any[]) {
    for (const b of blocks) {
      const typeObj = b[b.type];
      if (typeObj && typeObj.children) {
        if (typeObj.children.length === 0) {
          delete typeObj.children;
        } else {
          cleanEmptyChildren(typeObj.children);
        }
      }
    }
  }
  cleanEmptyChildren(rootBlocks);

  return rootBlocks;
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

      // Daily Report (Relation)
      const dailyReportKey = findPropertyKey(props, ['DB_日報', '日報', 'Daily Report', 'デイリー'], 'relation');
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

    if (payload.linkDailyReport !== false && env.NOTION_DAILY_REPORT_DATABASE_ID && env.NOTION_DAILY_REPORT_DATABASE_ID.trim()) {
      try {
        const dailyDbId = env.NOTION_DAILY_REPORT_DATABASE_ID;
        // ターゲット日付を決定（クライアント指定日付、またはAsia/Tokyoの当日）
        let targetDate = payload.clientDate;
        if (!targetDate || !/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
          targetDate = new Intl.DateTimeFormat('ja-JP', {
            timeZone: 'Asia/Tokyo',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
          }).format(new Date()).replace(/\//g, '-');
        }

        // 日報DBのプロパティから日付プロパティ名を自動解決
        const dailyDb = await notion.databases.retrieve({ database_id: dailyDbId });
        const dateKey = findPropertyKey(dailyDb.properties, ['日付', 'Date', '作成日'], 'date') || '日付';

        // 当日の日報ページをクエリ検索
        const dailyQuery = await notion.databases.query({
          database_id: dailyDbId,
          filter: {
            property: dateKey,
            date: {
              equals: targetDate,
            },
          },
          page_size: 1,
        });

        if (dailyQuery.results.length > 0) {
          const dailyPageId = dailyQuery.results[0].id;
          const dailyRelKey = findPropertyKey(props, ['DB_日報', '日報', 'Daily Report', 'デイリー'], 'relation') || 'DB_日報';
          if (props[dailyRelKey]) {
            properties[dailyRelKey] = {
              relation: [{ id: dailyPageId }],
            };
            dailyReportLinked = true;
          }
        } else {
          // 当日の日報ページが見つからない場合: 仕様に基づきスキップ
          dailyReportLinked = false;
          dailyReportWarning = `日付 ${targetDate} の日報ページが見つからなかったため、日報リレーション付与をスキップしました`;
          console.warn(`[posts.post] ${dailyReportWarning}`);
        }
      } catch (dailyErr: any) {
        console.warn('Failed to resolve daily report relation, skipping:', dailyErr.message || dailyErr);
        dailyReportWarning = `日報連携処理中にエラーが発生したためスキップしました: ${dailyErr.message || String(dailyErr)}`;
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
    return c.json(
      { error: 'Failed to create post', message: error.message || String(error) },
      500
    );
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
    const pinnedKey = findPropertyKey(props, ['ピン止め', 'ピン留め', '固定', 'Pinned'], 'checkbox') || 'ピン止め';

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
  } catch (error: any) {
    console.error(`Failed to update post ${id}:`, error);
    return c.json(
      { error: 'Failed to update post', message: error.message || String(error) },
      500
    );
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
  } catch (error: any) {
    console.error(`Failed to fetch blocks for post ${id}:`, error);
    return c.json(
      { error: 'Failed to fetch blocks', message: error.message || String(error) },
      500
    );
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

    // ハイブリッド補正: Notionページの「コメント追加回数」プロパティと実数を突合し、差分があれば最新化
    try {
      const page: any = await notion.pages.retrieve({ page_id: id });
      const countKey = findPropertyKey(
        page.properties,
        ['コメント追加回数', 'Comments Count', 'コメント数', 'comments_count'],
        'number'
      );
      if (countKey) {
        const storedCount =
          typeof page.properties[countKey]?.number === 'number'
            ? page.properties[countKey].number
            : 0;
        if (storedCount !== actualCount) {
          await notion.pages.update({
            page_id: id,
            properties: {
              [countKey]: {
                number: actualCount,
              },
            },
          });
        }
      }
    } catch (syncErr) {
      console.warn(`Failed to sync commentsCount for page ${id}:`, syncErr);
    }

    return c.json({ comments, commentsCount: actualCount });
  } catch (error: any) {
    console.error(`Failed to fetch comments for post ${id}:`, error);
    return c.json(
      { error: 'Failed to fetch comments', message: error.message || String(error) },
      500
    );
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
    let updatedCount: number | undefined = undefined;
    try {
      const page: any = await notion.pages.retrieve({ page_id: id });
      const countKey = findPropertyKey(
        page.properties,
        ['コメント追加回数', 'Comments Count', 'コメント数', 'comments_count'],
        'number'
      );
      if (countKey) {
        const currentCount =
          typeof page.properties[countKey]?.number === 'number'
            ? page.properties[countKey].number
            : 0;
        updatedCount = currentCount + 1;
        await notion.pages.update({
          page_id: id,
          properties: {
            [countKey]: {
              number: updatedCount,
            },
          } as any,
        });
      }
    } catch (countErr) {
      console.warn(`Failed to increment commentsCount for page ${id}:`, countErr);
    }

    return c.json({ comment: resultItem, commentsCount: updatedCount }, 201);
  } catch (error: any) {
    console.error(`Failed to create comment for post ${id}:`, error);
    return c.json(
      { error: 'Failed to create comment', message: error.message || String(error) },
      500
    );
  }
});

