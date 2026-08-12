import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { PlaybackQueue, QueueItem } from '../lib/api';
import { api, fetchCsrf } from '../lib/api';

interface PlayerState {
  queue: QueueItem[];
  currentIndex: number;
  current: QueueItem | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  showQueue: boolean;
  setShowQueue: (show: boolean) => void;
  playTracks: (tracks: QueueItem[], shuffle?: boolean) => Promise<void>;
  toggle: () => void;
  next: () => Promise<void>;
  prev: () => Promise<void>;
  jumpTo: (index: number) => Promise<void>;
  seek: (time: number) => void;
}

const PlayerContext = createContext<PlayerState | null>(null);

function syncFromResponse(
  res: { queue?: PlaybackQueue; current: QueueItem | null },
  setQueue: (items: QueueItem[]) => void,
  setCurrentIndex: (index: number) => void,
) {
  if (res.queue) {
    setQueue(res.queue.items);
    setCurrentIndex(res.queue.currentIndex);
  }
}

export function PlayerProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showQueue, setShowQueue] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const current = queue[currentIndex] ?? null;

  const next = useCallback(async () => {
    await fetchCsrf();
    const res = await api<{ queue: PlaybackQueue; current: QueueItem | null }>(
      '/api/player/next',
      { method: 'POST', body: '{}' },
    );
    syncFromResponse(res, setQueue, setCurrentIndex);
    if (res.current) setIsPlaying(true);
  }, []);

  useEffect(() => {
    audioRef.current = new Audio();
    const audio = audioRef.current;

    const onEnded = () => {
      void next();
    };
    const onTimeUpdate = () => {
      setCurrentTime(audio.currentTime || 0);
    };
    const onDurationChange = () => {
      const nextDuration = Number.isFinite(audio.duration) ? audio.duration : 0;
      setDuration(nextDuration);
    };
    const onLoadedMetadata = () => {
      const nextDuration = Number.isFinite(audio.duration) ? audio.duration : 0;
      setDuration(nextDuration);
    };

    audio.addEventListener('ended', onEnded);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('durationchange', onDurationChange);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);

    return () => {
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('durationchange', onDurationChange);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
    };
  }, [next]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !current?.streamUrl) return;
    setCurrentTime(0);
    setDuration(current.durationMs ? current.durationMs / 1000 : 0);
    audio.src = current.streamUrl;
    if (isPlaying) audio.play().catch(() => setIsPlaying(false));
  }, [current?.streamUrl, current?.ratingKey]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) audio.play().catch(() => setIsPlaying(false));
    else audio.pause();
  }, [isPlaying]);

  useEffect(() => {
    api<{ queue: PlaybackQueue | null; current: QueueItem | null }>('/api/player/queue')
      .then((res) => {
        if (res.queue) {
          setQueue(res.queue.items);
          setCurrentIndex(res.queue.currentIndex);
        }
      })
      .catch(() => undefined);
  }, []);

  const playTracks = async (tracks: QueueItem[], shuffle = false) => {
    await fetchCsrf();
    const res = await api<{ queue: PlaybackQueue; current: QueueItem | null }>(
      '/api/player/queue',
      { method: 'POST', body: JSON.stringify({ tracks, shuffle }) },
    );
    syncFromResponse(res, setQueue, setCurrentIndex);
    setIsPlaying(true);
  };

  const prev = async () => {
    await fetchCsrf();
    const res = await api<{ queue: PlaybackQueue; current: QueueItem | null }>(
      '/api/player/prev',
      { method: 'POST', body: '{}' },
    );
    syncFromResponse(res, setQueue, setCurrentIndex);
    setIsPlaying(true);
  };

  const jumpTo = async (index: number) => {
    await fetchCsrf();
    const res = await api<{ queue: PlaybackQueue; current: QueueItem | null }>(
      '/api/player/jump',
      { method: 'POST', body: JSON.stringify({ index }) },
    );
    syncFromResponse(res, setQueue, setCurrentIndex);
    setIsPlaying(true);
  };

  const seek = useCallback((time: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    const max = Number.isFinite(audio.duration) && audio.duration > 0
      ? audio.duration
      : duration;
    const clamped = Math.max(0, Math.min(time, max || 0));
    audio.currentTime = clamped;
    setCurrentTime(clamped);
  }, [duration]);

  return (
    <PlayerContext.Provider
      value={{
        queue,
        currentIndex,
        current,
        isPlaying,
        currentTime,
        duration,
        showQueue,
        setShowQueue,
        playTracks,
        toggle: () => setIsPlaying((p) => !p),
        next,
        prev,
        jumpTo,
        seek,
      }}
    >
      {children}
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error('usePlayer must be used within PlayerProvider');
  return ctx;
}
