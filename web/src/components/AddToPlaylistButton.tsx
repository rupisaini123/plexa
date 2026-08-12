import { ListPlus } from 'lucide-react';
import type { TrackItem } from '../lib/api';
import { tooltipProps } from '../lib/tooltip';
import { usePlaylistActions } from '../context/PlaylistActionsContext';

interface AddToPlaylistButtonProps {
  track: TrackItem;
  className?: string;
}

export function AddToPlaylistButton({ track, className }: AddToPlaylistButtonProps) {
  const { openForTrack } = usePlaylistActions();

  return (
    <button
      className={className ? `player-icon-btn ${className}` : 'player-icon-btn h-9 w-9'}
      type="button"
      aria-label={`Add ${track.title} to playlist`}
      {...tooltipProps('Add to playlist')}
      onClick={() => openForTrack(track)}
    >
      <ListPlus className="h-4 w-4" aria-hidden />
    </button>
  );
}
