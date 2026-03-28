/**
 * useApi — generic hook for API calls with loading, error, fallback, and polling support.
 *
 * Usage:
 *   const { data, loading, error } = useApi(fetchFn, fallbackData, deps)
 *   const { data } = useApi(fetchFn, fallback, deps, 30000) // poll every 30s
 */

import { useState, useEffect, useCallback, useRef } from 'react';

export function useApi(fetchFn, fallback = null, deps = [], pollInterval = 0) {
  const [data, setData] = useState(fallback);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [usingFallback, setUsingFallback] = useState(false);
  const mountedRef = useRef(true);

  const execute = useCallback(async (isPolling = false) => {
    if (!isPolling) setLoading(true);
    setError(null);
    try {
      const result = await fetchFn();
      if (mountedRef.current) {
        setData(result);
        setUsingFallback(false);
      }
    } catch (err) {
      if (mountedRef.current) {
        // CRITICAL FIX: never wipe existing data on error — keep last known value
        // Only use fallback if we have no data at all yet
        setData(prev => {
          if (prev === null || prev === undefined) return fallback;
          return prev; // keep existing data on error
        });
        setUsingFallback(true);
        setError(err.message);
        if (!isPolling) {
          console.warn('[SignalForge API] Request failed, keeping last known data:', err.message);
        }
      }
    } finally {
      // CRITICAL FIX: Always set loading to false, even on error
      if (mountedRef.current) setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    mountedRef.current = true;
    execute(false);

    let intervalId;
    if (pollInterval > 0) {
      intervalId = setInterval(() => execute(true), pollInterval);
    }

    return () => {
      mountedRef.current = false;
      if (intervalId) clearInterval(intervalId);
    };
  }, [execute, pollInterval]);

  return { data, loading, error, usingFallback, refetch: () => execute(false) };
}
