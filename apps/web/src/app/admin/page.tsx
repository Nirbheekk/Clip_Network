'use client';

import React from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { useAuth } from '@/components/providers/AuthProvider';
import { SuperAdminView } from '@/components/SaasAccountViews';

export default function AdminOverviewPage() {
  const { token, notify } = useAuth();
  return (
    <AppShell
      title="Platform Admin Overview"
      subtitle="SUPER_ADMIN telemetry across all tenants, revenue, and open tickets."
      breadcrumb="ADMIN / OVERVIEW"
      requireSuperAdmin
    >
      {token && <SuperAdminView token={token} onNotify={(m) => notify(m, 'success')} />}
    </AppShell>
  );
}
