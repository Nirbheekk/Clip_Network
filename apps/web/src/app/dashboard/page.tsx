'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, CheckSquare, Plus, Send, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AppShell } from '@/components/layout/AppShell';
import { useAuth } from '@/components/providers/AuthProvider';
import { apiRequest, type ClipJob, type PublishPost } from '@/lib/saas-types';

interface SummaryPayload {
  metrics: {
    totalExecutions: number;
    completedExecutions: number;
    failedExecutions: number;
    cancelledExecutions: number;
    compliantClips: number;
    creatorsCount: number;
    accountsCount: number;
    postsCount: number;
    clipsUsedThisPeriod: number;
    monthlyClipLimit: number;
    remainingQuota: number;
  };
  recentActivity: Array<{ id: string; action: string; entityType: string; createdAt: string }>;
}

export default function DashboardPage() {
  const { token, workspace } = useAuth();
  const [summary, setSummary] = useState<SummaryPayload | null>(null);
  const [clips, setClips] = useState<ClipJob[]>([]);
  const [posts, setPosts] = useState<PublishPost[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    const [sRes, cRes, pRes] = await Promise.all([
      apiRequest<SummaryPayload>('/api/v1/dashboard/summary', { token }),
      apiRequest<ClipJob[]>('/api/v1/clips', { token }),
      apiRequest<PublishPost[]>('/api/v1/publish-queue', { token }),
    ]);
    if (sRes.ok && sRes.json.data) setSummary(sRes.json.data);
    if (cRes.ok && cRes.json.data) setClips(cRes.json.data);
    if (pRes.ok && pRes.json.data) setPosts(pRes.json.data);
    setLoading(false);
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const pendingApprovals = clips.filter((c) => c.approvalStatus === 'AWAITING_APPROVAL');
  const publishedPosts = posts.filter((p) => p.status.startsWith('PUBLISHED'));

  return (
    <AppShell
      title="Operations Dashboard"
      subtitle={`Workspace overview for ${workspace?.name ?? ''}`}
      breadcrumb="WORKSPACE / DASHBOARD"
      actions={
        <Button size="sm" asChild>
          <Link href="/clips/new">
            <Plus className="mr-1.5 h-3.5 w-3.5" /> Ingest Clips
          </Link>
        </Button>
      }
    >
      <div className="space-y-6">
        {/* Primary KPI Row */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              label: 'Total Clips',
              value: summary?.metrics.totalExecutions ?? 0,
              sub: `${summary?.metrics.completedExecutions ?? 0} completed`,
            },
            {
              label: 'Pending Approval',
              value: pendingApprovals.length,
              sub: 'Human approval gate',
            },
            {
              label: 'Published Clips',
              value: publishedPosts.length,
              sub: `${summary?.metrics.postsCount ?? 0} total queued`,
            },
            {
              label: 'Failed Executions',
              value: summary?.metrics.failedExecutions ?? 0,
              sub: `${summary?.metrics.remainingQuota ?? 0} clips remaining in quota`,
            },
          ].map((k) => (
            <div key={k.label} className="rounded-lg border border-border bg-card p-5 space-y-1">
              <div className="text-xs text-muted-foreground">{k.label}</div>
              <div className="font-display text-2xl font-semibold tabular-nums">
                {loading ? '—' : k.value}
              </div>
              <div className="text-[11px] font-mono text-muted-foreground">{k.sub}</div>
            </div>
          ))}
        </div>

        {/* Quick Actions Bar */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { href: '/creators', label: 'Add Creator', desc: `${summary?.metrics.creatorsCount ?? 0} tagged`, icon: Users },
            { href: '/clips/new', label: 'Ingest Stream Clip', desc: 'Run captions + SFX engine', icon: Plus },
            { href: '/approvals', label: 'Review Pending Clips', desc: `${pendingApprovals.length} awaiting decision`, icon: CheckSquare },
            { href: '/publishing', label: 'Publishing Queue', desc: `${summary?.metrics.accountsCount ?? 0} social accounts`, icon: Send },
          ].map((q) => (
            <Link
              key={q.href}
              href={q.href}
              className="rounded-lg border border-border bg-card/60 p-4 hover:border-primary/60 transition-colors flex items-center justify-between gap-3"
            >
              <div>
                <div className="text-xs font-medium">{q.label}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">{q.desc}</div>
              </div>
              <q.icon className="h-4 w-4 text-primary shrink-0" />
            </Link>
          ))}
        </div>

        {/* Main Split: Recent Clips + Recent System Activity */}
        <div className="grid gap-6 lg:grid-cols-12">
          <div className="lg:col-span-8 rounded-lg border border-border bg-card overflow-hidden">
            <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
              <h2 className="font-display text-sm font-semibold">Recent Clip Activity</h2>
              <Link href="/clips" className="text-xs text-primary hover:underline flex items-center gap-1">
                View library <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            {clips.length === 0 ? (
              <div className="p-8 text-center space-y-3">
                <p className="text-sm font-medium">No clips ingested yet</p>
                <p className="text-xs text-muted-foreground max-w-md mx-auto">
                  Tag a creator channel first, then run your first stream ingest to generate
                  speech-aligned captions, SFX cues, and a compliance report.
                </p>
                <div className="flex justify-center gap-2 pt-1">
                  <Button size="sm" variant="outline" asChild>
                    <Link href="/creators">Tag Creator</Link>
                  </Button>
                  <Button size="sm" asChild>
                    <Link href="/clips/new">Ingest First Clip</Link>
                  </Button>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {clips.slice(0, 6).map((c) => (
                  <Link
                    key={c.id}
                    href={`/clips/${c.id}`}
                    className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 hover:bg-secondary/40 transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{c.title}</div>
                      <div className="text-xs text-muted-foreground font-mono">
                        {c.creator?.displayName ?? 'Creator'} • {c.durationSec}s • {c.durationMs}ms
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={c.compliancePassed ? 'secondary' : 'destructive'} className="font-mono text-[10px]">
                        {c.complianceScore}/100
                      </Badge>
                      <Badge variant="outline" className="font-mono text-[10px]">
                        {c.approvalStatus}
                      </Badge>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="lg:col-span-4 rounded-lg border border-border bg-card overflow-hidden">
            <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
              <h2 className="font-display text-sm font-semibold">Recent Audit Activity</h2>
              <Link href="/activity" className="text-xs text-primary hover:underline">
                All logs
              </Link>
            </div>
            <div className="divide-y divide-border">
              {(summary?.recentActivity ?? []).length === 0 ? (
                <div className="p-6 text-xs text-muted-foreground">No workspace events recorded yet.</div>
              ) : (
                (summary?.recentActivity ?? []).slice(0, 8).map((ev) => (
                  <div key={ev.id} className="px-5 py-3 text-xs space-y-0.5">
                    <div className="font-mono text-[11px] font-medium">{ev.action}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {ev.entityType} • {new Date(ev.createdAt).toLocaleTimeString()}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
