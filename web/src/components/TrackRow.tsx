import type { ReactNode } from 'react';
import { motion } from 'motion/react';
import { Play } from 'lucide-react';
import type { TrackItem } from '../lib/api';
import { tapScale } from '../lib/motion';
import { tooltipProps } from '../lib/tooltip';
import { Artwork } from './Artwork';
import { MarqueeText } from './MarqueeText';

function formatDuration(ms?: number): string | null {
  if (!ms || !Number.isFinite(ms) || ms <= 0) return null;
  const total = Math.floor(ms / 1000);
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export interface TrackRowProps {
  track: TrackItem;
  subtitle?: string;
  onPlay?: () => void;
  onSelect?: () => void;
  actions?: ReactNode;
  showDuration?: boolean;
  index?: number;
  artworkRounded?: 'lg' | 'xl' | 'full';
}

export function TrackRow({
  track,
  subtitle,
  onPlay,
  onSelect,
  actions,
  showDuration = true,
  index,
  artworkRounded = 'lg',
}: TrackRowProps) {
  const joined = [track.artist, track.album].filter(Boolean).join(' · ');
  const meta = subtitle ?? (joined || undefined);
  const duration = showDuration ? formatDuration(track.durationMs) : null;

  const metaBlock = (
    <div className="min-w-0 flex-1 overflow-hidden">
      <MarqueeText text={track.title} className="font-medium leading-snug" />
      {meta ? <p className="truncate text-sm text-muted">{meta}</p> : null}
    </div>
  );

  return (
    <div className="group flex min-w-0 items-center gap-3 rounded-xl bg-surface-muted/40 px-3 py-2.5 transition hover:bg-surface-muted/70">
      {index !== undefined && (
        <span className="hidden w-6 shrink-0 text-center text-xs tabular-nums text-muted sm:block">
          {index}
        </span>
      )}

      <Artwork
        src={track.artUrl}
        alt=""
        className="h-11 w-11 sm:h-12 sm:w-12"
        rounded={artworkRounded}
      />

      {onSelect ? (
        <button type="button" className="min-w-0 flex-1 text-left" onClick={onSelect}>
          {metaBlock}
        </button>
      ) : (
        metaBlock
      )}

      {duration && (
        <span className="hidden shrink-0 text-xs tabular-nums text-muted sm:inline">
          {duration}
        </span>
      )}

      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
        {onPlay && (
          <motion.button
            className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-accent text-white shadow-md shadow-accent/25 hover:bg-accent-hover sm:h-10 sm:w-10"
            type="button"
            aria-label={`Play ${track.title}`}
            {...tooltipProps('Play')}
            onClick={onPlay}
            {...tapScale}
          >
            <Play className="h-4 w-4 translate-x-px" fill="currentColor" aria-hidden />
          </motion.button>
        )}
        {actions}
      </div>
    </div>
  );
}
