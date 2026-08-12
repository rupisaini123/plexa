import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import {
  ArrowUpDown,
  Disc3,
  LayoutGrid,
  List,
  Mic2,
  Music2,
  Play,
  Shuffle,
} from 'lucide-react';
import type { LibraryKind, LibrarySort, LibraryView } from '../lib/api';

const TABS: { id: LibraryKind; label: string; icon: typeof Mic2 }[] = [
  { id: 'artists', label: 'Artists', icon: Mic2 },
  { id: 'albums', label: 'Albums', icon: Disc3 },
  { id: 'tracks', label: 'Tracks', icon: Music2 },
];

const LIBRARY_TOOLBAR_HEIGHT_FALLBACK = '3.25rem';

function setLibraryToolbarHeight(px: number) {
  document.documentElement.style.setProperty(
    '--library-toolbar-height',
    px > 0 ? `${Math.max(0, Math.ceil(px))}px` : LIBRARY_TOOLBAR_HEIGHT_FALLBACK,
  );
}

const SORT_OPTIONS: Record<LibraryKind, { value: LibrarySort; label: string }[]> = {
  artists: [
    { value: 'title', label: 'Title A–Z' },
    { value: 'titleDesc', label: 'Title Z–A' },
    { value: 'addedAt', label: 'Recently added' },
  ],
  albums: [
    { value: 'title', label: 'Title A–Z' },
    { value: 'titleDesc', label: 'Title Z–A' },
    { value: 'yearDesc', label: 'Year (newest)' },
    { value: 'year', label: 'Year (oldest)' },
    { value: 'addedAt', label: 'Recently added' },
  ],
  tracks: [
    { value: 'title', label: 'Title A–Z' },
    { value: 'titleDesc', label: 'Title Z–A' },
    { value: 'addedAt', label: 'Recently added' },
  ],
};

interface LibraryToolbarProps {
  tab: LibraryKind;
  sort: LibrarySort;
  view: LibraryView;
  loadedCount: number;
  onTabChange: (tab: LibraryKind) => void;
  onSortChange: (sort: LibrarySort) => void;
  onViewChange: (view: LibraryView) => void;
  onPlayAll?: () => void;
  onShuffle?: () => void;
}

export function LibraryToolbar({
  tab,
  sort,
  view,
  loadedCount,
  onTabChange,
  onSortChange,
  onViewChange,
  onPlayAll,
  onShuffle,
}: LibraryToolbarProps) {
  const panelId = `library-panel-${tab}`;
  const sortOptions = SORT_OPTIONS[tab];
  const activeSort = sortOptions.some((o) => o.value === sort) ? sort : sortOptions[0].value;
  const activeSortLabel = sortOptions.find((o) => o.value === activeSort)?.label ?? 'Sort';

  const sortMenuId = useId();
  const sortRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [sortOpen, setSortOpen] = useState(false);

  useLayoutEffect(() => {
    const el = toolbarRef.current;
    if (!el) return;

    const apply = () => setLibraryToolbarHeight(el.getBoundingClientRect().height);
    apply();

    if (typeof ResizeObserver === 'undefined') {
      return () => setLibraryToolbarHeight(0);
    }

    const observer = new ResizeObserver(apply);
    observer.observe(el);
    return () => {
      observer.disconnect();
      setLibraryToolbarHeight(0);
    };
  }, []);

  useEffect(() => {
    if (!sortOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!sortRef.current?.contains(event.target as Node)) {
        setSortOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSortOpen(false);
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [sortOpen]);

  const itemLabel = loadedCount === 1 ? 'item' : 'items';

  return (
    <div ref={toolbarRef} className="library-toolbar card p-2">
      <div className="library-toolbar-inner flex flex-wrap items-center gap-2">
        <div className="nav-pills-track inline-flex max-w-full items-center gap-1 rounded-2xl p-1" role="tablist" aria-label="Library views">
          {TABS.map((entry) => {
            const Icon = entry.icon;
            const active = tab === entry.id;
            return (
              <button
                key={entry.id}
                type="button"
                role="tab"
                id={`library-tab-${entry.id}`}
                aria-selected={active}
                aria-controls={panelId}
                title={entry.label}
                className={`library-toolbar-tab nav-pill ${active ? 'nav-pill-active' : ''}`}
                onClick={() => onTabChange(entry.id)}
              >
                <Icon aria-hidden="true" className="h-4 w-4 shrink-0" strokeWidth={2} />
                <span className="hidden sm:inline">{entry.label}</span>
              </button>
            );
          })}
        </div>

        <div className="library-toolbar-controls flex flex-wrap items-center gap-2 border-l border-white/10 pl-2">
          {tab !== 'tracks' && (
            <div className="nav-pills-track inline-flex items-center gap-1 rounded-2xl p-1" role="group" aria-label="View">
              <button
                type="button"
                className={`library-toolbar-tab nav-pill ${view === 'grid' ? 'nav-pill-active' : ''}`}
                aria-pressed={view === 'grid'}
                title="Grid"
                onClick={() => onViewChange('grid')}
              >
                <LayoutGrid aria-hidden="true" className="h-4 w-4 shrink-0" strokeWidth={2} />
                <span className="sr-only">Grid</span>
              </button>
              <button
                type="button"
                className={`library-toolbar-tab nav-pill ${view === 'list' ? 'nav-pill-active' : ''}`}
                aria-pressed={view === 'list'}
                title="List"
                onClick={() => onViewChange('list')}
              >
                <List aria-hidden="true" className="h-4 w-4 shrink-0" strokeWidth={2} />
                <span className="sr-only">List</span>
              </button>
            </div>
          )}

          <div className="library-sort relative" ref={sortRef}>
            <button
              type="button"
              className="library-toolbar-action nav-pill"
              aria-haspopup="menu"
              aria-expanded={sortOpen}
              aria-controls={sortMenuId}
              title={`Sort: ${activeSortLabel}`}
              onClick={() => setSortOpen((open) => !open)}
            >
              <ArrowUpDown aria-hidden="true" className="h-4 w-4 shrink-0" strokeWidth={2} />
              <span className="hidden max-w-[7rem] truncate md:inline">{activeSortLabel}</span>
              <span className="sr-only">Sort</span>
            </button>

            {sortOpen && (
              <div
                id={sortMenuId}
                className="library-sort-menu card"
                role="menu"
                aria-label="Sort options"
              >
                {sortOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    role="menuitemradio"
                    aria-checked={activeSort === option.value}
                    className={`library-sort-option ${activeSort === option.value ? 'library-sort-option-active' : ''}`}
                    onClick={() => {
                      onSortChange(option.value);
                      setSortOpen(false);
                    }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {tab === 'tracks' && (
            <>
              {onPlayAll && (
                <button
                  type="button"
                  className="player-icon-btn h-9 w-9"
                  aria-label="Play all"
                  title="Play all"
                  onClick={onPlayAll}
                >
                  <Play aria-hidden="true" className="h-4 w-4 translate-x-px" fill="currentColor" strokeWidth={2} />
                </button>
              )}
              {onShuffle && (
                <button
                  type="button"
                  className="player-icon-btn h-9 w-9"
                  aria-label="Shuffle"
                  title="Shuffle"
                  onClick={onShuffle}
                >
                  <Shuffle aria-hidden="true" className="h-4 w-4" strokeWidth={2} />
                </button>
              )}
            </>
          )}

          <p className="text-xs text-muted" role="status">
            <span className="hidden sm:inline">· </span>
            {loadedCount} {itemLabel}
          </p>
        </div>
      </div>
    </div>
  );
}
