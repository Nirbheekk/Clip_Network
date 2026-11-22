'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Link2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { AppShell } from '@/components/layout/AppShell';
import { useAuth } from '@/components/providers/AuthProvider';
import { apiRequest, type SocialAccount } from '@/lib/saas-types';

export default function SocialAccountsPage() {
  const { token, notify } = useAuth();
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [platform, setPlatform] = useState<'INSTAGRAM_REELS' | 'TIKTOK' | 'YOUTUBE_SHORTS' | 'X'>(
    'INSTAGRAM_REELS',
  );
  const [accountName, setAccountName] = useState('');
  const [accountHandle, setAccountHandle] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [autoPublishApproved, setAutoPublishApproved] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    const res = await apiRequest<SocialAccount[]>('/api/v1/social-accounts', { token });
    if (res.ok && res.json.data) setAccounts(res.json.data);
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onConnect(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setBusy(true);
    const res = await apiRequest('/api/v1/social-accounts', {
      method: 'POST',
      token,
      body: {
        platform,
        accountName: accountName.trim(),
        accountHandle: accountHandle.trim().startsWith('@')
          ? accountHandle.trim()
          : `@${accountHandle.trim()}`,
        accessToken: accessToken.trim() || undefined,
        autoPublishApproved,
      },
    });
    setBusy(false);
    if (res.ok) {
      setAccountName('');
      setAccountHandle('');
      setAccessToken('');
      await load();
      notify('Social account connected.', 'success');
    } else {
      notify(typeof res.json.error === 'string' ? res.json.error : 'Could not link account.', 'error');
    }
  }

  async function toggleAuto(id: string, nextVal: boolean) {
    if (!token) return;
    await apiRequest(`/api/v1/social-accounts/${id}/auto-publish`, {
      method: 'PATCH',
      token,
      body: { autoPublishApproved: nextVal },
    });
    await load();
    notify(`Auto-publish ${nextVal ? 'enabled' : 'disabled'}.`, 'info');
  }

  async function disconnect(id: string) {
    if (!token) return;
    const res = await apiRequest(`/api/v1/social-accounts/${id}`, { method: 'DELETE', token });
    if (res.ok) {
      await load();
      notify('Social account disconnected.', 'info');
    }
  }

  return (
    <AppShell
      title="Social Accounts"
      subtitle="Encrypted OAuth vault for Instagram Reels, TikTok, YouTube Shorts, and X destinations."
      breadcrumb="DISTRIBUTION / SOCIAL ACCOUNTS"
    >
      <div className="grid gap-6 lg:grid-cols-12">
        <form
          onSubmit={onConnect}
          className="lg:col-span-5 rounded-lg border border-border bg-card p-5 space-y-3.5 h-fit"
        >
          <h2 className="font-display text-sm font-semibold flex items-center gap-2">
            <Link2 className="h-4 w-4 text-primary" /> Connect Destination Account
          </h2>
          <div className="space-y-1">
            <Label>Platform</Label>
            <select
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={platform}
              onChange={(e) => setPlatform(e.target.value as typeof platform)}
            >
              <option value="INSTAGRAM_REELS">Instagram Reels</option>
              <option value="TIKTOK">TikTok</option>
              <option value="YOUTUBE_SHORTS">YouTube Shorts</option>
              <option value="X">X</option>
            </select>
          </div>
          <div className="space-y-1">
            <Label>Account Display Name</Label>
            <Input required placeholder="Lacy Daily Clips" value={accountName} onChange={(e) => setAccountName(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Handle</Label>
            <Input required placeholder="@lacy.clips" value={accountHandle} onChange={(e) => setAccountHandle(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>OAuth Token (optional — encrypted AES-256-GCM)</Label>
            <Input
              type="password"
              placeholder="Leave blank for SANDBOX_SIMULATED"
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
            />
          </div>
          <label className="flex items-center justify-between pt-1 text-xs">
            <span className="text-muted-foreground">Opt-in Auto-Publish Compliant Clips</span>
            <Switch checked={autoPublishApproved} onCheckedChange={setAutoPublishApproved} />
          </label>
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? 'Connecting...' : 'Connect Account'}
          </Button>
          <p className="text-[11px] text-muted-foreground">
            Tokens are encrypted server-side and never returned to browser clients. Without{' '}
            <code className="font-mono">POSTIZ_API_KEY</code>, accounts run in{' '}
            <code className="font-mono">SANDBOX_SIMULATED</code> mode.
          </p>
        </form>

        <div className="lg:col-span-7 rounded-lg border border-border bg-card overflow-hidden">
          <div className="border-b border-border px-5 py-3.5 text-sm font-display font-semibold">
            Connected Destinations ({accounts.length})
          </div>
          {accounts.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground">
              No social accounts connected yet. Connect a destination on the left to build routing rules.
            </div>
          ) : (
            <div className="divide-y divide-border">
              {accounts.map((a) => (
                <div key={a.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 text-xs">
                  <div>
                    <div className="font-medium text-foreground">
                      {a.accountName} <span className="font-mono text-muted-foreground">{a.accountHandle}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-[10px]">{a.platform}</Badge>
                      <Badge variant="secondary" className="text-[10px] font-mono">{a.integrationMode}</Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      <span>Auto-publish</span>
                      <Switch
                        checked={a.autoPublishApproved}
                        onCheckedChange={(v) => toggleAuto(a.id, v)}
                      />
                    </label>
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => disconnect(a.id)}>
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
