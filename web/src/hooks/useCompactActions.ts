import { useEffect, useState } from 'react';

const COMPACT_QUERY = '(max-width: 639px)';

export function useCompactActions(): boolean {
  const [compact, setCompact] = useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return false;
    }
    return window.matchMedia(COMPACT_QUERY).matches;
  });

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const media = window.matchMedia(COMPACT_QUERY);
    const update = () => setCompact(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  return compact;
}
