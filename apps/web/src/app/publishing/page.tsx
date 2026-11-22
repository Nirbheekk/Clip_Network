'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AppShell } from '@/components/layout/AppShell';
import { useAuth } from '@/components/providers/AuthProvider';
import { apiRequest, type PublishPost } from '@/lib/saas-types';

export default function PublishingQueuePage() {
  const { token, notify } = useAuth();
  const [posts, setPosts] = useState<PublishPost[]>([]);

  const load = useCallback(async () => {
    if (!token) return;
    const res = await apiRequest<PublishPost[]>('/api/v1/publish-queue', { token });
    if (res.ok && res.json.data) setPosts(res.json.data);
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function publishNow(id: string) {
    if (!token) return;
    const res = await apiRequest(`/api/v1/publish-queue/${id}/publish`, { method: 'POST', token });
    if (res.ok) {
      await load();
      notify('Publish action executed idempotently.', 'success');
    }
  }

  return (
    <AppShell
      title="Publishing Queue"
      subtitle="Idempotent delivery tracking with transparent SANDBOX_SIMULATED vs LIVE_OAUTH status."
      breadcrumb="OPERATIONS / PUBLISHING"
    >
      {posts.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-12 text-center text-xs text-muted-foreground">
          No posts queued yet. Route a creator to a social account and ingest a compliant clip.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border font-mono text-muted-foreground">
              <tr>
                <th className="p-3.5">Clip</th>
                <th className="p-3.5">Destination</th>
                <th className="p-3.5">Mode</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5">External ID</th>
                <th className="p-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {posts.map((p) => (
                <tr key={p.id}>
                  <td className="p-3.5 font-medium">{p.clipJob?.title ?? 'Clip'}</td>
                  <td className="p-3.5">
                    <div>{p.socialAccount?.accountHandle}</div>
                    <div className="font-mono text-[10px] text-muted-foreground">{p.platform}</div>
                  </td>
                  <td className="p-3.5 font-mono text-[11px]">{p.executionMode}</td>
                  <td className="p-3.5">
                    <Badge variant={p.status.startsWith('PUBLISHED') ? 'default' : 'outline'}>
                      {p.status}
                    </Badge>
                  </td>
                  <td className="p-3.5 font-mono text-[11px] text-muted-foreground">
                    {p.externalPostId ?? '—'}
                  </td>
                  <td className="p-3.5 text-right">
                    {p.status === 'AWAITING_APPROVAL' && (
                      <Button size="sm" onClick={() => publishNow(p.id)}>
                        <Send className="mr-1.5 h-3 w-3" /> Publish
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AppShell>
  );
}
