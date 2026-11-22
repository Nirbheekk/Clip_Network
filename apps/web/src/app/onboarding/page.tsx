'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, CheckCircle2, Clapperboard, Radio, Rocket } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/components/providers/AuthProvider';
import { apiRequest } from '@/lib/saas-types';

export default function OnboardingPage() {
  const router = useRouter();
  const { booting, token, user, workspace, devVerificationToken, refreshSession, notify } = useAuth();
  const [step, setStep] = useState(1);
  const [wsName, setWsName] = useState('');
  const [workflowRole, setWorkflowRole] = useState('Solo clipper');
  const [primaryPlatform, setPrimaryPlatform] = useState<'TWITCH' | 'YOUTUBE' | 'KICK'>('TWITCH');

  // Step 3: Creator channel
  const [creatorHandle, setCreatorHandle] = useState('');
  const [creatorName, setCreatorName] = useState('');
  const [creatorTopics, setCreatorTopics] = useState('GTA, marathon');
  const [createdCreatorId, setCreatedCreatorId] = useState<string | null>(null);

  // Step 4: Posting account
  const [socialHandle, setSocialHandle] = useState('');
  const [socialPlatform, setSocialPlatform] = useState<'INSTAGRAM_REELS' | 'TIKTOK' | 'YOUTUBE_SHORTS' | 'X'>('INSTAGRAM_REELS');
  const [autoPublish, setAutoPublish] = useState(true);
  const [createdSocialId, setCreatedSocialId] = useState<string | null>(null);

  const [runInitialScan, setRunInitialScan] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!booting && !user) router.replace('/login');
    if (workspace && !wsName) setWsName(workspace.name);
  }, [booting, user, workspace, wsName, router]);

  if (booting || !user || !workspace || !token) return null;

  async function handleAddFirstCreator() {
    if (!creatorHandle.trim() || !creatorName.trim()) {
      setStep(4);
      return;
    }
    setBusy(true);
    const res = await apiRequest<{ id: string }>('/api/v1/creators', {
      method: 'POST',
      token,
      body: {
        handle: creatorHandle.trim(),
        displayName: creatorName.trim(),
        platform: primaryPlatform,
        channelUrl:
          primaryPlatform === 'YOUTUBE'
            ? `https://www.youtube.com/@${creatorHandle.trim()}`
            : primaryPlatform === 'KICK'
              ? `https://kick.com/${creatorHandle.trim()}`
              : `https://www.twitch.tv/${creatorHandle.trim()}`,
        tags: [creatorHandle.trim()],
        requiredTopics: creatorTopics.split(',').map((s) => s.trim()).filter(Boolean),
        bannedKeywords: [],
        disallowLogos: true,
        enableSfx: true,
      },
    });
    setBusy(false);
    if (res.ok && res.json.data) {
      setCreatedCreatorId(res.json.data.id);
      notify(`Creator ${creatorName} added with auto-upload monitoring enabled.`, 'success');
    }
    setStep(4);
  }

  async function handleAddSocial() {
    if (!socialHandle.trim()) {
      setStep(5);
      return;
    }
    setBusy(true);
    const cleanHandle = socialHandle.trim().startsWith('@')
      ? socialHandle.trim()
      : `@${socialHandle.trim()}`;
    const res = await apiRequest<{ id: string }>('/api/v1/social-accounts', {
      method: 'POST',
      token,
      body: {
        platform: socialPlatform,
        accountName: cleanHandle,
        accountHandle: cleanHandle,
        autoPublishApproved: autoPublish,
      },
    });
    if (res.ok && res.json.data) {
      const socialId = res.json.data.id;
      setCreatedSocialId(socialId);
      // Automatically link Creator -> Posting Account route!
      if (createdCreatorId) {
        await apiRequest('/api/v1/routes', {
          method: 'POST',
          token,
          body: {
            creatorId: createdCreatorId,
            socialAccountId: socialId,
            minComplianceScore: 70,
            hashtags: ['clips', 'shorts'],
          },
        });
      }
      notify(`Posting account ${cleanHandle} linked & routed.`, 'success');
    }
    setBusy(false);
    setStep(5);
  }

  async function handleComplete() {
    setBusy(true);
    if (!user?.emailVerified && devVerificationToken) {
      await apiRequest('/api/v1/auth/verify-email', {
        method: 'POST',
        body: { token: devVerificationToken },
      });
    }
    const res = await apiRequest('/api/v1/onboarding/complete', {
      method: 'POST',
      token,
      body: {
        workspaceName: wsName.trim() || workspace?.name || 'My Studio',
        primaryPlatform,
        selectedPlan: 'FREE',
      },
    });

    if (res.ok) {
      if (runInitialScan && createdCreatorId) {
        await apiRequest('/api/v1/monitor/scan', {
          method: 'POST',
          token,
          body: { autoExecute: true },
        });
      }
      await refreshSession();
      notify('Workspace live. Channel monitor detected latest video & executed pipeline.', 'success');
      router.push('/dashboard');
    }
    setBusy(false);
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
      <div className="w-full max-w-xl rounded-lg border border-border bg-card p-6 sm:p-8 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Clapperboard className="h-3.5 w-3.5" />
            </div>
            <span className="font-display text-sm font-semibold">Clip Network Onboarding</span>
          </div>
          <span className="font-mono text-xs text-muted-foreground">Step {step} / 5</span>
        </div>

        <div className="grid grid-cols-5 gap-1.5">
          {[1, 2, 3, 4, 5].map((s) => (
            <div key={s} className={`h-1 rounded-full ${s <= step ? 'bg-primary' : 'bg-secondary'}`} />
          ))}
        </div>

        {step === 1 && (
          <div className="space-y-4">
            <div>
              <h1 className="font-display text-xl font-semibold">Welcome, {user.name}</h1>
              <p className="text-xs text-muted-foreground mt-1">
                Name your workspace and choose the primary creator platform you monitor.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>Workspace Name</Label>
              <Input value={wsName} onChange={(e) => setWsName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Primary Source Platform</Label>
              <div className="grid grid-cols-3 gap-2">
                {(['TWITCH', 'YOUTUBE', 'KICK'] as const).map((p) => (
                  <Button
                    key={p}
                    type="button"
                    size="sm"
                    variant={primaryPlatform === p ? 'default' : 'outline'}
                    onClick={() => setPrimaryPlatform(p)}
                  >
                    {p}
                  </Button>
                ))}
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <Button onClick={() => setStep(2)}>
                Continue <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div>
              <h2 className="font-display text-xl font-semibold">How will you use Clip Network?</h2>
              <p className="text-xs text-muted-foreground mt-1">
                Configure your channel monitoring and publishing workflow.
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {['Solo clipper', 'Creator agency', 'Content manager', 'Brand campaign team'].map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setWorkflowRole(r)}
                  className={`rounded-md border p-3 text-left text-xs font-medium transition-colors ${
                    workflowRole === r ? 'border-primary bg-primary/10' : 'border-border hover:bg-secondary/50'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
            <div className="flex justify-between pt-2">
              <Button variant="ghost" onClick={() => setStep(1)}>Back</Button>
              <Button onClick={() => setStep(3)}>Continue <ArrowRight className="ml-1.5 h-3.5 w-3.5" /></Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div>
              <h2 className="font-display text-xl font-semibold">Add a creator channel to monitor</h2>
              <p className="text-xs text-muted-foreground mt-1">
                Clip Network watches this channel for latest &amp; newly uploaded videos and starts clipping automatically.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Creator Handle</Label>
                <Input placeholder="lacy" value={creatorHandle} onChange={(e) => setCreatorHandle(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Display Name</Label>
                <Input placeholder="Lacy" value={creatorName} onChange={(e) => setCreatorName(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Required Campaign Topics (comma-separated)</Label>
              <Input value={creatorTopics} onChange={(e) => setCreatorTopics(e.target.value)} />
            </div>
            <div className="flex justify-between pt-2">
              <Button variant="ghost" onClick={() => setStep(2)}>Back</Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(4)}>Skip</Button>
                <Button onClick={handleAddFirstCreator} disabled={busy}>
                  {busy ? 'Adding...' : 'Add Channel & Continue'}
                </Button>
              </div>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <div>
              <h2 className="font-display text-xl font-semibold">Connect your posting account</h2>
              <p className="text-xs text-muted-foreground mt-1">
                We will automatically route compliant clips from {creatorName || 'your creator'} to this destination.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Destination Platform</Label>
                <select
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-xs"
                  value={socialPlatform}
                  onChange={(e) => setSocialPlatform(e.target.value as typeof socialPlatform)}
                >
                  <option value="INSTAGRAM_REELS">Instagram Reels</option>
                  <option value="TIKTOK">TikTok</option>
                  <option value="YOUTUBE_SHORTS">YouTube Shorts</option>
                  <option value="X">X</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label>Posting Account Handle</Label>
                <Input placeholder="@lacy.clips" value={socialHandle} onChange={(e) => setSocialHandle(e.target.value)} />
              </div>
            </div>
            <label className="flex items-center justify-between rounded-md border border-border bg-background p-3 text-xs">
              <div>
                <div className="font-medium">Auto-publish compliant clips &amp; track insights</div>
                <div className="text-[11px] text-muted-foreground">
                  Turn off to hold clips in the Human Approval Queue first.
                </div>
              </div>
              <Switch checked={autoPublish} onCheckedChange={setAutoPublish} />
            </label>
            <div className="flex justify-between pt-2">
              <Button variant="ghost" onClick={() => setStep(3)}>Back</Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(5)}>Skip</Button>
                <Button onClick={handleAddSocial} disabled={busy}>
                  {busy ? 'Linking...' : 'Link Account & Continue'}
                </Button>
              </div>
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-md border border-border bg-background p-4">
              <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <div className="space-y-1 text-xs">
                <div className="font-semibold text-foreground">Automated pipeline ready</div>
                <p className="text-muted-foreground">
                  {createdCreatorId && createdSocialId
                    ? `Creator channel linked to posting account. Ready to detect latest uploads, execute clipping, post, and generate insights.`
                    : `Workspace "${wsName}" is ready on the Free plan (10 clips/month).`}
                </p>
              </div>
            </div>

            {createdCreatorId && (
              <label className="flex items-center justify-between rounded-md border border-primary/40 bg-primary/5 p-3 text-xs">
                <div className="flex items-center gap-2">
                  <Radio className="h-4 w-4 text-primary" />
                  <span>Detect latest video &amp; run first automated clip + post now</span>
                </div>
                <Switch checked={runInitialScan} onCheckedChange={setRunInitialScan} />
              </label>
            )}

            <div className="flex justify-between pt-2">
              <Button variant="ghost" onClick={() => setStep(4)}>Back</Button>
              <Button onClick={handleComplete} disabled={busy}>
                <Rocket className="mr-1.5 h-4 w-4" />
                {busy ? 'Scanning & Launching...' : 'Launch Dashboard'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
