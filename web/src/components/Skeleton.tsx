import type { ReactNode } from 'react';

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton ${className}`.trim()} />;
}

interface SkeletonStackProps {
  count: number;
  gap?: string;
  className?: string;
  label?: string;
  children?: (index: number) => ReactNode;
  itemClassName?: string;
}

export function SkeletonStack({
  count,
  gap = 'space-y-2',
  className = '',
  label = 'Loading…',
  children,
  itemClassName,
}: SkeletonStackProps) {
  return (
    <div className={`${gap} ${className}`.trim()} role="status" aria-busy="true">
      <span className="sr-only">{label}</span>
      {Array.from({ length: count }, (_, index) =>
        children
          ? children(index)
          : <Skeleton key={index} className={itemClassName ?? 'h-14'} />,
      )}
    </div>
  );
}

export function TrackRowSkeleton({
  index,
  showDuration = true,
  showActions = true,
}: {
  index?: number;
  showDuration?: boolean;
  showActions?: boolean;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-xl bg-surface-muted/40 px-3 py-2.5">
      {index !== undefined && (
        <Skeleton className="hidden h-4 w-6 sm:block" />
      )}
      <Skeleton className="h-11 w-11 shrink-0 sm:h-12 sm:w-12" />
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-4 w-3/5 max-w-xs" />
        <Skeleton className="h-3 w-2/5 max-w-[10rem]" />
      </div>
      {showDuration && <Skeleton className="hidden h-3 w-8 shrink-0 sm:block" />}
      {showActions && <Skeleton className="h-9 w-9 shrink-0 rounded-full sm:h-10 sm:w-10" />}
    </div>
  );
}

export function PlaylistItemSkeleton() {
  return (
    <div className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5">
      <Skeleton className="h-10 w-10 shrink-0" />
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-4 w-2/3 max-w-[12rem]" />
        <Skeleton className="h-3 w-16" />
      </div>
    </div>
  );
}

export function MediaCardSkeleton({ variant = 'grid' }: { variant?: 'grid' | 'compact' }) {
  if (variant === 'compact') {
    return (
      <div className="flex items-center gap-3 rounded-xl p-2">
        <Skeleton className="h-12 w-12 shrink-0 sm:h-14 sm:w-14" />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-4 w-3/5" />
          <Skeleton className="h-3 w-2/5" />
        </div>
      </div>
    );
  }

  return <Skeleton className="aspect-square w-full" />;
}

export function ActivityRowSkeleton() {
  return (
    <div className="flex h-11 items-center justify-between gap-4 border-b border-white/5 px-3 py-2">
      <Skeleton className="h-4 w-2/5 max-w-xs" />
      <Skeleton className="h-3 w-16 shrink-0" />
    </div>
  );
}

export function StatusCardSkeleton() {
  return (
    <div className="rounded-xl bg-surface-muted/50 p-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-12" />
      </div>
      <Skeleton className="mt-3 h-4 w-3/5" />
    </div>
  );
}

export function ServerOptionSkeleton() {
  return (
    <div className="rounded-xl bg-surface-muted/50 px-4 py-3">
      <Skeleton className="h-4 w-40" />
      <Skeleton className="mt-2 h-3 w-56 max-w-full" />
    </div>
  );
}

export function PlaylistHeaderSkeleton() {
  return (
    <div className="flex min-w-0 items-center gap-4">
      <Skeleton className="h-20 w-20 shrink-0 sm:h-24 sm:w-24" />
      <div className="min-w-0 space-y-2">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-7 w-48 max-w-full" />
        <Skeleton className="h-4 w-24" />
      </div>
    </div>
  );
}

export function SettingsCardSkeleton() {
  return (
    <div className="card space-y-4 p-6">
      <Skeleton className="h-6 w-48" />
      <Skeleton className="h-4 w-full max-w-md" />
      <Skeleton className="h-10 w-full max-w-xs" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
    </div>
  );
}

export function SearchGroupSkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-5 w-24" />
      <TrackRowSkeleton showDuration={false} showActions={false} />
      <TrackRowSkeleton showDuration={false} showActions={false} />
    </div>
  );
}

export function AppBootstrapSkeleton() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-4" role="status" aria-busy="true">
      <span className="sr-only">Loading…</span>
      <Skeleton className="h-12 w-12 rounded-2xl" />
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-32 w-full max-w-sm rounded-2xl" />
    </div>
  );
}

export function DashboardPageSkeleton() {
  return (
    <div className="space-y-6" role="status" aria-busy="true">
      <span className="sr-only">Loading…</span>
      <section className="card space-y-4 p-6">
        <Skeleton className="h-6 w-40" />
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <StatusCardSkeleton key={index} />
          ))}
        </div>
      </section>
      <section className="card space-y-4 p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-28" />
        </div>
        <div className="mt-4 max-h-96 overflow-hidden rounded-xl border border-white/5">
          {Array.from({ length: 6 }).map((_, index) => (
            <ActivityRowSkeleton key={index} />
          ))}
        </div>
      </section>
    </div>
  );
}

export function SettingsPageSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]" role="status" aria-busy="true">
      <span className="sr-only">Loading…</span>
      <div className="space-y-6">
        <div className="card p-4">
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-9 w-28" />
            ))}
          </div>
        </div>
        <SettingsCardSkeleton />
        <SettingsCardSkeleton />
      </div>
      <div className="card space-y-4 p-6">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    </div>
  );
}
