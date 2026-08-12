import { Reorder, motion } from 'motion/react';
import { GripVertical, Play, Trash2 } from 'lucide-react';
import type { TrackItem } from '../lib/api';
import type { DragReorderProps } from '../hooks/useDragReorder';
import { reorderListItem, tapScale } from '../lib/motion';
import { tooltipProps } from '../lib/tooltip';
import { useReorderHandle } from '../hooks/useReorderHandle';
import { useCompactActions } from '../hooks/useCompactActions';
import { AddToPlaylistButton } from './AddToPlaylistButton';
import { Artwork } from './Artwork';
import { MarqueeText } from './MarqueeText';
import { PlaylistTrackRowMenu } from './PlaylistTrackRowMenu';

function formatDuration(ms?: number): string | null {
  if (!ms || !Number.isFinite(ms) || ms <= 0) return null;
  const total = Math.floor(ms / 1000);
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export interface PlaylistTrackRowProps {
  track: TrackItem;
  index: number;
  sortable: boolean;
  isPlaying?: boolean;
  dragProps: DragReorderProps;
  onPlay: () => void;
  onRemove: () => void;
}

export function PlaylistTrackRow({
  track,
  index,
  sortable,
  isPlaying = false,
  dragProps,
  onPlay,
  onRemove,
}: PlaylistTrackRowProps) {
  const compact = useCompactActions();
  const { controls, handleProps } = useReorderHandle(!sortable);
  const duration = formatDuration(track.durationMs);
  const value = track.playlistItemId ?? track.ratingKey;

  const rowClassName = `group relative grid min-w-0 items-center gap-2 rounded-xl px-2 py-2.5 hover:bg-surface-muted/70 sm:gap-3 sm:px-3 playlist-track-row-grid${
    isPlaying ? ' playlist-track-row-playing' : ' bg-surface-muted/40'
  }`;

  return (
    <Reorder.Item
      as="div"
      value={value}
      dragListener={false}
      dragControls={controls}
      layout
      className={rowClassName}
      role="listitem"
      data-reorder-value={value}
      aria-current={isPlaying ? 'true' : undefined}
      {...reorderListItem}
      whileDrag={{ zIndex: 10 }}
      onDragStart={() => {
        dragProps.onDragStart();
      }}
      onDrag={(event) => {
        if ('clientY' in event && typeof event.clientY === 'number') {
          dragProps.onPointerDrag(event.clientY, value);
        }
      }}
      onDragEnd={() => {
        dragProps.onDragEnd();
      }}
    >
      <button
        type="button"
        className="inline-flex h-9 w-6 shrink-0 touch-none cursor-grab items-center justify-center rounded-md text-muted hover:bg-white/10 hover:text-foreground active:cursor-grabbing disabled:cursor-default disabled:opacity-40"
        aria-label="Drag to reorder"
        {...tooltipProps('Drag to reorder')}
        disabled={!sortable}
        {...(sortable ? handleProps : {})}
      >
        <GripVertical className="h-4 w-4" aria-hidden />
      </button>

      <span
        className={`w-6 shrink-0 text-center text-sm tabular-nums ${
          isPlaying ? 'font-semibold text-accent' : 'text-muted'
        }`}
        aria-hidden
      >
        {index}
      </span>

      <Artwork
        src={track.artUrl}
        alt=""
        className="h-10 w-10 shrink-0 sm:h-11 sm:w-11"
        rounded="lg"
      />

      <div className="min-w-0 overflow-hidden">
        <MarqueeText
          text={track.title}
          className={`font-medium leading-snug${isPlaying ? ' text-accent' : ''}`}
        />
        {track.artist ? (
          <p className="truncate text-sm text-muted">{track.artist}</p>
        ) : null}
      </div>

      <p className="playlist-tracks-header-album truncate text-sm text-muted">
        {track.album ?? ''}
      </p>

      {duration && !compact ? (
        <span className="playlist-tracks-header-duration shrink-0 text-xs tabular-nums text-muted">
          {duration}
        </span>
      ) : !compact ? (
        <span className="playlist-tracks-header-duration" aria-hidden />
      ) : null}

      <div
        data-testid="playlist-track-actions"
        className="flex shrink-0 items-center justify-end gap-1.5 sm:gap-2"
      >
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

        {compact ? (
          <PlaylistTrackRowMenu track={track} onRemove={onRemove} />
        ) : (
          <>
            <AddToPlaylistButton track={track} className="h-9 w-9 sm:h-10 sm:w-10" />
            {track.playlistItemId && (
              <button
                className="player-icon-btn h-9 w-9 sm:h-10 sm:w-10 hover:text-danger"
                type="button"
                aria-label={`Remove ${track.title}`}
                {...tooltipProps('Remove')}
                onClick={onRemove}
              >
                <Trash2 className="h-4 w-4" aria-hidden />
              </button>
            )}
          </>
        )}
      </div>
    </Reorder.Item>
  );
}
