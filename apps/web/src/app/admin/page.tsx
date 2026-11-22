'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { RefreshCw } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AppShell } from '@/components/layout/AppShell';
import { AdminSubnav } from '@/components/admin/AdminSubnav';
import { useAuth } from '@/components/providers/AuthProvider';
import { apiRequest } from '@/lib/saas-types';

interface ControlCenterData {
  kpis: {
    totalUsers: number;
    activeUsers: number;
    suspendedUsers: number;
    verifiedUsers: number;
    totalWorkspaces: number;
    payingWorkspaces: number;
    pastDueWorkspaces: number;
    mrrUsd: number;
    collectedRevenueUsd: number;
    activeSessionsCount: number;
    openTickets: number;
    highPriorityOpenTickets: number;
    monitoredCreatorsCount: number;
    detectedVideosCount: number;
    totalClips: number;
    completedClips: number;
    failedClips: number;
    pendingApprovalClips: number;
    compliancePassRatePct: number;
    avgClipDurationMs: number;
    totalPosts: number;
    publishedLivePosts: number;
    publishedSandboxPosts: number;
    failedPosts: number;
    blockedPosts: number;
    totalTrackedViews: number;
    estStorageMb: number;
  };
  planEconomics: Array<{
    tier: string;
    name: string;
    workspaces: number;
    activeWorkspaces: number;
    mrrUsd: number;
    clipsUsed: number;
    estCogsUsd: number;
    grossProfitUsd: number;
  }>;
  watchlist: Array<{
    workspaceId: string;
    workspaceName: string;
    ownerEmail: string;
    planTier: string;
    subscriptionStatus: string;
    quotaPct: number;
    clipsUsed: number;
    monthlyLimit: number;
    signal: string;
  }>;
  funnel: Array<{ eventName: string; count: number }>;
  integrations: Array<{ name: string; mode: string; live: boolean; detail: string }>;
}

export default function AdminControlCenterOverviewPage() {
  const { token } = useAuth();
  const [data, setData] = useState<ControlCenterData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    const res = await apiRequest<ControlCenterData>('/api/v1/admin/control-center', { token });
    if (res.ok && res.json.data) setData(res.json.data);
    setLoading(false);
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <AppShell
      title="Super Admin Control Center"
      subtitle="Platform-wide SaaS observability, revenue intelligence, operations & governance."
      breadcrumb="ADMIN / PLATFORM OVERVIEW"
      requireSuperAdmin
      actions={
        <Button size="sm" variant="outline" onClick={load} disabled={loading}>
          <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      }
    >
      <AdminSubnav />

      {!data ? (
        <p className="text-xs font-mono text-muted-foreground">Loading platform telemetry...</p>
      ) : (
        <div className="space-y-6">
          {/* Top-Level Executive KPI Grid */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                label: 'Users (Active / Total)',
                value: `${data.kpis.activeUsers} / ${data.kpis.totalUsers}`,
                sub: `${data.kpis.verifiedUsers} verified • ${data.kpis.suspendedUsers} suspended`,
              },
              {
                label: 'Workspaces (Paying / Total)',
                value: `${data.kpis.payingWorkspaces} / ${data.kpis.totalWorkspaces}`,
                sub: `${data.kpis.pastDueWorkspaces} past due`,
              },
              {
                label: 'Est. MRR / Collected',
                value: `$${data.kpis.mrrUsd.toLocaleString()}`,
                sub: `$${data.kpis.collectedRevenueUsd.toLocaleString()} paid invoices`,
              },
              {
                label: 'Clips Processed',
                value: data.kpis.totalClips.toLocaleString(),
                sub: `${data.kpis.compliancePassRatePct}% compliant • ${data.kpis.failedClips} failed • ${data.kpis.avgClipDurationMs}ms avg`,
              },
              {
                label: 'Social Publishing',
                value: `${data.kpis.publishedLivePosts + data.kpis.publishedSandboxPosts} / ${data.kpis.totalPosts}`,
                sub: `${data.kpis.publishedLivePosts} live • ${data.kpis.publishedSandboxPosts} sandbox • ${data.kpis.failedPosts} failed`,
              },
              {
                label: 'Channel Monitoring',
                value: data.kpis.detectedVideosCount.toLocaleString(),
                sub: `${data.kpis.monitoredCreatorsCount} monitored channels`,
              },
              {
                label: 'Active Sessions & Storage',
                value: `${data.kpis.activeSessionsCount} sessions`,
                sub: `~${data.kpis.estStorageMb} MB est. rendered media`,
              },
              {
                label: 'Open Support Tickets',
                value: data.kpis.openTickets,
                sub: `${data.kpis.highPriorityOpenTickets} high priority`,
              },
            ].map((k) => (
              <div key={k.label} className="rounded-lg border border-border bg-card p-4 space-y-1">
                <div className="text-[11px] text-muted-foreground">{k.label}</div>
                <div className="font-display text-2xl font-semibold tabular-nums">{k.value}</div>
                <div className="font-mono text-[10px] text-muted-foreground">{k.sub}</div>
              </div>
            ))}
          </div>

          {/* Business Intelligence Charts Row */}
          <div className="grid gap-6 lg:grid-cols-12">
            <div className="lg:col-span-7 rounded-lg border border-border bg-card p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-display text-sm font-semibold">Revenue vs Estimated COGS by Plan</h2>
                  <p className="text-[11px] text-muted-foreground">Live MRR against variable clip COGS ($0.013/clip)</p>
                </div>
                <Link href="/admin/subscriptions" className="text-xs text-primary hover:underline">
                  Unit economics →
                </Link>
              </div>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.planEconomics}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                    <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        borderColor: 'hsl(var(--border))',
                        fontSize: '12px',
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                    <Bar dataKey="mrrUsd" name="MRR (USD)" fill="#D4FF00" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="estCogsUsd" name="Est. COGS (USD)" fill="#F43F5E" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="lg:col-span-5 rounded-lg border border-border bg-card p-5 space-y-3">
              <h2 className="font-display text-sm font-semibold">Conversion Funnel Telemetry</h2>
              <div className="h-64 w-full">
                {data.funnel.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-xs text-muted-foreground border border-dashed border-border rounded">
                    No funnel events captured yet.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.funnel} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis type="number" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                      <YAxis
                        dataKey="eventName"
                        type="category"
                        width={130}
                        tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          borderColor: 'hsl(var(--border))',
                          fontSize: '12px',
                        }}
                      />
                      <Bar dataKey="count" name="Events" fill="#D4FF00" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>

          {/* Integration Health Matrix + Churn Risk Watchlist */}
          <div className="grid gap-6 lg:grid-cols-12">
            <div className="lg:col-span-6 rounded-lg border border-border bg-card overflow-hidden">
              <div className="border-b border-border px-5 py-3.5 flex items-center justify-between">
                <h2 className="font-display text-sm font-semibold">Integration &amp; Worker Health</h2>
                <Link href="/admin/operations" className="text-xs text-primary hover:underline">
                  Operations →
                </Link>
              </div>
              <div className="divide-y divide-border">
                {data.integrations.map((intg) => (
                  <div key={intg.name} className="flex items-center justify-between px-5 py-3 text-xs">
                    <div>
                      <div className="font-medium">{intg.name}</div>
                      <div className="text-[11px] text-muted-foreground">{intg.detail}</div>
                    </div>
                    <Badge variant={intg.live ? 'default' : 'outline'} className="font-mono text-[10px]">
                      {intg.mode}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:col-span-6 rounded-lg border border-border bg-card overflow-hidden">
              <div className="border-b border-border px-5 py-3.5 flex items-center justify-between">
                <h2 className="font-display text-sm font-semibold">
                  Churn Risk &amp; Quota Pressure Watchlist ({data.watchlist.length})
                </h2>
                <Link href="/admin/workspaces" className="text-xs text-primary hover:underline">
                  All workspaces →
                </Link>
              </div>
              {data.watchlist.length === 0 ? (
                <div className="p-6 text-xs text-muted-foreground">
                  No workspaces are currently past due, cancelled, or above 80% monthly clip quota.
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {data.watchlist.map((w) => (
                    <div key={w.workspaceId} className="flex items-center justify-between px-5 py-3 text-xs">
                      <div>
                        <div className="font-medium">{w.workspaceName}</div>
                        <div className="font-mono text-[11px] text-muted-foreground">
                          {w.ownerEmail} • {w.planTier} ({w.clipsUsed}/{w.monthlyLimit} clips)
                        </div>
                      </div>
                      <Badge
                        variant={w.signal === 'QUOTA_PRESSURE' ? 'secondary' : 'destructive'}
                        className="font-mono text-[10px]"
                      >
                        {w.signal}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
