import { describe, it, expect } from 'vitest';
import { mapPageToPost } from './postMapper.ts';

const basePage = {
  id: 'page-1',
  created_time: '2026-10-14T00:00:00.000Z',
  created_by: { id: 'user-1', name: 'Mitsuie', avatar_url: 'https://example.com/a.png' },
  url: 'https://www.notion.so/page-1',
};

describe('mapPageToPost', () => {
  it('Posts DB のページを PostItem に変換する', () => {
    const page = {
      ...basePage,
      properties: {
        Name: { type: 'title', title: [{ plain_text: 'タイトル' }] },
        タグ: { type: 'relation', relation: [{ id: 'tag-1' }, { id: 'tag-2' }] },
        ピン止め: { type: 'checkbox', checkbox: true },
        DB_日報: { type: 'relation', relation: [{ id: 'daily-1' }] },
        コメント追加回数: { type: 'number', number: 4 },
      },
    };
    expect(mapPageToPost(page)).toEqual({
      id: 'page-1',
      title: 'タイトル',
      createdTime: '2026-10-14T00:00:00.000Z',
      createdBy: { id: 'user-1', name: 'Mitsuie', avatarUrl: 'https://example.com/a.png' },
      tags: [
        { id: 'tag-1', name: '' },
        { id: 'tag-2', name: '' },
      ],
      pinned: true,
      dailyReport: { id: 'daily-1' },
      commentsCount: 4,
      url: 'https://www.notion.so/page-1',
    });
  });

  it('分割保存されたタイトルは全要素を連結する', () => {
    const page = {
      ...basePage,
      properties: { Name: { type: 'title', title: [{ plain_text: 'a'.repeat(2000) }, { plain_text: 'b' }] } },
    };
    expect(mapPageToPost(page).title).toBe('a'.repeat(2000) + 'b');
  });

  it('任意プロパティがない場合は既定値になる', () => {
    const page = { id: 'p', created_time: 't', properties: { Name: { type: 'title', title: [] } } };
    expect(mapPageToPost(page)).toMatchObject({
      title: '',
      tags: [],
      pinned: false,
      dailyReport: null,
      commentsCount: 0,
      createdBy: { id: '', name: 'User' },
    });
  });
});
