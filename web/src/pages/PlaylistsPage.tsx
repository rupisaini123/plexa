import { FormEvent, useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, ListMusic, Trash2 } from 'lucide-react';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Artwork } from '../components/Artwork';
import { TrackRow } from '../components/TrackRow';
import { AddToPlaylistButton } from '../components/AddToPlaylistButton';
import { InfiniteListBoundary } from '../components/InfiniteListBoundary';
import { PlaylistItemSkeleton, SkeletonStack, TrackRowSkeleton } from '../components/Skeleton';
import { api, fetchCsrf, type PageResult, type TrackItem } from '../lib/api';
import { usePlayer } from '../context/PlayerContext';
import { usePlaylistActions } from '../context/PlaylistActionsContext';
import { useInfiniteMediaList } from '../hooks/useInfiniteMediaList';

interface Playlist {
  ratingKey: string;
  title: string;
  leafCount?: number;
  artUrl?: string;
}

type DialogMode = 'rename' | 'delete' | 'removeTrack' | null;

export function PlaylistsPage() {
  const [selected, setSelected] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [dialog, setDialog] = useState<DialogMode>(null);
  const [renameValue, setRenameValue] = useState('');
  const [dialogBusy, setDialogBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const [trackToRemove, setTrackToRemove] = useState<{ playlistItemId: string; title: string } | null>(null);
  const [sidebarReset, setSidebarReset] = useState(0);
  const [tracksReset, setTracksReset] = useState(0);
  const sidebarScrollRef = useRef<HTMLDivElement>(null);
  const tracksScrollRef = useRef<HTMLOListElement>(null);
  const player = usePlayer();
  const { openForPlaylist, revision } = usePlaylistActions();

  const playlists = useInfiniteMediaList<Playlist>({
    resetKey: `playlists:${sidebarReset}`,
    pageSize: 40,
    fetchPage: async ({ start, size, signal }) => api<PageResult<Playlist>>(
      `/api/playlists?start=${start}&size=${size}`,
      { signal },
    ),
  });

  const tracks = useInfiniteMediaList<TrackItem>({
    enabled: Boolean(selected),
    resetKey: `playlist-tracks:${selected ?? 'none'}:${tracksReset}`,
    pageSize: 50,
    getItemKey: (item) => item.playlistItemId ?? item.ratingKey,
    fetchPage: async ({ start, size, signal }) => {
      if (!selected) return { items: [], nextStart: 0, hasMore: false };
      return api<PageResult<TrackItem>>(
        `/api/playlists/${selected}/tracks?start=${start}&size=${size}`,
        { signal },
      );
    },
  });

  const selectedPlaylist = playlists.items.find((p) => p.ratingKey === selected) ?? null;
  const trackCount = selectedPlaylist?.leafCount ?? tracks.items.length;

  useEffect(() => {
    setTracksReset((value) => value + 1);
  }, [selected]);

  useEffect(() => {
    setSidebarReset((value) => value + 1);
    setTracksReset((value) => value + 1);
  }, [revision]);

  const openPlaylist = (key: string) => {
    setSelected(key);
    setActionError('');
  };

  const createPlaylist = async (e: FormEvent) => {
    e.preventDefault();
    await fetchCsrf();
    await api('/api/playlists', { method: 'POST', body: JSON.stringify({ title: newTitle }) });
    setNewTitle('');
    setSidebarReset((value) => value + 1);
  };

  const openRename = () => {
    if (!selectedPlaylist) return;
    setRenameValue(selectedPlaylist.title);
    setDialog('rename');
  };

  const openDelete = () => {
    if (!selectedPlaylist) return;
    setDialog('delete');
  };

  const closeDialog = () => {
    if (dialogBusy) return;
    setDialog(null);
    setTrackToRemove(null);
  };

  const renamePlaylist = async () => {
    if (!selected) return;
    const title = renameValue.trim();
    if (!title || title === selectedPlaylist?.title) return;
    setDialogBusy(true);
    try {
      await fetchCsrf();
      await api(`/api/playlists/${selected}`, { method: 'PATCH', body: JSON.stringify({ title }) });
      setDialog(null);
      setSidebarReset((value) => value + 1);
    } catch (err) {
      setActionError((err as Error).message);
    } finally {
      setDialogBusy(false);
    }
  };

  const deletePlaylist = async () => {
    if (!selected) return;
    setDialogBusy(true);
    try {
      await fetchCsrf();
      await api(`/api/playlists/${selected}`, { method: 'DELETE' });
      setSelected(null);
      setDialog(null);
      setSidebarReset((value) => value + 1);
    } catch (err) {
      setActionError((err as Error).message);
    } finally {
      setDialogBusy(false);
    }
  };

  const openRemoveTrack = (track: TrackItem) => {
    if (!track.playlistItemId) return;
    setTrackToRemove({ playlistItemId: track.playlistItemId, title: track.title });
    setDialog('removeTrack');
  };

  const confirmRemoveTrack = async () => {
    if (!selected || !trackToRemove) return;
    setDialogBusy(true);
    try {
      await fetchCsrf();
      await api(`/api/playlists/${selected}/tracks/${trackToRemove.playlistItemId}`, { method: 'DELETE' });
      setDialog(null);
      setTrackToRemove(null);
      setTracksReset((value) => value + 1);
      setSidebarReset((value) => value + 1);
    } catch (err) {
      setActionError((err as Error).message);
    } finally {
      setDialogBusy(false);
    }
  };

  const moveTrack = async (index: number, direction: -1 | 1) => {
    if (!selected) return;
    const target = index + direction;
    if (target < 0) return;

    if (target >= tracks.items.length) {
      if (!tracks.hasMore) return;
      tracks.loadMore();
      return;
    }

    const item = tracks.items[index];
    const after = direction < 0 ? tracks.items[target - 1] : tracks.items[target];
    if (!item.playlistItemId) return;
    await fetchCsrf();
    await api(`/api/playlists/${selected}/reorder`, {
      method: 'POST',
      body: JSON.stringify({
        playlistItemId: item.playlistItemId,
        afterPlaylistItemId: after?.playlistItemId,
      }),
    });
    setTracksReset((value) => value + 1);
  };

  const playAll = async (shuffle = false) => {
    if (!selected) return;
    const res = await api<{ items: TrackItem[] }>(`/api/playlists/${selected}/tracks?all=1`);
    await player.playTracks(res.items, shuffle);
  };

  const trackListMaxHeight = player.current
    ? 'lg:max-h-[calc(100vh-26rem)]'
    : 'lg:max-h-[calc(100vh-18rem)]';

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[320px_1fr]">
      <section
        data-testid="playlists-sidebar"
        className="card space-y-4 self-start p-4 lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:overflow-hidden"
      >
        <h2 className="font-semibold">Playlists</h2>
        <form onSubmit={createPlaylist} className="flex gap-2">
          <input className="input" placeholder="New playlist" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} aria-label="New playlist name" />
          <button className="btn btn-primary" type="submit">Add</button>
        </form>
        {playlists.loading && playlists.items.length === 0 && (
          <SkeletonStack count={6} label="Loading playlists">
            {(index) => <PlaylistItemSkeleton key={index} />}
          </SkeletonStack>
        )}
        {(actionError || playlists.error) && (
          <p className="text-sm text-danger" role="alert">{actionError || playlists.error}</p>
        )}
        <div
          ref={sidebarScrollRef}
          className="space-y-2 lg:max-h-[calc(100vh-12rem)] lg:overflow-y-auto"
        >
          {playlists.items.map((p) => (
            <button
              key={p.ratingKey}
              type="button"
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${
                selected === p.ratingKey
                  ? 'bg-accent text-white'
                  : 'bg-surface-muted/60 hover:bg-surface-muted'
              }`}
              onClick={() => openPlaylist(p.ratingKey)}
            >
              <Artwork
                src={p.artUrl}
                alt=""
                className="h-10 w-10"
                rounded="lg"
                icon={<ListMusic className="h-4 w-4" aria-hidden />}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{p.title}</span>
                {p.leafCount ? (
                  <span className={`text-xs ${selected === p.ratingKey ? 'text-white/70' : 'text-muted'}`}>
                    {p.leafCount} {p.leafCount === 1 ? 'track' : 'tracks'}
                  </span>
                ) : null}
              </span>
            </button>
          ))}
          <InfiniteListBoundary
            hasMore={playlists.hasMore}
            loading={playlists.loading}
            loadingMore={playlists.loadingMore}
            error={playlists.error && playlists.items.length > 0 ? playlists.error : ''}
            onLoadMore={playlists.loadMore}
            onRetry={playlists.retry}
            rootRef={sidebarScrollRef}
          />
        </div>
      </section>

      <section className="card min-w-0 p-4 sm:p-5">
        {selected && selectedPlaylist ? (
          <div className="space-y-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex min-w-0 items-center gap-4">
                <Artwork
                  src={selectedPlaylist.artUrl ?? tracks.items[0]?.artUrl}
                  alt=""
                  className="h-20 w-20 sm:h-24 sm:w-24"
                  rounded="xl"
                  icon={<ListMusic className="h-7 w-7 sm:h-8 sm:w-8" aria-hidden />}
                />
                <div className="min-w-0">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted">Playlist</p>
                  <h2 className="truncate text-2xl font-semibold">{selectedPlaylist.title}</h2>
                  <p className="text-sm text-muted">
                    {trackCount} {trackCount === 1 ? 'track' : 'tracks'}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button className="btn btn-primary" type="button" onClick={() => void playAll(false)}>Play</button>
                <button className="btn btn-secondary" type="button" onClick={() => void playAll(true)}>Shuffle</button>
                <button
                  className="btn btn-secondary"
                  type="button"
                  onClick={() => openForPlaylist(selectedPlaylist)}
                >
                  Add tracks
                </button>
                <button className="btn btn-secondary" type="button" onClick={openRename}>Rename</button>
                <button className="btn btn-secondary" type="button" onClick={openDelete}>Delete</button>
              </div>
            </div>

            {tracks.loading && tracks.items.length === 0 && (
              <SkeletonStack count={8} label="Loading tracks">
                {(index) => <TrackRowSkeleton key={index} index={index + 1} />}
              </SkeletonStack>
            )}
            {tracks.error && tracks.items.length === 0 && (
              <p className="text-sm text-danger" role="alert">{tracks.error}</p>
            )}

            <ol
              ref={tracksScrollRef}
              data-testid="playlist-tracks"
              className={`space-y-1.5 lg:overflow-y-auto ${trackListMaxHeight}`}
            >
              {tracks.items.map((track, index) => (
                <li key={track.playlistItemId ?? track.ratingKey}>
                  <TrackRow
                    track={track}
                    index={index + 1}
                    onPlay={() => player.playTracks([track])}
                    actions={
                      <>
                        <AddToPlaylistButton track={track} />
                        <button
                          className="player-icon-btn h-9 w-9"
                          type="button"
                          aria-label="Move up"
                          title="Move up"
                          onClick={() => void moveTrack(index, -1)}
                          disabled={index === 0}
                        >
                          <ArrowUp className="h-4 w-4" aria-hidden />
                        </button>
                        <button
                          className="player-icon-btn h-9 w-9"
                          type="button"
                          aria-label="Move down"
                          title="Move down"
                          onClick={() => void moveTrack(index, 1)}
                          disabled={index === tracks.items.length - 1 && !tracks.hasMore}
                        >
                          <ArrowDown className="h-4 w-4" aria-hidden />
                        </button>
                        {track.playlistItemId && (
                          <button
                            className="player-icon-btn h-9 w-9 hover:text-danger"
                            type="button"
                            aria-label={`Remove ${track.title}`}
                            title="Remove"
                            onClick={() => openRemoveTrack(track)}
                          >
                            <Trash2 className="h-4 w-4" aria-hidden />
                          </button>
                        )}
                      </>
                    }
                  />
                </li>
              ))}
              <li>
                <InfiniteListBoundary
                  hasMore={tracks.hasMore}
                  loading={tracks.loading}
                  loadingMore={tracks.loadingMore}
                  error={tracks.error && tracks.items.length > 0 ? tracks.error : ''}
                  onLoadMore={tracks.loadMore}
                  onRetry={tracks.retry}
                  rootRef={tracksScrollRef}
                  endLabel={tracks.items.length > 0 ? `${tracks.items.length} tracks loaded` : undefined}
                />
              </li>
            </ol>
          </div>
        ) : (
          <p className="text-muted">Select a playlist to manage tracks.</p>
        )}
      </section>

      {dialog === 'rename' && selectedPlaylist && (
        <ConfirmDialog
          title="Rename playlist"
          description={<>Enter a new name for &ldquo;{selectedPlaylist.title}&rdquo;.</>}
          input={{
            label: 'Playlist name',
            value: renameValue,
            onChange: setRenameValue,
            placeholder: 'Playlist name',
          }}
          confirmLabel="Save"
          busy={dialogBusy}
          confirmDisabled={!renameValue.trim() || renameValue.trim() === selectedPlaylist.title}
          onConfirm={renamePlaylist}
          onCancel={closeDialog}
        />
      )}

      {dialog === 'delete' && selectedPlaylist && (
        <ConfirmDialog
          title="Delete playlist"
          description={
            <>
              &ldquo;{selectedPlaylist.title}&rdquo;
              {trackCount > 0
                ? <> and its {trackCount} {trackCount === 1 ? 'track' : 'tracks'}</>
                : null}
              {' '}will be permanently removed from Plex. This cannot be undone.
            </>
          }
          confirmLabel="Delete"
          danger
          busy={dialogBusy}
          onConfirm={deletePlaylist}
          onCancel={closeDialog}
        />
      )}

      {dialog === 'removeTrack' && trackToRemove && selectedPlaylist && (
        <ConfirmDialog
          title="Remove track"
          description={
            <>
              &ldquo;{trackToRemove.title}&rdquo; will be removed from &ldquo;{selectedPlaylist.title}&rdquo;.
            </>
          }
          confirmLabel="Remove"
          danger
          busy={dialogBusy}
          onConfirm={confirmRemoveTrack}
          onCancel={closeDialog}
        />
      )}
    </div>
  );
}
