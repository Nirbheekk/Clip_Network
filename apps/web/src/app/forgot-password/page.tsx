'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PublicNavbar } from '@/components/layout/PublicChrome';
import { apiRequest } from '@/lib/saas-types';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [devToken, setDevToken] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await apiRequest<{ message: string; devResetToken?: string }>(
      '/api/v1/auth/forgot-password',
      { method: 'POST', body: { email } },
    );
    setBusy(false);
    setSubmitted(true);
    if (res.ok && res.json.data?.devResetToken) {
      setDevToken(res.json.data.devResetToken);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PublicNavbar />
      <main className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md items-center justify-center px-4 py-12">
        <div className="w-full rounded-lg border border-border bg-card p-6 space-y-5">
          <div className="space-y-1">
            <h1 className="font-display text-xl font-semibold">Reset your password</h1>
            <p className="text-xs text-muted-foreground">
              Enter your email address. If an account exists, a reset token will be issued.
            </p>
          </div>

          {submitted ? (
            <div className="space-y-4">
              <div className="rounded border border-border bg-background p-3 text-xs text-muted-foreground">
                If an account matches <strong className="text-foreground">{email}</strong>, a
                password reset link has been dispatched.
              </div>
              {devToken && (
                <div className="rounded border border-primary/50 bg-primary/5 p-3 space-y-2 text-xs">
                  <div className="font-mono text-[11px] text-primary">DEV RESET TOKEN</div>
                  <code className="block break-all font-mono text-[11px]">{devToken}</code>
                  <Button size="sm" className="w-full" asChild>
                    <Link href={`/reset-password?token=${encodeURIComponent(devToken)}`}>
                      Proceed to Reset Password
                    </Link>
                  </Button>
                </div>
              )}
              <Button variant="outline" className="w-full" asChild>
                <Link href="/login">Back to Log in</Link>
              </Button>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="fp-email">Email</Label>
                <Input
                  id="fp-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? 'Requesting...' : 'Send Reset Instructions'}
              </Button>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
