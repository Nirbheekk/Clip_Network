'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AppShell } from '@/components/layout/AppShell';
import { AdminSubnav } from '@/components/admin/AdminSubnav';
import { useAuth } from '@/components/providers/AuthProvider';
import { apiRequest } from '@/lib/saas-types';

interface JobsPayload {
  clips: Array<{
    id: string;
    title: string;
    executionStatus: string;
    approvalStatus: string;
    complianceScore: number;
    durationMs: number;
    workspace?: { name: string };
    creator?: { displayName: string };
  }>;
  posts: Array<{
    id: string;
    platform: string;
    status: string;
    executionMode: string;
    errorMessage?: string | null;
    workspace?: { name: string };
    clipJob?: { title: string };
    socialAccount?: { accountHandle: string };
  }>;
  videos: Array<{
    id: string;
    title: string;
    detectionSource: string;
    detectionStatus: string;
    workspace?: { name: string };
    creator?: { displayName: string; platform: string };
  }>;
}

export default function AdminOperationsPage() {
  const { token, notify } = useAuth();
  const [jobs, setJobs] = useState<JobsPayload | null>(null);
  const [failedOnly, setFailedOnly] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    const res = await apiRequest<JobsPayload>('/api/v1/admin/jobs', { token });
    if (res.ok && res.json.data) setJobs(res.json.data);
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function retryPost(postId: string) {
    if (!token) return;
    const res = await apiRequest(`/api/v1/admin/publish-posts/${postId}/retry`, {
      method: 'POST',
      token,
    });
    if (res.ok) {
      await load();
      notify('Admin publish retry executed.', 'success');
    }
  }

  const visibleClips = (jobs?.clips ?? []).filter(
    (c) => !failedOnly || c.executionStatus === 'FAILED' || c.approvalStatus === 'DISQUALIFIED',
  );
  const visiblePosts = (jobs?.posts ?? []).filter(
    (p) => !failedOnly || p.status === 'FAILED' || p.status === 'BLOCKED',
  );

  return (
    <AppShell
      title="Jobs, Monitoring & Publishing Ops"
      subtitle="Platform-wide clip executions, failed job triage, channel uploads, and publish retries."
      breadcrumb="ADMIN / JOBS & OPS"
      requireSuperAdmin
      actions={
        <Button
          size="sm"
          variant={failedOnly ? 'default' : 'outline'}
          onClick={() => setFailedOnly((f) => !f)}
        >
          {failedOnly ? 'Showing Failures Only' : 'Filter Failures Only'}
        </Button>
      }
    >
      <AdminSubnav />

      <div className="space-y-6">
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="border-b border-border px-5 py-3.5 text-sm font-display font-semibold">
            Platform Clip Jobs ({visibleClips.length})
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border font-mono text-muted-foreground">
                <tr>
                  <th className="p-3.5">Clip</th>
                  <th className="p-3.5">Workspace</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5">Approval</th>
                  <th className="p-3.5">Score / Duration</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border tabular-nums">
                {visibleClips.map((c) => (
                  <tr key={c.id}>
                    <td className="p-3.5 font-medium">{c.title}</td>
                    <td className="p-3.5 text-muted-foreground">{c.workspace?.name ?? '—'}</td>
                    <td className="p-3.5"><Badge variant="outline">{c.executionStatus}</Badge></td>
                    <td className="p-3.5 font-mono text-[11px]">{c.approvalStatus}</td>
                    <td className="p-3.5 font-mono">{c.complianceScore}/100 • {c.durationMs}ms</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="border-b border-border px-5 py-3.5 text-sm font-display font-semibold">
            Platform Publish Queue ({visiblePosts.length})
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border font-mono text-muted-foreground">
                <tr>
                  <th className="p-3.5">Clip &amp; Account</th>
                  <th className="p-3.5">Workspace</th>
                  <th className="p-3.5">Mode</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {visiblePosts.map((p) => (
                  <tr key={p.id}>
                    <td className="p-3.5">
                      <div className="font-medium">{p.clipJob?.title ?? 'Clip'}</div>
                      <div className="font-mono text-[10px] text-muted-foreground">
                        {p.socialAccount?.accountHandle} ({p.platform})
                      </div>
                    </td>
                    <td className="p-3.5 text-muted-foreground">{p.workspace?.name ?? '—'}</td>
                    <td className="p-3.5 font-mono text-[11px]">{p.executionMode}</td>
                    <td className="p-3.5">
                      <Badge variant={p.status === 'FAILED' || p.status === 'BLOCKED' ? 'destructive' : 'outline'}>
                        {p.status}
                      </Badge>
                    </td>
                    <td className="p-3.5 text-right">
                      {p.status === 'FAILED' && (
                        <Button size="sm" variant="outline" onClick={() => retryPost(p.id)}>
                          <RotateCcw className="mr-1.5 h-3 w-3" /> Retry
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
