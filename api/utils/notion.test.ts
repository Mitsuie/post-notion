import { describe, it, expect } from 'vitest';
import { findPropertyKey, filterUsedPostsProperties } from './notion.ts';

describe('findPropertyKey', () => {
  const properties = {
    名前: { type: 'title' },
    tags: { type: 'relation' },
    関連: { type: 'relation' },
    固定: { type: 'checkbox' },
  };

  it('候補名と大文字小文字を無視して一致し、型も一致するキーを返す', () => {
    expect(findPropertyKey(properties, ['Tags', 'タグ'], 'relation')).toBe('tags');
  });

  it('候補名の並び順を優先する', () => {
    expect(findPropertyKey(properties, ['関連', 'Tags'], 'relation')).toBe('関連');
  });

  it('名前が一致しても型が異なれば候補として扱わない', () => {
    expect(findPropertyKey(properties, ['固定'], 'relation')).toBe('tags');
  });

  it('候補名に一致しない場合は同じ型の最初のキーにフォールバックする', () => {
    expect(findPropertyKey(properties, ['Title'], 'title')).toBe('名前');
  });

  it('同じ型のプロパティがなければ undefined を返す', () => {
    expect(findPropertyKey(properties, ['数'], 'number')).toBeUndefined();
  });
});

describe('filterUsedPostsProperties', () => {
  it('利用中のプロパティのみを DB の定義順で返す', () => {
    const properties = {
      作成者: { type: 'created_by' },
      メモ: { type: 'rich_text' },
      Pinned: { type: 'checkbox' },
      Name: { type: 'title' },
      タグ: { type: 'relation' },
      作成日時: { type: 'created_time' },
      コメント数: { type: 'number' },
      日報: { type: 'relation' },
    };
    expect(filterUsedPostsProperties(properties)).toEqual([
      '作成者',
      'Pinned',
      'Name',
      'タグ',
      '作成日時',
      'コメント数',
      '日報',
    ]);
  });

  it('型フォールバックが許可された定義のみ、名前不一致でも型一致で拾う', () => {
    const properties = {
      見出し: { type: 'title' }, // title は型フォールバック可
      関連タグ: { type: 'relation' }, // relation は型フォールバック不可
      チェック: { type: 'checkbox' }, // checkbox は型フォールバック不可
      いつ: { type: 'created_time' }, // created_time は型フォールバック可
    };
    expect(filterUsedPostsProperties(properties)).toEqual(['見出し', 'いつ']);
  });

  it('候補名は大文字小文字を無視して一致する', () => {
    const properties = {
      TITLE: { type: 'title' },
      'comments count': { type: 'number' },
    };
    expect(filterUsedPostsProperties(properties)).toEqual(['TITLE', 'comments count']);
  });
});
