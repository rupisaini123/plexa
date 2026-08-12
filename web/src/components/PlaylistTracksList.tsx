import { useCallback, useRef } from 'react';
import { useIntersectionLoadMore } from '../hooks/useIntersectionLoadMore';
import { AnimatePresence, Reorder, motion } from 'motion/react';
import type { TrackItem } from '../lib/api';
import { api, fetchCsrf } from '../lib/api';
import type { InfiniteMediaListState } from '../hooks/useInfiniteMediaList';
import { useDragReorder } from '../hooks/useDragReorder';
import {
  afterPlaylistItemId,
  reorderArray,
} from '../lib/reorderPlaylistTracks';
import { InfiniteListBoundary } from './InfiniteListBoundary';
import { PlaylistTrackRow } from './PlaylistTrackRow';
import { TrackRowSkeleton } from './Skeleton';

export interface PlaylistTracksListProps {
  playlistKey: string;
  tracks: InfiniteMediaListState<TrackItem>;
  playingRatingKey?: string | null;
  onPlayTrack: (track: TrackItem) => void;
  onRemoveTrack: (track: TrackItem) => void;
  onReorderError: (message: string) => void;
}

export function PlaylistTracksList({
  playlistKey,
  tracks,
  playingRatingKey = null,
  onPlayTrack,
  onRemoveTrack,
  onReorderError,
}: PlaylistTracksListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const loadSentinelRef = useRef<HTMLDivElement>(null);
  const { items, hasMore, loading, loadingMore, error, loadMore, retry, replaceItems } = tracks;
  const busy = loading || loadingMore;

  useIntersectionLoadMore({
    rootRef: scrollRef,
    targetRef: loadSentinelRef,
    enabled: hasMore && !error,
    busy,
    onLoadMore: loadMore,
  });

  const commitReorder = useCallback(async (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;

    const snapshot = items;
    const item = snapshot[fromIndex];
    if (!item?.playlistItemId) return;

    const reordered = reorderArray(snapshot, fromIndex, toIndex);
    const afterId = afterPlaylistItemId(reordered, toIndex);

    replaceItems(reordered);
    try {
      await fetchCsrf();
      await api(`/api/playlists/${playlistKey}/reorder`, {
        method: 'POST',
        body: JSON.stringify({
          playlistItemId: item.playlistItemId,
          afterPlaylistItemId: afterId,
        }),
      });
    } catch (err) {
      replaceItems(snapshot);
      onReorderError(err instanceof Error ? err.message : 'Reorder failed');
    }
  }, [items, onReorderError, playlistKey, replaceItems]);

  const handleCommit = useCallback((_dragStart: TrackItem[], fromIndex: number, toIndex: number) => {
    void commitReorder(fromIndex, toIndex);
  }, [commitReorder]);

  const {
    orderedItems,
    reorderValues,
    reorderByValues,
    clearExiting,
    dragProps,
  } = useDragReorder(
    items,
    (track) => track.playlistItemId ?? track.ratingKey,
    handleCommit,
    { containerRef: scrollRef },
  );

  return (
    <div className="space-y-2">
      <div className="playlist-tracks-header" aria-hidden>
        <span />
        <span>#</span>
        <span />
        <span>Title</span>
        <span className="playlist-tracks-header-album">Album</span>
        <span className="playlist-tracks-header-duration">Time</span>
        <span />
      </div>

      <motion.div
        ref={scrollRef}
        layoutScroll
        data-testid="playlist-tracks"
        role="list"
        className="playlist-tracks-scroll"
      >
        <Reorder.Group
          axis="y"
          as="div"
          className="flex flex-col gap-1.5"
          values={reorderValues}
          onReorder={reorderByValues}
        >
          <AnimatePresence mode="popLayout" initial={false} onExitComplete={clearExiting}>
            {orderedItems.map((track, index) => (
              <PlaylistTrackRow
                key={track.playlistItemId ?? track.ratingKey}
                track={track}
                index={index + 1}
                sortable={Boolean(track.playlistItemId)}
                isPlaying={playingRatingKey === track.ratingKey}
                dragProps={dragProps}
                onPlay={() => onPlayTrack(track)}
                onRemove={() => onRemoveTrack(track)}
              />
            ))}
          </AnimatePresence>
        </Reorder.Group>
        {hasMore ? (
          <div ref={loadSentinelRef} className="pt-1.5" data-testid="playlist-tracks-load-sentinel">
            <TrackRowSkeleton />
          </div>
        ) : null}
      </motion.div>

      <InfiniteListBoundary
        hasMore={hasMore}
        loading={loading}
        loadingMore={loadingMore}
        error={error && items.length > 0 ? error : ''}
        onLoadMore={loadMore}
        onRetry={retry}
        rootRef={scrollRef}
        endLabel={items.length > 0 ? `${items.length} tracks loaded` : undefined}
      />
    </div>
  );
}
