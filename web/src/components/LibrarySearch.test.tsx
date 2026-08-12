import { useCallback, useState } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LibrarySearch } from './LibrarySearch';
import type { SearchMediaType } from '../lib/api';

vi.mock('../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../lib/api')>('../lib/api');
  return {
    ...actual,
    api: vi.fn(),
  };
});

vi.mock('../context/PlaylistActionsContext', () => ({
  usePlaylistActions: () => ({
    openForTrack: vi.fn(),
    openForPlaylist: vi.fn(),
    revision: 0,
  }),
}));

import { api } from '../lib/api';

function ControlledLibrarySearch() {
  const [query, setQuery] = useState('');
  const [focusedType, setFocusedType] = useState<SearchMediaType | null>(null);

  const clearSearch = useCallback(() => {
    setQuery('');
    setFocusedType(null);
  }, []);

  return (
    <LibrarySearch
      query={query}
      onQueryChange={setQuery}
      onClearSearch={clearSearch}
      focusedType={focusedType}
      onFocusedTypeChange={setFocusedType}
      onOpenArtist={() => undefined}
      onOpenAlbum={() => undefined}
      onPlayTrack={() => undefined}
      onPlayAlbum={() => undefined}
      onPlayPlaylist={() => undefined}
    />
  );
}

/**
 * Mirrors LibraryPage URL param ownership: query comes from a param bag updated
 * via a single atomic clear patch (q + stype together).
 */
function UrlOwnedLibrarySearch() {
  const [params, setParams] = useState(() => new URLSearchParams('q=ne'));

  const updateParams = useCallback((patch: Record<string, string | null>) => {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      for (const [key, value] of Object.entries(patch)) {
        if (value === null || value === '') next.delete(key);
        else next.set(key, value);
      }
      return next;
    });
  }, []);

  const query = params.get('q') ?? '';
  const rawType = params.get('stype');
  const focusedType = (
    rawType === 'tracks' || rawType === 'albums' || rawType === 'artists' || rawType === 'playlists'
      ? rawType
      : null
  );

  const clearSearch = useCallback(() => {
    updateParams({ q: null, stype: null });
  }, [updateParams]);

  return (
    <LibrarySearch
      query={query}
      onQueryChange={(value) => updateParams({ q: value || null, stype: value ? focusedType : null })}
      onClearSearch={clearSearch}
      focusedType={focusedType}
      onFocusedTypeChange={(type) => updateParams({ stype: type })}
      onOpenArtist={() => undefined}
      onOpenAlbum={() => undefined}
      onPlayTrack={() => undefined}
      onPlayAlbum={() => undefined}
      onPlayPlaylist={() => undefined}
    />
  );
}

describe('LibrarySearch', () => {
  let resizeCallback: ResizeObserverCallback | null = null;
  let containerWidth = 120;
  let textWidth = 420;

  beforeEach(() => {
    vi.mocked(api).mockReset();
    resizeCallback = null;
    containerWidth = 120;
    textWidth = 420;

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

    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
      configurable: true,
      get(this: HTMLElement) {
        if (this.classList.contains('marquee')) return containerWidth;
        return 0;
      },
    });

    Object.defineProperty(HTMLElement.prototype, 'scrollWidth', {
      configurable: true,
      get(this: HTMLElement) {
        if (
          this.classList.contains('marquee-static')
          || this.classList.contains('marquee-segment')
        ) {
          return textWidth;
        }
        return 0;
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    delete (HTMLElement.prototype as { clientWidth?: unknown }).clientWidth;
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    delete (HTMLElement.prototype as { scrollWidth?: unknown }).scrollWidth;
  });

  it('renders long album titles with marquee in search results', async () => {
    const user = userEvent.setup();
    const longTitle = 'An Extremely Long Album Title That Needs A Ticker';

    vi.mocked(api).mockImplementation(async (path: string) => {
      if (path.startsWith('/api/search?')) {
        return {
          tracks: [],
          albums: [{
            ratingKey: 'al1',
            title: longTitle,
            artist: 'Aurora',
            artUrl: '/artwork/album.png',
          }],
          artists: [],
          playlists: [],
        };
      }
      throw new Error(`Unexpected path: ${path}`);
    });

    const { container } = render(<ControlledLibrarySearch />);
    await user.type(screen.getByRole('textbox', { name: /Search library/i }), 'ne');

    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: /Search results/i })).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(container.querySelector('.library-search-panel .marquee')).toBeTruthy();
    });

    act(() => {
      resizeCallback?.([] as unknown as ResizeObserverEntry[], {} as ResizeObserver);
    });

    expect(container.querySelector('.library-search-panel .marquee')).toHaveClass('marquee-overflow');
    expect(screen.getByText('Aurora')).toBeInTheDocument();
  });

  it('clears the query and closes results when the clear button is pressed', async () => {
    const user = userEvent.setup();

    vi.mocked(api).mockImplementation(async (path: string) => {
      if (path.startsWith('/api/search?')) {
        return {
          tracks: [{
            ratingKey: 't1',
            title: 'Neon Pulse',
            artist: 'Aurora',
            artUrl: '/artwork/track.png',
          }],
          albums: [],
          artists: [],
          playlists: [],
        };
      }
      throw new Error(`Unexpected path: ${path}`);
    });

    render(<ControlledLibrarySearch />);
    const input = screen.getByRole('textbox', { name: /Search library/i });
    await user.type(input, 'ne');

    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: /Search results/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /Clear search/i }));

    expect(input).toHaveValue('');
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /Search results/i })).not.toBeInTheDocument();
    });
    expect(screen.queryByText(/No results/i)).not.toBeInTheDocument();
  });

  it('clears URL-owned query with a single atomic onClearSearch update', async () => {
    const user = userEvent.setup();

    vi.mocked(api).mockImplementation(async (path: string) => {
      if (path.startsWith('/api/search?')) {
        return {
          tracks: [{
            ratingKey: 't1',
            title: 'Neon Pulse',
            artist: 'Aurora',
            artUrl: '/artwork/track.png',
          }],
          albums: [],
          artists: [],
          playlists: [],
        };
      }
      throw new Error(`Unexpected path: ${path}`);
    });

    render(<UrlOwnedLibrarySearch />);
    const input = screen.getByRole('textbox', { name: /Search library/i });

    expect(input).toHaveValue('ne');

    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: /Search results/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /Clear search/i }));

    await waitFor(() => {
      expect(input).toHaveValue('');
    });
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /Search results/i })).not.toBeInTheDocument();
    });
  });

  it('shows add-to-playlist on track search results', async () => {
    const user = userEvent.setup();

    vi.mocked(api).mockImplementation(async (path: string) => {
      if (path.startsWith('/api/search?')) {
        return {
          tracks: [{
            ratingKey: 't1',
            title: 'Neon Pulse',
            artist: 'Aurora',
            artUrl: '/artwork/track.png',
          }],
          albums: [],
          artists: [],
          playlists: [],
        };
      }
      throw new Error(`Unexpected path: ${path}`);
    });

    render(<ControlledLibrarySearch />);
    await user.type(screen.getByRole('textbox', { name: /Search library/i }), 'ne');

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Add Neon Pulse to playlist/i })).toBeInTheDocument();
    });
  });
});
