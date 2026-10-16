import { useState, useEffect } from 'react';
import { getItem, setItem, STORAGE_KEYS } from '../utils/storage';

export interface UserPreferences {
  defaultPinned: boolean;
  defaultDailyReport: boolean;
  requireTag: boolean;
}

export function useUserPreferences() {
  const [defaultPinned, setDefaultPinnedState] = useState<boolean>(() => {
    const saved = getItem(STORAGE_KEYS.defaultPinned);
    return saved !== null ? saved === 'true' : false;
  });

  const [defaultDailyReport, setDefaultDailyReportState] = useState<boolean>(() => {
    const saved = getItem(STORAGE_KEYS.defaultDailyReport);
    return saved !== null ? saved === 'true' : true;
  });

  const [requireTag, setRequireTagState] = useState<boolean>(() => {
    const saved = getItem(STORAGE_KEYS.requireTag);
    return saved !== null ? saved === 'true' : false;
  });

  const setDefaultPinned = (value: boolean) => {
    setDefaultPinnedState(value);
    setItem(STORAGE_KEYS.defaultPinned, String(value));
  };

  const setDefaultDailyReport = (value: boolean) => {
    setDefaultDailyReportState(value);
    setItem(STORAGE_KEYS.defaultDailyReport, String(value));
  };

  const setRequireTag = (value: boolean) => {
    setRequireTagState(value);
    setItem(STORAGE_KEYS.requireTag, String(value));
  };

  // 他タブや外部更新があった場合のローカルストレージ同期
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEYS.defaultPinned && e.newValue !== null) {
        setDefaultPinnedState(e.newValue === 'true');
      }
      if (e.key === STORAGE_KEYS.defaultDailyReport && e.newValue !== null) {
        setDefaultDailyReportState(e.newValue === 'true');
      }
      if (e.key === STORAGE_KEYS.requireTag && e.newValue !== null) {
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
