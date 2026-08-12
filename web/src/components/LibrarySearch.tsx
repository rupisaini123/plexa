import { useEffect, useId, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowLeft, Disc3, ListMusic, Mic2, Music2, Play, Search, X } from 'lucide-react';
import { api, type PageResult, type SearchGroupedResults, type SearchMediaType, type TrackItem } from '../lib/api';
import { tooltipProps } from '../lib/tooltip';
import { useInfiniteMediaList } from '../hooks/useInfiniteMediaList';
import { fadeUp, modalBackdrop, springSoft } from '../lib/motion';
import { Artwork } from './Artwork';
import { InfiniteListBoundary } from './InfiniteListBoundary';
import { MarqueeText } from './MarqueeText';
import { TrackRow } from './TrackRow';
import { AddToPlaylistButton } from './AddToPlaylistButton';
import { SearchGroupSkeleton, Skeleton, SkeletonStack, TrackRowSkeleton } from './Skeleton';

interface LibrarySearchProps {
  query: string;
  onQueryChange: (value: string) => void;
  onClearSearch: () => void;
  focusedType: SearchMediaType | null;
  onFocusedTypeChange: (type: SearchMediaType | null) => void;
  onOpenArtist: (item: TrackItem) => void;
  onOpenAlbum: (item: TrackItem) => void;
  onPlayTrack: (item: TrackItem) => void;
  onPlayAlbum: (item: TrackItem) => void;
  onPlayPlaylist: (item: TrackItem) => void;
}

const GROUP_META: { type: SearchMediaType; title: string; icon: typeof Music2 }[] = [
  { type: 'tracks', title: 'Tracks', icon: Music2 },
  { type: 'albums', title: 'Albums', icon: Disc3 },
  { type: 'artists', title: 'Artists', icon: Mic2 },
  { type: 'playlists', title: 'Playlists', icon: ListMusic },
];

export function LibrarySearch({
  query,
  onQueryChange,
  onClearSearch,
  focusedType,
  onFocusedTypeChange,
  onOpenArtist,
  onOpenAlbum,
  onPlayTrack,
  onPlayAlbum,
  onPlayPlaylist,
}: LibrarySearchProps) {
  const dialogId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const clearingRef = useRef(false);
  const [open, setOpen] = useState(false);
  const [grouped, setGrouped] = useState<SearchGroupedResults | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');
  const trimmed = query.trim();
  const canSearch = trimmed.length >= 2;

  useEffect(() => {
    if (!query.trim()) clearingRef.current = false;
  }, [query]);

  useEffect(() => {
    if (!canSearch) {
      setGrouped(null);
      setSearching(false);
      setError('');
      return;
    }

    setOpen(true);
    setSearching(true);
    setError('');
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const res = await api<SearchGroupedResults>(`/api/search?q=${encodeURIComponent(trimmed)}`, {
          signal: controller.signal,
        });
        setGrouped(res);
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        setError((err as Error).message);
        setGrouped(null);
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 280);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [canSearch, trimmed]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        if (focusedType) {
          onFocusedTypeChange(null);
          return;
        }
        setOpen(false);
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [focusedType, onFocusedTypeChange, open]);

  const focusedList = useInfiniteMediaList<TrackItem>({
    enabled: open && canSearch && focusedType !== null,
    resetKey: `${focusedType ?? 'none'}::${trimmed}`,
    pageSize: 40,
    fetchPage: async ({ start, size, signal }) => {
      if (!focusedType) return { items: [], nextStart: 0, hasMore: false };
      return api<PageResult<TrackItem>>(
        `/api/search?q=${encodeURIComponent(trimmed)}&type=${focusedType}&start=${start}&size=${size}`,
        { signal },
      );
    },
  });

  const clear = () => {
    clearingRef.current = true;
    onClearSearch();
    setOpen(false);
    setGrouped(null);
    setError('');
  };

  const renderResultRow = (item: TrackItem, type: SearchMediaType) => {
    if (type === 'tracks') {
      return (
        <TrackRow
          key={item.ratingKey}
          track={item}
          onPlay={() => onPlayTrack(item)}
          actions={<AddToPlaylistButton track={item} />}
        />
      );
    }

    const icon = type === 'artists'
      ? <Mic2 className="h-4 w-4" aria-hidden />
      : type === 'playlists'
        ? <ListMusic className="h-4 w-4" aria-hidden />
        : <Disc3 className="h-4 w-4" aria-hidden />;

    return (
      <div key={item.ratingKey} className="flex min-w-0 items-center gap-3 overflow-hidden rounded-xl bg-surface-muted/40 px-3 py-2.5">
        <Artwork
          src={item.artUrl}
          alt=""
          className="h-11 w-11"
          rounded={type === 'artists' ? 'full' : 'lg'}
          icon={icon}
        />
        <div className="min-w-0 flex-1 overflow-hidden">
          <MarqueeText text={item.title} className="font-medium" />
          <p className="truncate text-sm text-muted">{item.artist ?? item.album ?? type}</p>
        </div>
        <div className="flex shrink-0 gap-2">
          {(type === 'artists' || type === 'albums') && (
            <button
              className="btn btn-secondary"
              type="button"
              onClick={() => (type === 'artists' ? onOpenArtist(item) : onOpenAlbum(item))}
            >
              View
            </button>
          )}
          {(type === 'albums' || type === 'playlists') && (
            <button
              className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-accent text-white transition hover:bg-accent-hover"
              type="button"
              aria-label={`Play ${item.title}`}
              {...tooltipProps('Play')}
              onClick={() => {
                if (type === 'albums') onPlayAlbum(item);
                else onPlayPlaylist(item);
              }}
            >
              <Play className="h-4 w-4 translate-x-px" fill="currentColor" aria-hidden />
            </button>
          )}
        </div>
      </div>
    );
  };

  const totalResults = grouped
    ? grouped.tracks.length + grouped.albums.length + grouped.artists.length + grouped.playlists.length
    : 0;

  return (
    <div className="relative">
      <div className="library-search-field card flex items-center gap-2 p-3 sm:p-4">
        <Search className="h-4 w-4 shrink-0 text-muted" aria-hidden />
        <label className="sr-only" htmlFor="library-search">Search library</label>
        <input
          ref={inputRef}
          id="library-search"
          className="input border-0 bg-transparent px-0 shadow-none focus:ring-0"
          placeholder="Search artists, albums, tracks, playlists"
          value={query}
          onChange={(e) => {
            onQueryChange(e.target.value);
            if (e.target.value.trim().length >= 2) setOpen(true);
          }}
          onFocus={() => {
            if (clearingRef.current) return;
            if (canSearch) setOpen(true);
          }}
          aria-controls={open ? dialogId : undefined}
          aria-expanded={open}
          autoComplete="off"
        />
        {query && (
          <button type="button" className="btn btn-secondary px-3" onClick={clear} aria-label="Clear search" {...tooltipProps('Clear search')}>
            <X className="h-4 w-4" aria-hidden />
          </button>
        )}
      </div>

      <AnimatePresence>
        {open && canSearch ? (
          <>
            <motion.button
              key="library-search-scrim"
              type="button"
              className="library-search-scrim"
              aria-label="Close search"
              {...tooltipProps('Close search')}
              onClick={() => setOpen(false)}
              variants={modalBackdrop}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={springSoft}
            />
            <motion.div
              key="library-search-panel"
              id={dialogId}
              className="library-search-panel card"
              role="dialog"
              aria-modal="true"
              aria-label="Search results"
              variants={fadeUp}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={springSoft}
            >
              <div className="mb-3 flex items-center justify-between gap-2">
                <div>
                  {focusedType ? (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => onFocusedTypeChange(null)}
                    >
                      <ArrowLeft className="mr-2 h-4 w-4" aria-hidden />
                      Back to all results
                    </button>
                  ) : (
                    <div className="text-sm text-muted" aria-live="polite">
                      {searching ? (
                        <span className="inline-flex items-center gap-2" role="status" aria-busy="true">
                          <span className="sr-only">Searching…</span>
                          <Skeleton className="h-4 w-40" />
                        </span>
                      ) : `${totalResults} results for “${trimmed}”`}
                    </div>
                  )}
                </div>
                <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>
                  Close
                </button>
              </div>

              {error && (
                <p className="mb-3 text-sm text-danger" role="alert">{error}</p>
              )}

              <AnimatePresence mode="wait">
                {focusedType ? (
                  <motion.div
                    key={`focused-${focusedType}`}
                    className="space-y-2"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={springSoft}
                  >
                    <h3 className="font-semibold capitalize">{focusedType}</h3>
                    {focusedList.loading && focusedList.items.length === 0 && (
                      <SkeletonStack count={5} label="Loading search results">
                        {(index) => <TrackRowSkeleton key={index} showDuration={false} showActions={false} />}
                      </SkeletonStack>
                    )}
                    {focusedList.items.map((item) => renderResultRow(item, focusedType))}
                    <InfiniteListBoundary
                      hasMore={focusedList.hasMore}
                      loading={focusedList.loading}
                      loadingMore={focusedList.loadingMore}
                      error={focusedList.error}
                      onLoadMore={focusedList.loadMore}
                      onRetry={focusedList.retry}
                      endLabel={focusedList.items.length > 0 ? `${focusedList.items.length} results` : undefined}
                    />
                    {!focusedList.loading && !focusedList.error && focusedList.items.length === 0 && (
                      <p className="text-sm text-muted">No results</p>
                    )}
                  </motion.div>
                ) : searching && !grouped ? (
                  <motion.div
                    key="searching"
                    className="grid gap-4 sm:grid-cols-2"
                    role="status"
                    aria-busy="true"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={springSoft}
                  >
                    <span className="sr-only">Searching…</span>
                    {GROUP_META.map((group) => (
                      <SearchGroupSkeleton key={group.type} />
                    ))}
                  </motion.div>
                ) : grouped ? (
                  <motion.div
                    key="grouped"
                    className="grid min-w-0 gap-5 lg:grid-cols-2"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={springSoft}
                  >
                    {GROUP_META.map((group) => {
                      const items = grouped[group.type];
                      const Icon = group.icon;
                      return (
                        <section key={group.type} className="min-w-0 space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <h3 className="inline-flex items-center gap-2 font-semibold">
                              <Icon className="h-4 w-4 text-muted" aria-hidden />
                              {group.title}
                            </h3>
                            {items.length > 0 && (
                              <button
                                type="button"
                                className="btn btn-secondary px-3 py-1.5 text-xs"
                                onClick={() => onFocusedTypeChange(group.type)}
                              >
                                See all
                              </button>
                            )}
                          </div>
                          {items.length === 0 ? (
                            <p className="text-sm text-muted">No results</p>
                          ) : (
                            <div className="space-y-1.5">
                              {items.slice(0, 5).map((item) => renderResultRow(item, group.type))}
                            </div>
                          )}
                        </section>
                      );
                    })}
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
