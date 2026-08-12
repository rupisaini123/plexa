import { useEffect, useState, type ReactNode } from 'react';
import { Music2 } from 'lucide-react';

interface ArtworkProps {
  src?: string | null;
  alt?: string;
  className?: string;
  icon?: ReactNode;
  rounded?: 'lg' | 'xl' | 'full';
}

const roundedClass = {
  lg: 'rounded-lg',
  xl: 'rounded-xl',
  full: 'rounded-full',
} as const;

export function Artwork({
  src,
  alt = '',
  className = 'h-12 w-12',
  icon,
  rounded = 'lg',
}: ArtworkProps) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  const showImage = Boolean(src) && !failed;

  return (
    <div
      className={`relative shrink-0 overflow-hidden bg-surface-muted ${roundedClass[rounded]} ${className}`}
    >
      {showImage ? (
        <img
          src={src!}
          alt={alt}
          role={alt ? undefined : 'presentation'}
          className="h-full w-full object-cover"
          draggable={false}
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-muted">
          {icon ?? <Music2 className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden />}
        </div>
      )}
    </div>
  );
}
