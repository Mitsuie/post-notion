import { Hono } from 'hono';
import type { PageObjectResponse } from '@notionhq/client';
import type { Bindings, TagItem } from '../types.ts';
import { getNotionClient, validateEnv } from '../notion.ts';
import { parseTagsLimit, queryAll } from '../utils/notion.ts';
import { getDataSourceId } from '../utils/schema.ts';
import { toClientError } from '../utils/errors.ts';

export const tagsRouter = new Hono<{ Bindings: Bindings }>();

tagsRouter.get('/', async (c) => {
  const env = c.env;
  const validation = validateEnv(env);
  if (!validation.valid) {
    return c.json(
      { error: 'Environment variables not configured', missing: validation.missing },
      500
    );
  }

  if (!env.NOTION_TAGS_DATABASE_ID || !env.NOTION_TAGS_DATABASE_ID.trim()) {
    return c.json({ tags: [], configured: false });
  }

  const notion = getNotionClient(env.NOTION_API_KEY);

  try {
    // 100 件を超えるタグも取得できるよう、全ページを取得する
    const results = await queryAll(notion, {
      data_source_id: await getDataSourceId(notion, env.NOTION_TAGS_DATABASE_ID),
    });

    // 結果はページとして扱う（従来どおり Partial の応答やデータソースの行は判定しない）
    const tags: TagItem[] = (results as PageObjectResponse[])
      .map((page) => {
        // タイトルプロパティの探索 (Name, 名前, Title, タイトル等に柔軟に対応)
        const titlePropKey = Object.keys(page.properties).find(
          (key) => page.properties[key].type === 'title'
        );
        const titleObj = titlePropKey ? page.properties[titlePropKey] : null;
        const name = (titleObj?.type === 'title' ? titleObj.title?.[0]?.plain_text : undefined) || '名称未設定';

        return {
          id: page.id,
          name,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'ja', { numeric: true }));

    return c.json({ tags, configured: true, limit: parseTagsLimit(env.NOTION_TAGS_LIMIT) });
  } catch (error: unknown) {
    console.error('Failed to fetch tags from Notion:', error);
    const { status, message } = toClientError(error, 'タグ一覧の取得に失敗しました');
    return c.json({ error: 'Failed to fetch tags', message }, status);
  }
});
