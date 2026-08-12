import { useEffect, useId, useRef, useState } from 'react';
import { ListMusic } from 'lucide-react';
import {
  addTracksToPlaylist,
  api,
  type PageResult,
  type PlaylistSummary,
  type TrackItem,
} from '../lib/api';
import { useInfiniteMediaList } from '../hooks/useInfiniteMediaList';
import { Artwork } from './Artwork';
import { InfiniteListBoundary } from './InfiniteListBoundary';
import { MarqueeText } from './MarqueeText';
import { Modal } from './motion/Modal';
import { SkeletonStack, TrackRowSkeleton } from './Skeleton';

interface AddTracksSearchDialogProps {
  open?: boolean;
  playlist: PlaylistSummary;
  onClose: () => void;
  onSuccess: (message: string) => void;
  onExitComplete?: () => void;
}

export function AddTracksSearchDialog({
  open = true,
  playlist,
  onClose,
  onSuccess,
  onExitComplete,
}: AddTracksSearchDialogProps) {
  const titleId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [actionError, setActionError] = useState('');
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const trimmed = query.trim();
  const canSearch = trimmed.length >= 2;

  const results = useInfiniteMediaList<TrackItem>({
    enabled: open && canSearch,
    resetKey: `playlist-add-search:${trimmed}`,
    pageSize: 40,
    fetchPage: async ({ start, size, signal }) => api<PageResult<TrackItem>>(
      `/api/search?q=${encodeURIComponent(trimmed)}&type=tracks&start=${start}&size=${size}`,
      { signal },
    ),
  });

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busyKey) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [busyKey, onClose, open]);

  const addTrack = async (track: TrackItem) => {
    setActionError('');
    setBusyKey(track.ratingKey);
    try {
      await addTracksToPlaylist(playlist.ratingKey, [track.ratingKey]);
      onSuccess(`Added "${track.title}" to "${playlist.title}"`);
    } catch (err) {
      setActionError((err as Error).message);
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      busy={Boolean(busyKey)}
      labelledBy={titleId}
      zIndexClass="z-[60]"
      panelClassName="card flex max-h-[min(85vh,720px)] w-full max-w-lg flex-col overflow-hidden"
      onExitComplete={onExitComplete}
    >
      <div className="space-y-4 border-b border-white/10 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id={titleId} className="text-xl font-semibold">Add tracks</h2>
            <p className="truncate text-sm text-muted">to {playlist.title}</p>
          </div>
          <button
            className="btn btn-secondary shrink-0"
            type="button"
            onClick={onClose}
            disabled={Boolean(busyKey)}
          >
            Close
          </button>
        </div>

        <div className="flex min-w-0 items-center gap-3">
          <Artwork
            src={playlist.artUrl}
            alt=""
            className="h-12 w-12"
            rounded="lg"
            icon={<ListMusic className="h-5 w-5" aria-hidden />}
          />
          <div className="min-w-0">
            <p className="truncate font-medium">{playlist.title}</p>
            {playlist.leafCount !== undefined ? (
              <p className="text-sm text-muted">
                {playlist.leafCount} {playlist.leafCount === 1 ? 'track' : 'tracks'}
              </p>
            ) : null}
          </div>
        </div>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Search tracks</span>
          <input
            ref={inputRef}
            className="input"
            placeholder="Search by title, artist, or album"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            disabled={Boolean(busyKey)}
            autoComplete="off"
          />
        </label>

        {actionError ? (
          <p className="text-sm text-danger" role="alert">{actionError}</p>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        {!canSearch ? (
          <p className="text-sm text-muted">Type at least 2 characters to search.</p>
        ) : null}

        {canSearch && results.loading && results.items.length === 0 ? (
          <SkeletonStack count={4} label="Searching tracks">
            {(index) => <TrackRowSkeleton key={index} showDuration={false} showActions={false} />}
          </SkeletonStack>
        ) : null}

        {canSearch && results.error && results.items.length === 0 ? (
          <div className="space-y-3" role="alert">
            <p className="text-sm text-danger">{results.error}</p>
            <button className="btn btn-secondary" type="button" onClick={results.retry}>
              Retry
            </button>
          </div>
        ) : null}

        {canSearch && !results.loading && !results.error && results.items.length === 0 ? (
          <p className="text-sm text-muted">No tracks found.</p>
        ) : null}

        {canSearch && results.items.length > 0 ? (
          <ul className="space-y-1.5">
            {results.items.map((track) => {
              const meta = [track.artist, track.album].filter(Boolean).join(' · ');
              return (
                <li key={track.ratingKey}>
                  <div className="flex min-w-0 items-center gap-3 rounded-xl bg-surface-muted/40 px-3 py-2.5">
                    <Artwork src={track.artUrl} alt="" className="h-10 w-10" rounded="lg" />
                    <div className="min-w-0 flex-1 overflow-hidden">
                      <MarqueeText text={track.title} className="font-medium" />
                      {meta ? <p className="truncate text-sm text-muted">{meta}</p> : null}
                    </div>
                    <button
                      className="btn btn-secondary shrink-0"
                      type="button"
                      disabled={Boolean(busyKey)}
                      onClick={() => void addTrack(track)}
                    >
                      {busyKey === track.ratingKey ? 'Adding…' : 'Add'}
                    </button>
                  </div>
                </li>
              );
            })}
            <li>
              <InfiniteListBoundary
                hasMore={results.hasMore}
                loading={results.loading}
                loadingMore={results.loadingMore}
                error={results.error && results.items.length > 0 ? results.error : ''}
                onLoadMore={results.loadMore}
                onRetry={results.retry}
                endLabel={results.items.length > 0 ? `${results.items.length} results` : undefined}
              />
            </li>
          </ul>
        ) : null}
      </div>
    </Modal>
  );
}
