import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { ActivityFeed } from '../components/ActivityFeed';
import { DashboardPageSkeleton } from '../components/Skeleton';

export function DashboardPage() {
  const [status, setStatus] = useState<{
    settings: { publicUrl: string | null; alexaSkillId: string | null; invocationName: string };
    plex: { ok: boolean; name?: string };
    public: { reachable: boolean };
    alexa: { skillIdConfigured: boolean };
  } | null>(null);

  useEffect(() => {
    api<typeof status>('/api/status').then(setStatus).catch(() => setStatus(null));
  }, []);

  if (!status) return <DashboardPageSkeleton />;

  return (
    <div className="space-y-6">
      <section className="card p-6">
        <h2 className="text-xl font-semibold">Service health</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <StatusCard label="Plex" ok={status.plex.ok} detail={status.plex.name ?? 'Not connected'} />
          <StatusCard label="Public HTTPS" ok={status.public.reachable} detail={status.settings.publicUrl ?? 'Not set'} />
          <StatusCard label="Alexa skill" ok={status.alexa.skillIdConfigured} detail={status.settings.alexaSkillId ?? 'Not set'} />
        </div>
      </section>

      <section className="card p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-xl font-semibold">Recent activity</h2>
          <p className="text-sm text-muted">Updates every 30s</p>
        </div>
        <ActivityFeed />
      </section>
    </div>
  );
}

function StatusCard({ label, ok, detail }: { label: string; ok: boolean; detail: string }) {
  return (
    <div className="rounded-xl bg-surface-muted/50 p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">{label}</p>
        <span className={`text-xs font-medium ${ok ? 'text-success' : 'text-danger'}`}>{ok ? 'OK' : 'Needs setup'}</span>
      </div>
      <p className="mt-2 text-sm">{detail}</p>
    </div>
  );
}
