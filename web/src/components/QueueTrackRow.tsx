import { Reorder } from 'motion/react';
import { GripVertical, Trash2 } from 'lucide-react';
import type { DragReorderProps } from '../hooks/useDragReorder';
import { useReorderHandle } from '../hooks/useReorderHandle';
import { reorderListItem } from '../lib/motion';
import { tooltipProps } from '../lib/tooltip';
import { AddToPlaylistButton } from './AddToPlaylistButton';
import { Artwork } from './Artwork';
import { MarqueeText } from './MarqueeText';
import type { QueueUpNextItem } from './QueueTracksList';

export interface QueueTrackRowProps {
  item: QueueUpNextItem;
  dragProps: DragReorderProps;
  onJumpTo: () => void;
  onRemove: () => void;
}

export function QueueTrackRow({
  item,
  dragProps,
  onJumpTo,
  onRemove,
}: QueueTrackRowProps) {
  const { track, queueIndex } = item;
  const { controls, handleProps } = useReorderHandle();

  return (
    <Reorder.Item
      as="div"
      value={track.ratingKey}
      dragListener={false}
      dragControls={controls}
      layout
      role="listitem"
      className="queue-track-row group relative grid min-w-0 items-center gap-2 rounded-xl bg-surface-muted/40 px-2 py-2.5 hover:bg-surface-muted/70 sm:gap-3 sm:px-3"
      data-queue-index={queueIndex}
      data-reorder-value={track.ratingKey}
      {...reorderListItem}
      whileDrag={{ zIndex: 10 }}
      onDragStart={() => {
        dragProps.onDragStart();
      }}
      onDrag={(event) => {
        if ('clientY' in event && typeof event.clientY === 'number') {
          dragProps.onPointerDrag(event.clientY, track.ratingKey);
        }
      }}
      onDragEnd={() => {
        dragProps.onDragEnd();
      }}
    >
      <button
        type="button"
        className="inline-flex h-9 w-6 shrink-0 touch-none cursor-grab items-center justify-center rounded-md text-muted hover:bg-white/10 hover:text-foreground active:cursor-grabbing"
        aria-label="Drag to reorder"
        {...tooltipProps('Drag to reorder')}
        {...handleProps}
      >
        <GripVertical className="h-4 w-4" aria-hidden />
      </button>

      <button
        type="button"
        className="flex min-w-0 items-center gap-2 text-left sm:gap-3"
        aria-label={`Play ${track.title}`}
        onClick={onJumpTo}
        onDoubleClick={onJumpTo}
      >
        <Artwork
          src={track.artUrl}
          alt=""
          className="h-10 w-10 shrink-0 sm:h-11 sm:w-11"
          rounded="lg"
        />
        <div className="min-w-0 overflow-hidden">
          <MarqueeText text={track.title} className="font-medium leading-snug" />
          {track.artist ? (
            <p className="truncate text-sm text-muted">{track.artist}</p>
          ) : null}
        </div>
      </button>

      <div className="flex shrink-0 items-center justify-end gap-1">
        <AddToPlaylistButton track={track} className="h-9 w-9" />
        <button
          className="player-icon-btn h-9 w-9 hover:text-danger"
          type="button"
          aria-label={`Remove ${track.title}`}
          {...tooltipProps('Remove')}
          onClick={onRemove}
        >
          <Trash2 className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </Reorder.Item>
  );
}
