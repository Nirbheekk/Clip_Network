'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2,
  Clapperboard,
  CreditCard,
  GitBranch,
  KeyRound,
  LifeBuoy,
  Link2,
  LogOut,
  Moon,
  Play,
  RefreshCw,
  RotateCcw,
  Send,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Sun,
  UserPlus,
  Users,
  Video,
  Volume2,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  apiRequest,
  type ClipJob,
  type Creator,
  type PlanDef,
  type PublishPost,
  type RouteRule,
  type SaasUser,
  type SaasWorkspace,
  type SocialAccount,
} from '@/lib/saas-types';
import { LandingAndAuth } from '@/components/LandingAndAuth';
import { OnboardingFlow } from '@/components/OnboardingFlow';
import {
  BillingView,
  SettingsAndKeysView,
  SuperAdminView,
  SupportAndDocsView,
} from '@/components/SaasAccountViews';

type AppTab = 'studio' | 'creators' | 'routing' | 'queue' | 'billing' | 'settings' | 'support' | 'admin';

const TOKEN_STORAGE_KEY = 'clip_network_session_token';

export default function ClipNetworkSaasApp() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [booting, setBooting] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<SaasUser | null>(null);
  const [workspace, setWorkspace] = useState<SaasWorkspace | null>(null);
  const [devVerificationToken, setDevVerificationToken] = useState<string | null>(null);
  const [plans, setPlans] = useState<PlanDef[]>([]);

  const [activeTab, setActiveTab] = useState<AppTab>('studio');
  const [banner, setBanner] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Tenant-scoped studio data
  const [creators, setCreators] = useState<Creator[]>([]);
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [routes, setRoutes] = useState<RouteRule[]>([]);
  const [clips, setClips] = useState<ClipJob[]>([]);
  const [posts, setPosts] = useState<PublishPost[]>([]);

  // Composer form
  const [ingestCreatorId, setIngestCreatorId] = useState('');
  const [sourceUrl, setSourceUrl] = useState('https://www.twitch.tv/videos/2933767012');
  const [clipTitle, setClipTitle] = useState('Lacy GTA 6 Marathon Hype Moment');
  const [transcriptText, setTranscriptText] = useState(
    'We are live on the GTA 6 marathon tonight and chat is going absolutely wild!',
  );
  const [enableSfx, setEnableSfx] = useState(true);

  // Creator form
  const [cHandle, setCHandle] = useState('');
  const [cName, setCName] = useState('');
  const [cPlatform, setCPlatform] = useState<'TWITCH' | 'YOUTUBE' | 'KICK'>('TWITCH');
  const [cUrl, setCUrl] = useState('');
  const [cTopics, setCTopics] = useState('GTA, marathon');
  const [cBanned, setCBanned] = useState('gambling');

  // Social account form
  const [aPlatform, setAPlatform] = useState<'INSTAGRAM_REELS' | 'TIKTOK' | 'YOUTUBE_SHORTS' | 'X'>(
    'INSTAGRAM_REELS',
  );
  const [aName, setAName] = useState('');
  const [aHandle, setAHandle] = useState('');
  const [aAuto, setAAuto] = useState(false);

  // Route form
  const [rCreatorId, setRCreatorId] = useState('');
  const [rAccountId, setRAccountId] = useState('');

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
  }, [theme]);

  const loadWorkspaceData = useCallback(async (authToken: string) => {
    const [meRes, cRes, aRes, rRes, clRes, pRes] = await Promise.all([
      apiRequest<{ user: SaasUser; workspace: SaasWorkspace }>('/api/v1/auth/me', { token: authToken }),
      apiRequest<Creator[]>('/api/v1/creators', { token: authToken }),
      apiRequest<SocialAccount[]>('/api/v1/social-accounts', { token: authToken }),
      apiRequest<RouteRule[]>('/api/v1/routes', { token: authToken }),
      apiRequest<ClipJob[]>('/api/v1/clips', { token: authToken }),
      apiRequest<PublishPost[]>('/api/v1/publish-queue', { token: authToken }),
    ]);

    if (!meRes.ok || !meRes.json.data) {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      setToken(null);
      setUser(null);
      setWorkspace(null);
      return;
    }

    setUser(meRes.json.data.user);
    setWorkspace(meRes.json.data.workspace);

    if (cRes.ok && cRes.json.data) {
      setCreators(cRes.json.data);
      if (cRes.json.data[0] && !ingestCreatorId) {
        setIngestCreatorId(cRes.json.data[0].id);
        setRCreatorId(cRes.json.data[0].id);
      }
    }
    if (aRes.ok && aRes.json.data) {
      setAccounts(aRes.json.data);
      if (aRes.json.data[0] && !rAccountId) {
        setRAccountId(aRes.json.data[0].id);
      }
    }
    if (rRes.ok && rRes.json.data) setRoutes(rRes.json.data);
    if (clRes.ok && clRes.json.data) setClips(clRes.json.data);
    if (pRes.ok && pRes.json.data) setPosts(pRes.json.data);
  }, [ingestCreatorId, rAccountId]);

  useEffect(() => {
    async function boot() {
      const plansRes = await apiRequest<PlanDef[]>('/api/v1/billing/plans');
      if (plansRes.ok && plansRes.json.data) setPlans(plansRes.json.data);

      const savedToken =
        typeof window !== 'undefined' ? localStorage.getItem(TOKEN_STORAGE_KEY) : null;
      if (savedToken) {
        setToken(savedToken);
        await loadWorkspaceData(savedToken);
      }
      setBooting(false);
    }
    void boot();
  }, [loadWorkspaceData]);

  async function handleLogout() {
    if (token) {
      await apiRequest('/api/v1/auth/logout', { method: 'POST', token });
    }
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    setToken(null);
    setUser(null);
    setWorkspace(null);
    setActiveTab('studio');
  }

  async function handleCreateCreator(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setBusy(true);
    const res = await apiRequest('/api/v1/creators', {
      method: 'POST',
      token,
      body: {
        handle: cHandle.trim(),
        displayName: cName.trim(),
        platform: cPlatform,
        channelUrl: cUrl.trim() || `https://www.twitch.tv/${cHandle.trim()}`,
        tags: [cHandle.trim()],
        requiredTopics: cTopics.split(',').map((s) => s.trim()).filter(Boolean),
        bannedKeywords: cBanned.split(',').map((s) => s.trim()).filter(Boolean),
        disallowLogos: true,
        enableSfx: true,
      },
    });
    setBusy(false);
    if (res.ok) {
      setCHandle('');
      setCName('');
      setCUrl('');
      await loadWorkspaceData(token);
      setBanner('Creator tagged and saved to your workspace.');
    } else {
      setBanner(typeof res.json.error === 'string' ? res.json.error : 'Could not tag creator.');
    }
  }

  async function handleLinkAccount(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setBusy(true);
    const res = await apiRequest('/api/v1/social-accounts', {
      method: 'POST',
      token,
      body: {
        platform: aPlatform,
        accountName: aName.trim(),
        accountHandle: aHandle.trim(),
        autoPublishApproved: aAuto,
      },
    });
    setBusy(false);
    if (res.ok) {
      setAName('');
      setAHandle('');
      await loadWorkspaceData(token);
      setBanner('Social clipping account linked.');
    } else {
      setBanner(typeof res.json.error === 'string' ? res.json.error : 'Could not link account.');
    }
  }

  async function handleCreateRoute(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !rCreatorId || !rAccountId) return;
    setBusy(true);
    const res = await apiRequest('/api/v1/routes', {
      method: 'POST',
      token,
      body: {
        creatorId: rCreatorId,
        socialAccountId: rAccountId,
        minComplianceScore: 75,
        hashtags: ['clips', 'viral'],
      },
    });
    setBusy(false);
    if (res.ok) {
      await loadWorkspaceData(token);
      setBanner('Creator -> Social Account route activated.');
    } else {
      setBanner('Route already exists or invalid selection.');
    }
  }

  async function handleIngestClip(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !ingestCreatorId) {
      setBanner('Tag a creator first before ingesting a stream clip.');
      setActiveTab('creators');
      return;
    }
    setBusy(true);
    const res = await apiRequest('/api/v1/clips/ingest', {
      method: 'POST',
      token,
      body: {
        creatorId: ingestCreatorId,
        sourceUrl,
        title: clipTitle,
        startSec: 120,
        endSec: 145,
        transcriptText,
        enableSfx,
      },
    });
    setBusy(false);
    if (res.ok) {
      await loadWorkspaceData(token);
      setBanner('Engine executed: captions aligned, SFX synthesized, compliance scored.');
    } else if (res.status === 402) {
      setBanner(typeof res.json.error === 'string' ? res.json.error : 'Monthly clip quota reached. Upgrade in Billing.');
      setActiveTab('billing');
    } else {
      setBanner(typeof res.json.error === 'string' ? res.json.error : 'Clip ingest failed.');
    }
  }

  async function handleClipDecision(clipId: string, decision: 'APPROVED' | 'REJECTED') {
    if (!token) return;
    const res = await apiRequest(`/api/v1/clips/${clipId}/decision`, {
      method: 'POST',
      token,
      body: { decision },
    });
    if (res.ok) {
      await loadWorkspaceData(token);
      setBanner(`Clip ${decision.toLowerCase()}.`);
    }
  }

  async function handleClipAction(clipId: string, action: 'cancel' | 'retry') {
    if (!token) return;
    const res = await apiRequest(`/api/v1/clips/${clipId}/${action}`, {
      method: 'POST',
      token,
    });
    if (res.ok) {
      await loadWorkspaceData(token);
      setBanner(`Clip execution ${action === 'cancel' ? 'cancelled' : 'retried'}.`);
    }
  }

  async function handleToggleAutoPublish(accountId: string, nextVal: boolean) {
    if (!token) return;
    await apiRequest(`/api/v1/social-accounts/${accountId}/auto-publish`, {
      method: 'PATCH',
      token,
      body: { autoPublishApproved: nextVal },
    });
    await loadWorkspaceData(token);
  }

  async function handleManualPublish(postId: string) {
    if (!token) return;
    const res = await apiRequest(`/api/v1/publish-queue/${postId}/publish`, {
      method: 'POST',
      token,
    });
    if (res.ok) {
      await loadWorkspaceData(token);
      setBanner('Post published idempotently.');
    }
  }

  if (booting) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <RefreshCw className="h-4 w-4 animate-spin text-primary" />
          <span>Loading Clip Network SaaS...</span>
        </div>
      </div>
    );
  }

  if (!token || !user || !workspace) {
    return (
      <LandingAndAuth
        theme={theme}
        onToggleTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
        plans={plans}
        onAuthenticated={async (payload) => {
          localStorage.setItem(TOKEN_STORAGE_KEY, payload.token);
          setToken(payload.token);
          setUser(payload.user);
          setWorkspace(payload.workspace);
          if (payload.devVerificationToken) {
            setDevVerificationToken(payload.devVerificationToken);
          }
          await loadWorkspaceData(payload.token);
        }}
      />
    );
  }

  if (!user.onboardingCompleted) {
    return (
      <OnboardingFlow
        token={token}
        user={user}
        workspace={workspace}
        plans={plans}
        devVerificationToken={devVerificationToken}
        onEmailVerified={() => setUser((u) => (u ? { ...u, emailVerified: true } : u))}
        onCompleted={async (updatedWorkspace) => {
          setWorkspace(updatedWorkspace);
          setUser((u) => (u ? { ...u, onboardingCompleted: true } : u));
          await loadWorkspaceData(token);
        }}
      />
    );
  }

  const navItems: Array<{ id: AppTab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { id: 'studio', label: 'Studio', icon: Sparkles },
    { id: 'creators', label: 'Creators', icon: Users },
    { id: 'routing', label: 'Routing', icon: GitBranch },
    { id: 'queue', label: 'Queue', icon: Send },
    { id: 'billing', label: 'Billing', icon: CreditCard },
    { id: 'settings', label: 'Settings', icon: KeyRound },
    { id: 'support', label: 'Support', icon: LifeBuoy },
    ...(user.systemRole === 'SUPER_ADMIN'
      ? [{ id: 'admin' as const, label: 'Admin', icon: ShieldAlert }]
      : []),
  ];

  return (
    <div className="min-h-screen bg-background text-foreground relative overflow-x-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 -z-10 opacity-90 dark:opacity-100"
        style={{
          background:
            theme === 'dark'
              ? 'radial-gradient(65% 45% at 50% 0%, rgba(212,255,0,0.08) 0%, rgba(9,9,11,0) 70%)'
              : 'radial-gradient(70% 50% at 20% 0%, rgba(251,146,60,0.20) 0%, transparent 55%), radial-gradient(60% 45% at 85% 5%, rgba(139,92,246,0.16) 0%, transparent 55%)',
        }}
      />

      {/* Authenticated SaaS Studio Header */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Clapperboard className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="truncate font-display text-sm font-semibold">{workspace.name}</span>
                <Badge variant="outline" className="text-[10px]">{workspace.planTier}</Badge>
              </div>
              <p className="text-[11px] text-muted-foreground font-mono">
                {workspace.clipsUsedThisPeriod}/{workspace.monthlyClipLimit} clips used
              </p>
            </div>
          </div>

          <nav className="hidden xl:flex items-center gap-1 rounded-full border border-border/70 bg-secondary/50 p-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                    active
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {item.label}
                </button>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
              title="Toggle Theme"
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="mr-1.5 h-3.5 w-3.5" /> Sign Out
            </Button>
          </div>
        </div>

        {/* Mobile / Tablet Nav */}
        <div className="flex xl:hidden overflow-x-auto gap-1 border-t border-border/40 px-4 py-2">
          {navItems.map((item) => (
            <Button
              key={item.id}
              size="sm"
              variant={activeTab === item.id ? 'default' : 'ghost'}
              onClick={() => setActiveTab(item.id)}
              className="shrink-0 text-xs"
            >
              {item.label}
            </Button>
          ))}
        </div>
      </header>

      <main className="mx-auto max-w-[1440px] px-4 py-8 sm:px-6 space-y-6">
        {banner && (
          <div className="flex items-center justify-between rounded-xl border border-primary/40 bg-primary/10 px-4 py-2.5 text-xs">
            <span>{banner}</span>
            <button type="button" onClick={() => setBanner(null)} className="text-muted-foreground hover:text-foreground">
              Dismiss
            </button>
          </div>
        )}

        {/* STUDIO TAB */}
        {activeTab === 'studio' && (
          <div className="space-y-8">
            {/* SaaS KPI Strip */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { label: 'Total Executions', value: clips.length, sub: `${clips.filter((c) => c.executionStatus === 'COMPLETED').length} completed` },
                { label: 'Monthly Quota', value: `${workspace.clipsUsedThisPeriod} / ${workspace.monthlyClipLimit}`, sub: `${workspace.planTier} tier` },
                { label: 'Tagged Creators', value: creators.length, sub: `${routes.length} active routes` },
                { label: 'Publish Queue', value: posts.length, sub: `${posts.filter((p) => p.status.startsWith('PUBLISHED')).length} published` },
              ].map((m) => (
                <Card key={m.label} className="border-border/70 bg-card/80">
                  <CardContent className="pt-5">
                    <div className="text-xs text-muted-foreground">{m.label}</div>
                    <div className="font-display text-2xl font-bold mt-1">{m.value}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">{m.sub}</div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Floating Stream Composer */}
            <Card className="border-border/80 bg-card/90 shadow-xl backdrop-blur-xl">
              <CardHeader>
                <CardTitle className="font-display text-lg flex items-center gap-2">
                  <Video className="h-4 w-4 text-primary" /> Stream-to-Short Engine Composer
                </CardTitle>
                <CardDescription>
                  Ingest a stream clip, run compliance scoring, align voice-synced captions, synthesize SFX, and route to linked accounts.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleIngestClip} className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Tagged Creator</Label>
                    <select
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                      value={ingestCreatorId}
                      onChange={(e) => setIngestCreatorId(e.target.value)}
                    >
                      {creators.length === 0 && <option value="">No creators tagged yet — go to Creators tab</option>}
                      {creators.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.displayName} (@{c.handle} • {c.platform})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Stream / VOD URL</Label>
                    <Input value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} required />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Clip Hook / Title</Label>
                    <Input value={clipTitle} onChange={(e) => setClipTitle(e.target.value)} required />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Transcript Excerpt (for Compliance &amp; Subtitle Alignment)</Label>
                    <Input value={transcriptText} onChange={(e) => setTranscriptText(e.target.value)} required />
                  </div>
                  <div className="flex items-center justify-between md:col-span-2 pt-2">
                    <div className="flex items-center gap-2">
                      <Switch checked={enableSfx} onCheckedChange={setEnableSfx} />
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Volume2 className="h-3.5 w-3.5 text-primary" /> Procedural SFX Pack Enabled
                      </span>
                    </div>
                    <Button type="submit" disabled={busy}>
                      <Play className="mr-1.5 h-3.5 w-3.5" />
                      {busy ? 'Running Engine...' : 'Execute Clip Engine'}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            {/* 9:16 Cinema Gallery & Execution Lifecycle */}
            <div className="space-y-3">
              <h2 className="font-display text-lg font-semibold">Recent Engine Executions</h2>
              {clips.length === 0 ? (
                <Card className="border-dashed border-border/70 bg-card/40">
                  <CardContent className="py-10 text-center text-sm text-muted-foreground">
                    No clips executed yet. Tag a creator in the Creators tab, then run the Stream Composer above.
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {clips.map((clip) => (
                    <Card key={clip.id} className="border-border/70 bg-card/85 flex flex-col justify-between">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between gap-2">
                          <Badge variant={clip.executionStatus === 'COMPLETED' ? 'default' : 'outline'}>
                            {clip.executionStatus} • {clip.durationMs}ms
                          </Badge>
                          <Badge variant={clip.compliancePassed ? 'secondary' : 'destructive'}>
                            Score {clip.complianceScore}/100
                          </Badge>
                        </div>
                        <CardTitle className="font-display text-base pt-2">{clip.title}</CardTitle>
                        <CardDescription className="text-xs">
                          {clip.creator?.displayName ?? 'Creator'} • {clip.layout} • {clip.approvalStatus}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="rounded-lg bg-background/70 p-2.5 font-mono text-[10px] text-muted-foreground max-h-24 overflow-y-auto space-y-0.5">
                          {(clip.executionLogs ?? []).map((line, i) => (
                            <div key={i} className="truncate">{line}</div>
                          ))}
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {clip.approvalStatus === 'AWAITING_APPROVAL' && clip.compliancePassed && (
                            <>
                              <Button size="sm" onClick={() => handleClipDecision(clip.id, 'APPROVED')}>
                                <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Approve &amp; Publish
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => handleClipDecision(clip.id, 'REJECTED')}>
                                <XCircle className="mr-1 h-3.5 w-3.5" /> Reject
                              </Button>
                            </>
                          )}
                          {clip.executionStatus !== 'CANCELLED' ? (
                            <Button size="sm" variant="ghost" onClick={() => handleClipAction(clip.id, 'cancel')}>
                              Cancel
                            </Button>
                          ) : (
                            <Button size="sm" variant="outline" onClick={() => handleClipAction(clip.id, 'retry')}>
                              <RotateCcw className="mr-1 h-3.5 w-3.5" /> Retry
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* CREATORS TAB */}
        {activeTab === 'creators' && (
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="border-border/70 bg-card/85">
              <CardHeader>
                <CardTitle className="font-display text-base flex items-center gap-2">
                  <UserPlus className="h-4 w-4 text-primary" /> Tag Creator Account
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCreateCreator} className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <Input required placeholder="Handle (e.g. lacy)" value={cHandle} onChange={(e) => setCHandle(e.target.value)} />
                    <Input required placeholder="Display Name (e.g. Lacy)" value={cName} onChange={(e) => setCName(e.target.value)} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <select
                      className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                      value={cPlatform}
                      onChange={(e) => setCPlatform(e.target.value as 'TWITCH' | 'YOUTUBE' | 'KICK')}
                    >
                      <option value="TWITCH">TWITCH</option>
                      <option value="YOUTUBE">YOUTUBE</option>
                      <option value="KICK">KICK</option>
                    </select>
                    <Input placeholder="Channel URL" value={cUrl} onChange={(e) => setCUrl(e.target.value)} />
                  </div>
                  <Input placeholder="Required topics (comma-separated)" value={cTopics} onChange={(e) => setCTopics(e.target.value)} />
                  <Input placeholder="Banned keywords (comma-separated)" value={cBanned} onChange={(e) => setCBanned(e.target.value)} />
                  <Button type="submit" disabled={busy}>Tag Creator</Button>
                </form>
              </CardContent>
            </Card>

            <Card className="border-border/70 bg-card/85">
              <CardHeader>
                <CardTitle className="font-display text-base">Workspace Creators ({creators.length})</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2.5">
                {creators.map((c) => (
                  <div key={c.id} className="rounded-lg border border-border/60 p-3 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">{c.displayName} (@{c.handle})</span>
                      <Badge variant="outline">{c.platform}</Badge>
                    </div>
                    <div className="text-muted-foreground">
                      Topics: {c.requiredTopics.join(', ') || 'Any'} • Banned: {c.bannedKeywords.join(', ') || 'None'}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        )}

        {/* ROUTING TAB */}
        {activeTab === 'routing' && (
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="border-border/70 bg-card/85">
              <CardHeader>
                <CardTitle className="font-display text-base flex items-center gap-2">
                  <Link2 className="h-4 w-4 text-primary" /> Link Social Clipping Account
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <form onSubmit={handleLinkAccount} className="space-y-3">
                  <select
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={aPlatform}
                    onChange={(e) =>
                      setAPlatform(e.target.value as 'INSTAGRAM_REELS' | 'TIKTOK' | 'YOUTUBE_SHORTS' | 'X')
                    }
                  >
                    <option value="INSTAGRAM_REELS">INSTAGRAM_REELS</option>
                    <option value="TIKTOK">TIKTOK</option>
                    <option value="YOUTUBE_SHORTS">YOUTUBE_SHORTS</option>
                    <option value="X">X</option>
                  </select>
                  <Input required placeholder="Account Name" value={aName} onChange={(e) => setAName(e.target.value)} />
                  <Input required placeholder="Handle (@lacy.clips)" value={aHandle} onChange={(e) => setAHandle(e.target.value)} />
                  <div className="flex items-center gap-2">
                    <Switch checked={aAuto} onCheckedChange={setAAuto} />
                    <span className="text-xs text-muted-foreground">Opt-in Auto-Publish Compliant Clips</span>
                  </div>
                  <Button type="submit" disabled={busy}>Link Account</Button>
                </form>

                <div className="space-y-2 pt-2">
                  {accounts.map((a) => (
                    <div key={a.id} className="flex items-center justify-between rounded-lg border border-border/60 p-2.5 text-xs">
                      <div>
                        <div className="font-medium">{a.accountName} ({a.accountHandle})</div>
                        <div className="text-muted-foreground">{a.platform} • {a.integrationMode}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-muted-foreground">Auto</span>
                        <Switch
                          checked={a.autoPublishApproved}
                          onCheckedChange={(v) => handleToggleAutoPublish(a.id, v)}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/70 bg-card/85">
              <CardHeader>
                <CardTitle className="font-display text-base flex items-center gap-2">
                  <GitBranch className="h-4 w-4 text-primary" /> Creator → Account Routing Rules
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <form onSubmit={handleCreateRoute} className="space-y-3">
                  <select
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={rCreatorId}
                    onChange={(e) => setRCreatorId(e.target.value)}
                  >
                    <option value="">Select Creator</option>
                    {creators.map((c) => (
                      <option key={c.id} value={c.id}>{c.displayName} (@{c.handle})</option>
                    ))}
                  </select>
                  <select
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={rAccountId}
                    onChange={(e) => setRAccountId(e.target.value)}
                  >
                    <option value="">Select Social Account</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>{a.accountHandle} ({a.platform})</option>
                    ))}
                  </select>
                  <Button type="submit" disabled={busy || !rCreatorId || !rAccountId}>Create Route</Button>
                </form>

                <div className="space-y-2 pt-2">
                  {routes.map((r) => (
                    <div key={r.id} className="flex items-center justify-between rounded-lg border border-border/60 p-2.5 text-xs">
                      <span>
                        <strong>@{r.creator?.handle}</strong> → <strong>{r.socialAccount?.accountHandle}</strong>
                      </span>
                      <Badge variant="outline">Min Score {r.minComplianceScore}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* QUEUE TAB */}
        {activeTab === 'queue' && (
          <Card className="border-border/70 bg-card/85">
            <CardHeader>
              <CardTitle className="font-display text-base flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary" /> Publish Queue &amp; Distribution Log
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {posts.length === 0 ? (
                <p className="text-xs text-muted-foreground">No routed posts yet.</p>
              ) : (
                posts.map((p) => (
                  <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 p-3 text-xs">
                    <div>
                      <div className="font-semibold">{p.clipJob?.title ?? 'Clip'} → {p.socialAccount?.accountHandle}</div>
                      <div className="text-muted-foreground">{p.platform} • {p.executionMode}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={p.status.startsWith('PUBLISHED') ? 'default' : 'outline'}>{p.status}</Badge>
                      {p.status === 'AWAITING_APPROVAL' && (
                        <Button size="sm" onClick={() => handleManualPublish(p.id)}>Publish Now</Button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        )}

        {/* BILLING TAB */}
        {activeTab === 'billing' && (
          <BillingView
            token={token}
            workspace={workspace}
            plans={plans}
            onWorkspaceUpdated={() => loadWorkspaceData(token)}
            onNotify={setBanner}
          />
        )}

        {/* SETTINGS & API KEYS TAB */}
        {activeTab === 'settings' && (
          <SettingsAndKeysView
            token={token}
            user={user}
            workspace={workspace}
            onUpdated={() => loadWorkspaceData(token)}
            onNotify={setBanner}
          />
        )}

        {/* SUPPORT & DOCS TAB */}
        {activeTab === 'support' && <SupportAndDocsView token={token} onNotify={setBanner} />}

        {/* SUPER-ADMIN TAB */}
        {activeTab === 'admin' && user.systemRole === 'SUPER_ADMIN' && (
          <SuperAdminView token={token} onNotify={setBanner} />
        )}
      </main>
    </div>
  );
}
