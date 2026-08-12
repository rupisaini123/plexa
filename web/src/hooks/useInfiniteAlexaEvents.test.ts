import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { prependNewById, useInfiniteAlexaEvents } from './useInfiniteAlexaEvents';
import type { AlexaEventItem, PageResult } from '../lib/api';

function makeEvent(id: number): AlexaEventItem {
  return {
    id,
    event_type: 'PlayPlaylistIntent',
    summary: `Event ${id}`,
    created_at: '2026-08-12 03:27:19',
  };
}

describe('prependNewById', () => {
  it('prepends only unseen ids', () => {
    const result = prependNewById([makeEvent(2), makeEvent(1)], [makeEvent(4), makeEvent(3), makeEvent(2)]);
    expect(result.addedCount).toBe(2);
    expect(result.items.map((item) => item.id)).toEqual([4, 3, 2, 1]);
  });
});

describe('useInfiniteAlexaEvents', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      value: false,
    });
  });

  it('loads the first page on mount', async () => {
    const fetchPage = vi.fn(async (): Promise<PageResult<AlexaEventItem>> => ({
      items: [makeEvent(1), makeEvent(2)],
      nextStart: 2,
      hasMore: true,
    }));
    const fetchAfter = vi.fn(async (): Promise<PageResult<AlexaEventItem>> => ({
      items: [],
      nextStart: 2,
      hasMore: false,
    }));

    const { result } = renderHook(() =>
      useInfiniteAlexaEvents({
        fetchPage,
        fetchAfter,
        pageSize: 2,
        pollingEnabled: false,
      }),
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(fetchPage).toHaveBeenCalledWith(expect.objectContaining({ start: 0, size: 2 }));
    expect(result.current.items).toHaveLength(2);
    expect(result.current.hasMore).toBe(true);
  });

  it('appends the next page without duplicating ids', async () => {
    const fetchPage = vi.fn(async ({ start }: { start: number; size: number; signal: AbortSignal }) => {
      if (start === 0) {
        return { items: [makeEvent(2), makeEvent(1)], nextStart: 2, hasMore: true };
      }
      return { items: [makeEvent(0)], nextStart: 3, hasMore: false };
    });
    const fetchAfter = vi.fn(async (): Promise<PageResult<AlexaEventItem>> => ({
      items: [],
      nextStart: 2,
      hasMore: false,
    }));

    const { result } = renderHook(() =>
      useInfiniteAlexaEvents({ fetchPage, fetchAfter, pageSize: 2, pollingEnabled: false }),
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      result.current.loadMore();
    });

    await waitFor(() => {
      expect(result.current.loadingMore).toBe(false);
    });

    expect(fetchPage).toHaveBeenCalledTimes(2);
    expect(result.current.items.map((item) => item.id)).toEqual([2, 1, 0]);
    expect(result.current.hasMore).toBe(false);
  });

  it('polls for newer events and prepends them', async () => {
    vi.useFakeTimers();
    try {
      const fetchPage = vi.fn(async (): Promise<PageResult<AlexaEventItem>> => ({
        items: [makeEvent(2), makeEvent(1)],
        nextStart: 2,
        hasMore: false,
      }));
      const fetchAfter = vi.fn(async ({ afterId }: { afterId: number; size: number; signal: AbortSignal }) => {
        expect(afterId).toBe(2);
        return { items: [makeEvent(3)], nextStart: 3, hasMore: false };
      });
      const onNewItemsPrepended = vi.fn();

      const { result } = renderHook(() =>
        useInfiniteAlexaEvents({
          fetchPage,
          fetchAfter,
          pollIntervalMs: 1_000,
          onNewItemsPrepended,
        }),
      );

      await act(async () => {
        await Promise.resolve();
      });

      expect(result.current.loading).toBe(false);
      expect(result.current.items.map((item) => item.id)).toEqual([2, 1]);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(1_000);
      });

      expect(fetchAfter).toHaveBeenCalled();
      expect(result.current.items.map((item) => item.id)).toEqual([3, 2, 1]);
      expect(onNewItemsPrepended).toHaveBeenCalledWith(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('skips polling while the document is hidden', async () => {
    vi.useFakeTimers();
    try {
      Object.defineProperty(document, 'hidden', {
        configurable: true,
        value: true,
      });

      const fetchPage = vi.fn(async (): Promise<PageResult<AlexaEventItem>> => ({
        items: [makeEvent(1)],
        nextStart: 1,
        hasMore: false,
      }));
      const fetchAfter = vi.fn(async (): Promise<PageResult<AlexaEventItem>> => ({
        items: [makeEvent(2)],
        nextStart: 2,
        hasMore: false,
      }));

      renderHook(() =>
        useInfiniteAlexaEvents({
          fetchPage,
          fetchAfter,
          pollIntervalMs: 1_000,
        }),
      );

      await act(async () => {
        await vi.advanceTimersByTimeAsync(1_000);
      });

      expect(fetchAfter).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('aborts in-flight requests on unmount', async () => {
    let capturedSignal: AbortSignal | undefined;
    const fetchPage = vi.fn(async ({ signal }: { start: number; size: number; signal: AbortSignal }) => {
      capturedSignal = signal;
      await new Promise((resolve) => setTimeout(resolve, 25));
      return { items: [makeEvent(1)], nextStart: 1, hasMore: false };
    });
    const fetchAfter = vi.fn(async (): Promise<PageResult<AlexaEventItem>> => ({
      items: [],
      nextStart: 1,
      hasMore: false,
    }));

    const { unmount } = renderHook(() =>
      useInfiniteAlexaEvents({ fetchPage, fetchAfter, pollingEnabled: false }),
    );

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    unmount();

    expect(capturedSignal?.aborted).toBe(true);
  });
});
