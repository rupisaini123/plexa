import { useEffect, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { TrackItem } from '../lib/api';
import type { InfiniteMediaListState } from '../hooks/useInfiniteMediaList';
import { AddToPlaylistButton } from './AddToPlaylistButton';
import { InfiniteListBoundary } from './InfiniteListBoundary';
import {
  RevealListItem,
  buildViewportIndices,
  buildVisibleStaggerPositions,
} from './motion/Reveal';
import { TrackRowSkeleton } from './Skeleton';
import { TrackRow } from './TrackRow';

const ROW_HEIGHT = 56;
const LOAD_AHEAD_ROWS = 5;

export interface LibraryTracksListProps {
  tracks: InfiniteMediaListState<TrackItem>;
  listMaxHeight: string;
  revealKey: string;
  onPlayTrack: (track: TrackItem) => void;
}

export function LibraryTracksList({
  tracks,
  listMaxHeight,
  revealKey,
  onPlayTrack,
}: LibraryTracksListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const seenKeysRef = useRef(new Set<string>());
  const revealKeyRef = useRef(revealKey);
  const { items, hasMore, loading, loadingMore, error, loadMore, retry } = tracks;

  if (revealKeyRef.current !== revealKey) {
    revealKeyRef.current = revealKey;
    seenKeysRef.current.clear();
  }

  const rowCount = items.length + (hasMore ? 1 : 0);

  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 6,
  });

  const virtualItems = virtualizer.getVirtualItems();
  const viewportRange = virtualizer.range;
  const viewportStart = viewportRange?.startIndex ?? 0;
  const viewportEnd = viewportRange?.endIndex ?? Math.max(items.length - 1, 0);
  const viewportIndices = buildViewportIndices(viewportStart, viewportEnd, items.length);
  const staggerPositions = buildVisibleStaggerPositions(
    viewportIndices,
    items,
    seenKeysRef.current,
  );

  useEffect(() => {
    if (loading || loadingMore || !hasMore || items.length === 0) return;
    const last = virtualItems.at(-1);
    if (!last) return;
    if (last.index >= items.length - LOAD_AHEAD_ROWS) {
      loadMore();
    }
  }, [hasMore, items.length, loadMore, loading, loadingMore, virtualItems]);

  return (
    <div className="card space-y-2 p-3 sm:p-4">
      <div
        ref={scrollRef}
        data-testid="library-tracks"
        className={`overflow-y-auto ${listMaxHeight}`}
      >
        <div
          className="relative w-full"
          style={{ height: `${virtualizer.getTotalSize()}px` }}
        >
          {virtualItems.map((virtualRow) => {
            const isLoaderRow = virtualRow.index >= items.length;
            const track = items[virtualRow.index];

            if (isLoaderRow) {
              return (
                <div
                  key="loader-row"
                  ref={virtualizer.measureElement}
                  data-index={virtualRow.index}
                  className="absolute left-0 top-0 w-full pb-1.5"
                  style={{
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  <TrackRowSkeleton />
                </div>
              );
            }

            const isInViewport = virtualRow.index >= viewportStart
              && virtualRow.index <= viewportEnd;
            const shouldAnimate = !seenKeysRef.current.has(track.ratingKey) && isInViewport;
            const staggerPosition = staggerPositions.get(track.ratingKey);

            return (
              <div
                key={track.ratingKey}
                ref={virtualizer.measureElement}
                data-index={virtualRow.index}
                className="absolute left-0 top-0 w-full pb-1.5"
                style={{
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <RevealListItem
                  shouldAnimate={shouldAnimate}
                  itemKey={track.ratingKey}
                  listKey={revealKey}
                  staggerPosition={shouldAnimate ? staggerPosition : undefined}
                  onRevealStart={() => {
                    seenKeysRef.current.add(track.ratingKey);
                  }}
                >
                  <TrackRow
                    track={track}
                    onPlay={() => onPlayTrack(track)}
                    actions={<AddToPlaylistButton track={track} />}
                  />
                </RevealListItem>
              </div>
            );
          })}
        </div>
      </div>

      <InfiniteListBoundary
        hasMore={hasMore}
        loading={loading}
        loadingMore={loadingMore}
        error={error && items.length > 0 ? error : ''}
        onLoadMore={loadMore}
        onRetry={retry}
        rootRef={scrollRef}
        endLabel={`${items.length} tracks loaded`}
      />
    </div>
  );
}
