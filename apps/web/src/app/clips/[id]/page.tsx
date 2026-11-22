'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { CheckCircle2, RotateCcw, ShieldAlert, ShieldCheck, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AppShell } from '@/components/layout/AppShell';
import { useAuth } from '@/components/providers/AuthProvider';
import { apiRequest, type ClipJob, type PublishPost } from '@/lib/saas-types';

interface ClipDetail extends ClipJob {
  assScript: string;
  transcript: string;
  sfxCues: Array<{ presetId?: string; atSec?: number }>;
  publishPosts: PublishPost[];
}

export default function ClipReviewStudioPage() {
  const { id } = useParams<{ id: string }>();
  const { token, notify } = useAuth();
  const [clip, setClip] = useState<ClipDetail | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!token || !id) return;
    const res = await apiRequest<ClipDetail>(`/api/v1/clips/${id}`, { token });
    if (res.ok && res.json.data) setClip(res.json.data);
  }, [token, id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function decide(decision: 'APPROVED' | 'REJECTED') {
    if (!token || !id) return;
    setBusy(true);
    const res = await apiRequest(`/api/v1/clips/${id}/decision`, {
      method: 'POST',
      token,
      body: { decision },
    });
    setBusy(false);
    if (res.ok) {
      await load();
      notify(`Clip ${decision.toLowerCase()}.`, 'success');
    } else {
      notify(typeof res.json.error === 'string' ? res.json.error : 'Action failed.', 'error');
    }
  }

  async function lifecycleAction(action: 'cancel' | 'retry') {
    if (!token || !id) return;
    setBusy(true);
    const res = await apiRequest(`/api/v1/clips/${id}/${action}`, { method: 'POST', token });
    setBusy(false);
    if (res.ok) {
      await load();
      notify(`Execution ${action === 'cancel' ? 'cancelled' : 'retried'}.`, 'info');
    }
  }

  return (
    <AppShell
      title={clip?.title ?? 'Clip Review Studio'}
      subtitle={clip ? `${clip.creator?.displayName ?? 'Creator'} • ${clip.durationSec}s • ${clip.layout}` : undefined}
      breadcrumb="OPERATIONS / REVIEW STUDIO"
      actions={
        clip && (
          <div className="flex items-center gap-2">
            {clip.approvalStatus === 'AWAITING_APPROVAL' && clip.compliancePassed && (
              <>
                <Button size="sm" onClick={() => decide('APPROVED')} disabled={busy}>
                  <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> Approve &amp; Release
                </Button>
                <Button size="sm" variant="outline" onClick={() => decide('REJECTED')} disabled={busy}>
                  <XCircle className="mr-1.5 h-3.5 w-3.5" /> Reject
                </Button>
              </>
            )}
            {clip.executionStatus !== 'CANCELLED' ? (
              <Button size="sm" variant="ghost" onClick={() => lifecycleAction('cancel')} disabled={busy}>
                Cancel Job
              </Button>
            ) : (
              <Button size="sm" variant="outline" onClick={() => lifecycleAction('retry')} disabled={busy}>
                <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Retry
              </Button>
            )}
          </div>
        )
      }
    >
      {!clip ? (
        <p className="text-xs text-muted-foreground">Loading clip details...</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-12">
          {/* Left: Vertical Preview Surface & Engine Logs */}
          <div className="lg:col-span-7 space-y-6">
            <div className="rounded-lg border border-border bg-card p-6 grid gap-6 sm:grid-cols-12 items-center">
              <div className="sm:col-span-5 aspect-[9/16] rounded-md border border-border bg-background p-4 flex flex-col justify-between">
                <div className="flex justify-between font-mono text-[10px] text-muted-foreground">
                  <span>9:16</span>
                  <span>{clip.durationSec}s</span>
                </div>
                <div className="space-y-3 text-center">
                  <div className="text-[10px] font-mono uppercase text-muted-foreground">
                    {clip.layout}
                  </div>
                  <div className="rounded border border-primary/50 bg-card px-2.5 py-2 font-display text-xs font-bold uppercase">
                    {clip.title}
                  </div>
                  <div className="text-[10px] font-mono text-muted-foreground">
                    {clip.captionStyle} • {clip.sfxCues.length} SFX cues
                  </div>
                </div>
                <div className="font-mono text-[10px] text-muted-foreground text-center">
                  0 ADDED LOGOS
                </div>
              </div>

              <div className="sm:col-span-7 space-y-3 text-xs">
                <div className="font-mono text-[11px] uppercase text-muted-foreground">
                  Aligned Transcript
                </div>
                <p className="leading-relaxed text-foreground">{clip.transcript}</p>
                <div className="border-t border-border pt-3 space-y-1 text-muted-foreground font-mono text-[11px]">
                  <div>Source: {clip.sourceUrl}</div>
                  <div>Execution: {clip.executionStatus} ({clip.durationMs}ms)</div>
                  <div>Approval: {clip.approvalStatus}</div>
                </div>
              </div>
            </div>

            {/* Timestamped Engine Logs */}
            <div className="rounded-lg border border-border bg-card overflow-hidden">
              <div className="border-b border-border px-4 py-3 text-xs font-mono text-muted-foreground">
                ENGINE EXECUTION LOGS
              </div>
              <div className="p-4 bg-background/70 font-mono text-[11px] space-y-1 text-muted-foreground overflow-x-auto">
                {clip.executionLogs.map((line, i) => (
                  <div key={i}>{line}</div>
                ))}
              </div>
            </div>
          </div>

          {/* Right: Compliance Inspector & Publishing Destinations */}
          <div className="lg:col-span-5 space-y-6">
            <div className="rounded-lg border border-border bg-card p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-sm font-semibold flex items-center gap-2">
                  {clip.compliancePassed ? (
                    <ShieldCheck className="h-4 w-4 text-primary" />
                  ) : (
                    <ShieldAlert className="h-4 w-4 text-destructive" />
                  )}
                  Compliance Evaluation
                </h2>
                <Badge variant={clip.compliancePassed ? 'default' : 'destructive'} className="font-mono">
                  {clip.complianceScore} / 100
                </Badge>
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Matched Topics</span>
                  <span className="font-mono">
                    {clip.complianceReport.matchedTopics.join(', ') || 'None'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Disqualifiers</span>
                  <span className="font-mono">
                    {clip.complianceReport.disqualifiersTriggered.join(', ') || '0'}
                  </span>
                </div>
                {clip.complianceReport.reasons.length > 0 && (
                  <ul className="list-disc pl-4 text-destructive pt-1 space-y-1">
                    {clip.complianceReport.reasons.map((r) => <li key={r}>{r}</li>)}
                  </ul>
                )}
              </div>
            </div>

            <div className="rounded-lg border border-border bg-card p-5 space-y-3">
              <h2 className="font-display text-sm font-semibold">
                Routed Destinations ({clip.publishPosts.length})
              </h2>
              {clip.publishPosts.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No publishing destinations routed. Create a routing rule for this creator under Routing Rules.
                </p>
              ) : (
                <div className="space-y-2">
                  {clip.publishPosts.map((p) => (
                    <div key={p.id} className="rounded border border-border p-3 text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{p.socialAccount?.accountHandle}</span>
                        <Badge variant={p.status.startsWith('PUBLISHED') ? 'default' : 'outline'}>
                          {p.status}
                        </Badge>
                      </div>
                      <div className="font-mono text-[10px] text-muted-foreground">
                        {p.platform} • {p.executionMode}
                      </div>
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
