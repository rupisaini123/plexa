import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { PlaybackQueue, QueueItem } from '../lib/api';
import { api, fetchCsrf } from '../lib/api';
import { reorderArray } from '../lib/reorderPlaylistTracks';

interface PlayerState {
  queue: QueueItem[];
  currentIndex: number;
  current: QueueItem | null;
  shuffle: boolean;
  loop: boolean;
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
  removeFromQueue: (index: number) => Promise<void>;
  reorderQueue: (fromIndex: number, toIndex: number) => Promise<void>;
  clearQueue: () => Promise<void>;
  setShuffle: (enabled: boolean) => Promise<void>;
  setLoop: (enabled: boolean) => Promise<void>;
}

const PlayerContext = createContext<PlayerState | null>(null);

type QueueResponse = { queue: PlaybackQueue | null; current: QueueItem | null };

const STREAM_RETRY_MAX = 3;
const STREAM_RETRY_BASE_MS = 1000;

function attachStream(audio: HTMLAudioElement, url: string) {
  audio.pause();
  audio.removeAttribute('src');
  audio.load();
  audio.src = url;
}

function syncFromResponse(
  res: QueueResponse,
  setQueue: (items: QueueItem[]) => void,
  setCurrentIndex: (index: number) => void,
  setShuffle: (shuffle: boolean) => void,
  setLoop: (loop: boolean) => void,
) {
  if (res.queue) {
    setQueue(res.queue.items);
    setCurrentIndex(res.queue.currentIndex);
    setShuffle(res.queue.shuffle);
    setLoop(res.queue.loop ?? false);
    return;
  }
  setQueue([]);
  setCurrentIndex(0);
  setShuffle(false);
  setLoop(false);
}

export function PlayerProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [shuffle, setShuffleState] = useState(false);
  const [loop, setLoopState] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showQueue, setShowQueue] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [streamLoadKey, setStreamLoadKey] = useState(0);

  const current = queue[currentIndex] ?? null;

  const currentRef = useRef(current);
  currentRef.current = current;
  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;
  const streamRetryCountRef = useRef(0);
  const streamRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const bumpStreamLoad = useCallback(() => {
    setStreamLoadKey((k) => k + 1);
  }, []);

  const syncQueue = useCallback((res: QueueResponse) => {
    syncFromResponse(res, setQueue, setCurrentIndex, setShuffleState, setLoopState);
  }, []);

  const next = useCallback(async () => {
    await fetchCsrf();
    const res = await api<QueueResponse>(
      '/api/player/next',
      { method: 'POST', body: '{}' },
    );
    syncQueue(res);
    if (res.current) setIsPlaying(true);
  }, [syncQueue]);

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
      streamRetryCountRef.current = 0;
      const nextDuration = Number.isFinite(audio.duration) ? audio.duration : 0;
      setDuration(nextDuration);
    };
    const onError = () => {
      const streamUrl = currentRef.current?.streamUrl;
      if (!streamUrl || !isPlayingRef.current) return;
      if (streamRetryCountRef.current >= STREAM_RETRY_MAX) {
        setIsPlaying(false);
        return;
      }
      const delay = STREAM_RETRY_BASE_MS * 2 ** streamRetryCountRef.current;
      streamRetryCountRef.current += 1;
      if (streamRetryTimerRef.current) clearTimeout(streamRetryTimerRef.current);
      streamRetryTimerRef.current = setTimeout(() => {
        bumpStreamLoad();
      }, delay);
    };

    audio.addEventListener('ended', onEnded);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('durationchange', onDurationChange);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('error', onError);

    return () => {
      if (streamRetryTimerRef.current) clearTimeout(streamRetryTimerRef.current);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('durationchange', onDurationChange);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('error', onError);
    };
  }, [next, bumpStreamLoad]);

  useEffect(() => {
    streamRetryCountRef.current = 0;
  }, [current?.streamUrl, current?.ratingKey]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !current?.streamUrl) return;
    setCurrentTime(0);
    setDuration(current.durationMs ? current.durationMs / 1000 : 0);
    attachStream(audio, current.streamUrl);
    if (isPlayingRef.current) audio.play().catch(() => setIsPlaying(false));
  }, [current?.streamUrl, current?.ratingKey, streamLoadKey]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) audio.play().catch(() => setIsPlaying(false));
    else audio.pause();
  }, [isPlaying]);

  const toggle = useCallback(() => {
    if (isPlaying) {
      setIsPlaying(false);
      return;
    }
    const audio = audioRef.current;
    if (audio?.error) {
      streamRetryCountRef.current = 0;
      bumpStreamLoad();
    }
    setIsPlaying(true);
  }, [isPlaying, bumpStreamLoad]);

  useEffect(() => {
    api<QueueResponse>('/api/player/queue')
      .then((res) => {
        if (res.queue) syncQueue(res);
      })
      .catch(() => undefined);
  }, [syncQueue]);

  const playTracks = async (tracks: QueueItem[], shuffleEnabled = false) => {
    await fetchCsrf();
    const res = await api<QueueResponse>(
      '/api/player/queue',
      { method: 'POST', body: JSON.stringify({ tracks, shuffle: shuffleEnabled }) },
    );
    syncQueue(res);
    setIsPlaying(true);
  };

  const prev = async () => {
    await fetchCsrf();
    const res = await api<QueueResponse>(
      '/api/player/prev',
      { method: 'POST', body: '{}' },
    );
    syncQueue(res);
    setIsPlaying(true);
  };

  const jumpTo = async (index: number) => {
    await fetchCsrf();
    const res = await api<QueueResponse>(
      '/api/player/jump',
      { method: 'POST', body: JSON.stringify({ index }) },
    );
    syncQueue(res);
    setIsPlaying(true);
  };

  const removeFromQueue = async (index: number) => {
    await fetchCsrf();
    const res = await api<QueueResponse>(
      '/api/player/queue/remove',
      { method: 'POST', body: JSON.stringify({ index }) },
    );
    syncQueue(res);
    if (!res.current) {
      setIsPlaying(false);
      const audio = audioRef.current;
      if (audio) {
        audio.pause();
        audio.removeAttribute('src');
      }
    }
  };

  const reorderQueue = async (fromIndex: number, toIndex: number) => {
    const snapshot = queue;
    const snapshotIndex = currentIndex;
    setQueue(reorderArray(queue, fromIndex, toIndex));
    try {
      await fetchCsrf();
      const res = await api<QueueResponse>(
        '/api/player/queue/reorder',
        { method: 'POST', body: JSON.stringify({ fromIndex, toIndex }) },
      );
      syncQueue(res);
    } catch {
      setQueue(snapshot);
      setCurrentIndex(snapshotIndex);
    }
  };

  const clearQueue = async () => {
    await fetchCsrf();
    const res = await api<QueueResponse>(
      '/api/player/queue/clear',
      { method: 'POST', body: '{}' },
    );
    syncQueue(res);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.removeAttribute('src');
    }
  };

  const setShuffle = async (enabled: boolean) => {
    await fetchCsrf();
    const res = await api<QueueResponse>(
      '/api/player/queue/shuffle',
      { method: 'POST', body: JSON.stringify({ enabled }) },
    );
    syncQueue(res);
  };

  const setLoop = async (enabled: boolean) => {
    await fetchCsrf();
    const res = await api<QueueResponse>(
      '/api/player/queue/loop',
      { method: 'POST', body: JSON.stringify({ enabled }) },
    );
    syncQueue(res);
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
        shuffle,
        loop,
        isPlaying,
        currentTime,
        duration,
        showQueue,
        setShowQueue,
        playTracks,
        toggle,
        next,
        prev,
        jumpTo,
        seek,
        removeFromQueue,
        reorderQueue,
        clearQueue,
        setShuffle,
        setLoop,
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
