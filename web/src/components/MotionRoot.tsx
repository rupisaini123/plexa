import type { ReactNode } from 'react';
import { MotionConfig } from 'motion/react';
import { useAppReducedMotion } from '../lib/motion';

export function MotionRoot({ children }: { children: ReactNode }) {
  const reducedMotion = useAppReducedMotion();

  return (
    <MotionConfig reducedMotion={reducedMotion ? 'always' : 'user'}>
      {children}
    </MotionConfig>
  );
}
