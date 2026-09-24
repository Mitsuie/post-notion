import { Hono } from 'hono';
import type { Bindings, TagItem } from '../types.ts';
import { getNotionClient, validateEnv } from '../notion.ts';

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

  const notion = getNotionClient(env.NOTION_API_KEY);

  try {
    const response = await notion.databases.query({
      database_id: env.NOTION_TAGS_DATABASE_ID,
      page_size: 100,
    });

    const tags: TagItem[] = response.results
      .map((page: any) => {
        // タイトルプロパティの探索 (Name, 名前, Title, タイトル等に柔軟に対応)
        const titlePropKey = Object.keys(page.properties).find(
          (key) => page.properties[key].type === 'title'
        );
        const titleObj = titlePropKey ? page.properties[titlePropKey] : null;
        const name = titleObj?.title?.[0]?.plain_text || '名称未設定';

        return {
          id: page.id,
          name,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'ja', { numeric: true }));

    return c.json({ tags });
  } catch (error: any) {
    console.error('Failed to fetch tags from Notion:', error);
    return c.json(
      { error: 'Failed to fetch tags', message: error.message || String(error) },
      500
    );
  }
});
