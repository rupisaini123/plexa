import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '../context/ThemeContext';
import { PlayerProvider, usePlayer } from '../context/PlayerContext';
import { PlaylistActionsProvider } from '../context/PlaylistActionsContext';
import { PlayerBar } from './PlayerBar';
import { Layout } from './Layout';
import { api } from '../lib/api';

vi.mock('../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../lib/api')>('../lib/api');
  return {
    ...actual,
    api: vi.fn(async () => ({ queue: null, current: null })),
    fetchCsrf: vi.fn().mockResolvedValue('csrf'),
    logout: vi.fn().mockResolvedValue(undefined),
  };
});

type Listener = EventListenerOrEventListenerObject;

class FakeAudio {
  src = '';
  paused = true;
  currentTime = 0;
  duration = 125;
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
}

let fakeAudio: FakeAudio;
vi.stubGlobal('Audio', class {
  constructor() {
    fakeAudio = new FakeAudio();
    return fakeAudio;
  }
});

function SeedPlayer({
  track,
}: {
  track: {
    ratingKey: string;
    title: string;
    artist?: string;
    durationMs?: number;
    artUrl?: string;
    streamUrl?: string;
  };
}) {
  const player = usePlayer();
  return (
    <button type="button" onClick={() => player.playTracks([track])}>
      Seed
    </button>
  );
}

describe('PlayerBar', () => {
  beforeEach(() => {
    vi.mocked(api).mockReset();
    vi.mocked(api).mockImplementation(async (path: string, options?: RequestInit) => {
      if (path === '/api/player/queue' && options?.method === 'POST') {
        const body = JSON.parse(String(options.body ?? '{}')) as {
          tracks?: Array<{
            ratingKey: string;
            title: string;
            artist?: string;
            durationMs?: number;
            artUrl?: string;
            streamUrl?: string;
          }>;
        };
        const tracks = (body.tracks ?? []).map((t) => ({
          ...t,
          streamUrl: t.streamUrl ?? `https://example.com/${t.ratingKey}`,
        }));
        return {
          queue: { items: tracks, currentIndex: 0, shuffle: false },
          current: tracks[0] ?? null,
        };
      }
      return { queue: null, current: null };
    });

    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: (query: string) => ({
        matches: query.includes('prefers-reduced-motion'),
        media: query,
        onchange: null,
        addListener: () => undefined,
        removeListener: () => undefined,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        dispatchEvent: () => false,
      }),
    });
  });

  it('renders artwork, icon controls, times, and seeks', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <ThemeProvider>
          <PlayerProvider>
            <PlaylistActionsProvider>
              <SeedPlayer
                track={{
                  ratingKey: '1',
                  title: 'Neon Skyline',
                  artist: 'Aurora',
                  durationMs: 125000,
                  artUrl: '/artwork/neon.png',
                  streamUrl: 'https://example.com/1',
                }}
              />
              <Layout onLogout={() => undefined} />
            </PlaylistActionsProvider>
          </PlayerProvider>
        </ThemeProvider>
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: 'Seed' }));

    expect(await screen.findByText('Neon Skyline')).toBeInTheDocument();
    expect(screen.getByText('Aurora')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Neon Skyline artwork' })).toHaveAttribute('src', '/artwork/neon.png');
    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous track' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next track' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Queue' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Add Neon Skyline to playlist/i })).toBeInTheDocument();

    await act(async () => {
      fakeAudio.currentTime = 65;
      fakeAudio.duration = 125;
      fakeAudio.dispatch('timeupdate');
      fakeAudio.dispatch('loadedmetadata');
    });

    expect(screen.getByText('1:05')).toBeInTheDocument();
    expect(screen.getByText('2:05')).toBeInTheDocument();

    const seek = screen.getByLabelText('Seek');
    fireEvent.change(seek, { target: { value: '30' } });
    expect(fakeAudio.currentTime).toBe(30);
  });

  it('publishes the measured player height as a CSS offset', async () => {
    const user = userEvent.setup();
    let resizeCallback: ResizeObserverCallback | null = null;
    const OriginalResizeObserver = globalThis.ResizeObserver;
    const originalGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect;

    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(cb: ResizeObserverCallback) {
          resizeCallback = cb;
        }
        observe() {
          /* no-op */
        }
        disconnect() {
          /* no-op */
        }
        unobserve() {
          /* no-op */
        }
      },
    );

    Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', {
      configurable: true,
      value() {
        if ((this as HTMLElement).classList?.contains('player-bar')) {
          return {
            x: 0,
            y: 0,
            top: 0,
            left: 0,
            bottom: 132,
            right: 390,
            width: 390,
            height: 132,
            toJSON() {
              return {};
            },
          };
        }
        return originalGetBoundingClientRect.call(this);
      },
    });

    try {
      const { unmount } = render(
        <PlaylistActionsProvider>
          <PlayerProvider>
            <SeedPlayer track={{ ratingKey: '9', title: 'No Art', artist: 'Blank', durationMs: 60000 }} />
            <PlayerBar />
          </PlayerProvider>
        </PlaylistActionsProvider>,
      );

      await user.click(screen.getByRole('button', { name: 'Seed' }));
      expect(await screen.findByText('No Art')).toBeInTheDocument();
      expect(document.documentElement.style.getPropertyValue('--player-bar-offset')).toBe('132px');

      act(() => {
        resizeCallback?.([] as unknown as ResizeObserverEntry[], {} as ResizeObserver);
      });
      expect(document.documentElement.style.getPropertyValue('--player-bar-offset')).toBe('132px');

      unmount();
      expect(document.documentElement.style.getPropertyValue('--player-bar-offset')).toBe('0px');
    } finally {
      if (OriginalResizeObserver) {
        vi.stubGlobal('ResizeObserver', OriginalResizeObserver);
      }
      Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', {
        configurable: true,
        value: originalGetBoundingClientRect,
      });
    }
  });

  it('shows music fallback when artwork is missing', async () => {
    const user = userEvent.setup();

    render(
      <PlaylistActionsProvider>
        <PlayerProvider>
          <SeedPlayer track={{ ratingKey: '9', title: 'No Art', artist: 'Blank', durationMs: 60000 }} />
          <PlayerBar />
        </PlayerProvider>
      </PlaylistActionsProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'Seed' }));
    expect(await screen.findByText('No Art')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('falls back to music icon when artwork fails to load', async () => {
    const user = userEvent.setup();

    render(
      <PlaylistActionsProvider>
        <PlayerProvider>
          <SeedPlayer
            track={{
              ratingKey: '7',
              title: 'Broken Art',
              artist: 'Blank',
              durationMs: 60000,
              artUrl: '/artwork/broken.png',
            }}
          />
          <PlayerBar />
        </PlayerProvider>
      </PlaylistActionsProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'Seed' }));
    const img = await screen.findByRole('img', { name: 'Broken Art artwork' });
    fireEvent.error(img);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByText('Broken Art')).toBeInTheDocument();
  });
});
