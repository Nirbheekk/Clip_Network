'use client';

import React, { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { AppShell } from '@/components/layout/AppShell';
import { apiRequest } from '@/lib/saas-types';

interface HealthPayload {
  service: string;
  version: string;
  database: string;
  billingMode: string;
  publishingMode: string;
  sfxPresets: string[];
}

export default function AdminOperationsPage() {
  const [health, setHealth] = useState<HealthPayload | null>(null);

  useEffect(() => {
    void apiRequest<HealthPayload>('/api/health').then((res) => {
      if (res.ok && res.json) setHealth(res.json as unknown as HealthPayload);
    });
  }, []);

  return (
    <AppShell
      title="Platform Operations"
      subtitle="Live API health, database connectivity, and external integration modes."
      breadcrumb="ADMIN / OPERATIONS"
      requireSuperAdmin
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'API Service', value: health?.service ?? 'Checking...' },
          { label: 'Database', value: health?.database ?? 'Checking...' },
          { label: 'Billing Integration', value: health?.billingMode ?? 'Checking...' },
          { label: 'Publishing Integration', value: health?.publishingMode ?? 'Checking...' },
        ].map((item) => (
          <div key={item.label} className="rounded-lg border border-border bg-card p-5 space-y-2">
            <div className="text-xs text-muted-foreground">{item.label}</div>
            <Badge variant="outline" className="font-mono text-xs">{item.value}</Badge>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
