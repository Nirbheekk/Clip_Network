'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Eye, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AppShell } from '@/components/layout/AppShell';
import { useAuth } from '@/components/providers/AuthProvider';
import { apiRequest, type ClipJob } from '@/lib/saas-types';

export default function ApprovalsQueuePage() {
  const { token, notify } = useAuth();
  const [clips, setClips] = useState<ClipJob[]>([]);

  const load = useCallback(async () => {
    if (!token) return;
    const res = await apiRequest<ClipJob[]>('/api/v1/clips', { token });
    if (res.ok && res.json.data) {
      setClips(res.json.data.filter((c) => c.approvalStatus === 'AWAITING_APPROVAL'));
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function decide(id: string, decision: 'APPROVED' | 'REJECTED') {
    if (!token) return;
    const res = await apiRequest(`/api/v1/clips/${id}/decision`, {
      method: 'POST',
      token,
      body: { decision },
    });
    if (res.ok) {
      await load();
      notify(`Clip ${decision.toLowerCase()}.`, 'success');
    }
  }

  return (
    <AppShell
      title="Approval Queue"
      subtitle="Human approval is enforced by default before clips release to linked accounts."
      breadcrumb="OPERATIONS / APPROVAL QUEUE"
    >
      {clips.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-12 text-center space-y-2">
          <p className="text-sm font-medium">All caught up</p>
          <p className="text-xs text-muted-foreground">No clips are currently awaiting human approval.</p>
        </div>
      ) : (
        <div className="divide-y divide-border rounded-lg border border-border bg-card">
          {clips.map((c) => (
            <div key={c.id} className="flex flex-wrap items-center justify-between gap-4 p-4">
              <div className="space-y-1">
                <div className="text-sm font-medium">{c.title}</div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
                  <span>{c.creator?.displayName ?? 'Creator'}</span>
                  <span>•</span>
                  <span>Score {c.complianceScore}/100</span>
                  <span>•</span>
                  <span>{c.durationSec}s</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{c.compliancePassed ? 'COMPLIANT' : 'BLOCKED'}</Badge>
                <Button size="sm" variant="ghost" asChild>
                  <Link href={`/clips/${c.id}`}><Eye className="mr-1 h-3.5 w-3.5" /> Inspect</Link>
                </Button>
                <Button size="sm" disabled={!c.compliancePassed} onClick={() => decide(c.id, 'APPROVED')}>
                  <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Approve
                </Button>
                <Button size="sm" variant="outline" onClick={() => decide(c.id, 'REJECTED')}>
                  <XCircle className="mr-1 h-3.5 w-3.5" /> Reject
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}
