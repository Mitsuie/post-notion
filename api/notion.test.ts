import { describe, it, expect, afterEach, vi } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getNotionClient } from './notion.ts';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('getNotionClient', () => {
  it('Workers と同じく WorkerGlobalScope がある環境でもトークンを拒否しない', async () => {
    // workerd には WorkerGlobalScope が存在し、SDK v5 はこれをブラウザと判定する
    vi.stubGlobal('WorkerGlobalScope', class {});
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ object: 'user', id: 'u' }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(getNotionClient('secret_test').users.me({})).resolves.toMatchObject({ id: 'u' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('Notion トークンの配信防止', () => {
  // dangerouslyAllowBrowser を許可している前提: Notion クライアントはフロントエンドのバンドルに含めない
  function listSourceFiles(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) return listSourceFiles(path);
      return /\.(ts|tsx)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [path] : [];
    });
  }

  it('src/ は api/ と @notionhq/client を import しない', () => {
    const offenders = listSourceFiles(join(import.meta.dirname, '..', 'src')).filter((file) =>
      /from\s+['"](?:@notionhq\/client|(?:\.\.\/)+api\/)/.test(readFileSync(file, 'utf-8'))
    );
    expect(offenders).toEqual([]);
  });
});
