import { Client } from '@notionhq/client';
import type { Bindings } from './types.ts';

export function getNotionClient(apiKey: string): Client {
  return new Client({ auth: apiKey });
}

export function validateEnv(env: Bindings): { valid: boolean; missing: string[] } {
  const missing: string[] = [];
  if (!env.NOTION_API_KEY) missing.push('NOTION_API_KEY');
  if (!env.NOTION_POSTS_DATABASE_ID) missing.push('NOTION_POSTS_DATABASE_ID');
  if (!env.NOTION_TAGS_DATABASE_ID) missing.push('NOTION_TAGS_DATABASE_ID');
  return { valid: missing.length === 0, missing };
}
