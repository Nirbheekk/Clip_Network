'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { AppShell } from '@/components/layout/AppShell';
import { useAuth } from '@/components/providers/AuthProvider';
import { apiRequest } from '@/lib/saas-types';

interface AdminUser {
  id: string;
  email: string;
  name: string;
  systemRole: string;
  status: string;
  createdAt: string;
}

export default function AdminUsersPage() {
  const { token, notify } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [q, setQ] = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    const res = await apiRequest<{ users: AdminUser[] }>('/api/v1/admin/overview', { token });
    if (res.ok && res.json.data) setUsers(res.json.data.users);
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggleStatus(id: string, current: string) {
    if (!token) return;
    const next = current === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    const res = await apiRequest(`/api/v1/admin/users/${id}/status`, {
      method: 'PATCH',
      token,
      body: { status: next },
    });
    if (res.ok) {
      await load();
      notify(`User status set to ${next}.`, 'success');
    }
  }

  const filtered = users.filter(
    (u) =>
      !q.trim() ||
      u.email.toLowerCase().includes(q.toLowerCase()) ||
      u.name.toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <AppShell
      title="User Management"
      subtitle="Search platform accounts, inspect roles, and suspend or reactivate access."
      breadcrumb="ADMIN / USERS"
      requireSuperAdmin
    >
      <div className="space-y-4">
        <Input
          placeholder="Search users by name or email..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="max-w-sm h-9 text-xs"
        />
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border font-mono text-muted-foreground">
              <tr>
                <th className="p-3.5">User</th>
                <th className="p-3.5">Role</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((u) => (
                <tr key={u.id}>
                  <td className="p-3.5">
                    <div className="font-medium">{u.name}</div>
                    <div className="text-muted-foreground">{u.email}</div>
                  </td>
                  <td className="p-3.5 font-mono">{u.systemRole}</td>
                  <td className="p-3.5">
                    <Badge variant={u.status === 'ACTIVE' ? 'default' : 'destructive'}>{u.status}</Badge>
                  </td>
                  <td className="p-3.5 text-right">
                    {u.systemRole !== 'SUPER_ADMIN' && (
                      <Button size="sm" variant="outline" onClick={() => toggleStatus(u.id, u.status)}>
                        {u.status === 'ACTIVE' ? 'Suspend' : 'Reactivate'}
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
