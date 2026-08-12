import type { FormEvent, ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { modalPanel, springSoft } from '../../lib/motion';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  busy?: boolean;
  labelledBy?: string;
  align?: 'center' | 'bottom';
  zIndexClass?: string;
  panelClassName?: string;
  panelAs?: 'div' | 'form';
  onSubmit?: (event: FormEvent) => void;
  onExitComplete?: () => void;
  children: ReactNode;
}

export function Modal({
  open,
  onClose,
  busy = false,
  labelledBy,
  align = 'center',
  zIndexClass = 'z-50',
  panelClassName = '',
  panelAs = 'div',
  onSubmit,
  onExitComplete,
  children,
}: ModalProps) {
  const alignClass = align === 'bottom'
    ? 'items-end justify-center'
    : 'items-end justify-center md:items-center';

  const Panel = panelAs === 'form' ? motion.form : motion.div;

  return (
    <AnimatePresence onExitComplete={onExitComplete}>
      {open ? (
        <motion.div
          className={`fixed inset-0 ${zIndexClass}`}
          role="dialog"
          aria-modal="true"
          aria-labelledby={labelledBy}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={springSoft}
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            aria-label="Close dialog"
            onClick={() => {
              if (!busy) onClose();
            }}
          />
          <div className={`pointer-events-none fixed inset-0 flex p-4 ${alignClass}`}>
            <Panel
              className={`pointer-events-auto ${panelClassName}`.trim()}
              variants={modalPanel}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={springSoft}
              onClick={(event) => event.stopPropagation()}
              onSubmit={onSubmit}
            >
              {children}
            </Panel>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
