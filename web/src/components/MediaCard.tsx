import { motion } from 'motion/react';
import { Disc3, Mic2, Play } from 'lucide-react';
import type { TrackItem } from '../lib/api';
import { tapScale } from '../lib/motion';
import { tooltipProps } from '../lib/tooltip';
import { Artwork } from './Artwork';
import { MarqueeText } from './MarqueeText';

export type MediaCardKind = 'artist' | 'album';
export type MediaCardDensity = 'comfortable' | 'compact';

interface MediaCardProps {
  item: TrackItem;
  kind: MediaCardKind;
  density?: MediaCardDensity;
  selected?: boolean;
  onOpen: () => void;
  onPlay?: () => void;
}

export function MediaCard({
  item,
  kind,
  density = 'comfortable',
  selected = false,
  onOpen,
  onPlay,
}: MediaCardProps) {
  const subtitle = kind === 'album'
    ? [item.artist, item.year].filter(Boolean).join(' · ') || 'Album'
    : 'Artist';

  if (density === 'compact') {
    return (
      <motion.div
        className={`media-card media-card-compact group ${selected ? 'media-card-selected' : ''}`}
        whileHover={{ scale: 1.01 }}
        transition={tapScale.transition}
      >
        <button type="button" className="media-card-main" onClick={onOpen}>
          <Artwork
            src={item.artUrl}
            alt=""
            className="h-12 w-12 shrink-0 sm:h-14 sm:w-14"
            rounded={kind === 'artist' ? 'full' : 'xl'}
            icon={
              kind === 'artist'
                ? <Mic2 className="h-5 w-5" aria-hidden />
                : <Disc3 className="h-5 w-5" aria-hidden />
            }
          />
          <div className="min-w-0 flex-1 overflow-hidden text-left">
            <MarqueeText text={item.title} className="font-semibold" />
            <p className="truncate text-sm text-muted">{subtitle}</p>
          </div>
        </button>
        {onPlay && (
          <motion.button
            type="button"
            className="media-card-play shrink-0"
            aria-label={`Play ${item.title}`}
            {...tooltipProps('Play')}
            onClick={(e) => {
              e.stopPropagation();
              onPlay();
            }}
            {...tapScale}
          >
            <Play className="h-4 w-4 translate-x-px" fill="currentColor" aria-hidden />
          </motion.button>
        )}
      </motion.div>
    );
  }

  return (
    <motion.div
      className={`media-card media-card-comfortable group ${selected ? 'media-card-selected' : ''}`}
      whileHover={{ y: -2 }}
      transition={tapScale.transition}
    >
      <div className="relative">
        <button type="button" className="media-card-cover" onClick={onOpen}>
          <Artwork
            src={item.artUrl}
            alt=""
            className="aspect-square w-full"
            rounded={kind === 'artist' ? 'full' : 'xl'}
            icon={
              kind === 'artist'
                ? <Mic2 className="h-6 w-6" aria-hidden />
                : <Disc3 className="h-6 w-6" aria-hidden />
            }
          />
        </button>
        {onPlay && (
          <div className="media-card-play-overlay">
            <motion.button
              type="button"
              className="media-card-play"
              aria-label={`Play ${item.title}`}
              {...tooltipProps('Play')}
              onClick={(e) => {
                e.stopPropagation();
                onPlay();
              }}
              {...tapScale}
            >
              <Play className="h-4 w-4 translate-x-px" fill="currentColor" aria-hidden />
            </motion.button>
          </div>
        )}
      </div>
      <button type="button" className="mt-2 w-full overflow-hidden text-left" onClick={onOpen}>
        <MarqueeText text={item.title} className="text-sm font-semibold" />
        <p className="truncate text-xs text-muted">{subtitle}</p>
      </button>
    </motion.div>
  );
}
