'use client';

import React, { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { AppShell } from '@/components/layout/AppShell';
import { useAuth } from '@/components/providers/AuthProvider';
import { apiRequest } from '@/lib/saas-types';

interface MemberRow {
  id: string;
  role: string;
  joinedAt: string;
  user: { id: string; name: string; email: string; status: string; emailVerified: boolean };
}

export default function TeamSettingsPage() {
  const { token } = useAuth();
  const [members, setMembers] = useState<MemberRow[]>([]);

  useEffect(() => {
    if (!token) return;
    void apiRequest<MemberRow[]>('/api/v1/workspace/members', { token }).then((res) => {
      if (res.ok && res.json.data) setMembers(res.json.data);
    });
  }, [token]);

  return (
    <AppShell
      title="Team & RBAC"
      subtitle="Role-based access control enforced on every workspace API route."
      breadcrumb="SETTINGS / TEAM"
    >
      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-7 rounded-lg border border-border bg-card overflow-hidden">
          <div className="border-b border-border px-5 py-3.5 text-sm font-display font-semibold">
            Workspace Members ({members.length})
          </div>
          <div className="divide-y divide-border">
            {members.map((m) => (
              <div key={m.id} className="flex items-center justify-between px-5 py-3.5 text-xs">
                <div>
                  <div className="font-medium">{m.user.name}</div>
                  <div className="text-muted-foreground">{m.user.email}</div>
                </div>
                <Badge variant="outline" className="font-mono">{m.role}</Badge>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-5 rounded-lg border border-border bg-card p-5 space-y-3 text-xs h-fit">
          <h2 className="font-display text-sm font-semibold">Role Permission Matrix</h2>
          <div className="space-y-2 text-muted-foreground">
            <div><strong className="text-foreground font-mono">OWNER</strong> — Full billing, workspace, API key, creator, and approval control.</div>
            <div><strong className="text-foreground font-mono">ADMIN</strong> — Billing checkout, API keys, creator deletion, and all member actions.</div>
            <div><strong className="text-foreground font-mono">MEMBER</strong> — Tag creators, connect accounts, ingest clips, approve/publish.</div>
            <div><strong className="text-foreground font-mono">VIEWER</strong> — Read-only access to dashboard, clips, analytics, and audit logs.</div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
