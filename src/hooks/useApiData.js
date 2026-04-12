import { useState, useEffect, useCallback } from 'react';

/**
 * Hook g\u00e9n\u00e9rique pour fetch + loading + error.
 * @param {Function} fetchFn - Fonction async qui retourne les donn\u00e9es
 * @param {Array} deps - D\u00e9pendances pour re-fetch
 * @param {Object} options - { autoFetch: true, initialData: null }
 */
export default function useApiData(fetchFn, deps = [], options = {}) {
  const { autoFetch = true, initialData = null } = options;
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(autoFetch);
  const [error, setError] = useState(null);

  const execute = useCallback(async (...args) => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchFn(...args);
      setData(result);
      return result;
    } catch (err) {
      setError(err.message || 'Erreur inconnue');
      throw err;
    } finally {
      setLoading(false);
    }
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (autoFetch) {
      execute().catch(() => {}); // erreur d\u00e9j\u00e0 stock\u00e9e dans state
    }
  }, [execute, autoFetch]);

  return { data, setData, loading, error, refetch: execute };
}
