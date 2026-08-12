import { useEffect, useId, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import {
  LayoutDashboard,
  Library,
  ListMusic,
  LogOut,
  Menu,
  Monitor,
  Moon,
  Settings,
  Sun,
  X,
} from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';
import { useTheme } from '../context/ThemeContext';
import { logout } from '../lib/api';
import { fadeUp, modalBackdrop, pageOverlayTransition, pageTransitionEase, springSoft, useAppReducedMotion } from '../lib/motion';
import { AppTooltip, tooltipProps } from '../lib/tooltip';
import { PlayerBar } from './PlayerBar';
import { QueuePanel } from './QueuePanel';

const links = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/library', label: 'Library', icon: Library },
  { to: '/playlists', label: 'Playlists', icon: ListMusic },
  { to: '/settings', label: 'Settings', icon: Settings },
] as const;

const themeOrder = ['system', 'light', 'dark'] as const;
const themeLabels = { system: 'System', light: 'Light', dark: 'Dark' } as const;
const COMPACT_NAV_QUERY = '(max-width: 1023px)';

function useCompactNav(): boolean {
  const [isCompact, setIsCompact] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(COMPACT_NAV_QUERY).matches;
  });

  useEffect(() => {
    const mq = window.matchMedia(COMPACT_NAV_QUERY);
    const onChange = () => setIsCompact(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return isCompact;
}

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const ThemeIcon = theme === 'light' ? Sun : theme === 'dark' ? Moon : Monitor;

  const cycleTheme = () => {
    const index = themeOrder.indexOf(theme);
    const next = themeOrder[(index + 1) % themeOrder.length];
    setTheme(next);
  };

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={cycleTheme}
      aria-label={`Theme: ${themeLabels[theme]}`}
      {...tooltipProps(`Theme: ${themeLabels[theme]}`, 'bottom')}
    >
      <ThemeIcon aria-hidden="true" className="h-4 w-4" strokeWidth={2} />
    </button>
  );
}

export function Layout({ onLogout }: { onLogout: () => void }) {
  const player = usePlayer();
  const location = useLocation();
  const reducedMotion = useAppReducedMotion();
  const isCompactNav = useCompactNav();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuId = useId();

  useEffect(() => {
    if (!isCompactNav) setMenuOpen(false);
  }, [isCompactNav]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [menuOpen]);

  const handleLogout = async () => {
    setMenuOpen(false);
    await logout();
    onLogout();
  };

  const closeMenu = () => setMenuOpen(false);

  return (
    <div className={`min-h-screen ${player.current ? 'player-active pb-[var(--player-bar-offset)]' : ''}`}>
      <header className="nav-shell relative sticky top-0 z-50 pt-3 lg:pt-4">
        <div className="nav-bar app-gutter flex items-center gap-3 py-2.5 lg:gap-4 lg:py-3">
          <NavLink
            to="/"
            aria-label="Plexa"
            className="nav-brand group flex min-w-0 shrink-0 items-center gap-2.5 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
            onClick={closeMenu}
          >
            <img
              src="/logo-icon.svg"
              alt=""
              aria-hidden="true"
              className="nav-brand-mark h-9 w-9 shrink-0 rounded-xl object-contain"
            />
            <span className="nav-brand-wordmark hidden text-xl font-semibold tracking-tight lg:block">
              Plexa
            </span>
          </NavLink>

          <nav
            className="nav-pills hidden min-w-0 flex-1 items-center justify-center lg:flex"
            aria-label="Primary"
          >
            <div className="nav-pills-track inline-flex max-w-full items-center gap-1 rounded-2xl p-1">
              {links.map((link) => {
                const Icon = link.icon;
                return (
                  <NavLink
                    key={link.to}
                    to={link.to}
                    end={link.to === '/'}
                    className={({ isActive }) =>
                      `nav-pill ${isActive ? 'nav-pill-active' : ''}`}
                    {...tooltipProps(link.label, 'bottom')}
                  >
                    <Icon aria-hidden="true" className="h-4 w-4 shrink-0" strokeWidth={2} />
                    <span className="hidden xl:inline">{link.label}</span>
                  </NavLink>
                );
              })}
            </div>
          </nav>

          <div className="ml-auto hidden items-center gap-2 lg:flex">
            <ThemeToggle />
            <button
              className="btn btn-secondary nav-icon-btn"
              onClick={handleLogout}
              type="button"
              aria-label="Log out"
              {...tooltipProps('Log out', 'bottom')}
            >
              <LogOut aria-hidden="true" className="h-4 w-4" strokeWidth={2} />
            </button>
          </div>

          {isCompactNav ? (
            <button
              type="button"
              className="btn btn-secondary ml-auto inline-flex h-11 w-11 shrink-0 items-center justify-center p-0"
              aria-expanded={menuOpen}
              aria-controls={menuId}
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              {...tooltipProps(menuOpen ? 'Close menu' : 'Open menu', 'bottom')}
              onClick={() => setMenuOpen((open) => !open)}
            >
              {menuOpen ? (
                <X aria-hidden="true" className="h-5 w-5" strokeWidth={2} />
              ) : (
                <Menu aria-hidden="true" className="h-5 w-5" strokeWidth={2} />
              )}
            </button>
          ) : null}
        </div>

        <AnimatePresence>
          {isCompactNav && menuOpen ? (
            <>
              <motion.button
                key="nav-mobile-backdrop"
                type="button"
                className="nav-mobile-backdrop"
                aria-label="Dismiss menu"
                {...tooltipProps('Dismiss menu')}
                onClick={closeMenu}
                variants={modalBackdrop}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={springSoft}
              />
              <motion.div
                key="nav-mobile-panel"
                id={menuId}
                className="nav-mobile"
                variants={fadeUp}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={springSoft}
              >
                <div className="nav-mobile-panel">
                  <nav className="flex flex-col gap-1 p-2" aria-label="Mobile">
                    {links.map((link) => {
                      const Icon = link.icon;
                      return (
                        <NavLink
                          key={link.to}
                          to={link.to}
                          end={link.to === '/'}
                          onClick={closeMenu}
                          className={({ isActive }) =>
                            `nav-mobile-link ${isActive ? 'nav-mobile-link-active' : ''}`}
                        >
                          <Icon aria-hidden="true" className="h-4 w-4 shrink-0" strokeWidth={2} />
                          <span>{link.label}</span>
                        </NavLink>
                      );
                    })}
                  </nav>
                  <div className="flex items-center gap-2 border-t border-white/10 p-2">
                    <ThemeToggle />
                    <button
                      className="btn btn-secondary inline-flex flex-1 items-center justify-center gap-2"
                      onClick={handleLogout}
                      type="button"
                    >
                      <LogOut aria-hidden="true" className="h-4 w-4" strokeWidth={2} />
                      Log out
                    </button>
                  </div>
                </div>
              </motion.div>
            </>
          ) : null}
        </AnimatePresence>
      </header>

      <main className="app-gutter py-6">
        {reducedMotion ? (
          <Outlet />
        ) : (
          <div className="page-outlet-stack grid [&>*]:col-start-1 [&>*]:row-start-1">
            <AnimatePresence>
              <motion.div
                key={location.pathname}
                className="col-start-1 row-start-1 w-full bg-surface"
                variants={pageOverlayTransition}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={pageTransitionEase}
              >
                <Outlet />
              </motion.div>
            </AnimatePresence>
          </div>
        )}
      </main>

      <PlayerBar />
      <QueuePanel />
      <AppTooltip />
    </div>
  );
}
