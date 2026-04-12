import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchArticles, countByStatus, hasNotion } from '../services/notion';

const SYNC_INTERVAL = 5 * 60 * 1000; // 5 minutes

/**
 * Hook pour synchroniser les articles Notion.
 * Polling toutes les 5 minutes + refresh manuel.
 */
export default function useNotionSync() {
  const [notionArticles, setNotionArticles] = useState([]);
  const [notionCounts, setNotionCounts] = useState({ draft: 0, writing: 0, review: 0, ready: 0, published: 0, archived: 0 });
  const [notionLoading, setNotionLoading] = useState(false);
  const [notionError, setNotionError] = useState(null);
  const [lastSync, setLastSync] = useState(null);
  const intervalRef = useRef(null);

  const syncNotion = useCallback(async () => {
    if (!hasNotion()) return;
    setNotionLoading(true);
    setNotionError(null);
    try {
      const articles = await fetchArticles();
      setNotionArticles(articles);
      setNotionCounts(countByStatus(articles));
      setLastSync(new Date());
    } catch (err) {
      setNotionError(err.message);
    } finally {
      setNotionLoading(false);
    }
  }, []);

  // Initial sync + polling
  useEffect(() => {
    if (!hasNotion()) return;
    syncNotion();
    intervalRef.current = setInterval(syncNotion, SYNC_INTERVAL);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [syncNotion]);

  return {
    notionArticles,
    notionCounts,
    notionLoading,
    notionError,
    lastSync,
    syncNotion,
    notionConfigured: hasNotion(),
  };
}
