import { FormEvent, useEffect, useId, useRef, useState } from 'react';
import { ListMusic } from 'lucide-react';
import {
  addTracksToPlaylist,
  createPlaylistWithTracks,
  listAllPlaylists,
  type PlaylistSummary,
  type TrackItem,
} from '../lib/api';
import { Artwork } from './Artwork';
import { Modal } from './motion/Modal';
import { PlaylistItemSkeleton, SkeletonStack } from './Skeleton';

interface AddToPlaylistDialogProps {
  open?: boolean;
  track: TrackItem;
  onClose: () => void;
  onSuccess: (message: string) => void;
  onExitComplete?: () => void;
}

export function AddToPlaylistDialog({
  open = true,
  track,
  onClose,
  onSuccess,
  onExitComplete,
}: AddToPlaylistDialogProps) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const [playlists, setPlaylists] = useState<PlaylistSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');

  const loadPlaylists = async (signal?: AbortSignal) => {
    setLoading(true);
    setError('');
    try {
      const items = await listAllPlaylists();
      if (signal?.aborted) return;
      setPlaylists(items);
    } catch (err) {
      if (signal?.aborted || (err as Error).name === 'AbortError') return;
      setError((err as Error).message);
      setPlaylists([]);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    void loadPlaylists(controller.signal);
    return () => controller.abort();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busyKey && !creating) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [busyKey, creating, onClose, open]);

  const addToPlaylist = async (playlist: PlaylistSummary) => {
    setActionError('');
    setBusyKey(playlist.ratingKey);
    try {
      await addTracksToPlaylist(playlist.ratingKey, [track.ratingKey]);
      onSuccess(`Added "${track.title}" to "${playlist.title}"`);
      onClose();
    } catch (err) {
      setActionError((err as Error).message);
    } finally {
      setBusyKey(null);
    }
  };

  const createPlaylist = async (event: FormEvent) => {
    event.preventDefault();
    const title = newTitle.trim();
    if (!title) return;

    setActionError('');
    setCreating(true);
    try {
      const playlist = await createPlaylistWithTracks(title, [track.ratingKey]);
      onSuccess(`Created "${playlist.title}" with "${track.title}"`);
      onClose();
    } catch (err) {
      setActionError((err as Error).message);
    } finally {
      setCreating(false);
    }
  };

  const busy = Boolean(busyKey) || creating;
  const meta = [track.artist, track.album].filter(Boolean).join(' · ');

  return (
    <Modal
      open={open}
      onClose={onClose}
      busy={busy}
      labelledBy={titleId}
      zIndexClass="z-[60]"
      panelClassName="card flex max-h-[min(85vh,720px)] w-full max-w-lg flex-col overflow-hidden"
      onExitComplete={onExitComplete}
    >
      <div className="space-y-4 border-b border-white/10 p-5">
        <div className="flex items-start justify-between gap-3">
          <h2 id={titleId} className="text-xl font-semibold">Add to playlist</h2>
          <button
            ref={closeRef}
            className="btn btn-secondary shrink-0"
            type="button"
            onClick={onClose}
            disabled={busy}
          >
            Close
          </button>
        </div>

        <div className="flex min-w-0 items-center gap-3">
          <Artwork src={track.artUrl} alt="" className="h-12 w-12" rounded="lg" />
          <div className="min-w-0">
            <p className="truncate font-medium">{track.title}</p>
            {meta ? <p className="truncate text-sm text-muted">{meta}</p> : null}
          </div>
        </div>

        <form className="flex gap-2" onSubmit={createPlaylist}>
          <input
            className="input"
            placeholder="New playlist name"
            value={newTitle}
            onChange={(event) => setNewTitle(event.target.value)}
            disabled={busy}
            aria-label="New playlist name"
          />
          <button
            className="btn btn-primary shrink-0"
            type="submit"
            disabled={busy || !newTitle.trim()}
          >
            {creating ? 'Creating…' : 'Create'}
          </button>
        </form>

        {actionError ? (
          <p className="text-sm text-danger" role="alert">{actionError}</p>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        {loading ? (
          <SkeletonStack count={4} label="Loading playlists">
            {(index) => <PlaylistItemSkeleton key={index} />}
          </SkeletonStack>
        ) : null}

        {!loading && error ? (
          <div className="space-y-3" role="alert">
            <p className="text-sm text-danger">{error}</p>
            <button className="btn btn-secondary" type="button" onClick={() => void loadPlaylists()}>
              Retry
            </button>
          </div>
        ) : null}

        {!loading && !error && playlists.length === 0 ? (
          <p className="text-sm text-muted">No playlists yet. Create one above to get started.</p>
        ) : null}

        {!loading && !error && playlists.length > 0 ? (
          <ul className="space-y-1.5">
            {playlists.map((playlist) => (
              <li key={playlist.ratingKey}>
                <div className="flex min-w-0 items-center gap-3 rounded-xl bg-surface-muted/40 px-3 py-2.5">
                  <Artwork
                    src={playlist.artUrl}
                    alt=""
                    className="h-10 w-10"
                    rounded="lg"
                    icon={<ListMusic className="h-4 w-4" aria-hidden />}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{playlist.title}</p>
                    {playlist.leafCount !== undefined ? (
                      <p className="text-xs text-muted">
                        {playlist.leafCount} {playlist.leafCount === 1 ? 'track' : 'tracks'}
                      </p>
                    ) : null}
                  </div>
                  <button
                    className="btn btn-secondary shrink-0"
                    type="button"
                    disabled={busy}
                    onClick={() => void addToPlaylist(playlist)}
                  >
                    {busyKey === playlist.ratingKey ? 'Adding…' : 'Add'}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </Modal>
  );
}
