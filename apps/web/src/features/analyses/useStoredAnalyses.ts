'use client';

import { useEffect, useState } from 'react';
import {
  ANALYSES_CHANGED_EVENT,
  ANALYSES_STORAGE_KEY,
  readStoredAnalyses,
  type StoredAnalysis,
} from '../upload/storage';

/**
 * The analyses saved in this browser, newest first. `undefined` until the first read: the site is a
 * static export, so localStorage must only be read after mount to avoid a hydration mismatch.
 */
export function useStoredAnalyses(): StoredAnalysis[] | undefined {
  const [entries, setEntries] = useState<StoredAnalysis[] | undefined>(undefined);

  useEffect(() => {
    const update = () => {
      setEntries(readStoredAnalyses());
    };
    const onStorage = (event: StorageEvent) => {
      // key is null when storage was cleared
      if (event.key === null || event.key === ANALYSES_STORAGE_KEY) update();
    };
    update();
    window.addEventListener(ANALYSES_CHANGED_EVENT, update);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(ANALYSES_CHANGED_EVENT, update);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  return entries;
}
