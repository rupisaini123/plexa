import { AnimatePresence, motion } from 'motion/react';
import type { QueueItem } from '../lib/api';
import { fadeUp } from '../lib/motion';
import { AddToPlaylistButton } from './AddToPlaylistButton';
import { Artwork } from './Artwork';
import { MarqueeText } from './MarqueeText';
import { QueueProgressBar } from './QueueProgressBar';

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.floor(seconds);
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export interface QueueNowPlayingProps {
  track: QueueItem;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
}

export function QueueNowPlaying({
  track,
  isPlaying,
  currentTime,
  duration,
}: QueueNowPlayingProps) {
  const resolvedDuration = duration > 0
    ? duration
    : track.durationMs
      ? track.durationMs / 1000
      : 0;
  const progress = resolvedDuration > 0
    ? Math.min(currentTime / resolvedDuration, 1)
    : 0;
  const meta = [track.artist, track.album].filter(Boolean).join(' · ');

  return (
    <section aria-label="Now playing" className="mb-4">
      <h3 className="mb-2 text-xs font-medium uppercase tracking-[0.16em] text-muted">
        Now playing
      </h3>
      <AnimatePresence mode="wait">
        <motion.article
          key={track.ratingKey}
          className="queue-now-playing relative overflow-hidden rounded-2xl border border-accent/20 bg-surface-muted/40 p-3 sm:p-4"
          variants={fadeUp}
          initial="initial"
          animate="animate"
          exit="exit"
        >
          <div className="flex items-center gap-3 sm:gap-4">
            <motion.div
              animate={isPlaying ? { opacity: [1, 0.82, 1] } : { opacity: 1 }}
              transition={isPlaying ? { duration: 2, repeat: Infinity, ease: 'easeInOut' } : undefined}
            >
              <Artwork
                src={track.artUrl}
                alt=""
                className="h-16 w-16 shrink-0 sm:h-20 sm:w-20"
                rounded="lg"
              />
            </motion.div>
            <div className="min-w-0 flex-1 overflow-hidden">
              <MarqueeText text={track.title} className="text-base font-semibold text-accent sm:text-lg" />
              {meta ? (
                <p className="truncate text-sm text-muted">{meta}</p>
              ) : null}
              <div className="mt-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs tabular-nums text-muted">
                  <span>{formatTime(currentTime)}</span>
                  <span aria-hidden>·</span>
                  <span>{formatTime(resolvedDuration)}</span>
                </div>
                <AddToPlaylistButton track={track} className="h-8 w-8" />
              </div>
            </div>
          </div>
          <QueueProgressBar progress={progress} className="mt-3" />
        </motion.article>
      </AnimatePresence>
    </section>
  );
}
