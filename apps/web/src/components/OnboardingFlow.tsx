'use client';

import React, { useState } from 'react';
import { ArrowRight, CheckCircle2, Clapperboard, MailCheck, Rocket } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { apiRequest, type PlanDef, type SaasUser, type SaasWorkspace } from '@/lib/saas-types';

interface OnboardingFlowProps {
  token: string;
  user: SaasUser;
  workspace: SaasWorkspace;
  plans: PlanDef[];
  devVerificationToken?: string | null;
  onEmailVerified: () => void;
  onCompleted: (updatedWorkspace: SaasWorkspace) => void;
}

export function OnboardingFlow({
  token,
  user,
  workspace,
  plans,
  devVerificationToken,
  onEmailVerified,
  onCompleted,
}: OnboardingFlowProps) {
  const [step, setStep] = useState(1);
  const [workspaceName, setWorkspaceName] = useState(workspace.name);
  const [primaryPlatform, setPrimaryPlatform] = useState<'TWITCH' | 'YOUTUBE' | 'KICK'>('TWITCH');
  const [selectedPlan, setSelectedPlan] = useState<'FREE' | 'STARTER' | 'PRO' | 'ENTERPRISE'>('FREE');
  const [verifyTokenInput, setVerifyTokenInput] = useState(devVerificationToken ?? '');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function handleVerifyEmail() {
    if (!verifyTokenInput.trim()) return;
    setBusy(true);
    const res = await apiRequest('/api/v1/auth/verify-email', {
      method: 'POST',
      body: { token: verifyTokenInput.trim() },
    });
    setBusy(false);
    if (res.ok) {
      setMsg('Email verified!');
      onEmailVerified();
    } else {
      setMsg('Invalid verification token.');
    }
  }

  async function handleFinish() {
    setBusy(true);
    const res = await apiRequest<{ workspace: SaasWorkspace }>('/api/v1/onboarding/complete', {
      method: 'POST',
      token,
      body: { workspaceName, primaryPlatform, selectedPlan },
    });
    setBusy(false);
    if (res.ok && res.json.data) {
      onCompleted(res.json.data.workspace);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-4 py-12">
      <Card className="w-full max-w-2xl border-border/80 bg-card/95 shadow-2xl">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                <Clapperboard className="h-4 w-4" />
              </div>
              <div>
                <CardTitle className="font-display text-lg">Welcome to Clip Network, {user.name}</CardTitle>
                <CardDescription>Step {step} of 3 • Configure your clipping studio</CardDescription>
              </div>
            </div>
            <Badge variant="outline">Resumable Onboarding</Badge>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`h-1.5 rounded-full transition-colors ${s <= step ? 'bg-primary' : 'bg-secondary'}`}
              />
            ))}
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {step === 1 && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="onb-ws">Workspace Name</Label>
                <Input
                  id="onb-ws"
                  value={workspaceName}
                  onChange={(e) => setWorkspaceName(e.target.value)}
                  placeholder="My Clipping Agency"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Primary Stream Source Platform</Label>
                <div className="grid grid-cols-3 gap-2">
                  {(['TWITCH', 'YOUTUBE', 'KICK'] as const).map((p) => (
                    <Button
                      key={p}
                      type="button"
                      variant={primaryPlatform === p ? 'default' : 'outline'}
                      onClick={() => setPrimaryPlatform(p)}
                    >
                      {p}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="flex justify-end">
                <Button onClick={() => setStep(2)}>
                  Continue <ArrowRight className="ml-1.5 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="flex items-start gap-3 rounded-xl border border-border/70 bg-secondary/40 p-4">
                <MailCheck className="mt-0.5 h-5 w-5 text-primary shrink-0" />
                <div className="space-y-1 text-sm">
                  <div className="font-medium">
                    {user.emailVerified ? 'Email verified!' : `Verify ${user.email}`}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Verifying your email unlocks production alerts and team invitations.
                  </p>
                </div>
              </div>

              {!user.emailVerified && (
                <div className="flex gap-2">
                  <Input
                    value={verifyTokenInput}
                    onChange={(e) => setVerifyTokenInput(e.target.value)}
                    placeholder="Paste verification token"
                  />
                  <Button type="button" onClick={handleVerifyEmail} disabled={busy}>
                    Verify Now
                  </Button>
                </div>
              )}

              {msg && (
                <p className="text-xs text-emerald-500 flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5" /> {msg}
                </p>
              )}

              <div className="flex items-center justify-between pt-2">
                <Button variant="ghost" onClick={() => setStep(1)}>Back</Button>
                <Button onClick={() => setStep(3)}>
                  {user.emailVerified ? 'Continue' : 'Skip for now'} <ArrowRight className="ml-1.5 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                {plans.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelectedPlan(p.id)}
                    className={`rounded-xl border p-3.5 text-left transition-all ${
                      selectedPlan === p.id
                        ? 'border-primary bg-primary/10 ring-1 ring-primary/40'
                        : 'border-border/70 bg-background/40 hover:border-border'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-display font-semibold">{p.name}</span>
                      <span className="text-sm font-bold">${p.priceMonthlyUsd}/mo</span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {p.monthlyClipLimit} clips/mo • {p.maxCreators} creators
                    </p>
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground">
                You start on the Free plan immediately. Paid plans can be activated anytime in Billing via server-verified checkout.
              </p>
              <div className="flex items-center justify-between pt-2">
                <Button variant="ghost" onClick={() => setStep(2)}>Back</Button>
                <Button onClick={handleFinish} disabled={busy}>
                  <Rocket className="mr-1.5 h-4 w-4" />
                  {busy ? 'Launching Studio...' : 'Launch Clip Network Studio'}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
