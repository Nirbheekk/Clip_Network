'use client';

import React, { useEffect, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { useAuth } from '@/components/providers/AuthProvider';
import { apiRequest } from '@/lib/saas-types';

interface AnalyticsData {
  scope: string;
  disclaimer: string;
  totals: {
    totalClips: number;
    compliantCount: number;
    compliancePassRate: number;
    approvedCount: number;
    approvalRate: number;
    pendingCount: number;
    failedCount: number;
    avgDurationMs: number;
    totalPosts: number;
    publishedCount: number;
    publishSuccessRate: number;
    clipsUsedThisPeriod: number;
    monthlyClipLimit: number;
  };
  byCreator: Array<{
    id: string;
    displayName: string;
    handle: string;
    platform: string;
    clipsCount: number;
    routesCount: number;
  }>;
}

export default function AnalyticsPage() {
  const { token } = useAuth();
  const [data, setData] = useState<AnalyticsData | null>(null);

  useEffect(() => {
    if (!token) return;
    void apiRequest<AnalyticsData>('/api/v1/analytics', { token }).then((res) => {
      if (res.ok && res.json.data) setData(res.json.data);
    });
  }, [token]);

  return (
    <AppShell
      title="Operational Analytics"
      subtitle="Real Clip Network pipeline telemetry computed directly from your workspace database."
      breadcrumb="OBSERVABILITY / ANALYTICS"
    >
      {!data ? (
        <p className="text-xs text-muted-foreground">Loading operational analytics...</p>
      ) : (
        <div className="space-y-6">
          <div className="rounded-md border border-border bg-card px-4 py-3 text-xs text-muted-foreground">
            <strong className="text-foreground">Scope ({data.scope}):</strong> {data.disclaimer}
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: 'Total Clips Generated', value: data.totals.totalClips },
              { label: 'Compliance Pass Rate', value: `${data.totals.compliancePassRate}%` },
              { label: 'Approval Rate', value: `${data.totals.approvalRate}%` },
              { label: 'Avg Engine Duration', value: `${data.totals.avgDurationMs}ms` },
              { label: 'Publish Success Rate', value: `${data.totals.publishSuccessRate}%` },
              { label: 'Published Posts', value: data.totals.publishedCount },
              { label: 'Pending Approvals', value: data.totals.pendingCount },
              { label: 'Failed Executions', value: data.totals.failedCount },
            ].map((m) => (
              <div key={m.label} className="rounded-lg border border-border bg-card p-5 space-y-1">
                <div className="text-xs text-muted-foreground">{m.label}</div>
                <div className="font-display text-2xl font-semibold tabular-nums">{m.value}</div>
              </div>
            ))}
          </div>

          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <div className="border-b border-border px-5 py-3.5 text-sm font-display font-semibold">
              Activity by Creator
            </div>
            {data.byCreator.length === 0 ? (
              <div className="p-6 text-xs text-muted-foreground">No creators tagged yet.</div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="border-b border-border font-mono text-muted-foreground">
                  <tr>
                    <th className="p-3.5">Creator</th>
                    <th className="p-3.5">Platform</th>
                    <th className="p-3.5">Clips Generated</th>
                    <th className="p-3.5">Active Routes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border tabular-nums">
                  {data.byCreator.map((c) => (
                    <tr key={c.id}>
                      <td className="p-3.5 font-medium">{c.displayName} (@{c.handle})</td>
                      <td className="p-3.5 font-mono">{c.platform}</td>
                      <td className="p-3.5 font-mono">{c.clipsCount}</td>
                      <td className="p-3.5 font-mono">{c.routesCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </AppShell>
  );
}
