'use client';

import React from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { useAuth } from '@/components/providers/AuthProvider';
import { BillingView } from '@/components/SaasAccountViews';

export default function SettingsBillingPage() {
  const { token, workspace, plans, refreshSession, notify } = useAuth();

  return (
    <AppShell
      title="Billing & Subscription"
      subtitle="Manage your commercial plan, inspect invoices, and upgrade via verified webhooks."
      breadcrumb="SETTINGS / BILLING"
    >
      {token && workspace && (
        <BillingView
          token={token}
          workspace={workspace}
          plans={plans}
          onWorkspaceUpdated={refreshSession}
          onNotify={(m) => notify(m, 'success')}
        />
      )}
    </AppShell>
  );
}
