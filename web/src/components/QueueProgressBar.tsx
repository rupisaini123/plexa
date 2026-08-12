import { motion } from 'motion/react';
import { springSnappy } from '../lib/motion';

export interface QueueProgressBarProps {
  progress: number;
  className?: string;
}

export function QueueProgressBar({ progress, className = '' }: QueueProgressBarProps) {
  const clamped = Math.max(0, Math.min(progress, 1));

  return (
    <div
      className={`queue-progress-bar-track overflow-hidden ${className}`.trim()}
      aria-hidden
    >
      <motion.div
        className="queue-progress-bar-fill h-full origin-left bg-accent"
        initial={false}
        animate={{ scaleX: clamped }}
        transition={springSnappy}
      />
    </div>
  );
}
