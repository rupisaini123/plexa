import { useEffect, useMemo, useRef, useState } from 'react';
import { ListMusic, Plus, Search } from 'lucide-react';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { InfiniteListBoundary } from '../components/InfiniteListBoundary';
import { PlaylistHero } from '../components/PlaylistHero';
import { PlaylistTracksList } from '../components/PlaylistTracksList';
import { PlaylistItemSkeleton, SkeletonStack, TrackRowSkeleton } from '../components/Skeleton';
import { Artwork } from '../components/Artwork';
import { api, fetchCsrf, type PageResult, type PlaylistSummary, type TrackItem } from '../lib/api';
import { usePlayer } from '../context/PlayerContext';
import { usePlaylistActions } from '../context/PlaylistActionsContext';
import { useInfiniteMediaList } from '../hooks/useInfiniteMediaList';

type DialogMode = 'create' | 'rename' | 'delete' | 'removeTrack' | null;

export function PlaylistsPage() {
  const [selected, setSelected] = useState<string | null>(null);
  const [filterQuery, setFilterQuery] = useState('');
  const [createTitle, setCreateTitle] = useState('');
  const [dialog, setDialog] = useState<DialogMode>(null);
  const [renameValue, setRenameValue] = useState('');
  const [dialogBusy, setDialogBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const [trackToRemove, setTrackToRemove] = useState<{ playlistItemId: string; title: string } | null>(null);
  const [sidebarReset, setSidebarReset] = useState(0);
  const [tracksReset, setTracksReset] = useState(0);
  const sidebarScrollRef = useRef<HTMLDivElement>(null);
  const player = usePlayer();
  const { openForPlaylist, revision } = usePlaylistActions();

  const playlists = useInfiniteMediaList<PlaylistSummary>({
    resetKey: `playlists:${sidebarReset}`,
    pageSize: 40,
    fetchPage: async ({ start, size, signal }) => api<PageResult<PlaylistSummary>>(
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
  const playerActive = Boolean(player.current);

  const filteredPlaylists = useMemo(() => {
    const query = filterQuery.trim().toLowerCase();
    if (!query) return playlists.items;
    return playlists.items.filter((playlist) => playlist.title.toLowerCase().includes(query));
  }, [filterQuery, playlists.items]);

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

  const openCreateDialog = () => {
    setCreateTitle('');
    setDialog('create');
  };

  const createPlaylist = async () => {
    const title = createTitle.trim();
    if (!title) return;
    setDialogBusy(true);
    try {
      await fetchCsrf();
      const created = await api<PlaylistSummary>('/api/playlists', {
        method: 'POST',
        body: JSON.stringify({ title }),
      });
      setDialog(null);
      setCreateTitle('');
      setSidebarReset((value) => value + 1);
      if (created?.ratingKey) {
        setSelected(created.ratingKey);
      }
    } catch (err) {
      setActionError((err as Error).message);
    } finally {
      setDialogBusy(false);
    }
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
    setCreateTitle('');
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
    const removedId = trackToRemove.playlistItemId;
    const removedTrack = tracks.items.find((t) => t.playlistItemId === removedId);
    setDialogBusy(true);
    try {
      await fetchCsrf();
      await api(`/api/playlists/${selected}/tracks/${removedId}`, { method: 'DELETE' });
      setDialog(null);
      setTrackToRemove(null);
      const nextTracks = tracks.items.filter((t) => t.playlistItemId !== removedId);
      tracks.replaceItems(nextTracks);
      playlists.replaceItems(
        playlists.items.map((p) => {
          if (p.ratingKey !== selected) return p;

          const nextLeafCount = Math.max(0, (p.leafCount ?? tracks.items.length) - 1);
          let nextDuration = p.duration;
          if (nextLeafCount === 0) {
            nextDuration = 0;
          } else if (p.duration != null && removedTrack?.durationMs != null) {
            nextDuration = Math.max(0, p.duration - removedTrack.durationMs);
          }

          return { ...p, leafCount: nextLeafCount, duration: nextDuration };
        }),
      );
    } catch (err) {
      setActionError((err as Error).message);
    } finally {
      setDialogBusy(false);
    }
  };

  const playAll = async (shuffle = false) => {
    if (!selected) return;
    const res = await api<{ items: TrackItem[] }>(`/api/playlists/${selected}/tracks?all=1`);
    await player.playTracks(res.items, shuffle);
  };

  return (
    <div className="playlist-split">
      <section
        data-testid="playlists-sidebar"
        className="playlist-sidebar card"
      >
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted">Your music</p>
          <h1 className="text-2xl font-semibold tracking-tight">Playlists</h1>
        </div>

        <div className="flex gap-2">
          <div className="input flex min-w-0 flex-1 items-center gap-2">
            <Search className="h-4 w-4 shrink-0 text-muted" aria-hidden />
            <input
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted focus:ring-0"
              placeholder="Filter playlists"
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              aria-label="Filter playlists"
            />
          </div>
          <button
            type="button"
            className="btn btn-primary shrink-0"
            aria-label="New playlist"
            onClick={openCreateDialog}
          >
            <Plus className="h-4 w-4" aria-hidden />
            <span className="hidden sm:inline">Create</span>
          </button>
        </div>

        {playlists.loading && playlists.items.length === 0 && (
          <SkeletonStack count={6} label="Loading playlists">
            {(index) => <PlaylistItemSkeleton key={index} />}
          </SkeletonStack>
        )}

        {(actionError || playlists.error) && (
          <p className="text-sm text-danger" role="alert">{actionError || playlists.error}</p>
        )}

        {!playlists.loading && playlists.items.length === 0 && !playlists.error && (
          <div className="rounded-xl border border-dashed border-white/10 bg-surface-muted/30 p-4 text-center">
            <ListMusic className="mx-auto h-8 w-8 text-muted" aria-hidden />
            <p className="mt-2 text-sm font-medium">Create your first playlist</p>
            <p className="mt-1 text-xs text-muted">Organize tracks for every mood and moment.</p>
            <button type="button" className="btn btn-primary mt-3" onClick={openCreateDialog}>
              Create playlist
            </button>
          </div>
        )}

        <div ref={sidebarScrollRef} className="playlist-sidebar-scroll">
          {filteredPlaylists.map((p) => {
            const isSelected = selected === p.ratingKey;
            return (
              <button
                key={p.ratingKey}
                type="button"
                className={`playlist-rail-item ${
                  isSelected ? 'playlist-rail-item-selected' : 'playlist-rail-item-default'
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
                    <span className="text-xs text-muted">
                      {p.leafCount} {p.leafCount === 1 ? 'track' : 'tracks'}
                    </span>
                  ) : (
                    <span className="text-xs text-muted">Empty</span>
                  )}
                </span>
              </button>
            );
          })}

          {playlists.items.length > 0 && filteredPlaylists.length === 0 && (
            <p className="px-2 py-3 text-sm text-muted">No playlists match your filter.</p>
          )}

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

      <section
        className={`min-w-0 space-y-5${playerActive ? ' playlist-detail-player-active' : ''}`}
      >
        {selected && selectedPlaylist ? (
          <>
            <PlaylistHero
              playlist={selectedPlaylist}
              coverArtUrl={selectedPlaylist.artUrl ?? tracks.items[0]?.artUrl}
              trackCount={trackCount}
              isEmpty={trackCount === 0 && tracks.items.length === 0 && !tracks.loading}
              onPlay={() => void playAll(false)}
              onShuffle={() => void playAll(true)}
              onAddTracks={() => openForPlaylist(selectedPlaylist)}
              onRename={openRename}
              onDelete={openDelete}
            />

            {tracks.loading && tracks.items.length === 0 && (
              <SkeletonStack count={8} label="Loading tracks">
                {(index) => <TrackRowSkeleton key={index} index={index + 1} />}
              </SkeletonStack>
            )}

            {tracks.error && tracks.items.length === 0 && (
              <p className="text-sm text-danger" role="alert">{tracks.error}</p>
            )}

            {tracks.items.length > 0 && (
              <PlaylistTracksList
                playlistKey={selected}
                tracks={tracks}
                playingRatingKey={player.current?.ratingKey}
                onPlayTrack={(track) => void player.playTracks([track])}
                onRemoveTrack={openRemoveTrack}
                onReorderError={setActionError}
              />
            )}
          </>
        ) : (
          <div className="card flex min-h-[16rem] flex-col items-center justify-center p-8 text-center">
            <ListMusic className="h-12 w-12 text-muted" aria-hidden />
            <h2 className="mt-4 text-lg font-semibold">Choose a playlist</h2>
            <p className="mt-2 max-w-sm text-sm text-muted">
              Select a playlist from the rail to view tracks, or create a new one to get started.
            </p>
            <button type="button" className="btn btn-primary mt-4" onClick={openCreateDialog}>
              Create playlist
            </button>
          </div>
        )}
      </section>

      <ConfirmDialog
        open={dialog === 'create'}
        title="Create playlist"
        description="Give your playlist a name."
        input={{
          label: 'Playlist name',
          value: createTitle,
          onChange: setCreateTitle,
          placeholder: 'Playlist name',
        }}
        confirmLabel="Create"
        busy={dialogBusy}
        confirmDisabled={!createTitle.trim()}
        onConfirm={createPlaylist}
        onCancel={closeDialog}
      />

      {selectedPlaylist ? (
        <ConfirmDialog
          open={dialog === 'rename'}
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
      ) : null}

      {selectedPlaylist ? (
        <ConfirmDialog
          open={dialog === 'delete'}
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
      ) : null}

      {trackToRemove && selectedPlaylist ? (
        <ConfirmDialog
          open={dialog === 'removeTrack'}
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
      ) : null}
    </div>
  );
}
