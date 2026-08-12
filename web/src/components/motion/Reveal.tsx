import { useRef, type ReactNode } from 'react';
import { motion } from 'motion/react';
import {
  REVEAL_STAGGER_CAP,
  REVEAL_STAGGER_STEP,
  REVEAL_TRACK_STAGGER_STEP,
  revealItem,
  revealTrackItem,
  springSoft,
  springTrackReveal,
  staggerContainer,
  useAppReducedMotion,
} from '../../lib/motion';

interface RevealProps {
  children: ReactNode;
  delay?: number;
  className?: string;
  /** Skip scroll-reveal; show immediately (route crossfade already handles page enter). */
  immediate?: boolean;
}

export function Reveal({ children, delay = 0, className, immediate = false }: RevealProps) {
  const reduced = useAppReducedMotion();

  if (reduced || immediate) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      initial={revealItem.hidden}
      whileInView={revealItem.visible}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ ...springSoft, delay }}
    >
      {children}
    </motion.div>
  );
}

interface RevealStaggerProps {
  children: ReactNode;
  className?: string;
  immediate?: boolean;
  /** Stagger children on mount (not whileInView) — for grids after route enter. */
  staggerOnMount?: boolean;
}

export function RevealStagger({
  children,
  className,
  immediate = false,
  staggerOnMount = false,
}: RevealStaggerProps) {
  const reduced = useAppReducedMotion();

  if (reduced || immediate) {
    return <div className={className}>{children}</div>;
  }

  if (staggerOnMount) {
    return (
      <motion.div
        className={className}
        initial="hidden"
        animate="visible"
        variants={staggerContainer}
      >
        {children}
      </motion.div>
    );
  }

  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-40px' }}
      variants={staggerContainer}
    >
      {children}
    </motion.div>
  );
}

interface RevealStaggerGroupProps {
  children: ReactNode;
  /** Remounts the stagger boundary when tab, sort, or pagination batch changes. */
  revealKey: string;
  className?: string;
}

/** Mount-based parent/child stagger for library grids and pagination batches. */
export function RevealStaggerGroup({ children, revealKey, className }: RevealStaggerGroupProps) {
  const reduced = useAppReducedMotion();

  if (reduced) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      key={revealKey}
      className={className}
      initial="hidden"
      animate="visible"
      variants={staggerContainer}
    >
      {children}
    </motion.div>
  );
}

export function RevealItem({ children, className }: RevealProps) {
  const reduced = useAppReducedMotion();

  if (reduced) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      variants={revealItem}
      transition={springSoft}
    >
      {children}
    </motion.div>
  );
}

interface RevealListItemProps {
  children: ReactNode;
  shouldAnimate: boolean;
  itemKey: string;
  listKey: string;
  onRevealStart?: () => void;
  className?: string;
  /** Rank among currently rendered unseen rows in a virtualized list. */
  staggerPosition?: number;
  /** Legacy absolute-index stagger for non-virtual lists. */
  index?: number;
  batchStart?: number;
  /** Max stagger steps; default REVEAL_STAGGER_CAP. Pass undefined for no cap. */
  staggerCap?: number;
}

/** Per-row reveal for virtualized lists; parent tracks seen keys and visible-window order. */
export function RevealListItem({
  children,
  shouldAnimate,
  itemKey,
  listKey,
  onRevealStart,
  className,
  staggerPosition,
  index = 0,
  batchStart = 0,
  staggerCap = REVEAL_STAGGER_CAP,
}: RevealListItemProps) {
  const reduced = useAppReducedMotion();
  const onRevealStartRef = useRef(onRevealStart);
  onRevealStartRef.current = onRevealStart;

  if (reduced || !shouldAnimate) {
    return <div className={className}>{children}</div>;
  }

  const isVirtualWave = staggerPosition !== undefined;
  const resolvedStaggerPosition = isVirtualWave ? staggerPosition : 0;
  const delay = isVirtualWave
    ? resolvedStaggerPosition * REVEAL_TRACK_STAGGER_STEP
    : Math.min(Math.max(index - batchStart, 0), staggerCap) * REVEAL_STAGGER_STEP;
  const variants = isVirtualWave ? revealTrackItem : revealItem;
  const transition = isVirtualWave
    ? { ...springTrackReveal, delay }
    : { ...springSoft, delay };

  return (
    <motion.div
      key={`${listKey}:${itemKey}`}
      className={className}
      data-testid="reveal-list-item"
      data-stagger-position={isVirtualWave ? resolvedStaggerPosition : undefined}
      data-stagger-delay={delay}
      initial={variants.hidden}
      animate={variants.visible}
      transition={transition}
      onAnimationComplete={() => {
        onRevealStartRef.current?.();
      }}
    >
      {children}
    </motion.div>
  );
}

/** Maps unseen track keys to their top-to-bottom rank in the current viewport window. */
export function buildVisibleStaggerPositions<T extends { ratingKey: string }>(
  visibleIndices: number[],
  items: T[],
  seenKeys: ReadonlySet<string>,
): Map<string, number> {
  const positions = new Map<string, number>();
  let position = 0;

  for (const index of visibleIndices) {
    const item = items[index];
    if (!item || seenKeys.has(item.ratingKey)) continue;
    positions.set(item.ratingKey, position);
    position += 1;
  }

  return positions;
}

/** Builds contiguous viewport indices from a virtualizer range, clamped to item count. */
export function buildViewportIndices(
  startIndex: number,
  endIndex: number,
  itemCount: number,
): number[] {
  if (itemCount === 0) return [];

  const start = Math.max(0, startIndex);
  const end = Math.min(endIndex, itemCount - 1);
  const indices: number[] = [];

  for (let index = start; index <= end; index += 1) {
    indices.push(index);
  }

  return indices;
}

/** Tracks pagination batch starts; resets when datasetKey changes. */
export function useRevealBatches(
  itemCount: number,
  loading: boolean,
  datasetKey: string,
): number[] {
  const datasetKeyRef = useRef(datasetKey);
  const batchStartsRef = useRef<number[]>([0]);
  const prevLengthRef = useRef(0);

  if (datasetKeyRef.current !== datasetKey) {
    datasetKeyRef.current = datasetKey;
    batchStartsRef.current = [0];
    prevLengthRef.current = 0;
  }

  const prevLength = prevLengthRef.current;
  if (loading && itemCount === 0) {
    batchStartsRef.current = [0];
    prevLengthRef.current = 0;
  } else if (itemCount > prevLength && prevLength > 0 && !loading) {
    batchStartsRef.current = [...batchStartsRef.current, prevLength];
    prevLengthRef.current = itemCount;
  } else if (itemCount !== prevLength) {
    prevLengthRef.current = itemCount;
  }

  return batchStartsRef.current;
}
