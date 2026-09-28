import { useState, useEffect } from 'react';

const STORAGE_KEY_DEFAULT_PINNED = 'post-notion-pref-default-pinned';
const STORAGE_KEY_DEFAULT_DAILY_REPORT = 'post-notion-pref-default-daily-report';

export interface UserPreferences {
  defaultPinned: boolean;
  defaultDailyReport: boolean;
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

  const setDefaultPinned = (value: boolean) => {
    setDefaultPinnedState(value);
    localStorage.setItem(STORAGE_KEY_DEFAULT_PINNED, String(value));
  };

  const setDefaultDailyReport = (value: boolean) => {
    setDefaultDailyReportState(value);
    localStorage.setItem(STORAGE_KEY_DEFAULT_DAILY_REPORT, String(value));
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
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  return {
    preferences: {
      defaultPinned,
      defaultDailyReport,
    },
    setDefaultPinned,
    setDefaultDailyReport,
  };
}
