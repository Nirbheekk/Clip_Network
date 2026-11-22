'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Copy, KeyRound, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { AppShell } from '@/components/layout/AppShell';
import { useAuth } from '@/components/providers/AuthProvider';
import { API_BASE, apiRequest, type ApiKeyItem } from '@/lib/saas-types';

export default function ApiKeysPage() {
  const { token, notify } = useAuth();
  const [keys, setKeys] = useState<ApiKeyItem[]>([]);
  const [name, setName] = useState('');
  const [createdKey, setCreatedKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    const res = await apiRequest<ApiKeyItem[]>('/api/v1/api-keys', { token });
    if (res.ok && res.json.data) setKeys(res.json.data);
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !name.trim()) return;
    const res = await apiRequest<{ rawKey: string }>('/api/v1/api-keys', {
      method: 'POST',
      token,
      body: { name: name.trim() },
    });
    if (res.ok && res.json.data) {
      setCreatedKey(res.json.data.rawKey);
      setName('');
      await load();
      notify('API key created. Copy it now—it is shown only once.', 'success');
    } else {
      notify(typeof res.json.error === 'string' ? res.json.error : 'Could not create API key.', 'error');
    }
  }

  async function revoke(id: string) {
    if (!token) return;
    await apiRequest(`/api/v1/api-keys/${id}/revoke`, { method: 'POST', token });
    await load();
    notify('API key revoked.', 'info');
  }

  return (
    <AppShell
      title="API Keys"
      subtitle="Authenticate external clipping workers and webhooks via X-Api-Key."
      breadcrumb="SETTINGS / API KEYS"
    >
      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-7 rounded-lg border border-border bg-card p-6 space-y-5">
          <form onSubmit={onCreate} className="flex gap-2">
            <Input
              placeholder="Key name (e.g. Twitch Webhook Bot)"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <Button type="submit">
              <KeyRound className="mr-1.5 h-3.5 w-3.5" /> Generate Key
            </Button>
          </form>

          {createdKey && (
            <div className="rounded-md border border-primary/60 bg-primary/5 p-3.5 space-y-2 text-xs">
              <div className="font-semibold">Copy your new API secret (never shown again):</div>
              <div className="flex items-center gap-2">
                <code className="flex-1 truncate rounded bg-background px-2.5 py-1.5 font-mono">
                  {createdKey}
                </code>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    void navigator.clipboard.writeText(createdKey);
                    notify('Copied to clipboard.', 'success');
                  }}
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}

          <div className="divide-y divide-border border-t border-border">
            {keys.length === 0 ? (
              <p className="py-6 text-xs text-muted-foreground">No API keys created yet.</p>
            ) : (
              keys.map((k) => (
                <div key={k.id} className="flex items-center justify-between py-3 text-xs">
                  <div>
                    <div className="font-medium">{k.name}</div>
                    <div className="font-mono text-muted-foreground">{k.keyPrefix}••••••••</div>
                  </div>
                  {k.revokedAt ? (
                    <Badge variant="outline">Revoked</Badge>
                  ) : (
                    <Button size="sm" variant="ghost" onClick={() => revoke(k.id)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="lg:col-span-5 rounded-lg border border-border bg-card p-6 space-y-3 h-fit">
          <h2 className="font-display text-sm font-semibold">Usage Example</h2>
          <pre className="overflow-x-auto rounded border border-border bg-background p-3.5 font-mono text-[11px]">
{`curl -X GET ${API_BASE}/api/v1/dashboard/summary \\
  -H "X-Api-Key: cn_live_YOUR_KEY"`}
          </pre>
          <p className="text-xs text-muted-foreground">
            Keys are stored as SHA-256 hashes and scoped strictly to your workspace. Revoking a key
            immediately rejects subsequent requests with HTTP 401.
          </p>
        </div>
      </div>
    </AppShell>
  );
}
