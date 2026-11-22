'use client';

import React, { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { AppShell } from '@/components/layout/AppShell';
import { useAuth } from '@/components/providers/AuthProvider';
import { apiRequest } from '@/lib/saas-types';

interface HealthPayload {
  service: string;
  version: string;
  database: string;
  billingMode: string;
  publishingMode: string;
  emailMode: string;
  storageMode: string;
}

interface FunnelRow {
  eventName: string;
  count: number;
}

export default function AdminOperationsPage() {
  const { token } = useAuth();
  const [health, setHealth] = useState<HealthPayload | null>(null);
  const [funnel, setFunnel] = useState<FunnelRow[]>([]);

  useEffect(() => {
    void apiRequest<HealthPayload>('/api/health').then((res) => {
      if (res.ok && res.json) setHealth(res.json as unknown as HealthPayload);
    });
    if (token) {
      void apiRequest<FunnelRow[]>('/api/v1/admin/funnel', { token }).then((res) => {
        if (res.ok && res.json.data) setFunnel(res.json.data);
      });
    }
  }, [token]);

  return (
    <AppShell
      title="Platform Operations"
      subtitle="Live integration health across Billing, Publishing, Email, Storage, and conversion funnel."
      breadcrumb="ADMIN / OPERATIONS"
      requireSuperAdmin
    >
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { label: 'API Service & Version', value: health ? `${health.service} (${health.version})` : 'Checking...' },
            { label: 'Database', value: health?.database ?? 'Checking...' },
            { label: 'Billing Mode', value: health?.billingMode ?? 'Checking...' },
            { label: 'Publishing Mode', value: health?.publishingMode ?? 'Checking...' },
            { label: 'Email Provider Mode', value: health?.emailMode ?? 'Checking...' },
            { label: 'Object Storage Mode', value: health?.storageMode ?? 'Checking...' },
          ].map((item) => (
            <div key={item.label} className="rounded-lg border border-border bg-card p-5 space-y-2">
              <div className="text-xs text-muted-foreground">{item.label}</div>
              <Badge variant="outline" className="font-mono text-xs">{item.value}</Badge>
            </div>
          ))}
        </div>

        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="border-b border-border px-5 py-3.5 text-sm font-display font-semibold">
            Privacy-Safe Conversion Funnel Telemetry
          </div>
          {funnel.length === 0 ? (
            <div className="p-6 text-xs text-muted-foreground">No funnel events recorded yet.</div>
          ) : (
            <div className="divide-y divide-border">
              {funnel.map((f) => (
                <div key={f.eventName} className="flex items-center justify-between px-5 py-3 text-xs font-mono">
                  <span>{f.eventName}</span>
                  <span className="font-semibold">{f.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
