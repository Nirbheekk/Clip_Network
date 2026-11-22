'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AppShell } from '@/components/layout/AppShell';
import { AdminSubnav } from '@/components/admin/AdminSubnav';
import { useAuth } from '@/components/providers/AuthProvider';
import { apiRequest } from '@/lib/saas-types';

interface AdminTicket {
  id: string;
  subject: string;
  message: string;
  priority: string;
  status: string;
  createdAt: string;
  workspace?: { name: string; planTier: string };
  user?: { name: string; email: string };
}

export default function AdminSupportPage() {
  const { token, notify } = useAuth();
  const [tickets, setTickets] = useState<AdminTicket[]>([]);

  const load = useCallback(async () => {
    if (!token) return;
    const res = await apiRequest<AdminTicket[]>('/api/v1/admin/support', { token });
    if (res.ok && res.json.data) setTickets(res.json.data);
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function setStatus(ticketId: string, status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED') {
    if (!token) return;
    const res = await apiRequest(`/api/v1/admin/support/${ticketId}`, {
      method: 'PATCH',
      token,
      body: { status },
    });
    if (res.ok) {
      await load();
      notify(`Ticket marked ${status}.`, 'success');
    }
  }

  return (
    <AppShell
      title="Support Triage Inbox"
      subtitle="Manage incoming customer support requests across all workspaces."
      breadcrumb="ADMIN / SUPPORT TRIAGE"
      requireSuperAdmin
    >
      <AdminSubnav />

      {tickets.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-10 text-center text-xs text-muted-foreground">
          No customer support tickets submitted yet.
        </div>
      ) : (
        <div className="divide-y divide-border rounded-lg border border-border bg-card">
          {tickets.map((t) => (
            <div key={t.id} className="p-5 space-y-2.5 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="space-y-0.5">
                  <div className="font-semibold text-sm">{t.subject}</div>
                  <div className="font-mono text-[11px] text-muted-foreground">
                    {t.user?.name} ({t.user?.email}) • {t.workspace?.name} [{t.workspace?.planTier}]
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={t.priority === 'HIGH' ? 'destructive' : 'outline'}>{t.priority}</Badge>
                  <Badge variant={t.status === 'RESOLVED' ? 'secondary' : 'default'}>{t.status}</Badge>
                </div>
              </div>
              <p className="text-muted-foreground leading-relaxed">{t.message}</p>
              <div className="flex gap-2 pt-1">
                {(['OPEN', 'IN_PROGRESS', 'RESOLVED'] as const).map((st) => (
                  <Button
                    key={st}
                    size="sm"
                    variant={t.status === st ? 'default' : 'outline'}
                    className="h-7 text-[11px]"
                    onClick={() => setStatus(t.id, st)}
                  >
                    {st.replace('_', ' ')}
                  </Button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}
