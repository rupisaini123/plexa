import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import * as motionLib from '../lib/motion';
import { LibraryPage } from './LibraryPage';

vi.mock('../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../lib/api')>('../lib/api');
  return {
    ...actual,
    api: vi.fn(),
  };
});

const playerState = {
  playTracks: vi.fn(),
  current: null as { ratingKey: string; title: string } | null,
};

vi.mock('../context/PlayerContext', () => ({
  usePlayer: () => playerState,
}));

vi.mock('../context/PlaylistActionsContext', () => ({
  usePlaylistActions: () => ({
    openForTrack: vi.fn(),
    openForPlaylist: vi.fn(),
    revision: 0,
  }),
}));

vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: ({ count }: { count: number }) => ({
    getVirtualItems: () => Array.from({ length: count }, (_, index) => ({
      index,
      start: index * 56,
      size: 56,
      key: index,
    })),
    getTotalSize: () => count * 56,
    measureElement: vi.fn(),
  }),
}));

import { api } from '../lib/api';

function mockMatchMedia({
  desktop = false,
  reducedMotion = true,
}: { desktop?: boolean; reducedMotion?: boolean } = {}) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: (query.includes('prefers-reduced-motion') && reducedMotion)
        || (query.includes('min-width: 1024px') ? desktop : false),
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }),
  });
}

function renderLibrary(initial = '/library') {
  return render(
    <MemoryRouter initialEntries={[initial]}>
      <LibraryPage />
    </MemoryRouter>,
  );
}

describe('LibraryPage', () => {
  beforeEach(() => {
    vi.mocked(api).mockReset();
    playerState.playTracks.mockReset();
    playerState.current = null;
    mockMatchMedia({ desktop: false });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows artwork-forward track rows in the tracks tab', async () => {
    const user = userEvent.setup();
    vi.mocked(api).mockImplementation(async (path: string) => {
      if (path.startsWith('/api/library/artists')) {
        return {
          items: [{ ratingKey: 'a1', title: 'Aurora', artUrl: '/artwork/artist.png' }],
          nextStart: 1,
          hasMore: false,
        };
      }
      if (path.startsWith('/api/library/tracks')) {
        return {
          items: [
            {
              ratingKey: '1',
              title: 'Neon Skyline',
              artist: 'Aurora',
              album: 'Night Drive',
              durationMs: 180000,
              artUrl: '/artwork/neon.png',
            },
          ],
          nextStart: 1,
          hasMore: false,
        };
      }
      throw new Error(`Unexpected path: ${path}`);
    });

    renderLibrary();

    await waitFor(() => expect(screen.getByText('Aurora')).toBeInTheDocument());
    await user.click(screen.getByRole('tab', { name: /tracks/i }));

    expect(await screen.findByText('Neon Skyline')).toBeInTheDocument();
    expect(screen.getByText('Aurora · Night Drive')).toBeInTheDocument();
    const poster = screen.getAllByRole('presentation').find(
      (element) => element.getAttribute('src') === '/artwork/neon.png',
    );
    expect(poster).toBeTruthy();
    expect(screen.getByRole('button', { name: /Play Neon Skyline/i })).toBeInTheDocument();
  });

  it('loads more artists through the infinite list boundary', async () => {
    vi.mocked(api).mockImplementation(async (path: string) => {
      if (path.includes('/api/library/artists') && path.includes('start=0')) {
        return {
          items: [{ ratingKey: 'a1', title: 'Aurora', artUrl: '/artwork/a.png' }],
          nextStart: 1,
          hasMore: true,
        };
      }
      if (path.includes('/api/library/artists') && path.includes('start=1')) {
        return {
          items: [{ ratingKey: 'a2', title: 'Boreal', artUrl: '/artwork/b.png' }],
          nextStart: 2,
          hasMore: false,
        };
      }
      throw new Error(`Unexpected path: ${path}`);
    });

    renderLibrary();
    expect(await screen.findByText('Aurora')).toBeInTheDocument();
    expect(await screen.findByText('Boreal')).toBeInTheDocument();
    expect(screen.getByText(/2 artists loaded/i)).toBeInTheDocument();
  });

  it('opens album details from a media card', async () => {
    const user = userEvent.setup();
    vi.mocked(api).mockImplementation(async (path: string) => {
      if (path.startsWith('/api/library/artists')) {
        return { items: [], nextStart: 0, hasMore: false };
      }
      if (path.startsWith('/api/library/albums') && !path.includes('/tracks')) {
        return {
          items: [{ ratingKey: 'al1', title: 'Night Drive', artist: 'Aurora', year: 2024, artUrl: '/artwork/album.png' }],
          nextStart: 1,
          hasMore: false,
        };
      }
      if (path.startsWith('/api/albums/al1') && !path.includes('/tracks')) {
        return {
          album: { ratingKey: 'al1', title: 'Night Drive', artist: 'Aurora', year: 2024, artUrl: '/artwork/album.png' },
        };
      }
      if (path.includes('/api/albums/al1/tracks')) {
        return {
          items: [{ ratingKey: 't1', title: 'Neon Skyline', artist: 'Aurora', artUrl: '/artwork/neon.png' }],
          nextStart: 1,
          hasMore: false,
        };
      }
      throw new Error(`Unexpected path: ${path}`);
    });

    renderLibrary('/library?tab=albums');
    expect(await screen.findByText('Night Drive')).toBeInTheDocument();
    await user.click(screen.getByText('Night Drive'));
    expect(await screen.findByRole('heading', { name: 'Night Drive' })).toBeInTheDocument();
    expect(await screen.findByText('Neon Skyline')).toBeInTheDocument();
  });

  it('uses a two-column comfortable grid and hides the mosaic below desktop', async () => {
    vi.mocked(api).mockImplementation(async (path: string) => {
      if (path.startsWith('/api/library/artists')) {
        return {
          items: [
            { ratingKey: 'a1', title: 'Aurora', artUrl: '/artwork/a.png' },
            { ratingKey: 'a2', title: 'Boreal', artUrl: '/artwork/b.png' },
          ],
          nextStart: 2,
          hasMore: false,
        };
      }
      throw new Error(`Unexpected path: ${path}`);
    });

    const { container } = renderLibrary();
    expect(await screen.findByText('Aurora')).toBeInTheDocument();

    const grid = container.querySelector('.library-page .grid.grid-cols-2');
    expect(grid).toBeTruthy();
    expect(grid?.className).toContain('gap-2');
    expect(grid?.className).toContain('sm:gap-2.5');
    expect(grid?.className).toContain('md:grid-cols-4');
    expect(grid?.className).toContain('lg:grid-cols-6');

    const mosaic = container.querySelector('.library-mosaic');
    expect(mosaic).toBeTruthy();
    expect(mosaic?.className).toContain('hidden');
    expect(mosaic?.className).toContain('overflow-visible');
    expect(mosaic?.className).toContain('lg:flex');
  });

  it('switches to list view with compact media cards', async () => {
    const user = userEvent.setup();
    vi.mocked(api).mockImplementation(async (path: string) => {
      if (path.startsWith('/api/library/artists')) {
        return {
          items: [{ ratingKey: 'a1', title: 'Aurora', artUrl: '/artwork/a.png' }],
          nextStart: 1,
          hasMore: false,
        };
      }
      throw new Error(`Unexpected path: ${path}`);
    });

    const { container } = renderLibrary();
    expect(await screen.findByText('Aurora')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^list$/i }));
    expect(container.querySelector('.media-card-compact')).toBeTruthy();
  });

  it('hides the view toggle on the tracks tab', async () => {
    const user = userEvent.setup();
    vi.mocked(api).mockImplementation(async (path: string) => {
      if (path.startsWith('/api/library/artists')) {
        return { items: [], nextStart: 0, hasMore: false };
      }
      if (path.startsWith('/api/library/tracks')) {
        return {
          items: [{ ratingKey: 't1', title: 'Neon Skyline', artist: 'Aurora', artUrl: '/artwork/neon.png' }],
          nextStart: 1,
          hasMore: false,
        };
      }
      throw new Error(`Unexpected path: ${path}`);
    });

    renderLibrary();
    await user.click(screen.getByRole('tab', { name: /tracks/i }));
    expect(await screen.findByText('Neon Skyline')).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: /view/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /play all/i })).toBeInTheDocument();
  });

  it('opens the sort menu and updates the sort param', async () => {
    const user = userEvent.setup();
    vi.mocked(api).mockImplementation(async (path: string) => {
      if (path.startsWith('/api/library/artists')) {
        return {
          items: [{ ratingKey: 'a1', title: 'Aurora', artUrl: '/artwork/a.png' }],
          nextStart: 1,
          hasMore: false,
        };
      }
      if (path.startsWith('/api/library/artists') && path.includes('sort=addedAt')) {
        return {
          items: [{ ratingKey: 'a1', title: 'Aurora', artUrl: '/artwork/a.png' }],
          nextStart: 1,
          hasMore: false,
        };
      }
      throw new Error(`Unexpected path: ${path}`);
    });

    renderLibrary();
    expect(await screen.findByText('Aurora')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /sort/i }));
    await user.click(screen.getByRole('menuitemradio', { name: /recently added/i }));

    await waitFor(() => {
      expect(vi.mocked(api).mock.calls.some(([path]) => String(path).includes('sort=addedAt'))).toBe(true);
    });
  });

  it('marks the detail pane as player-active when a track is playing', async () => {
    const user = userEvent.setup();
    playerState.current = { ratingKey: 't1', title: 'Neon Skyline' };

    vi.mocked(api).mockImplementation(async (path: string) => {
      if (path.startsWith('/api/library/artists')) {
        return { items: [], nextStart: 0, hasMore: false };
      }
      if (path.startsWith('/api/library/albums') && !path.includes('/tracks')) {
        return {
          items: [{ ratingKey: 'al1', title: 'Night Drive', artist: 'Aurora', year: 2024, artUrl: '/artwork/album.png' }],
          nextStart: 1,
          hasMore: false,
        };
      }
      if (path.startsWith('/api/albums/al1') && !path.includes('/tracks')) {
        return {
          album: { ratingKey: 'al1', title: 'Night Drive', artist: 'Aurora', year: 2024, artUrl: '/artwork/album.png' },
        };
      }
      if (path.includes('/api/albums/al1/tracks')) {
        return {
          items: [{ ratingKey: 't1', title: 'Neon Skyline', artist: 'Aurora', artUrl: '/artwork/neon.png' }],
          nextStart: 1,
          hasMore: false,
        };
      }
      throw new Error(`Unexpected path: ${path}`);
    });

    const { container } = renderLibrary('/library?tab=albums');
    expect(await screen.findByText('Night Drive')).toBeInTheDocument();
    await user.click(screen.getByText('Night Drive'));

    expect(await screen.findByRole('heading', { name: 'Night Drive' })).toBeInTheDocument();
    expect(container.querySelector('.library-detail-player-active')).toBeTruthy();
    expect(container.querySelector('.library-detail-sheet')).toBeTruthy();
    expect(container.querySelector('.library-detail-backdrop-player-active')).toBeTruthy();
    expect(screen.getByTestId('library-detail-scroll')).toBeInTheDocument();
  });

  it('loads tracks directly from the tracks tab route', async () => {
    vi.mocked(api).mockImplementation(async (path: string) => {
      if (path.startsWith('/api/library/tracks')) {
        return {
          items: [{ ratingKey: 't1', title: 'Neon Skyline', artist: 'Aurora', artUrl: '/artwork/neon.png' }],
          nextStart: 1,
          hasMore: false,
        };
      }
      throw new Error(`Unexpected path: ${path}`);
    });

    renderLibrary('/library?tab=tracks');
    expect(await screen.findByText('Neon Skyline')).toBeInTheDocument();
    expect(screen.getByTestId('library-tracks')).toBeInTheDocument();
  });

  it('replays grid reveals when switching tabs with reduced motion off', async () => {
    const user = userEvent.setup();
    mockMatchMedia({ reducedMotion: false });
    vi.spyOn(motionLib, 'useAppReducedMotion').mockReturnValue(false);

    vi.mocked(api).mockImplementation(async (path: string) => {
      if (path.startsWith('/api/library/artists')) {
        return {
          items: [{ ratingKey: 'a1', title: 'Aurora', artUrl: '/artwork/a.png' }],
          nextStart: 1,
          hasMore: false,
        };
      }
      if (path.startsWith('/api/library/albums')) {
        return {
          items: [{ ratingKey: 'al1', title: 'Night Drive', artist: 'Aurora', artUrl: '/artwork/album.png' }],
          nextStart: 1,
          hasMore: false,
        };
      }
      throw new Error(`Unexpected path: ${path}`);
    });

    renderLibrary();
    expect(await screen.findByText('Aurora')).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: /albums/i }));
    expect(await screen.findByText('Night Drive')).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: /artists/i }));
    expect(await screen.findByText('Aurora')).toBeInTheDocument();
  });

  it('renders track reveal wrappers when reduced motion is off', async () => {
    mockMatchMedia({ reducedMotion: false });
    vi.spyOn(motionLib, 'useAppReducedMotion').mockReturnValue(false);

    vi.mocked(api).mockImplementation(async (path: string) => {
      if (path.startsWith('/api/library/tracks')) {
        return {
          items: [{ ratingKey: 't1', title: 'Neon Skyline', artist: 'Aurora', artUrl: '/artwork/neon.png' }],
          nextStart: 1,
          hasMore: false,
        };
      }
      throw new Error(`Unexpected path: ${path}`);
    });

    renderLibrary('/library?tab=tracks');
    expect(await screen.findByText('Neon Skyline')).toBeInTheDocument();
    expect(screen.getByTestId('reveal-list-item')).toBeInTheDocument();
  });
});
