import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  api,
  type LibraryDensity,
  type LibraryKind,
  type LibrarySort,
  type LibraryView,
  type PageResult,
  type SearchMediaType,
  type TrackItem,
} from '../lib/api';
import { usePlayer } from '../context/PlayerContext';
import { useInfiniteMediaList } from '../hooks/useInfiniteMediaList';
import { InfiniteListBoundary } from '../components/InfiniteListBoundary';
import { LibraryDetailPane, type LibraryDetailSelection } from '../components/LibraryDetailPane';
import { LibrarySearch } from '../components/LibrarySearch';
import { LibraryToolbar } from '../components/LibraryToolbar';
import { LibraryTracksList } from '../components/LibraryTracksList';
import { MediaCard } from '../components/MediaCard';
import { RevealItem, RevealStagger, RevealStaggerGroup, useRevealBatches } from '../components/motion/Reveal';
import { MediaCardSkeleton, SkeletonStack, TrackRowSkeleton } from '../components/Skeleton';

const DEFAULT_SORT: Record<LibraryKind, LibrarySort> = {
  artists: 'title',
  albums: 'title',
  tracks: 'title',
};

function parseTab(value: string | null): LibraryKind {
  if (value === 'albums' || value === 'tracks' || value === 'artists') return value;
  return 'artists';
}

function parseSort(value: string | null, tab: LibraryKind): LibrarySort {
  const allowed: LibrarySort[] = tab === 'albums'
    ? ['title', 'titleDesc', 'addedAt', 'year', 'yearDesc']
    : ['title', 'titleDesc', 'addedAt'];
  if (value && (allowed as string[]).includes(value)) return value as LibrarySort;
  return DEFAULT_SORT[tab];
}

function parseView(viewParam: string | null, densityParam: string | null): LibraryView {
  if (viewParam === 'list' || viewParam === 'grid') return viewParam;
  if (densityParam === 'compact') return 'list';
  return 'grid';
}

function viewToDensity(view: LibraryView): LibraryDensity {
  return view === 'list' ? 'compact' : 'comfortable';
}

function parseSearchType(value: string | null): SearchMediaType | null {
  if (value === 'tracks' || value === 'albums' || value === 'artists' || value === 'playlists') return value;
  return null;
}

function comfortableGridClass(split: boolean): string {
  if (split) {
    return 'grid grid-cols-2 gap-2 sm:gap-2.5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6';
  }
  return 'grid grid-cols-2 gap-2 sm:gap-2.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8';
}

function compactGridClass(split: boolean): string {
  if (split) {
    return 'grid gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4';
  }
  return 'grid gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6';
}

function useIsDesktopDetail(): boolean {
  const [desktop, setDesktop] = useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return true;
    return window.matchMedia('(min-width: 1024px)').matches;
  });

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(min-width: 1024px)');
    const update = () => setDesktop(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  return desktop;
}

export function LibraryPage() {
  const player = usePlayer();
  const [params, setParams] = useSearchParams();
  const isDesktop = useIsDesktopDetail();

  const tab = parseTab(params.get('tab'));
  const sort = parseSort(params.get('sort'), tab);
  const view = parseView(params.get('view'), params.get('density'));
  const density = viewToDensity(view);
  const query = params.get('q') ?? '';
  const focusedType = parseSearchType(params.get('stype'));
  const detailType = params.get('dtype');
  const detailKey = params.get('dkey');
  const artistParentKey = params.get('aparent');
  const artistParentTitle = params.get('aparentTitle');

  const selection: LibraryDetailSelection | null = (
    (detailType === 'artist' || detailType === 'album') && detailKey
      ? {
          type: detailType,
          key: detailKey,
          title: params.get('dtitle') ?? undefined,
          artUrl: params.get('dart') ?? undefined,
          artist: params.get('dartist') ?? undefined,
        }
      : null
  );

  const artistParent: LibraryDetailSelection | null = (
    artistParentKey
      ? { type: 'artist', key: artistParentKey, title: artistParentTitle ?? undefined }
      : null
  );

  const updateParams = useCallback((patch: Record<string, string | null>, replace = false) => {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      for (const [key, value] of Object.entries(patch)) {
        if (value === null || value === '') next.delete(key);
        else next.set(key, value);
      }
      return next;
    }, { replace });
  }, [setParams]);

  const clearSearch = useCallback(() => {
    updateParams({ q: null, stype: null }, true);
  }, [updateParams]);

  const collection = useInfiniteMediaList<TrackItem>({
    resetKey: `${tab}:${sort}`,
    pageSize: 48,
    fetchPage: async ({ start, size, signal }) => {
      const path = tab === 'artists'
        ? '/api/library/artists'
        : tab === 'albums'
          ? '/api/library/albums'
          : '/api/library/tracks';
      return api<PageResult<TrackItem>>(
        `${path}?start=${start}&size=${size}&sort=${encodeURIComponent(sort)}`,
        { signal },
      );
    },
  });

  const mosaic = useMemo(
    () => collection.items.filter((item) => item.artUrl).slice(0, 6),
    [collection.items],
  );

  const openDetail = (type: 'artist' | 'album', item: TrackItem, parent?: LibraryDetailSelection | null) => {
    updateParams({
      dtype: type,
      dkey: item.ratingKey,
      dtitle: item.title,
      dart: item.artUrl ?? null,
      dartist: item.artist ?? null,
      aparent: parent?.key ?? null,
      aparentTitle: parent?.title ?? null,
    });
  };

  const closeDetail = () => {
    updateParams({
      dtype: null,
      dkey: null,
      dtitle: null,
      dart: null,
      dartist: null,
      aparent: null,
      aparentTitle: null,
    });
  };

  const playCollectionItem = async (kind: 'artist' | 'album', item: TrackItem) => {
    if (kind === 'album') {
      const res = await api<{ items: TrackItem[] }>(`/api/albums/${item.ratingKey}/tracks?all=1`);
      await player.playTracks(res.items);
      return;
    }
    const res = await api<{ items: TrackItem[] }>(`/api/artists/${item.ratingKey}/tracks?all=1`);
    await player.playTracks(res.items);
  };

  const playPlaylist = async (playlist: TrackItem) => {
    const res = await api<{ items: TrackItem[] }>(`/api/playlists/${playlist.ratingKey}/tracks?all=1`);
    await player.playTracks(res.items);
  };

  const playLoadedTracks = async (shuffle = false) => {
    if (collection.hasMore) {
      const res = await api<PageResult<TrackItem>>(
        `/api/library/tracks?start=0&size=100&sort=${encodeURIComponent(sort)}`,
      );
      // Prefer full collection when hasMore — walk pages via all-style fetches if needed
      let items = [...res.items];
      let start = res.nextStart;
      let hasMore = res.hasMore;
      while (hasMore) {
        const page = await api<PageResult<TrackItem>>(
          `/api/library/tracks?start=${start}&size=100&sort=${encodeURIComponent(sort)}`,
        );
        items = items.concat(page.items);
        start = page.nextStart;
        hasMore = page.hasMore;
      }
      await player.playTracks(items, shuffle);
      return;
    }
    await player.playTracks(collection.items, shuffle);
  };

  const showInlineDetail = Boolean(selection) && isDesktop && tab !== 'tracks';
  const showSheetDetail = Boolean(selection) && (!isDesktop || tab === 'tracks');
  const unconfigured = collection.error.toLowerCase().includes('music library not configured');
  const trackListMaxHeight = player.current
    ? 'max-h-[calc(100dvh-var(--library-detail-sticky-top)-12rem-var(--player-bar-offset))]'
    : 'max-h-[calc(100dvh-var(--library-detail-sticky-top)-8rem-var(--player-bar-offset))]';

  const datasetKey = `${tab}:${sort}`;
  const batchStarts = useRevealBatches(collection.items.length, collection.loading, datasetKey);

  return (
    <div className="library-page space-y-5">
      <header className="library-masthead card p-4 sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0 space-y-2">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted">Browse</p>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Your Library</h1>
            <p className="max-w-xl text-sm text-muted">
              Explore artists, albums, and tracks with artwork-first browsing and live search.
            </p>
          </div>
          {mosaic.length > 0 && (
            <RevealStagger
              key={tab}
              staggerOnMount
              className="library-mosaic hidden overflow-visible lg:flex"
              aria-hidden
            >
              {mosaic.map((item) => (
                <RevealItem key={item.ratingKey}>
                  <div className="library-mosaic-tile">
                    <img src={item.artUrl} alt="" className="h-full w-full object-cover" />
                  </div>
                </RevealItem>
              ))}
            </RevealStagger>
          )}
        </div>
        <div className="mt-5">
          <LibrarySearch
            query={query}
            onQueryChange={(value) => updateParams({ q: value || null, stype: value ? focusedType : null }, true)}
            onClearSearch={clearSearch}
            focusedType={focusedType}
            onFocusedTypeChange={(type) => updateParams({ stype: type }, true)}
            onOpenArtist={(item) => {
              openDetail('artist', item);
            }}
            onOpenAlbum={(item) => {
              openDetail('album', item);
            }}
            onPlayTrack={(item) => void player.playTracks([item])}
            onPlayAlbum={(item) => void playCollectionItem('album', item)}
            onPlayPlaylist={(item) => void playPlaylist(item)}
          />
        </div>
      </header>

      <LibraryToolbar
        tab={tab}
        sort={sort}
        view={view}
        loadedCount={collection.items.length}
        onTabChange={(next) => updateParams({
          tab: next,
          sort: DEFAULT_SORT[next],
          dtype: null,
          dkey: null,
          dtitle: null,
          dart: null,
          dartist: null,
          aparent: null,
          aparentTitle: null,
        })}
        onSortChange={(next) => updateParams({ sort: next })}
        onViewChange={(next) => updateParams({
          view: next === 'grid' ? null : next,
          density: null,
        })}
        onPlayAll={() => void playLoadedTracks(false)}
        onShuffle={() => void playLoadedTracks(true)}
      />

      <div className={showInlineDetail ? 'library-split' : undefined}>
        <section
          key={datasetKey}
          id={`library-panel-${tab}`}
          role="tabpanel"
          aria-labelledby={`library-tab-${tab}`}
          className="min-w-0"
        >
          {collection.loading && collection.items.length === 0 && (
            tab === 'tracks' ? (
              <div className="card space-y-2 p-4">
                <SkeletonStack count={8} label="Loading tracks">
                  {(index) => <TrackRowSkeleton key={index} />}
                </SkeletonStack>
              </div>
            ) : (
              <div
                className={density === 'compact'
                  ? compactGridClass(showInlineDetail)
                  : comfortableGridClass(showInlineDetail)}
                role="status"
                aria-busy="true"
              >
                <span className="sr-only">Loading library</span>
                {Array.from({ length: 8 }).map((_, index) => (
                  <MediaCardSkeleton key={index} />
                ))}
              </div>
            )
          )}

          {unconfigured && (
            <div className="card space-y-3 p-6" role="alert">
              <p className="font-semibold">Music library not configured</p>
              <p className="text-sm text-muted">
                Connect Plex and choose a music library in Settings to start browsing.
              </p>
              <Link className="btn btn-primary inline-flex w-fit" to="/settings">Open Settings</Link>
            </div>
          )}

          {!unconfigured && collection.error && collection.items.length === 0 && (
            <div className="card space-y-3 p-6" role="alert">
              <p className="text-danger">{collection.error}</p>
              <button type="button" className="btn btn-secondary w-fit" onClick={collection.retry}>
                Retry
              </button>
            </div>
          )}

          {!collection.loading && !collection.error && collection.items.length === 0 && (
            <div className="card p-6 text-muted">
              No items found. Configure your music library in Settings or try another view.
            </div>
          )}

          {tab === 'tracks' && collection.items.length > 0 && (
            <LibraryTracksList
              key={datasetKey}
              tracks={collection}
              listMaxHeight={trackListMaxHeight}
              revealKey={datasetKey}
              onPlayTrack={(track) => player.playTracks([track])}
            />
          )}

          {tab !== 'tracks' && collection.items.length > 0 && (
            <>
              <div
                className={density === 'compact'
                  ? compactGridClass(showInlineDetail)
                  : comfortableGridClass(showInlineDetail)}
              >
                {batchStarts.map((start, batchIndex) => {
                  const end = batchStarts[batchIndex + 1] ?? collection.items.length;
                  const batchKey = batchIndex === 0 ? datasetKey : `${datasetKey}:batch-${start}`;
                  return (
                    <RevealStaggerGroup
                      key={batchKey}
                      revealKey={batchKey}
                      className="contents"
                    >
                      {collection.items.slice(start, end).map((item) => (
                        <RevealItem key={item.ratingKey}>
                          <MediaCard
                            item={item}
                            kind={tab === 'artists' ? 'artist' : 'album'}
                            density={density}
                            selected={selection?.key === item.ratingKey}
                            onOpen={() => openDetail(tab === 'artists' ? 'artist' : 'album', item)}
                            onPlay={() => void playCollectionItem(tab === 'artists' ? 'artist' : 'album', item)}
                          />
                        </RevealItem>
                      ))}
                    </RevealStaggerGroup>
                  );
                })}
              </div>
              <InfiniteListBoundary
                hasMore={collection.hasMore}
                loading={collection.loading}
                loadingMore={collection.loadingMore}
                error={collection.error && collection.items.length > 0 ? collection.error : ''}
                onLoadMore={collection.loadMore}
                onRetry={collection.retry}
                endLabel={`${collection.items.length} ${tab} loaded`}
              />
            </>
          )}
        </section>

        {showInlineDetail && selection && (
          <LibraryDetailPane
            selection={selection}
            mode="inline"
            playerActive={Boolean(player.current)}
            artistParent={artistParent}
            onClose={closeDetail}
            onBackToArtist={() => {
              if (!artistParent) return;
              updateParams({
                dtype: 'artist',
                dkey: artistParent.key,
                dtitle: artistParent.title ?? null,
                dart: artistParent.artUrl ?? null,
                dartist: null,
                aparent: null,
                aparentTitle: null,
              });
            }}
            onOpenAlbum={(album) => openDetail('album', album, selection.type === 'artist' ? selection : artistParent)}
          />
        )}
      </div>

      {showSheetDetail && selection && (
        <LibraryDetailPane
          selection={selection}
          mode="sheet"
          playerActive={Boolean(player.current)}
          artistParent={artistParent}
          onClose={closeDetail}
          onBackToArtist={() => {
            if (!artistParent) return;
            updateParams({
              dtype: 'artist',
              dkey: artistParent.key,
              dtitle: artistParent.title ?? null,
              dart: artistParent.artUrl ?? null,
              dartist: null,
              aparent: null,
              aparentTitle: null,
            });
          }}
          onOpenAlbum={(album) => openDetail('album', album, selection.type === 'artist' ? selection : artistParent)}
        />
      )}
    </div>
  );
}
