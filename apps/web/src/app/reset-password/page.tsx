'use client';

import React, { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PublicNavbar } from '@/components/layout/PublicChrome';
import { apiRequest } from '@/lib/saas-types';

function ResetPasswordForm() {
  const params = useSearchParams();
  const [token, setToken] = useState(params.get('token') ?? '');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setBusy(true);
    setError(null);
    const res = await apiRequest('/api/v1/auth/reset-password', {
      method: 'POST',
      body: { token: token.trim(), newPassword },
    });
    setBusy(false);
    if (!res.ok) {
      setError(typeof res.json.error === 'string' ? res.json.error : 'Reset token invalid or expired.');
      return;
    }
    setDone(true);
  }

  return (
    <div className="w-full rounded-lg border border-border bg-card p-6 space-y-5">
      <div className="space-y-1">
        <h1 className="font-display text-xl font-semibold">Choose a new password</h1>
        <p className="text-xs text-muted-foreground">
          All existing sessions will be revoked when your password changes.
        </p>
      </div>

      {done ? (
        <div className="space-y-4">
          <div className="rounded border border-primary/50 bg-primary/5 p-3 text-xs">
            Password updated successfully. You can now sign in.
          </div>
          <Button className="w-full" asChild>
            <Link href="/login">Go to Log in</Link>
          </Button>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-3">
          {error && (
            <div className="rounded border border-destructive/50 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </div>
          )}
          <div className="space-y-1">
            <Label htmlFor="rt">Reset Token</Label>
            <Input id="rt" required value={token} onChange={(e) => setToken(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="npw">New Password (8+ chars, letter + number)</Label>
            <Input id="npw" type="password" required minLength={8} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="ncpw">Confirm Password</Label>
            <Input id="ncpw" type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </div>
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? 'Updating...' : 'Update Password'}
          </Button>
        </form>
      )}
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <PublicNavbar />
      <main className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md items-center justify-center px-4 py-12">
        <Suspense fallback={<div className="text-xs text-muted-foreground">Loading...</div>}>
          <ResetPasswordForm />
        </Suspense>
      </main>
    </div>
  );
}
