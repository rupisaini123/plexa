import type { PointerEvent } from 'react';
import { useDragControls } from 'motion/react';

export function useReorderHandle(disabled = false) {
  const controls = useDragControls();

  return {
    controls,
    handleProps: {
      onPointerDown: (event: PointerEvent) => {
        if (disabled) return;
        event.preventDefault();
        controls.start(event);
      },
    },
  };
}
