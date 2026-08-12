import { ListPlus } from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';
import { usePlaylistActions } from '../context/PlaylistActionsContext';
import { MarqueeText } from './MarqueeText';

export function QueuePanel() {
  const player = usePlayer();
  const { openForTrack } = usePlaylistActions();
  if (!player.showQueue || player.queue.length === 0) return null;

  return (
    <aside
      id="queue-panel"
      role="dialog"
      aria-label="Playback queue"
      className="fixed inset-y-0 right-0 z-50 w-full max-w-md border-l border-white/10 bg-surface-elevated/95 p-4 shadow-2xl backdrop-blur"
    >
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Queue</h2>
        <button className="btn btn-secondary" onClick={() => player.setShowQueue(false)} type="button">Close</button>
      </div>
      <ol className="max-h-[calc(100vh-8rem)] space-y-2 overflow-y-auto">
        {player.queue.map((track, index) => (
          <li key={`${track.ratingKey}-${index}`}>
            <div
              className={`flex items-center gap-2 rounded-xl px-2 py-1 ${
                index === player.currentIndex ? 'bg-accent text-white' : 'bg-surface-muted/50'
              }`}
            >
              <button
                className={`min-w-0 flex-1 rounded-lg px-2 py-1.5 text-left ${
                  index === player.currentIndex ? '' : 'hover:bg-surface-muted'
                }`}
                onClick={() => player.jumpTo(index)}
                type="button"
              >
                <MarqueeText text={track.title} className="font-medium" />
                <p className="truncate text-sm opacity-80">{track.artist}</p>
              </button>
              <button
                className="player-icon-btn h-9 w-9 shrink-0"
                type="button"
                aria-label={`Add ${track.title} to playlist`}
                title="Add to playlist"
                onClick={() => openForTrack(track)}
              >
                <ListPlus className="h-4 w-4" aria-hidden />
              </button>
            </div>
          </li>
        ))}
      </ol>
    </aside>
  );
}
