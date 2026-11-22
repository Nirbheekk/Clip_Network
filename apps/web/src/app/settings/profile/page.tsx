'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AppShell } from '@/components/layout/AppShell';
import { useAuth } from '@/components/providers/AuthProvider';
import { apiRequest } from '@/lib/saas-types';

export default function ProfileSettingsPage() {
  const { token, user, refreshSession, notify } = useAuth();
  const [name, setName] = useState(user?.name ?? '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    const res = await apiRequest('/api/v1/account/profile', {
      method: 'PATCH',
      token,
      body: { name },
    });
    if (res.ok) {
      await refreshSession();
      notify('Profile updated.', 'success');
    }
  }

  async function updatePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    const res = await apiRequest('/api/v1/auth/change-password', {
      method: 'POST',
      token,
      body: { currentPassword, newPassword },
    });
    if (res.ok) {
      setCurrentPassword('');
      setNewPassword('');
      notify('Password updated.', 'success');
    } else {
      notify(typeof res.json.error === 'string' ? res.json.error : 'Password update failed.', 'error');
    }
  }

  return (
    <AppShell
      title="Personal Profile"
      subtitle="Update your identity details and account security credentials."
      breadcrumb="SETTINGS / PROFILE"
    >
      <div className="grid gap-6 lg:grid-cols-2 max-w-4xl">
        <form onSubmit={saveProfile} className="rounded-lg border border-border bg-card p-6 space-y-4">
          <h2 className="font-display text-sm font-semibold">Identity</h2>
          <div className="space-y-1">
            <Label>Full Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Email</Label>
            <Input disabled value={user?.email ?? ''} />
          </div>
          <Button type="submit" size="sm">Save Profile</Button>
        </form>

        <form onSubmit={updatePassword} className="rounded-lg border border-border bg-card p-6 space-y-4">
          <h2 className="font-display text-sm font-semibold">Change Password</h2>
          <div className="space-y-1">
            <Label>Current Password</Label>
            <Input type="password" required value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>New Password (8+ chars, letter + number)</Label>
            <Input type="password" required minLength={8} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          </div>
          <Button type="submit" variant="outline" size="sm">Update Password</Button>
        </form>
      </div>
    </AppShell>
  );
}
