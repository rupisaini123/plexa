import { useCallback, useRef } from 'react';
import { AnimatePresence, Reorder, motion } from 'motion/react';
import type { QueueItem } from '../lib/api';
import { useDragReorder } from '../hooks/useDragReorder';
import { QueueTrackRow } from './QueueTrackRow';

export interface QueueUpNextItem {
  track: QueueItem;
  queueIndex: number;
}

export interface QueueTracksListProps {
  items: QueueUpNextItem[];
  className?: string;
  onJumpTo: (queueIndex: number) => void;
  onRemove: (queueIndex: number) => void | Promise<void>;
  onReorder: (fromIndex: number, toIndex: number) => void;
}

export function QueueTracksList({
  items,
  className = '',
  onJumpTo,
  onRemove,
  onReorder,
}: QueueTracksListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleCommit = useCallback((dragStart: QueueUpNextItem[], fromListIndex: number, toListIndex: number) => {
    const fromItem = dragStart[fromListIndex];
    const toItem = dragStart[toListIndex];
    if (!fromItem || !toItem) return;
    onReorder(fromItem.queueIndex, toItem.queueIndex);
  }, [onReorder]);

  const handleRemoveItem = useCallback((item: QueueUpNextItem) => {
    const fresh = items.find((entry) => entry.track.ratingKey === item.track.ratingKey);
    if (!fresh) return;
    return onRemove(fresh.queueIndex);
  }, [items, onRemove]);

  const {
    orderedItems,
    reorderValues,
    reorderByValues,
    removeItem,
    clearExiting,
    dragProps,
  } = useDragReorder(
    items,
    (item) => item.track.ratingKey,
    handleCommit,
    { onRemoveItem: handleRemoveItem, containerRef: scrollRef },
  );

  return (
    <section
      aria-label="Up next"
      className={`flex min-h-0 flex-1 flex-col${className ? ` ${className}` : ''}`}
    >
      <h3 className="mb-2 shrink-0 text-xs font-medium uppercase tracking-[0.16em] text-muted">
        Up next
      </h3>
      <motion.div
        ref={scrollRef}
        layoutScroll
        data-testid="queue-panel-scroll"
        className="queue-tracks-scroll -mx-1 min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-1"
      >
        <Reorder.Group
          axis="y"
          as="div"
          className="flex flex-col gap-1.5"
          values={reorderValues}
          onReorder={reorderByValues}
        >
          <AnimatePresence mode="popLayout" initial={false} onExitComplete={clearExiting}>
            {orderedItems.map((item) => (
              <QueueTrackRow
                key={`queue::${item.track.ratingKey}`}
                item={item}
                dragProps={dragProps}
                onJumpTo={() => onJumpTo(item.queueIndex)}
                onRemove={() => removeItem(item.track.ratingKey)}
              />
            ))}
          </AnimatePresence>
        </Reorder.Group>
      </motion.div>
    </section>
  );
}

export { useQueueListAutoScroll } from './useQueueListAutoScroll';
