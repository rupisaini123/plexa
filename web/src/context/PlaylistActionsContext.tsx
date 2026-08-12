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

type DialogKind = 'pickPlaylist' | 'searchTracks' | null;

interface PlaylistActionsValue {
  openForTrack: (track: TrackItem) => void;
  openForPlaylist: (playlist: PlaylistSummary) => void;
  revision: number;
}

const PlaylistActionsContext = createContext<PlaylistActionsValue | null>(null);

export function PlaylistActionsProvider({ children }: { children: ReactNode }) {
  const [dialogKind, setDialogKind] = useState<DialogKind>(null);
  const [pickTrack, setPickTrack] = useState<TrackItem | null>(null);
  const [searchPlaylist, setSearchPlaylist] = useState<PlaylistSummary | null>(null);
  const [revision, setRevision] = useState(0);
  const [announcement, setAnnouncement] = useState('');
  const lastFocusRef = useRef<HTMLElement | null>(null);

  const close = useCallback(() => {
    setDialogKind(null);
    const target = lastFocusRef.current;
    lastFocusRef.current = null;
    target?.focus();
  }, []);

  const clearPickTrack = useCallback(() => {
    setPickTrack(null);
  }, []);

  const clearSearchPlaylist = useCallback(() => {
    setSearchPlaylist(null);
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
    setPickTrack(track);
    setDialogKind('pickPlaylist');
  }, []);

  const openForPlaylist = useCallback((playlist: PlaylistSummary) => {
    lastFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    setSearchPlaylist(playlist);
    setDialogKind('searchTracks');
  }, []);

  return (
    <PlaylistActionsContext.Provider value={{ openForTrack, openForPlaylist, revision }}>
      {children}
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>
      {pickTrack ? (
        <AddToPlaylistDialog
          open={dialogKind === 'pickPlaylist'}
          track={pickTrack}
          onClose={close}
          onSuccess={handleSuccess}
          onExitComplete={clearPickTrack}
        />
      ) : null}
      {searchPlaylist ? (
        <AddTracksSearchDialog
          open={dialogKind === 'searchTracks'}
          playlist={searchPlaylist}
          onClose={close}
          onSuccess={handleSuccess}
          onExitComplete={clearSearchPlaylist}
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
