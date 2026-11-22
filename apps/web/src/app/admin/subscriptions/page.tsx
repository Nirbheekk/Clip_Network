'use client';

import React, { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { AppShell } from '@/components/layout/AppShell';
import { AdminSubnav } from '@/components/admin/AdminSubnav';
import { useAuth } from '@/components/providers/AuthProvider';
import { apiRequest } from '@/lib/saas-types';

interface RevenuePayload {
  kpis: {
    mrrUsd: number;
    collectedRevenueUsd: number;
    payingWorkspaces: number;
    pastDueWorkspaces: number;
  };
  planEconomics: Array<{
    tier: string;
    name: string;
    workspaces: number;
    activeWorkspaces: number;
    mrrUsd: number;
    clipsUsed: number;
    estCogsUsd: number;
    grossProfitUsd: number;
  }>;
  invoices: Array<{
    id: string;
    externalEventId: string;
    planTier: string;
    amountCents: number;
    currency: string;
    status: string;
    providerMode: string;
    createdAt: string;
    workspace?: { name: string };
  }>;
}

export default function AdminSubscriptionsPage() {
  const { token } = useAuth();
  const [data, setData] = useState<RevenuePayload | null>(null);

  useEffect(() => {
    if (!token) return;
    void apiRequest<RevenuePayload>('/api/v1/admin/control-center', { token }).then((res) => {
      if (res.ok && res.json.data) setData(res.json.data);
    });
  }, [token]);

  return (
    <AppShell
      title="Revenue, Plans & Unit Economics"
      subtitle="Live MRR, collected invoices, variable clip COGS, and gross margin by tier."
      breadcrumb="ADMIN / REVENUE & PLANS"
      requireSuperAdmin
    >
      <AdminSubnav />

      {!data ? (
        <p className="text-xs font-mono text-muted-foreground">Loading revenue ledger...</p>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: 'Estimated MRR', value: `$${data.kpis.mrrUsd.toLocaleString()}` },
              { label: 'Collected Invoices', value: `$${data.kpis.collectedRevenueUsd.toLocaleString()}` },
              { label: 'Paying Workspaces', value: data.kpis.payingWorkspaces },
              { label: 'Past-Due Workspaces', value: data.kpis.pastDueWorkspaces },
            ].map((k) => (
              <div key={k.label} className="rounded-lg border border-border bg-card p-5 space-y-1">
                <div className="text-xs text-muted-foreground">{k.label}</div>
                <div className="font-display text-2xl font-semibold tabular-nums">{k.value}</div>
              </div>
            ))}
          </div>

          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <div className="border-b border-border px-5 py-3.5 text-sm font-display font-semibold">
              Unit Economics by Subscription Tier
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-border font-mono text-muted-foreground">
                  <tr>
                    <th className="p-3.5">Plan Tier</th>
                    <th className="p-3.5">Workspaces (Active/Total)</th>
                    <th className="p-3.5">Clips Used</th>
                    <th className="p-3.5">MRR</th>
                    <th className="p-3.5">Est. COGS</th>
                    <th className="p-3.5">Est. Gross Profit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border tabular-nums font-mono">
                  {data.planEconomics.map((row) => (
                    <tr key={row.tier}>
                      <td className="p-3.5 font-sans font-medium">{row.name} ({row.tier})</td>
                      <td className="p-3.5">{row.activeWorkspaces} / {row.workspaces}</td>
                      <td className="p-3.5">{row.clipsUsed.toLocaleString()}</td>
                      <td className="p-3.5">${row.mrrUsd.toLocaleString()}</td>
                      <td className="p-3.5 text-muted-foreground">${row.estCogsUsd.toFixed(2)}</td>
                      <td className="p-3.5 font-semibold text-primary">${row.grossProfitUsd.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <div className="border-b border-border px-5 py-3.5 text-sm font-display font-semibold">
              Recent Subscription Invoices ({data.invoices.length})
            </div>
            {data.invoices.length === 0 ? (
              <div className="p-6 text-xs text-muted-foreground">No billing invoices recorded yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-border font-mono text-muted-foreground">
                    <tr>
                      <th className="p-3.5">Workspace</th>
                      <th className="p-3.5">Plan</th>
                      <th className="p-3.5">Amount</th>
                      <th className="p-3.5">Provider Mode</th>
                      <th className="p-3.5">Status</th>
                      <th className="p-3.5">Event ID</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border tabular-nums">
                    {data.invoices.map((inv) => (
                      <tr key={inv.id}>
                        <td className="p-3.5 font-medium">{inv.workspace?.name ?? '—'}</td>
                        <td className="p-3.5 font-mono">{inv.planTier}</td>
                        <td className="p-3.5 font-mono">${(inv.amountCents / 100).toFixed(2)} {inv.currency}</td>
                        <td className="p-3.5 font-mono text-[11px]">{inv.providerMode}</td>
                        <td className="p-3.5">
                          <Badge variant={inv.status === 'PAID' ? 'default' : 'destructive'}>{inv.status}</Badge>
                        </td>
                        <td className="p-3.5 font-mono text-[11px] text-muted-foreground">{inv.externalEventId}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </AppShell>
  );
}
