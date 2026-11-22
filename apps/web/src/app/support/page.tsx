'use client';

import React from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { useAuth } from '@/components/providers/AuthProvider';
import { SupportAndDocsView } from '@/components/SaasAccountViews';

export default function SupportPage() {
  const { token, notify } = useAuth();
  return (
    <AppShell
      title="Support & Help"
      subtitle="Open workspace support tickets and access live engine API examples."
      breadcrumb="WORKSPACE / SUPPORT"
    >
      {token && <SupportAndDocsView token={token} onNotify={(m) => notify(m, 'success')} />}
    </AppShell>
  );
}
