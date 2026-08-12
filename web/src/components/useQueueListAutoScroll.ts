import { useEffect } from 'react';

export function useQueueListAutoScroll(
  open: boolean,
  currentIndex: number,
  queueLength: number,
) {
  useEffect(() => {
    if (!open || queueLength === 0) return;
    const frame = window.requestAnimationFrame(() => {
      const row = document.querySelector(`[data-queue-index="${currentIndex}"]`);
      row?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [open, currentIndex, queueLength]);
}
