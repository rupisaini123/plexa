import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '../context/ThemeContext';
import { PlayerProvider } from '../context/PlayerContext';
import { PlaylistActionsProvider } from '../context/PlaylistActionsContext';
import { Layout } from '../components/Layout';

vi.mock('../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../lib/api')>('../lib/api');
  return {
    ...actual,
    api: vi.fn().mockResolvedValue({ queue: null, current: null }),
    fetchCsrf: vi.fn().mockResolvedValue('csrf'),
    logout: vi.fn().mockResolvedValue(undefined),
  };
});

function mockMatchMedia({ compact = false }: { compact?: boolean } = {}) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: query.includes('max-width: 1023px') ? compact : false,
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

function renderLayout(onLogout = vi.fn()) {
  render(
    <MemoryRouter>
      <ThemeProvider>
        <PlayerProvider>
          <PlaylistActionsProvider>
            <Layout onLogout={onLogout} />
          </PlaylistActionsProvider>
        </PlayerProvider>
      </ThemeProvider>
    </MemoryRouter>,
  );
  return onLogout;
}

describe('theme and layout', () => {
  beforeEach(() => {
    document.documentElement.className = '';
    try {
      localStorage.removeItem('plexa-theme');
    } catch {
      // jsdom may not expose localStorage
    }
  });

  it('renders the sticky floating glass navbar with primary links', () => {
    mockMatchMedia({ compact: false });
    renderLayout();

    const brand = screen.getByRole('link', { name: /plexa/i });
    expect(brand).toBeInTheDocument();
    expect(brand.querySelector('.nav-brand-mark')).toBeInTheDocument();
    expect(brand.querySelector('.nav-brand-wordmark')).toHaveTextContent('Plexa');
    expect(document.querySelector('.nav-shell')).toHaveClass('sticky');
    expect(document.querySelector('.nav-bar')).toBeInTheDocument();

    const primaryNav = screen.getByRole('navigation', { name: /primary/i });
    expect(within(primaryNav).getByRole('link', { name: /dashboard/i })).toBeInTheDocument();
    expect(within(primaryNav).getByRole('link', { name: /library/i })).toBeInTheDocument();
    expect(within(primaryNav).getByRole('link', { name: /playlists/i })).toBeInTheDocument();
    expect(within(primaryNav).getByRole('link', { name: /settings/i })).toBeInTheDocument();
  });

  it('does not render the hamburger on desktop viewports', () => {
    mockMatchMedia({ compact: false });
    renderLayout();

    expect(screen.queryByRole('button', { name: /open menu/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: /mobile/i })).not.toBeInTheDocument();
  });

  it('cycles theme with the icon toggle and logs out', async () => {
    mockMatchMedia({ compact: false });
    const user = userEvent.setup();
    const onLogout = renderLayout();

    const toggles = screen.getAllByRole('button', { name: /theme:/i });
    expect(toggles.length).toBeGreaterThanOrEqual(1);
    expect(toggles[0]).toHaveAttribute('aria-label', 'Theme: System');

    await user.click(toggles[0]);
    expect(toggles[0]).toHaveAttribute('aria-label', 'Theme: Light');
    expect(document.documentElement.classList.contains('light')).toBe(true);

    await user.click(toggles[0]);
    expect(toggles[0]).toHaveAttribute('aria-label', 'Theme: Dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);

    await user.click(screen.getAllByRole('button', { name: /log out/i })[0]);
    await waitFor(() => expect(onLogout).toHaveBeenCalled());
  });

  it('toggles the overlay mobile menu and closes after navigation', async () => {
    mockMatchMedia({ compact: true });
    const user = userEvent.setup();
    renderLayout();

    const openButton = screen.getByRole('button', { name: /open menu/i });
    expect(openButton).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('navigation', { name: /mobile/i })).not.toBeInTheDocument();

    await user.click(openButton);
    expect(screen.getByRole('button', { name: /close menu/i })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: /dismiss menu/i })).toBeInTheDocument();
    expect(document.querySelector('.nav-mobile')).toHaveClass('nav-mobile-open');

    const mobileNav = screen.getByRole('navigation', { name: /mobile/i });
    expect(within(mobileNav).getByRole('link', { name: /library/i })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /theme:/i }).length).toBeGreaterThanOrEqual(1);

    await user.click(within(mobileNav).getByRole('link', { name: /library/i }));
    expect(screen.queryByRole('navigation', { name: /mobile/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /open menu/i })).toHaveAttribute('aria-expanded', 'false');
  });

  it('closes the mobile menu with Escape and after logout', async () => {
    mockMatchMedia({ compact: true });
    const user = userEvent.setup();
    const onLogout = renderLayout();

    await user.click(screen.getByRole('button', { name: /open menu/i }));
    expect(screen.getByRole('navigation', { name: /mobile/i })).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('navigation', { name: /mobile/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /open menu/i }));
    const openMenu = screen.getByRole('navigation', { name: /mobile/i }).parentElement!;
    await user.click(within(openMenu).getByRole('button', { name: /log out/i }));
    await waitFor(() => expect(onLogout).toHaveBeenCalled());
    expect(screen.queryByRole('navigation', { name: /mobile/i })).not.toBeInTheDocument();
  });
});
