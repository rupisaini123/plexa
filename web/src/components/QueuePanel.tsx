import { useEffect, useMemo } from 'react';
import { ListMusic, Repeat, Shuffle, X } from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';
import { useCompactActions } from '../hooks/useCompactActions';
import { tooltipProps } from '../lib/tooltip';
import { QueueNowPlaying } from './QueueNowPlaying';
import { QueueTracksList, useQueueListAutoScroll } from './QueueTracksList';
import { SlidePanel } from './motion/SlidePanel';

export function QueuePanel() {
  const player = usePlayer();
  const compact = useCompactActions();
  const open = player.showQueue;

  const upNextItems = useMemo(
    () => player.queue
      .map((track, queueIndex) => ({ track, queueIndex }))
      .filter((item) => item.queueIndex > player.currentIndex),
    [player.queue, player.currentIndex],
  );

  useQueueListAutoScroll(open, player.currentIndex, player.queue.length);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        player.setShowQueue(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, player]);

  const trackCountLabel = player.queue.length === 1
    ? '1 track'
    : `${player.queue.length} tracks`;
  const upNextCount = upNextItems.length;

  return (
    <SlidePanel
      open={open}
      onClose={() => player.setShowQueue(false)}
      side={compact ? 'bottom' : 'right'}
      respectPlayerBar={compact}
      id="queue-panel"
      labelledBy="queue-panel-title"
      label="Playback queue"
      panelClassName={`queue-panel w-full border-white/10 bg-surface-elevated/95 shadow-2xl backdrop-blur ${
        compact
          ? 'queue-panel-compact rounded-t-2xl border-t p-4'
          : 'h-full max-w-md border-l p-4 sm:p-5'
      }`}
    >
      <div className="mb-4 flex shrink-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="queue-panel-title" className="text-lg font-semibold">Queue</h2>
          {player.queue.length > 0 ? (
            <p className="text-sm text-muted">
              {trackCountLabel}
              {upNextCount > 0 ? ` · ${upNextCount} up next` : ''}
            </p>
          ) : (
            <p className="text-sm text-muted">Nothing queued</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            className={`player-icon-btn h-9 w-9${player.shuffle ? ' text-accent' : ''}`}
            type="button"
            aria-label={player.shuffle ? 'Disable shuffle' : 'Enable shuffle'}
            aria-pressed={player.shuffle}
            disabled={player.queue.length < 2}
            {...tooltipProps('Shuffle')}
            onClick={() => void player.setShuffle(!player.shuffle)}
          >
            <Shuffle className="h-4 w-4" aria-hidden />
          </button>
          <button
            className={`player-icon-btn h-9 w-9${player.loop ? ' text-accent' : ''}`}
            type="button"
            aria-label={player.loop ? 'Disable loop' : 'Enable loop'}
            aria-pressed={player.loop}
            disabled={player.queue.length === 0}
            {...tooltipProps('Loop')}
            onClick={() => void player.setLoop(!player.loop)}
          >
            <Repeat className="h-4 w-4" aria-hidden />
          </button>
          <button
            className="player-icon-btn h-9 w-9"
            type="button"
            aria-label="Close queue"
            {...tooltipProps('Close')}
            onClick={() => player.setShowQueue(false)}
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>

      {player.queue.length === 0 ? (
        <div className="queue-panel-scroll flex flex-1 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-white/10 bg-surface-muted/30 px-6 py-12 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-muted text-muted">
            <ListMusic className="h-7 w-7" aria-hidden />
          </div>
          <div>
            <p className="font-medium">Your queue is empty</p>
            <p className="mt-1 text-sm text-muted">
              Play something from your library or a playlist to build a queue.
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="queue-panel-body flex min-h-0 flex-1 flex-col">
            {player.current ? (
              <div className="queue-panel-pinned shrink-0" data-testid="queue-panel-pinned">
                <QueueNowPlaying
                  track={player.current}
                  isPlaying={player.isPlaying}
                  currentTime={player.currentTime}
                  duration={player.duration}
                />
              </div>
            ) : null}

            {upNextItems.length > 0 ? (
              <QueueTracksList
                key={player.currentIndex}
                className="min-h-0 flex-1"
                items={upNextItems}
                onJumpTo={(index) => void player.jumpTo(index)}
                onRemove={(index) => void player.removeFromQueue(index)}
                onReorder={(fromIndex, toIndex) => void player.reorderQueue(fromIndex, toIndex)}
              />
            ) : (
              <p className="min-h-0 flex-1 text-sm text-muted">No more tracks in queue.</p>
            )}
          </div>

          <div
            className="queue-panel-footer shrink-0 border-t border-white/10 pt-3"
            data-testid="queue-panel-footer"
          >
            <button
              className="btn btn-secondary w-full"
              type="button"
              onClick={() => void player.clearQueue()}
            >
              Clear queue
            </button>
          </div>
        </>
      )}
    </SlidePanel>
  );
}
