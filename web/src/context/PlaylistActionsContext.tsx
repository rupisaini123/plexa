import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { PlaylistSummary, TrackItem } from '../lib/api';
import { AddToPlaylistDialog } from '../components/AddToPlaylistDialog';
import { AddTracksSearchDialog } from '../components/AddTracksSearchDialog';

type DialogState =
  | { kind: 'pickPlaylist'; track: TrackItem }
  | { kind: 'searchTracks'; playlist: PlaylistSummary };

interface PlaylistActionsValue {
  openForTrack: (track: TrackItem) => void;
  openForPlaylist: (playlist: PlaylistSummary) => void;
  revision: number;
}

const PlaylistActionsContext = createContext<PlaylistActionsValue | null>(null);

export function PlaylistActionsProvider({ children }: { children: ReactNode }) {
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [revision, setRevision] = useState(0);
  const [announcement, setAnnouncement] = useState('');
  const lastFocusRef = useRef<HTMLElement | null>(null);

  const close = useCallback(() => {
    setDialog(null);
    const target = lastFocusRef.current;
    lastFocusRef.current = null;
    target?.focus();
  }, []);

  const announce = useCallback((message: string) => {
    setAnnouncement(message);
  }, []);

  const handleSuccess = useCallback((message: string) => {
    setRevision((value) => value + 1);
    announce(message);
  }, [announce]);

  const openForTrack = useCallback((track: TrackItem) => {
    lastFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    setDialog({ kind: 'pickPlaylist', track });
  }, []);

  const openForPlaylist = useCallback((playlist: PlaylistSummary) => {
    lastFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    setDialog({ kind: 'searchTracks', playlist });
  }, []);

  return (
    <PlaylistActionsContext.Provider value={{ openForTrack, openForPlaylist, revision }}>
      {children}
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>
      {dialog?.kind === 'pickPlaylist' ? (
        <AddToPlaylistDialog
          track={dialog.track}
          onClose={close}
          onSuccess={handleSuccess}
        />
      ) : null}
      {dialog?.kind === 'searchTracks' ? (
        <AddTracksSearchDialog
          playlist={dialog.playlist}
          onClose={close}
          onSuccess={handleSuccess}
        />
      ) : null}
    </PlaylistActionsContext.Provider>
  );
}

export function usePlaylistActions(): PlaylistActionsValue {
  const value = useContext(PlaylistActionsContext);
  if (!value) {
    throw new Error('usePlaylistActions must be used within PlaylistActionsProvider');
  }
  return value;
}
