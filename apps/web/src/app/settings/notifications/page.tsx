'use client';

import React, { useState } from 'react';
import { Switch } from '@/components/ui/switch';
import { AppShell } from '@/components/layout/AppShell';

export default function NotificationsSettingsPage() {
  const [prefs, setPrefs] = useState({
    approvals: true,
    failures: true,
    billing: true,
    security: true,
  });

  return (
    <AppShell
      title="Notifications"
      subtitle="Configure alert categories for your workspace."
      breadcrumb="SETTINGS / NOTIFICATIONS"
    >
      <div className="max-w-2xl rounded-lg border border-border bg-card p-6 space-y-4">
        <div className="rounded border border-border bg-background px-3.5 py-2.5 text-xs text-muted-foreground">
          Outbound email delivery activates automatically when an SMTP or Resend provider key is
          configured in server environment variables.
        </div>

        {[
          { key: 'approvals' as const, label: 'Approval requests', desc: 'Alert reviewers when compliant clips enter AWAITING_APPROVAL.' },
          { key: 'failures' as const, label: 'Execution & publishing failures', desc: 'Notify when an ingest job or publish post fails.' },
          { key: 'billing' as const, label: 'Billing & quota events', desc: 'Alert on paid invoices, payment failures, and 80%+ quota usage.' },
          { key: 'security' as const, label: 'Security events', desc: 'Alert on password changes and API key creation.' },
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
      </div>
    </AppShell>
  );
}
