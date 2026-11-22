'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { AppShell } from '@/components/layout/AppShell';
import { useAuth } from '@/components/providers/AuthProvider';
import { apiRequest, type ClipJob } from '@/lib/saas-types';

export default function ActivityPage() {
  const { token } = useAuth();
  const [clips, setClips] = useState<ClipJob[]>([]);
  const [q, setQ] = useState('');

  useEffect(() => {
    if (!token) return;
    void apiRequest<ClipJob[]>('/api/v1/clips', { token }).then((res) => {
      if (res.ok && res.json.data) setClips(res.json.data);
    });
  }, [token]);

  const filtered = clips.filter(
    (c) =>
      !q.trim() ||
      c.id.toLowerCase().includes(q.toLowerCase()) ||
      c.title.toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <AppShell
      title="Execution History"
      subtitle="Inspect every clip engine execution, processing duration, and compliance outcome."
      breadcrumb="OBSERVABILITY / EXECUTIONS"
    >
      <div className="space-y-4">
        <Input
          placeholder="Filter by execution ID or clip title..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="max-w-sm h-9 text-xs"
        />

        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground">
              No engine executions recorded yet.
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border font-mono text-muted-foreground">
                <tr>
                  <th className="p-3.5">Execution ID</th>
                  <th className="p-3.5">Clip Title</th>
                  <th className="p-3.5">Creator</th>
                  <th className="p-3.5">Duration</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5">Compliance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((c) => (
                  <tr key={c.id} className="hover:bg-secondary/30">
                    <td className="p-3.5 font-mono text-[11px]">
                      <Link href={`/clips/${c.id}`} className="text-primary hover:underline">
                        {c.id.slice(0, 8)}…
                      </Link>
                    </td>
                    <td className="p-3.5 font-medium">{c.title}</td>
                    <td className="p-3.5 text-muted-foreground">{c.creator?.displayName ?? '—'}</td>
                    <td className="p-3.5 font-mono">{c.durationMs}ms</td>
                    <td className="p-3.5"><Badge variant="outline">{c.executionStatus}</Badge></td>
                    <td className="p-3.5 font-mono">{c.complianceScore}/100</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </AppShell>
  );
}
