'use client';

import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { AppShell } from '@/components/layout/AppShell';
import { useAuth } from '@/components/providers/AuthProvider';
import { apiRequest } from '@/lib/saas-types';

interface NotifPrefs {
  approvals: boolean;
  failures: boolean;
  billing: boolean;
  security: boolean;
}

export default function NotificationsSettingsPage() {
  const { token, notify } = useAuth();
  const [prefs, setPrefs] = useState<NotifPrefs>({
    approvals: true,
    failures: true,
    billing: true,
    security: true,
  });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) return;
    void apiRequest<NotifPrefs>('/api/v1/account/notifications', { token }).then((res) => {
      if (res.ok && res.json.data) setPrefs(res.json.data);
    });
  }, [token]);

  async function savePrefs() {
    if (!token) return;
    setBusy(true);
    const res = await apiRequest('/api/v1/account/notifications', {
      method: 'PATCH',
      token,
      body: prefs,
    });
    setBusy(false);
    if (res.ok) notify('Notification preferences saved to database.', 'success');
  }

  return (
    <AppShell
      title="Notifications"
      subtitle="Persisted alert preferences for approvals, failures, billing, and account security."
      breadcrumb="SETTINGS / NOTIFICATIONS"
    >
      <div className="max-w-2xl rounded-lg border border-border bg-card p-6 space-y-4">
        <div className="rounded border border-border bg-background px-3.5 py-2.5 text-xs text-muted-foreground">
          Preferences are persisted to your account in PostgreSQL/SQLite. Live outbound email
          dispatch activates automatically when <code className="font-mono">RESEND_API_KEY</code> is set.
        </div>

        {[
          { key: 'approvals' as const, label: 'Approval requests', desc: 'Alert reviewers when compliant clips enter AWAITING_APPROVAL.' },
          { key: 'failures' as const, label: 'Execution & publishing failures', desc: 'Notify when an ingest job or publish post fails.' },
          { key: 'billing' as const, label: 'Billing & quota events', desc: 'Alert on paid invoices, payment failures, and 80%+ quota usage.' },
          { key: 'security' as const, label: 'Security events', desc: 'Alert on password changes, invites, and API key creation.' },
        ].map((item) => (
          <div key={item.key} className="flex items-center justify-between border-t border-border pt-3.5 text-xs">
            <div>
              <div className="font-medium text-foreground">{item.label}</div>
              <div className="text-muted-foreground">{item.desc}</div>
            </div>
            <Switch
              checked={prefs[item.key]}
              onCheckedChange={(v) => setPrefs((p) => ({ ...p, [item.key]: v }))}
            />
          </div>
        ))}

        <div className="pt-2 flex justify-end">
          <Button size="sm" onClick={savePrefs} disabled={busy}>
            {busy ? 'Saving...' : 'Save Preferences'}
          </Button>
        </div>
      </div>
    </AppShell>
  );
}
