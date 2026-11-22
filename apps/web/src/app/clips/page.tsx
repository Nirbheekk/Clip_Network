'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Grid2x2, List, Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { AppShell } from '@/components/layout/AppShell';
import { useAuth } from '@/components/providers/AuthProvider';
import { apiRequest, type ClipJob } from '@/lib/saas-types';

export default function ClipLibraryPage() {
  const { token } = useAuth();
  const [clips, setClips] = useState<ClipJob[]>([]);
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const load = useCallback(async () => {
    if (!token) return;
    const res = await apiRequest<ClipJob[]>('/api/v1/clips', { token });
    if (res.ok && res.json.data) setClips(res.json.data);
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = clips.filter((c) => {
    const q = search.trim().toLowerCase();
    const matchSearch =
      !q ||
      c.title.toLowerCase().includes(q) ||
      (c.creator?.displayName ?? '').toLowerCase().includes(q);
    const matchStatus = statusFilter === 'ALL' || c.approvalStatus === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <AppShell
      title="Clip Library"
      subtitle="Browse, filter, and open generated vertical shorts in the Review Studio."
      breadcrumb="OPERATIONS / CLIP LIBRARY"
      actions={
        <Button size="sm" asChild>
          <Link href="/clips/new"><Plus className="mr-1.5 h-3.5 w-3.5" /> Ingest Clip</Link>
        </Button>
      }
    >
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search clips or creators..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 text-xs"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {['ALL', 'AWAITING_APPROVAL', 'APPROVED', 'REJECTED', 'DISQUALIFIED'].map((st) => (
              <Button
                key={st}
                size="sm"
                variant={statusFilter === st ? 'default' : 'outline'}
                onClick={() => setStatusFilter(st)}
                className="h-8 text-[11px]"
              >
                {st.replace('_', ' ')}
              </Button>
            ))}
            <div className="flex rounded-md border border-border overflow-hidden">
              <button
                type="button"
                onClick={() => setView('grid')}
                className={`p-2 ${view === 'grid' ? 'bg-secondary text-foreground' : 'text-muted-foreground'}`}
                aria-label="Grid view"
              >
                <Grid2x2 className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setView('list')}
                className={`p-2 ${view === 'list' ? 'bg-secondary text-foreground' : 'text-muted-foreground'}`}
                aria-label="List view"
              >
                <List className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-12 text-center space-y-3">
            <p className="text-sm font-medium">No clips found</p>
            <p className="text-xs text-muted-foreground">Ingest a stream moment to populate your library.</p>
            <Button size="sm" asChild><Link href="/clips/new">Ingest First Clip</Link></Button>
          </div>
        ) : view === 'grid' ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((c) => (
              <Link
                key={c.id}
                href={`/clips/${c.id}`}
                className="group rounded-lg border border-border bg-card overflow-hidden hover:border-primary/60 transition-colors flex flex-col justify-between"
              >
                <div className="aspect-[16/10] bg-background border-b border-border p-4 flex flex-col justify-between">
                  <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground">
                    <span>{c.layout}</span>
                    <span>{c.durationSec}s</span>
                  </div>
                  <div className="text-center font-display text-sm font-semibold px-2 line-clamp-2 group-hover:text-primary transition-colors">
                    {c.title}
                  </div>
                  <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground">
                    <span>{c.captionStyle}</span>
                    <span>{c.enableSfx ? 'SFX ON' : 'SFX OFF'}</span>
                  </div>
                </div>
                <div className="p-4 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground truncate">{c.creator?.displayName ?? 'Creator'}</span>
                  <div className="flex items-center gap-1.5">
                    <Badge variant={c.compliancePassed ? 'secondary' : 'destructive'} className="font-mono text-[10px]">
                      {c.complianceScore}/100
                    </Badge>
                    <Badge variant="outline" className="font-mono text-[10px]">
                      {c.approvalStatus}
                    </Badge>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border bg-card">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border font-mono text-muted-foreground">
                <tr>
                  <th className="p-3.5">Clip Title</th>
                  <th className="p-3.5">Creator</th>
                  <th className="p-3.5">Duration</th>
                  <th className="p-3.5">Compliance</th>
                  <th className="p-3.5">Approval</th>
                  <th className="p-3.5">Execution</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((c) => (
                  <tr key={c.id} className="hover:bg-secondary/30">
                    <td className="p-3.5 font-medium">
                      <Link href={`/clips/${c.id}`} className="hover:text-primary hover:underline">
                        {c.title}
                      </Link>
                    </td>
                    <td className="p-3.5 text-muted-foreground">{c.creator?.displayName ?? '—'}</td>
                    <td className="p-3.5 font-mono">{c.durationSec}s</td>
                    <td className="p-3.5 font-mono">{c.complianceScore}/100</td>
                    <td className="p-3.5"><Badge variant="outline">{c.approvalStatus}</Badge></td>
                    <td className="p-3.5 font-mono text-muted-foreground">{c.executionStatus} ({c.durationMs}ms)</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppShell>
  );
}
