import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Disc3, Mic2, X } from 'lucide-react';
import { api, type PageResult, type TrackItem } from '../lib/api';
import { usePlayer } from '../context/PlayerContext';
import { useInfiniteMediaList } from '../hooks/useInfiniteMediaList';
import { Artwork } from './Artwork';
import { InfiniteListBoundary } from './InfiniteListBoundary';
import { MediaCard } from './MediaCard';
import { TrackRow } from './TrackRow';
import { AddToPlaylistButton } from './AddToPlaylistButton';
import { MediaCardSkeleton, Skeleton, SkeletonStack, TrackRowSkeleton } from './Skeleton';

export interface LibraryDetailSelection {
  type: 'artist' | 'album';
  key: string;
  title?: string;
  artUrl?: string;
  artist?: string;
  year?: number;
}

interface LibraryDetailPaneProps {
  selection: LibraryDetailSelection;
  mode: 'inline' | 'sheet';
  onClose: () => void;
  onOpenAlbum: (album: TrackItem) => void;
  onBackToArtist?: () => void;
  artistParent?: LibraryDetailSelection | null;
  playerActive?: boolean;
}

export function LibraryDetailPane({
  selection,
  mode,
  onClose,
  onOpenAlbum,
  onBackToArtist,
  artistParent = null,
  playerActive = false,
}: LibraryDetailPaneProps) {
  const player = usePlayer();
  const scrollRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [meta, setMeta] = useState<LibraryDetailSelection>(selection);
  const [metaLoading, setMetaLoading] = useState(true);
  const [metaError, setMetaError] = useState('');

  useEffect(() => {
    setMeta(selection);
    setMetaLoading(true);
    setMetaError('');
    const controller = new AbortController();
    const path = selection.type === 'artist'
      ? `/api/artists/${selection.key}`
      : `/api/albums/${selection.key}`;

    api<{
      artist?: TrackItem;
      album?: TrackItem;
    }>(path, { signal: controller.signal })
      .then((res) => {
        if (selection.type === 'artist' && res.artist) {
          setMeta({
            type: 'artist',
            key: res.artist.ratingKey,
            title: res.artist.title,
            artUrl: res.artist.artUrl,
          });
        } else if (selection.type === 'album' && res.album) {
          setMeta({
            type: 'album',
            key: res.album.ratingKey,
            title: res.album.title,
            artUrl: res.album.artUrl,
            artist: res.album.artist,
            year: res.album.year,
          });
        }
      })
      .catch((err) => {
        if ((err as Error).name === 'AbortError') return;
        setMetaError((err as Error).message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setMetaLoading(false);
      });

    return () => controller.abort();
  }, [selection.key, selection.type]);

  useEffect(() => {
    closeRef.current?.focus();
  }, [selection.key, mode]);

  useEffect(() => {
    if (mode !== 'sheet') return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [mode, onClose]);

  const albumsList = useInfiniteMediaList<TrackItem>({
    enabled: selection.type === 'artist',
    resetKey: `artist-albums:${selection.key}`,
    pageSize: 40,
    fetchPage: async ({ start, size, signal }) => api<PageResult<TrackItem>>(
      `/api/artists/${selection.key}/albums?start=${start}&size=${size}`,
      { signal },
    ),
  });

  const tracksList = useInfiniteMediaList<TrackItem>({
    enabled: selection.type === 'album',
    resetKey: `album-tracks:${selection.key}`,
    pageSize: 50,
    fetchPage: async ({ start, size, signal }) => api<PageResult<TrackItem>>(
      `/api/albums/${selection.key}/tracks?start=${start}&size=${size}`,
      { signal },
    ),
  });

  const playAll = async (shuffle = false) => {
    if (selection.type === 'album') {
      const res = await api<{ items: TrackItem[] }>(`/api/albums/${selection.key}/tracks?all=1`);
      await player.playTracks(res.items, shuffle);
      return;
    }
    const res = await api<{ items: TrackItem[] }>(`/api/artists/${selection.key}/tracks?all=1`);
    await player.playTracks(res.items, shuffle);
  };

  const playAlbumQuick = async (album: TrackItem) => {
    const res = await api<{ items: TrackItem[] }>(`/api/albums/${album.ratingKey}/tracks?all=1`);
    await player.playTracks(res.items);
  };

  const content = (
    <div
      className={`library-detail-panel card ${mode === 'inline' ? 'library-detail-inline' : 'library-detail-sheet'} ${playerActive ? 'library-detail-player-active' : ''}`}
      role={mode === 'sheet' ? 'dialog' : 'region'}
      aria-modal={mode === 'sheet' ? true : undefined}
      aria-label={`${selection.type} details`}
    >
      {meta.artUrl && (
        <div
          className="library-detail-glow"
          style={{ backgroundImage: `url(${meta.artUrl})` }}
          aria-hidden
        />
      )}

      <div className="relative z-10 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-4">
          <Artwork
            src={meta.artUrl}
            alt=""
            className="h-20 w-20 sm:h-24 sm:w-24"
            rounded={selection.type === 'artist' ? 'full' : 'xl'}
            icon={
              selection.type === 'artist'
                ? <Mic2 className="h-7 w-7" aria-hidden />
                : <Disc3 className="h-7 w-7" aria-hidden />
            }
          />
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">
              {selection.type === 'artist' ? 'Artist' : 'Album'}
            </p>
            <h2 className="truncate text-2xl font-semibold">
              {metaLoading ? (
                <span className="block space-y-2" role="status" aria-busy="true">
                  <span className="sr-only">Loading…</span>
                  <Skeleton className="h-7 w-48 max-w-full" />
                </span>
              ) : (meta.title ?? 'Untitled')}
            </h2>
            {selection.type === 'album' && (
              metaLoading ? (
                <div className="truncate text-sm text-muted" role="status" aria-busy="true">
                  <span className="sr-only">Loading…</span>
                  <Skeleton className="mt-1 h-4 w-40 max-w-full" />
                </div>
              ) : (
                <p className="truncate text-sm text-muted">
                  {[meta.artist, meta.year].filter(Boolean).join(' · ')}
                </p>
              )
            )}
          </div>
        </div>
        <button ref={closeRef} type="button" className="btn btn-secondary shrink-0" onClick={onClose} aria-label="Close details">
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>

      {artistParent && selection.type === 'album' && onBackToArtist && (
        <button type="button" className="btn btn-secondary relative z-10 mt-3" onClick={onBackToArtist}>
          <ArrowLeft className="mr-2 h-4 w-4" aria-hidden />
          Back to {artistParent.title ?? 'artist'}
        </button>
      )}

      <div className="relative z-10 mt-4 flex flex-wrap gap-2">
        <button type="button" className="btn btn-primary" onClick={() => void playAll(false)}>
          Play all
        </button>
        <button type="button" className="btn btn-secondary" onClick={() => void playAll(true)}>
          Shuffle
        </button>
      </div>

      {metaError && (
        <p className="relative z-10 mt-4 text-sm text-danger" role="alert">{metaError}</p>
      )}

      <div
        ref={scrollRef}
        className="library-detail-scroll relative z-10 mt-4"
        data-testid="library-detail-scroll"
      >
        {selection.type === 'artist' && (
          <div className="space-y-2">
            <h3 className="font-medium">Albums</h3>
            {albumsList.loading && albumsList.items.length === 0 && (
              <SkeletonStack count={4} label="Loading albums">
                {(index) => <MediaCardSkeleton key={index} variant="compact" />}
              </SkeletonStack>
            )}
            <div className="grid min-w-0 gap-3 sm:grid-cols-2">
              {albumsList.items.map((album) => (
                <MediaCard
                  key={album.ratingKey}
                  item={album}
                  kind="album"
                  density="compact"
                  onOpen={() => onOpenAlbum(album)}
                  onPlay={() => void playAlbumQuick(album)}
                />
              ))}
            </div>
            <InfiniteListBoundary
              hasMore={albumsList.hasMore}
              loading={albumsList.loading}
              loadingMore={albumsList.loadingMore}
              error={albumsList.error}
              onLoadMore={albumsList.loadMore}
              onRetry={albumsList.retry}
              rootRef={scrollRef}
            />
            {!albumsList.loading && !albumsList.error && albumsList.items.length === 0 && (
              <p className="text-sm text-muted">No albums found.</p>
            )}
          </div>
        )}

        {selection.type === 'album' && (
          <div className="space-y-1.5">
            {tracksList.loading && tracksList.items.length === 0 && (
              <SkeletonStack count={6} label="Loading tracks">
                {(index) => <TrackRowSkeleton key={index} />}
              </SkeletonStack>
            )}
            {tracksList.items.map((track, index) => (
              <TrackRow
                key={track.ratingKey}
                track={track}
                subtitle={track.artist}
                index={index + 1}
                onPlay={() => player.playTracks([track])}
                actions={<AddToPlaylistButton track={track} />}
              />
            ))}
            <InfiniteListBoundary
              hasMore={tracksList.hasMore}
              loading={tracksList.loading}
              loadingMore={tracksList.loadingMore}
              error={tracksList.error}
              onLoadMore={tracksList.loadMore}
              onRetry={tracksList.retry}
              rootRef={scrollRef}
              endLabel={tracksList.items.length > 0 ? `${tracksList.items.length} tracks` : undefined}
            />
            {!tracksList.loading && !tracksList.error && tracksList.items.length === 0 && (
              <p className="text-sm text-muted">No tracks found.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );

  if (mode === 'sheet') {
    return (
      <div
        className={`library-detail-backdrop ${playerActive ? 'library-detail-backdrop-player-active' : ''}`}
      >
        <button type="button" className="absolute inset-0" aria-label="Close details" onClick={onClose} />
        <div className="relative z-10 min-w-0 w-full max-w-2xl">{content}</div>
      </div>
    );
  }

  return content;
}
