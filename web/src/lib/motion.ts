import { stagger, useReducedMotion } from 'motion/react';

export const springSnappy = { type: 'spring', stiffness: 300, damping: 20 } as const;
export const springSoft = { type: 'spring', stiffness: 260, damping: 24 } as const;

export const tapScale = {
  whileHover: { scale: 1.05 },
  whileTap: { scale: 0.95 },
  transition: springSnappy,
};

export const fadeUp = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 8 },
};

export const modalBackdrop = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

export const modalPanel = {
  initial: { opacity: 0, scale: 0.96, y: 16 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.98, y: 8 },
};

export const slideFromRight = {
  initial: { x: '100%' },
  animate: { x: 0 },
  exit: { x: '100%' },
};

export const popoverMenu = {
  initial: { opacity: 0, scale: 0.95, y: -4 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.95, y: -4 },
};

/** New page fades in over the old page (old stays opaque underneath). */
export const pageOverlayTransition = {
  initial: { opacity: 0, zIndex: 1 },
  animate: { opacity: 1, zIndex: 1 },
  exit: { opacity: 1, zIndex: 0 },
};

export const pageTransitionEase = { duration: 0.15, ease: 'easeOut' as const };

export const slideFromBottom = {
  initial: { opacity: 0, y: '100%' },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: '100%' },
};

export const revealItem = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0 },
};

export const REVEAL_STAGGER_STEP = 0.04;
export const REVEAL_STAGGER_CAP = 11;
/** Slightly wider spacing for virtualized track rows so the wave reads clearly. */
export const REVEAL_TRACK_STAGGER_STEP = 0.06;

export const revealTrackItem = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0 },
};

export const springTrackReveal = { type: 'spring', stiffness: 280, damping: 26 } as const;

export const staggerContainer = {
  hidden: {},
  visible: {
    transition: {
      delayChildren: stagger(REVEAL_STAGGER_STEP),
    },
  },
};

export const reorderListItemEnter = {
  initial: { opacity: 0, y: -12 },
  animate: { opacity: 1, y: 0 },
};

export const reorderListItem = {
  animate: { opacity: 1 },
  exit: {
    opacity: 0,
    height: 0,
    marginBottom: 0,
    paddingTop: 0,
    paddingBottom: 0,
    overflow: 'hidden',
    transition: { duration: 0.2, ease: 'easeInOut' as const },
  },
  transition: springSoft,
};

export function useAppReducedMotion(): boolean {
  return useReducedMotion() ?? false;
}
