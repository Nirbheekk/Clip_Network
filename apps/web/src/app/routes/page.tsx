'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { ArrowRight, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { AppShell } from '@/components/layout/AppShell';
import { useAuth } from '@/components/providers/AuthProvider';
import { apiRequest, type Creator, type RouteRule, type SocialAccount } from '@/lib/saas-types';

export default function RoutesPage() {
  const { token, notify } = useAuth();
  const [creators, setCreators] = useState<Creator[]>([]);
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [routes, setRoutes] = useState<RouteRule[]>([]);
  const [creatorId, setCreatorId] = useState('');
  const [socialAccountId, setSocialAccountId] = useState('');
  const [minScore, setMinScore] = useState(75);
  const [hashtags, setHashtags] = useState('clips, viral');

  const load = useCallback(async () => {
    if (!token) return;
    const [cRes, aRes, rRes] = await Promise.all([
      apiRequest<Creator[]>('/api/v1/creators', { token }),
      apiRequest<SocialAccount[]>('/api/v1/social-accounts', { token }),
      apiRequest<RouteRule[]>('/api/v1/routes', { token }),
    ]);
    if (cRes.ok && cRes.json.data) {
      setCreators(cRes.json.data);
      if (cRes.json.data[0] && !creatorId) setCreatorId(cRes.json.data[0].id);
    }
    if (aRes.ok && aRes.json.data) {
      setAccounts(aRes.json.data);
      if (aRes.json.data[0] && !socialAccountId) setSocialAccountId(aRes.json.data[0].id);
    }
    if (rRes.ok && rRes.json.data) setRoutes(rRes.json.data);
  }, [token, creatorId, socialAccountId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !creatorId || !socialAccountId) return;
    const res = await apiRequest('/api/v1/routes', {
      method: 'POST',
      token,
      body: {
        creatorId,
        socialAccountId,
        minComplianceScore: minScore,
        hashtags: hashtags.split(',').map((s) => s.trim()).filter(Boolean),
      },
    });
    if (res.ok) {
      await load();
      notify('Routing rule created.', 'success');
    } else {
      notify('Route already exists or invalid selection.', 'error');
    }
  }

  async function toggleRoute(id: string, enabled: boolean) {
    if (!token) return;
    await apiRequest(`/api/v1/routes/${id}`, { method: 'PATCH', token, body: { enabled } });
    await load();
  }

  async function deleteRoute(id: string) {
    if (!token) return;
    await apiRequest(`/api/v1/routes/${id}`, { method: 'DELETE', token });
    await load();
    notify('Route deleted.', 'info');
  }

  return (
    <AppShell
      title="Routing Rules"
      subtitle="Connect Creator Source -> Compliance Threshold -> Social Destination -> Approval Policy."
      breadcrumb="DISTRIBUTION / ROUTING RULES"
    >
      <div className="grid gap-6 lg:grid-cols-12">
        <form
          onSubmit={onCreate}
          className="lg:col-span-4 rounded-lg border border-border bg-card p-5 space-y-3.5 h-fit"
        >
          <h2 className="font-display text-sm font-semibold">Create Routing Rule</h2>
          <div className="space-y-1">
            <Label>Source Creator</Label>
            <select
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-xs"
              value={creatorId}
              onChange={(e) => setCreatorId(e.target.value)}
            >
              <option value="">Select creator</option>
              {creators.map((c) => (
                <option key={c.id} value={c.id}>{c.displayName} (@{c.handle})</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label>Destination Social Account</Label>
            <select
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-xs"
              value={socialAccountId}
              onChange={(e) => setSocialAccountId(e.target.value)}
            >
              <option value="">Select social account</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.accountHandle} ({a.platform})</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label>Min Compliance Score (0–100)</Label>
            <Input
              type="number"
              min={0}
              max={100}
              value={minScore}
              onChange={(e) => setMinScore(Number(e.target.value))}
            />
          </div>
          <div className="space-y-1">
            <Label>Hashtags (comma-separated)</Label>
            <Input value={hashtags} onChange={(e) => setHashtags(e.target.value)} />
          </div>
          <Button type="submit" className="w-full" disabled={!creatorId || !socialAccountId}>
            Activate Route
          </Button>
        </form>

        <div className="lg:col-span-8 rounded-lg border border-border bg-card overflow-hidden">
          <div className="border-b border-border px-5 py-3.5 text-sm font-display font-semibold">
            Active Distribution Matrix ({routes.length})
          </div>
          {routes.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground">
              No routes configured yet. Link a creator to a social destination to automatically route compliant clips.
            </div>
          ) : (
            <div className="divide-y divide-border">
              {routes.map((r) => (
                <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 text-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">@{r.creator?.handle}</Badge>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                    <Badge variant="secondary">Score &gt;= {r.minComplianceScore}</Badge>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="font-medium">{r.socialAccount?.accountHandle}</span>
                    <span className="font-mono text-[11px] text-muted-foreground">
                      ({r.socialAccount?.autoPublishApproved ? 'Opt-in Auto' : 'Human Approval'})
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Switch checked={r.enabled} onCheckedChange={(v) => toggleRoute(r.id, v)} />
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => deleteRoute(r.id)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
