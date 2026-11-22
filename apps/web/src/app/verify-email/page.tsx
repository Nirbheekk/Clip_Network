'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, MailCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PublicNavbar } from '@/components/layout/PublicChrome';
import { useAuth } from '@/components/providers/AuthProvider';
import { apiRequest } from '@/lib/saas-types';

export default function VerifyEmailPage() {
  const { token, user, devVerificationToken, refreshSession, notify } = useAuth();
  const [tokenInput, setTokenInput] = useState(devVerificationToken ?? '');
  const [busy, setBusy] = useState(false);
  const [verified, setVerified] = useState(Boolean(user?.emailVerified));
  const [error, setError] = useState<string | null>(null);

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await apiRequest('/api/v1/auth/verify-email', {
      method: 'POST',
      body: { token: tokenInput.trim() },
    });
    setBusy(false);
    if (res.ok) {
      setVerified(true);
      await refreshSession();
      notify('Email verified.', 'success');
    } else {
      setError('Verification token is invalid or already used.');
    }
  }

  async function handleResend() {
    if (!token) return;
    setBusy(true);
    const res = await apiRequest<{ message: string; devVerificationToken?: string }>(
      '/api/v1/auth/resend-verification',
      { method: 'POST', token },
    );
    setBusy(false);
    if (res.ok && res.json.data) {
      if (res.json.data.devVerificationToken) {
        setTokenInput(res.json.data.devVerificationToken);
      }
      notify(res.json.data.message, 'success');
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PublicNavbar />
      <main className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md items-center justify-center px-4 py-12">
        <div className="w-full rounded-lg border border-border bg-card p-6 space-y-5">
          {verified || user?.emailVerified ? (
            <div className="space-y-4 text-center">
              <CheckCircle2 className="mx-auto h-8 w-8 text-primary" />
              <h1 className="font-display text-xl font-semibold">Email Verified</h1>
              <p className="text-xs text-muted-foreground">
                Your email address is verified and your workspace is ready.
              </p>
              <Button className="w-full" asChild>
                <Link href={user?.onboardingCompleted ? '/dashboard' : '/onboarding'}>
                  Continue to Workspace
                </Link>
              </Button>
            </div>
          ) : (
            <>
              <div className="space-y-1.5">
                <MailCheck className="h-6 w-6 text-primary" />
                <h1 className="font-display text-xl font-semibold">Verify your email</h1>
                <p className="text-xs text-muted-foreground">
                  Enter the verification token issued for{' '}
                  <strong className="text-foreground">{user?.email ?? 'your account'}</strong>.
                </p>
              </div>

              {error && (
                <div className="rounded border border-destructive/50 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  {error}
                </div>
              )}

              <form onSubmit={handleVerify} className="space-y-3">
                <div className="space-y-1">
                  <Label htmlFor="vtok">Verification Token</Label>
                  <Input
                    id="vtok"
                    required
                    value={tokenInput}
                    onChange={(e) => setTokenInput(e.target.value)}
                    placeholder="Paste verification token"
                  />
                </div>
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? 'Verifying...' : 'Verify Email'}
                </Button>
              </form>

              {token && (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={handleResend}
                  disabled={busy}
                >
                  Resend Verification Token
                </Button>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
