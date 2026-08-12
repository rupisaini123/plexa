import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PlayerProvider, usePlayer } from '../context/PlayerContext';

const defaultApiHandler = async (path: string, options?: RequestInit) => {
  if (path === '/api/player/queue' && options?.method === 'POST') {
    const body = JSON.parse(String(options.body ?? '{}')) as {
      tracks?: Array<{ ratingKey: string; title: string; streamUrl?: string; durationMs?: number; artUrl?: string }>;
    };
    const tracks = body.tracks ?? [];
    return {
      queue: {
        items: tracks,
        currentIndex: 0,
        shuffle: false,
        loop: false,
      },
      current: tracks[0] ?? null,
    };
  }
  if (path === '/api/player/next') {
    return {
      queue: {
        items: [
          { ratingKey: '1', title: 'One', streamUrl: 'https://example.com/1' },
          { ratingKey: '2', title: 'Two', streamUrl: 'https://example.com/2' },
        ],
        currentIndex: 1,
        shuffle: false,
        loop: false,
      },
      current: { ratingKey: '2', title: 'Two', streamUrl: 'https://example.com/2' },
    };
  }
  if (path === '/api/player/queue/remove' && options?.method === 'POST') {
    return {
      queue: {
        items: [{ ratingKey: '2', title: 'Two', streamUrl: 'https://example.com/2' }],
        currentIndex: 0,
        shuffle: false,
        loop: false,
      },
      current: { ratingKey: '2', title: 'Two', streamUrl: 'https://example.com/2' },
    };
  }
  if (path === '/api/player/queue/clear' && options?.method === 'POST') {
    return { queue: null, current: null };
  }
  if (path === '/api/player/queue/loop' && options?.method === 'POST') {
    return {
      queue: {
        items: [{ ratingKey: '1', title: 'One', streamUrl: 'https://example.com/1' }],
        currentIndex: 0,
        shuffle: false,
        loop: true,
      },
      current: { ratingKey: '1', title: 'One', streamUrl: 'https://example.com/1' },
    };
  }
  if (path === '/api/player/queue/reorder' && options?.method === 'POST') {
    const body = JSON.parse(String(options.body ?? '{}')) as { fromIndex?: number; toIndex?: number };
    const items = [
      { ratingKey: '1', title: 'One', streamUrl: 'https://example.com/1' },
      { ratingKey: '2', title: 'Two', streamUrl: 'https://example.com/2' },
      { ratingKey: '3', title: 'Three', streamUrl: 'https://example.com/3' },
    ];
    if (body.fromIndex === 1 && body.toIndex === 2) {
      return {
        queue: {
          items: [items[0], items[2], items[1]],
          currentIndex: 0,
          shuffle: false,
          loop: false,
        },
        current: items[0],
      };
    }
    throw new Error('Reorder failed');
  }
  return { queue: null, current: null };
};

const apiMock = vi.fn(defaultApiHandler);

vi.mock('../lib/api', () => ({
  api: (...args: Parameters<typeof apiMock>) => apiMock(...args),
  fetchCsrf: vi.fn().mockResolvedValue('csrf'),
}));

type Listener = EventListenerOrEventListenerObject;

class FakeAudio {
  src = '';
  paused = true;
  currentTime = 0;
  duration = 180;
  error: MediaError | null = null;
  loadCallCount = 0;
  private listeners = new Map<string, Set<Listener>>();

  addEventListener(type: string, listener: Listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(listener);
  }

  removeEventListener(type: string, listener: Listener) {
    this.listeners.get(type)?.delete(listener);
  }

  dispatch(type: string) {
    const event = new Event(type);
    for (const listener of this.listeners.get(type) ?? []) {
      if (typeof listener === 'function') listener(event);
      else listener.handleEvent(event);
    }
  }

  play() {
    this.paused = false;
    return Promise.resolve();
  }

  pause() {
    this.paused = true;
  }

  removeAttribute(name: string) {
    if (name === 'src') this.src = '';
  }

  load() {
    this.loadCallCount += 1;
  }
}

let fakeAudio: FakeAudio;
vi.stubGlobal('Audio', class {
  constructor() {
    fakeAudio = new FakeAudio();
    return fakeAudio;
  }
});

function Probe() {
  const player = usePlayer();
  return (
    <div>
      <p data-testid="current">{player.current?.title ?? 'none'}</p>
      <p data-testid="queue-order">{player.queue.map((track) => track.title).join(',')}</p>
      <p data-testid="time">{Math.floor(player.currentTime)}</p>
      <p data-testid="duration">{Math.floor(player.duration)}</p>
      <p data-testid="loop">{player.loop ? 'on' : 'off'}</p>
      <p data-testid="playing">{player.isPlaying ? 'yes' : 'no'}</p>
      <button type="button" onClick={() => player.playTracks([
        { ratingKey: '1', title: 'One', streamUrl: 'https://example.com/1' },
        { ratingKey: '2', title: 'Two', streamUrl: 'https://example.com/2' },
        { ratingKey: '3', title: 'Three', streamUrl: 'https://example.com/3' },
      ])}>
        Play
      </button>
      <button type="button" onClick={() => player.toggle()}>Toggle</button>
      <button type="button" onClick={() => player.next()}>Next</button>
      <button type="button" onClick={() => player.seek(42)}>Seek</button>
      <button type="button" onClick={() => player.removeFromQueue(0)}>Remove first</button>
      <button type="button" onClick={() => player.clearQueue()}>Clear</button>
      <button type="button" onClick={() => player.setLoop(true)}>Loop on</button>
      <button type="button" onClick={() => void player.reorderQueue(1, 2)}>Reorder</button>
    </div>
  );
}

describe('PlayerContext', () => {
  beforeEach(() => {
    fakeAudio = undefined as unknown as FakeAudio;
    apiMock.mockReset();
    apiMock.mockImplementation(defaultApiHandler);
  });

  it('uses server-returned queue indices', async () => {
    const user = userEvent.setup();
    render(
      <PlayerProvider>
        <Probe />
      </PlayerProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'Play' }));
    expect(await screen.findByTestId('current')).toHaveTextContent('One');

    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(await screen.findByTestId('current')).toHaveTextContent('Two');
  });

  it('tracks currentTime and duration from audio events and supports seek', async () => {
    const user = userEvent.setup();
    render(
      <PlayerProvider>
        <Probe />
      </PlayerProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'Play' }));
    expect(await screen.findByTestId('current')).toHaveTextContent('One');

    await act(async () => {
      fakeAudio.duration = 180;
      fakeAudio.dispatch('loadedmetadata');
    });
    expect(screen.getByTestId('duration')).toHaveTextContent('180');

    await act(async () => {
      fakeAudio.currentTime = 25;
      fakeAudio.dispatch('timeupdate');
    });
    expect(screen.getByTestId('time')).toHaveTextContent('25');

    await user.click(screen.getByRole('button', { name: 'Seek' }));
    expect(fakeAudio.currentTime).toBe(42);
    expect(screen.getByTestId('time')).toHaveTextContent('42');
  });

  it('syncs queue mutations from the server', async () => {
    const user = userEvent.setup();
    render(
      <PlayerProvider>
        <Probe />
      </PlayerProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'Play' }));
    expect(await screen.findByTestId('current')).toHaveTextContent('One');

    await user.click(screen.getByRole('button', { name: 'Remove first' }));
    expect(await screen.findByTestId('current')).toHaveTextContent('Two');

    await user.click(screen.getByRole('button', { name: 'Loop on' }));
    expect(screen.getByTestId('loop')).toHaveTextContent('on');

    await user.click(screen.getByRole('button', { name: 'Clear' }));
    expect(await screen.findByTestId('current')).toHaveTextContent('none');
  });

  it('optimistically reorders the queue before the API resolves', async () => {
    const user = userEvent.setup();
    apiMock.mockImplementationOnce(async (path: string, options?: RequestInit) => {
      if (path === '/api/player/queue' && options?.method === 'POST') {
        return {
          queue: {
            items: [
              { ratingKey: '1', title: 'One', streamUrl: 'https://example.com/1' },
              { ratingKey: '2', title: 'Two', streamUrl: 'https://example.com/2' },
              { ratingKey: '3', title: 'Three', streamUrl: 'https://example.com/3' },
            ],
            currentIndex: 0,
            shuffle: false,
            loop: false,
          },
          current: { ratingKey: '1', title: 'One', streamUrl: 'https://example.com/1' },
        };
      }
      return { queue: null, current: null };
    });

    render(
      <PlayerProvider>
        <Probe />
      </PlayerProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'Play' }));
    expect(await screen.findByTestId('queue-order')).toHaveTextContent('One,Two,Three');

    await user.click(screen.getByRole('button', { name: 'Reorder' }));
    expect(await screen.findByTestId('queue-order')).toHaveTextContent('One,Three,Two');
  });

  it('rolls back queue order when reorder API fails', async () => {
    const user = userEvent.setup();
    apiMock.mockImplementation(async (path: string, options?: RequestInit) => {
      if (path === '/api/player/queue' && options?.method === 'POST') {
        return {
          queue: {
            items: [
              { ratingKey: '1', title: 'One', streamUrl: 'https://example.com/1' },
              { ratingKey: '2', title: 'Two', streamUrl: 'https://example.com/2' },
              { ratingKey: '3', title: 'Three', streamUrl: 'https://example.com/3' },
            ],
            currentIndex: 0,
            shuffle: false,
            loop: false,
          },
          current: { ratingKey: '1', title: 'One', streamUrl: 'https://example.com/1' },
        };
      }
      if (path === '/api/player/queue/reorder' && options?.method === 'POST') {
        throw new Error('Reorder failed');
      }
      return { queue: null, current: null };
    });

    render(
      <PlayerProvider>
        <Probe />
      </PlayerProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'Play' }));
    expect(await screen.findByTestId('queue-order')).toHaveTextContent('One,Two,Three');

    await user.click(screen.getByRole('button', { name: 'Reorder' }));
    expect(await screen.findByTestId('queue-order')).toHaveTextContent('One,Two,Three');
  });

  it('retries stream load after audio error with backoff', async () => {
    vi.useFakeTimers();
    apiMock.mockImplementationOnce(async (path: string, options?: RequestInit) => {
      if (path === '/api/player/queue' && options?.method === 'POST') {
        return {
          queue: {
            items: [
              { ratingKey: '1', title: 'One', streamUrl: 'https://example.com/1' },
            ],
            currentIndex: 0,
            shuffle: false,
            loop: false,
          },
          current: { ratingKey: '1', title: 'One', streamUrl: 'https://example.com/1' },
        };
      }
      return { queue: null, current: null };
    });

    render(
      <PlayerProvider>
        <Probe />
      </PlayerProvider>,
    );

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    });
    expect(screen.getByTestId('playing')).toHaveTextContent('yes');
    const initialLoadCount = fakeAudio.loadCallCount;

    await act(async () => {
      fakeAudio.dispatch('error');
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(fakeAudio.loadCallCount).toBeGreaterThan(initialLoadCount);
    expect(fakeAudio.src).toBe('https://example.com/1');
    vi.useRealTimers();
  });

  it('reloads stream when toggling play after an error', async () => {
    apiMock.mockImplementationOnce(async (path: string, options?: RequestInit) => {
      if (path === '/api/player/queue' && options?.method === 'POST') {
        return {
          queue: {
            items: [
              { ratingKey: '1', title: 'One', streamUrl: 'https://example.com/1' },
            ],
            currentIndex: 0,
            shuffle: false,
            loop: false,
          },
          current: { ratingKey: '1', title: 'One', streamUrl: 'https://example.com/1' },
        };
      }
      return { queue: null, current: null };
    });

    render(
      <PlayerProvider>
        <Probe />
      </PlayerProvider>,
    );

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    });
    expect(screen.getByTestId('playing')).toHaveTextContent('yes');

    fakeAudio.error = { code: 4 } as MediaError;
    const loadBeforeToggle = fakeAudio.loadCallCount;

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Toggle' }));
    });
    expect(screen.getByTestId('playing')).toHaveTextContent('no');

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Toggle' }));
    });

    expect(screen.getByTestId('playing')).toHaveTextContent('yes');
    expect(fakeAudio.loadCallCount).toBeGreaterThan(loadBeforeToggle);
    expect(fakeAudio.src).toBe('https://example.com/1');
  });
});
