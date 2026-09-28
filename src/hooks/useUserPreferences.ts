import { useState, useEffect } from 'react';

const STORAGE_KEY_DEFAULT_PINNED = 'post-notion-pref-default-pinned';
const STORAGE_KEY_DEFAULT_DAILY_REPORT = 'post-notion-pref-default-daily-report';
const STORAGE_KEY_REQUIRE_TAG = 'post-notion-pref-require-tag';

export interface UserPreferences {
  defaultPinned: boolean;
  defaultDailyReport: boolean;
  requireTag: boolean;
}

export function useUserPreferences() {
  const [defaultPinned, setDefaultPinnedState] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const saved = localStorage.getItem(STORAGE_KEY_DEFAULT_PINNED);
    return saved !== null ? saved === 'true' : false;
  });

  const [defaultDailyReport, setDefaultDailyReportState] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    const saved = localStorage.getItem(STORAGE_KEY_DEFAULT_DAILY_REPORT);
    return saved !== null ? saved === 'true' : true;
  });

  const [requireTag, setRequireTagState] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const saved = localStorage.getItem(STORAGE_KEY_REQUIRE_TAG);
    return saved !== null ? saved === 'true' : false;
  });

  const setDefaultPinned = (value: boolean) => {
    setDefaultPinnedState(value);
    localStorage.setItem(STORAGE_KEY_DEFAULT_PINNED, String(value));
  };

  const setDefaultDailyReport = (value: boolean) => {
    setDefaultDailyReportState(value);
    localStorage.setItem(STORAGE_KEY_DEFAULT_DAILY_REPORT, String(value));
  };

  const setRequireTag = (value: boolean) => {
    setRequireTagState(value);
    localStorage.setItem(STORAGE_KEY_REQUIRE_TAG, String(value));
  };

  // 他タブや外部更新があった場合のローカルストレージ同期
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY_DEFAULT_PINNED && e.newValue !== null) {
        setDefaultPinnedState(e.newValue === 'true');
      }
      if (e.key === STORAGE_KEY_DEFAULT_DAILY_REPORT && e.newValue !== null) {
        setDefaultDailyReportState(e.newValue === 'true');
      }
      if (e.key === STORAGE_KEY_REQUIRE_TAG && e.newValue !== null) {
        setRequireTagState(e.newValue === 'true');
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  return {
    preferences: {
      defaultPinned,
      defaultDailyReport,
      requireTag,
    },
    setDefaultPinned,
    setDefaultDailyReport,
    setRequireTag,
  };
}
