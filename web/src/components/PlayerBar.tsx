import type { CSSProperties } from 'react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ListMusic, ListPlus, Music2, Pause, Play, SkipBack, SkipForward } from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';
import { usePlaylistActions } from '../context/PlaylistActionsContext';
import { slideFromBottom, springSoft, tapScale } from '../lib/motion';
import { tooltipProps } from '../lib/tooltip';
import { MarqueeText } from './MarqueeText';

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.floor(seconds);
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function setPlayerBarOffset(px: number) {
  document.documentElement.style.setProperty('--player-bar-offset', `${Math.max(0, Math.ceil(px))}px`);
}

export function PlayerBar() {
  const player = usePlayer();
  const track = player.current;
  const barRef = useRef<HTMLElement>(null);
  const [artFailed, setArtFailed] = useState(false);

  useEffect(() => {
    setArtFailed(false);
  }, [track?.artUrl, track?.ratingKey]);

  useLayoutEffect(() => {
    if (!track) {
      return;
    }

    const el = barRef.current;
    if (!el) return;

    const apply = () => setPlayerBarOffset(el.getBoundingClientRect().height);
    apply();

    if (typeof ResizeObserver === 'undefined') {
      return () => setPlayerBarOffset(0);
    }

    const observer = new ResizeObserver(apply);
    observer.observe(el);
    return () => {
      observer.disconnect();
      setPlayerBarOffset(0);
    };
  }, [track]);

  const handleExitComplete = () => {
    setPlayerBarOffset(0);
  };

  return (
    <AnimatePresence onExitComplete={handleExitComplete}>
      {track ? (
        <PlayerBarContent
          key={track.ratingKey}
          barRef={barRef}
          track={track}
          artFailed={artFailed}
          setArtFailed={setArtFailed}
        />
      ) : null}
    </AnimatePresence>
  );
}

function PlayerBarContent({
  barRef,
  track,
  artFailed,
  setArtFailed,
}: {
  barRef: React.RefObject<HTMLElement | null>;
  track: NonNullable<ReturnType<typeof usePlayer>['current']>;
  artFailed: boolean;
  setArtFailed: (value: boolean) => void;
}) {
  const player = usePlayer();
  const { openForTrack } = usePlaylistActions();

  const duration = player.duration > 0
    ? player.duration
    : track.durationMs
      ? track.durationMs / 1000
      : 0;
  const progress = duration > 0 ? Math.min(player.currentTime / duration, 1) : 0;
  const poster = track.artUrl && !artFailed ? track.artUrl : null;

  return (
    <motion.footer
      ref={barRef}
      className="player-bar fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-surface-elevated/95 backdrop-blur-xl"
      variants={slideFromBottom}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={springSoft}
    >
      <div className="app-gutter py-3">
        {/* Seek bar — full width on all breakpoints */}
        <div className="mb-3 flex items-center gap-3">
          <span className="w-10 shrink-0 text-right text-xs tabular-nums text-muted sm:w-12">
            {formatTime(player.currentTime)}
          </span>
          <label className="sr-only" htmlFor="player-seek">Seek</label>
          <input
            id="player-seek"
            className="player-seek"
            type="range"
            min={0}
            max={duration || 0}
            step={0.1}
            value={Math.min(player.currentTime, duration || 0)}
            style={{ '--progress': `${progress * 100}%` } as CSSProperties}
            onChange={(e) => player.seek(Number(e.target.value))}
            aria-label="Seek"
            aria-valuemin={0}
            aria-valuemax={Math.floor(duration)}
            aria-valuenow={Math.floor(player.currentTime)}
            aria-valuetext={`${formatTime(player.currentTime)} of ${formatTime(duration)}`}
          />
          <span className="w-10 shrink-0 text-xs tabular-nums text-muted sm:w-12">
            {formatTime(duration)}
          </span>
        </div>

        <div className="flex items-center gap-3 sm:gap-4">
          {/* Artwork + metadata */}
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="player-poster relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-surface-muted sm:h-14 sm:w-14">
              {poster ? (
                <img
                  src={poster}
                  alt={`${track.title} artwork`}
                  className="h-full w-full object-cover"
                  draggable={false}
                  onError={() => setArtFailed(true)}
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-muted">
                  <Music2 className="h-5 w-5 sm:h-6 sm:w-6" aria-hidden />
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1 overflow-hidden">
              <MarqueeText
                text={track.title}
                className="text-sm font-semibold sm:text-base"
              />
              <p className="truncate text-xs text-muted sm:text-sm">
                {track.artist ?? track.album ?? 'Unknown artist'}
              </p>
            </div>
          </div>

          {/* Transport controls */}
          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            <button
              className="player-icon-btn"
              onClick={() => openForTrack(track)}
              type="button"
              aria-label={`Add ${track.title} to playlist`}
              {...tooltipProps('Add to playlist', 'top')}
            >
              <ListPlus className="h-5 w-5" aria-hidden />
            </button>
            <button
              className="player-icon-btn"
              onClick={() => player.setShowQueue(!player.showQueue)}
              type="button"
              aria-expanded={player.showQueue}
              aria-controls="queue-panel"
              aria-label="Queue"
              {...tooltipProps('Queue', 'top')}
            >
              <ListMusic className="h-5 w-5" aria-hidden />
            </button>
            <button
              className="player-icon-btn"
              onClick={() => void player.prev()}
              type="button"
              aria-label="Previous track"
              {...tooltipProps('Previous', 'top')}
            >
              <SkipBack className="h-5 w-5" aria-hidden />
            </button>
            <motion.button
              className="player-play-btn"
              onClick={() => player.toggle()}
              type="button"
              aria-label={player.isPlaying ? 'Pause' : 'Play'}
              {...tooltipProps(player.isPlaying ? 'Pause' : 'Play', 'top')}
              {...tapScale}
            >
              {player.isPlaying ? (
                <Pause className="h-5 w-5" fill="currentColor" aria-hidden />
              ) : (
                <Play className="h-5 w-5 translate-x-0.5" fill="currentColor" aria-hidden />
              )}
            </motion.button>
            <button
              className="player-icon-btn"
              onClick={() => void player.next()}
              type="button"
              aria-label="Next track"
              {...tooltipProps('Next', 'top')}
            >
              <SkipForward className="h-5 w-5" aria-hidden />
            </button>
          </div>
        </div>
      </div>
    </motion.footer>
  );
}
