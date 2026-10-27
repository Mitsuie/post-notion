import { describe, expect, it } from 'vitest';
import type { Tag } from '../types';
import { getDraftRestoreValues, withPendingTagIds, type DraftData, type DraftRestoreOptions } from './useDraft';

const tagA: Tag = { id: 'tag-a', name: 'A' };
const tagB: Tag = { id: 'tag-b', name: 'B' };

const options: DraftRestoreOptions = {
  isDailyReportConfigured: true,
  defaultPinned: false,
  defaultDailyReport: true,
};

const draft: DraftData = {
  title: 'タイトル',
  body: '本文',
  tagIds: ['tag-a'],
  pinned: true,
  linkDailyReport: false,
};

describe('getDraftRestoreValues', () => {
  it('初回はタイトル・本文・ピン留め・日報連携を復元し、タグ一覧の取得前はタグの復元を保留する', () => {
    const { values, isComplete } = getDraftRestoreValues(draft, [], true, options);
    expect(values).toEqual({ title: 'タイトル', body: '本文', pinned: true, linkDailyReport: false, tags: [] });
    expect(isComplete).toBe(false);
  });

  it('初回でタグ一覧を取得済みなら、一致するタグも復元して完了する', () => {
    const { values, isComplete } = getDraftRestoreValues(draft, [tagA, tagB], true, options);
    expect(values.tags).toEqual([tagA]);
    expect(values.title).toBe('タイトル');
    expect(isComplete).toBe(true);
  });

  it('2 回目以降はタグだけを返し、ピン留め・日報連携・タイトル・本文を巻き戻さない', () => {
    const { values, isComplete } = getDraftRestoreValues(draft, [tagA, tagB], false, options);
    expect(values).toEqual({ tags: [tagA] });
    expect(isComplete).toBe(true);
  });

  it('2 回目以降でもタグ一覧が空のままなら、何も適用せず復元を保留する', () => {
    const { values, isComplete } = getDraftRestoreValues(draft, [], false, options);
    expect(values).toEqual({ tags: [] });
    expect(isComplete).toBe(false);
  });

  it('下書きにタグがなければ、タグ一覧の取得前でも完了する（タグ DB 未設定・取得失敗）', () => {
    const { values, isComplete } = getDraftRestoreValues({ ...draft, tagIds: [] }, [], true, options);
    expect(values.title).toBe('タイトル');
    expect(values.body).toBe('本文');
    expect(isComplete).toBe(true);
  });

  it('ピン留め・日報連携が保存されていなければ既定値を使い、日報 DB が未設定なら日報連携は off にする', () => {
    const legacy = { title: 'タイトル', body: '', tagIds: [] } as unknown as DraftData;
    expect(getDraftRestoreValues(legacy, [], true, options).values).toMatchObject({
      pinned: false,
      linkDailyReport: true,
    });
    expect(
      getDraftRestoreValues(draft, [], true, { ...options, isDailyReportConfigured: false }).values.linkDailyReport
    ).toBe(false);
  });
});

describe('withPendingTagIds', () => {
  const current = { title: '入力中', body: '', tagIds: [] as string[], pinned: false, linkDailyReport: true };

  it('タグを復元できていない間は、復元待ちのタグ ID を引き継いで保存する', () => {
    expect(withPendingTagIds(current, draft).tagIds).toEqual(['tag-a']);
    expect(withPendingTagIds(current, draft).title).toBe('入力中');
  });

  it('復元待ちの下書きがなければ（復元完了・送信後）そのまま保存する', () => {
    expect(withPendingTagIds(current, null)).toBe(current);
  });

  it('入力中にタグが選ばれていれば、そのタグを優先する', () => {
    const withTags = { ...current, tagIds: ['tag-b'] };
    expect(withPendingTagIds(withTags, draft).tagIds).toEqual(['tag-b']);
  });
});
