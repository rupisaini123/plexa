import type { ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { modalBackdrop, slideFromBottom, slideFromRight, springSoft } from '../../lib/motion';

interface SlidePanelProps {
  open: boolean;
  onClose: () => void;
  side?: 'right' | 'bottom';
  respectPlayerBar?: boolean;
  id?: string;
  labelledBy?: string;
  label?: string;
  zIndexClass?: string;
  panelClassName?: string;
  onExitComplete?: () => void;
  children: ReactNode;
}

export function SlidePanel({
  open,
  onClose,
  side = 'right',
  respectPlayerBar = false,
  id,
  labelledBy,
  label,
  zIndexClass = 'z-50',
  panelClassName = '',
  onExitComplete,
  children,
}: SlidePanelProps) {
  const panelVariants = side === 'right'
    ? slideFromRight
    : slideFromBottom;

  const sideClass = side === 'right'
    ? 'inset-y-0 right-0'
    : respectPlayerBar
      ? 'inset-x-0 bottom-[var(--player-bar-offset,0px)]'
      : 'inset-x-0 bottom-0';

  return (
    <AnimatePresence onExitComplete={onExitComplete}>
      {open ? (
        <>
          <motion.button
            type="button"
            className={`fixed inset-0 bg-black/40 ${zIndexClass}`}
            aria-label="Close panel"
            variants={modalBackdrop}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={springSoft}
            onClick={onClose}
          />
          <motion.aside
            id={id}
            role="dialog"
            aria-modal="true"
            aria-labelledby={labelledBy}
            aria-label={label}
            className={`fixed ${sideClass} ${zIndexClass} ${panelClassName}`.trim()}
            variants={panelVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={springSoft}
          >
            {children}
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  );
}
