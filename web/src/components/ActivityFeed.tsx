import { useCallback, useEffect, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { InfiniteListBoundary } from './InfiniteListBoundary';
import { ActivityRowSkeleton, SkeletonStack } from './Skeleton';
import { useInfiniteAlexaEvents } from '../hooks/useInfiniteAlexaEvents';
import { adjustScrollForPrependedRows } from '../lib/activityFeedScroll';
import { formatRelativeTime } from '../lib/formatRelativeTime';

const ROW_HEIGHT = 44;
const LOAD_AHEAD_ROWS = 5;
const POLL_INTERVAL_MS = 30_000;

export function ActivityFeed() {
  const parentRef = useRef<HTMLDivElement | null>(null);
  const handlePrepended = useCallback((addedCount: number) => {
    adjustScrollForPrependedRows(parentRef.current, addedCount, ROW_HEIGHT);
  }, []);

  const {
    items,
    loading,
    loadingMore,
    error,
    hasMore,
    loadMore,
    retry,
  } = useInfiniteAlexaEvents({
    pollIntervalMs: POLL_INTERVAL_MS,
    pollingEnabled: true,
    onNewItemsPrepended: handlePrepended,
  });

  const rowCount = items.length + (hasMore ? 1 : 0);

  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 8,
  });

  const virtualItems = virtualizer.getVirtualItems();

  useEffect(() => {
    if (loading || loadingMore || !hasMore || items.length === 0) return;
    const last = virtualItems.at(-1);
    if (!last) return;
    if (last.index >= items.length - LOAD_AHEAD_ROWS) {
      loadMore();
    }
  }, [hasMore, items.length, loadMore, loading, loadingMore, virtualItems]);

  if (loading && items.length === 0) {
    return (
      <div className="mt-4 max-h-96 overflow-hidden rounded-xl border border-white/5">
        <SkeletonStack count={8} gap="" label="Loading activity">
          {(index) => <ActivityRowSkeleton key={index} />}
        </SkeletonStack>
      </div>
    );
  }

  if (error && items.length === 0) {
    return (
      <div className="mt-4 flex flex-col gap-2">
        <p className="text-sm text-danger" role="alert">{error}</p>
        <button type="button" className="btn btn-secondary self-start" onClick={retry}>
          Retry
        </button>
      </div>
    );
  }

  if (!loading && items.length === 0) {
    return <p className="mt-4 text-sm text-muted">No Alexa requests yet.</p>;
  }

  return (
    <div className="mt-4">
      <div
        ref={parentRef}
        className="max-h-96 overflow-auto rounded-xl border border-white/5"
        aria-label="Recent activity"
      >
        <div
          className="relative w-full"
          style={{ height: `${virtualizer.getTotalSize()}px` }}
        >
          {virtualItems.map((virtualRow) => {
            const isLoaderRow = virtualRow.index >= items.length;
            const event = items[virtualRow.index];

            return (
              <div
                key={isLoaderRow ? 'loader-row' : event.id}
                className="absolute left-0 top-0 flex w-full items-center justify-between gap-4 border-b border-white/5 px-3 py-2 text-sm"
                style={{
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                {isLoaderRow ? (
                  <ActivityRowSkeleton />
                ) : (
                  <>
                    <span>{event.summary}</span>
                    <span className="shrink-0 text-muted" title={event.created_at}>
                      {formatRelativeTime(event.created_at)}
                    </span>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <InfiniteListBoundary
        hasMore={hasMore}
        loading={loading}
        loadingMore={loadingMore}
        error={items.length > 0 ? error : undefined}
        onLoadMore={loadMore}
        onRetry={retry}
        rootRef={parentRef}
        label="Load more activity"
        endLabel={items.length > 0 ? 'End of activity history' : undefined}
        className="py-2"
      />
    </div>
  );
}
