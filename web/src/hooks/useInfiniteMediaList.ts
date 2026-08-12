import { useCallback, useEffect, useRef, useState } from 'react';
import type { PageResult } from '../lib/api';

export type MediaListItem = { ratingKey: string };

export interface FetchPageArgs {
  start: number;
  size: number;
  signal: AbortSignal;
}

export interface UseInfiniteMediaListOptions<T extends MediaListItem> {
  fetchPage: (args: FetchPageArgs) => Promise<PageResult<T>>;
  pageSize?: number;
  resetKey: string;
  enabled?: boolean;
  getItemKey?: (item: T) => string;
}

export interface InfiniteMediaListState<T extends MediaListItem> {
  items: T[];
  loading: boolean;
  loadingMore: boolean;
  error: string;
  hasMore: boolean;
  nextStart: number;
  loadMore: () => void;
  retry: () => void;
  reset: () => void;
  replaceItems: (items: T[]) => void;
}

function dedupeByKey<T extends MediaListItem>(
  existing: T[],
  incoming: T[],
  getKey: (item: T) => string,
): T[] {
  const seen = new Set(existing.map(getKey));
  const merged = [...existing];
  for (const item of incoming) {
    const key = getKey(item);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(item);
  }
  return merged;
}

export function useInfiniteMediaList<T extends MediaListItem>({
  fetchPage,
  pageSize = 50,
  resetKey,
  enabled = true,
  getItemKey = (item) => item.ratingKey,
}: UseInfiniteMediaListOptions<T>): InfiniteMediaListState<T> {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [hasMore, setHasMore] = useState(false);
  const [nextStart, setNextStart] = useState(0);

  const abortRef = useRef<AbortController | null>(null);
  const inFlightRef = useRef(false);
  const nextStartRef = useRef(0);
  const hasMoreRef = useRef(false);
  const itemsRef = useRef<T[]>([]);
  const fetchPageRef = useRef(fetchPage);
  const getItemKeyRef = useRef(getItemKey);

  fetchPageRef.current = fetchPage;
  getItemKeyRef.current = getItemKey;

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    nextStartRef.current = nextStart;
  }, [nextStart]);

  useEffect(() => {
    hasMoreRef.current = hasMore;
  }, [hasMore]);

  const runFetch = useCallback(async (start: number, append: boolean) => {
    if (!enabled) return;
    if (inFlightRef.current) return;
    if (append && !hasMoreRef.current) return;

    inFlightRef.current = true;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    if (append) setLoadingMore(true);
    else setLoading(true);
    setError('');

    try {
      const page = await fetchPageRef.current({
        start,
        size: pageSize,
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;

      setItems((prev) => {
        const merged = append
          ? dedupeByKey(prev, page.items, getItemKeyRef.current)
          : dedupeByKey([], page.items, getItemKeyRef.current);
        itemsRef.current = merged;
        return merged;
      });
      setNextStart(page.nextStart);
      nextStartRef.current = page.nextStart;
      setHasMore(page.hasMore);
      hasMoreRef.current = page.hasMore;
    } catch (err) {
      if (controller.signal.aborted) return;
      const message = err instanceof Error ? err.message : 'Request failed';
      if ((err as Error).name === 'AbortError' || message === 'AbortError' || message === 'The operation was aborted.') {
        return;
      }
      setError(message);
      if (!append) {
        setItems([]);
        itemsRef.current = [];
        setNextStart(0);
        nextStartRef.current = 0;
        setHasMore(false);
        hasMoreRef.current = false;
      }
    } finally {
      if (abortRef.current === controller) {
        setLoading(false);
        setLoadingMore(false);
        inFlightRef.current = false;
      }
    }
  }, [enabled, pageSize]);

  useEffect(() => {
    abortRef.current?.abort();
    inFlightRef.current = false;
    setItems([]);
    itemsRef.current = [];
    setNextStart(0);
    nextStartRef.current = 0;
    setHasMore(false);
    hasMoreRef.current = false;
    setError('');
    setLoadingMore(false);

    if (!enabled) {
      setLoading(false);
      return;
    }

    void runFetch(0, false);

    return () => {
      abortRef.current?.abort();
      inFlightRef.current = false;
    };
  }, [enabled, resetKey, runFetch]);

  const loadMore = useCallback(() => {
    void runFetch(nextStartRef.current, true);
  }, [runFetch]);

  const retry = useCallback(() => {
    if (itemsRef.current.length === 0) {
      void runFetch(0, false);
      return;
    }
    void runFetch(nextStartRef.current, true);
  }, [runFetch]);

  const reset = useCallback(() => {
    void runFetch(0, false);
  }, [runFetch]);

  const replaceItems = useCallback((next: T[]) => {
    setItems(next);
    itemsRef.current = next;
  }, []);

  return {
    items,
    loading,
    loadingMore,
    error,
    hasMore,
    nextStart,
    loadMore,
    retry,
    reset,
    replaceItems,
  };
}
