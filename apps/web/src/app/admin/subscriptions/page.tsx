'use client';

import React, { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { AppShell } from '@/components/layout/AppShell';
import { useAuth } from '@/components/providers/AuthProvider';
import { apiRequest } from '@/lib/saas-types';

interface WorkspaceRow {
  id: string;
  name: string;
  planTier: string;
  subscriptionStatus: string;
  clipsUsedThisPeriod: number;
  monthlyClipLimit: number;
}

export default function AdminSubscriptionsPage() {
  const { token } = useAuth();
  const [workspaces, setWorkspaces] = useState<WorkspaceRow[]>([]);

  useEffect(() => {
    if (!token) return;
    void apiRequest<{ workspaces: WorkspaceRow[] }>('/api/v1/admin/overview', { token }).then((res) => {
      if (res.ok && res.json.data) setWorkspaces(res.json.data.workspaces);
    });
  }, [token]);

  return (
    <AppShell
      title="Subscription Management"
      subtitle="Tenant plans, subscription statuses, and monthly quota utilization."
      breadcrumb="ADMIN / SUBSCRIPTIONS"
      requireSuperAdmin
    >
      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-border font-mono text-muted-foreground">
            <tr>
              <th className="p-3.5">Workspace</th>
              <th className="p-3.5">Plan</th>
              <th className="p-3.5">Status</th>
              <th className="p-3.5">Clip Usage</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border tabular-nums">
            {workspaces.map((w) => (
              <tr key={w.id}>
                <td className="p-3.5 font-medium">{w.name}</td>
                <td className="p-3.5"><Badge variant="outline">{w.planTier}</Badge></td>
                <td className="p-3.5 font-mono">{w.subscriptionStatus}</td>
                <td className="p-3.5 font-mono">{w.clipsUsedThisPeriod} / {w.monthlyClipLimit}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
