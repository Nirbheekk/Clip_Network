'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  Film,
  GitBranch,
  LayoutDashboard,
  Lock,
  Moon,
  Plus,
  Radio,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  Sun,
  Users,
  Volume2,
  XCircle,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input, NativeSelect, Textarea } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

const API = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4100';

type NavKey = 'overview' | 'creators' | 'accounts' | 'ingest' | 'queue';

interface CreatorDto {
  id: string;
  handle: string;
  displayName: string;
  platform: string;
  channelUrl: string;
  tags: string[];
  requiredTopics: string[];
  defaultLayout: string;
  defaultCaptionStyle: string;
  enableSfx: boolean;
}

interface SocialAccountDto {
  id: string;
  platform: string;
  accountName: string;
  accountHandle: string;
  autoPublishApproved: boolean;
  integrationMode: string;
  hasEncryptedToken: boolean;
}

interface RouteDto {
  id: string;
  creatorId: string;
  socialAccountId: string;
  minComplianceScore: number;
  creator: { displayName: string; handle: string };
  socialAccount: { accountHandle: string; platform: string };
}

interface ClipDto {
  id: string;
  title: string;
  sourceUrl: string;
  durationSec: number;
  compliancePassed: boolean;
  complianceScore: number;
  approvalStatus: string;
  enableSfx: boolean;
  assScript: string;
  creator: { displayName: string; handle: string };
  sfxCues: Array<{ preset: string; atSec: number }>;
  complianceReport: {
    matchedTopics: string[];
    disqualifiersTriggered: string[];
    reasons: string[];
  };
}

interface PublishPostDto {
  id: string;
  platform: string;
  captionText: string;
  status: string;
  executionMode: string;
  externalPostId: string | null;
  socialAccount: { accountHandle: string };
  clipJob: { title: string };
}

const NAV_ITEMS: Array<{ key: NavKey; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { key: 'overview', label: 'Command Center', icon: LayoutDashboard },
  { key: 'creators', label: 'Tagged Creators', icon: Users },
  { key: 'accounts', label: 'Clipping Accounts', icon: GitBranch },
  { key: 'ingest', label: 'Stream Ingest', icon: Film },
  { key: 'queue', label: 'Publish Queue', icon: Send },
];

export default function ClipNetworkApp() {
  const [nav, setNav] = useState<NavKey>('overview');
  const [dark, setDark] = useState(true);
  const [apiHealthy, setApiHealthy] = useState<boolean | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const [creators, setCreators] = useState<CreatorDto[]>([]);
  const [accounts, setAccounts] = useState<SocialAccountDto[]>([]);
  const [routes, setRoutes] = useState<RouteDto[]>([]);
  const [clips, setClips] = useState<ClipDto[]>([]);
  const [queue, setQueue] = useState<PublishPostDto[]>([]);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [queueFilter, setQueueFilter] = useState<'ALL' | 'AWAITING_APPROVAL' | 'PUBLISHED'>('ALL');
  const [expandedClipId, setExpandedClipId] = useState<string | null>(null);

  // Forms
  const [cHandle, setCHandle] = useState('stokestwins');
  const [cName, setCName] = useState('Stokes Twins');
  const [cPlatform, setCPlatform] = useState('YOUTUBE');
  const [cUrl, setCUrl] = useState('https://www.youtube.com/@StokesTwins');
  const [cTopics, setCTopics] = useState('Microsoft, Curry Barker, Stokes Twins');
  const [cLayout, setCLayout] = useState('CENTER_CROP_9_16');
  const [cEnableSfx, setCEnableSfx] = useState(true);

  const [sPlatform, setSPlatform] = useState('INSTAGRAM_REELS');
  const [sName, setSName] = useState('Viral Shorts Network IG');
  const [sHandle, setSHandle] = useState('@viralshorts_net');
  const [sToken, setSToken] = useState('');
  const [sAutoPub, setSAutoPub] = useState(false);

  const [rCreatorId, setRCreatorId] = useState('');
  const [rAccountId, setRAccountId] = useState('');
  const [rMinScore, setRMinScore] = useState(75);

  const [iCreatorId, setICreatorId] = useState('');
  const [iUrl, setIUrl] = useState('https://www.twitch.tv/videos/2933767012');
  const [iTitle, setITitle] = useState('Lacy GTA 6 Marathon — 30M Views Clipping Roast');
  const [iTranscript, setITranscript] = useState(
    'Day two GTA 6 Marathon! My clipping campaign got 30 million views yesterday, you are just doing something wrong bro.',
  );
  const [iEnableSfx, setIEnableSfx] = useState(true);
  const [busy, setBusy] = useState(false);

  const toggleTheme = () => {
    setDark((prev) => {
      const next = !prev;
      if (typeof document !== 'undefined') {
        document.documentElement.classList.toggle('dark', next);
      }
      return next;
    });
  };

  const loadAll = useCallback(async () => {
    setRefreshing(true);
    try {
      const [h, c, a, r, cl, q] = await Promise.all([
        fetch(`${API}/api/health`).then((x) => x.json()),
        fetch(`${API}/api/v1/creators`).then((x) => x.json()),
        fetch(`${API}/api/v1/social-accounts`).then((x) => x.json()),
        fetch(`${API}/api/v1/routes`).then((x) => x.json()),
        fetch(`${API}/api/v1/clips`).then((x) => x.json()),
        fetch(`${API}/api/v1/publish-queue`).then((x) => x.json()),
      ]);
      setApiHealthy(Boolean(h?.success));
      setCreators(c.data ?? []);
      setAccounts(a.data ?? []);
      setRoutes(r.data ?? []);
      setClips(cl.data ?? []);
      setQueue(q.data ?? []);
      if (!rCreatorId && c.data?.[0]) setRCreatorId(c.data[0].id);
      if (!iCreatorId && c.data?.[0]) setICreatorId(c.data[0].id);
      if (!rAccountId && a.data?.[0]) setRAccountId(a.data[0].id);
    } catch {
      setApiHealthy(false);
    } finally {
      setRefreshing(false);
    }
  }, [iCreatorId, rAccountId, rCreatorId]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const handleCreateCreator = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch(`${API}/api/v1/creators`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          handle: cHandle.trim(),
          displayName: cName.trim(),
          platform: cPlatform,
          channelUrl: cUrl.trim(),
          tags: [cHandle.trim(), cPlatform],
          requiredTopics: cTopics.split(',').map((s) => s.trim()).filter(Boolean),
          disallowLogos: true,
          defaultLayout: cLayout,
          enableSfx: cEnableSfx,
        }),
      });
      if (!res.ok) throw new Error('Creator handle already tagged or invalid input.');
      setNotice({ type: 'success', text: `Tagged creator @${cHandle.trim()} for automated clipping.` });
      await loadAll();
    } catch (err) {
      setNotice({ type: 'error', text: err instanceof Error ? err.message : 'Failed to tag creator' });
    } finally {
      setBusy(false);
    }
  };

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch(`${API}/api/v1/social-accounts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform: sPlatform,
          accountName: sName.trim(),
          accountHandle: sHandle.trim(),
          ...(sToken.trim().length >= 4 ? { accessToken: sToken.trim() } : {}),
          autoPublishApproved: sAutoPub,
        }),
      });
      if (!res.ok) throw new Error('Account already linked or invalid input.');
      setSToken('');
      setNotice({ type: 'success', text: `Linked clipping account ${sHandle.trim()} (${sPlatform}).` });
      await loadAll();
    } catch (err) {
      setNotice({ type: 'error', text: err instanceof Error ? err.message : 'Failed to link account' });
    } finally {
      setBusy(false);
    }
  };

  const handleToggleAutoPublish = async (acct: SocialAccountDto, checked: boolean) => {
    await fetch(`${API}/api/v1/social-accounts/${acct.id}/auto-publish`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ autoPublishApproved: checked }),
    });
    setNotice({
      type: 'success',
      text: `${acct.accountHandle}: ${checked ? 'Opt-in Auto-Publish enabled' : 'Human Approval Gate enforced'}.`,
    });
    await loadAll();
  };

  const handleCreateRoute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rCreatorId || !rAccountId) return;
    setBusy(true);
    try {
      const res = await fetch(`${API}/api/v1/routes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creatorId: rCreatorId,
          socialAccountId: rAccountId,
          minComplianceScore: rMinScore,
          hashtags: ['#ViralClips'],
        }),
      });
      if (!res.ok) throw new Error('Route already exists between this creator and account.');
      setNotice({ type: 'success', text: 'Created automated Creator → Clipping Account route.' });
      await loadAll();
    } catch (err) {
      setNotice({ type: 'error', text: err instanceof Error ? err.message : 'Failed to create route' });
    } finally {
      setBusy(false);
    }
  };

  const handleIngest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!iCreatorId) return;
    setBusy(true);
    try {
      const res = await fetch(`${API}/api/v1/clips/ingest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creatorId: iCreatorId,
          sourceUrl: iUrl.trim(),
          title: iTitle.trim(),
          startSec: 27.8,
          endSec: 78.7,
          transcriptText: iTranscript.trim(),
          enableSfx: iEnableSfx,
        }),
      });
      if (!res.ok) throw new Error('Stream ingest failed.');
      setNotice({
        type: 'success',
        text: 'Clip ingested, compliance-checked, subtitled, SFX-mapped, and routed.',
      });
      await loadAll();
    } catch (err) {
      setNotice({ type: 'error', text: err instanceof Error ? err.message : 'Ingest failed' });
    } finally {
      setBusy(false);
    }
  };

  const handleDecideClip = async (clipId: string, decision: 'APPROVED' | 'REJECTED') => {
    setBusy(true);
    try {
      await fetch(`${API}/api/v1/clips/${clipId}/decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision }),
      });
      setNotice({
        type: 'success',
        text:
          decision === 'APPROVED'
            ? 'Clip approved and published to linked clipping accounts.'
            : 'Clip rejected and blocked from publishing.',
      });
      await loadAll();
    } finally {
      setBusy(false);
    }
  };

  const publishedCount = queue.filter((p) => p.status.startsWith('PUBLISHED')).length;
  const awaitingCount = queue.filter((p) => p.status === 'AWAITING_APPROVAL').length;
  const filteredQueue = queue.filter((p) => {
    if (queueFilter === 'AWAITING_APPROVAL') return p.status === 'AWAITING_APPROVAL';
    if (queueFilter === 'PUBLISHED') return p.status.startsWith('PUBLISHED');
    return true;
  });

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-background text-foreground">
      {/* Stationary Sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-card/80 md:flex">
        <div className="flex h-16 items-center gap-2.5 border-b border-border px-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <div className="text-sm font-semibold tracking-tight">Clip Network</div>
            <div className="text-[11px] text-muted-foreground">Stream-to-Social OS</div>
          </div>
        </div>

        <nav className="flex-1 space-y-1 p-3">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = nav === item.key;
            const count =
              item.key === 'creators'
                ? creators.length
                : item.key === 'accounts'
                  ? accounts.length
                  : item.key === 'ingest'
                    ? clips.length
                    : item.key === 'queue'
                      ? queue.length
                      : null;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setNav(item.key)}
                className={cn(
                  'flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  active
                    ? 'bg-accent text-accent-foreground shadow-sm'
                    : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
                )}
              >
                <span className="flex items-center gap-2.5">
                  <Icon className="h-4 w-4" />
                  {item.label}
                </span>
                {count !== null && (
                  <span className="rounded-md bg-background/80 px-1.5 py-0.5 text-[11px] font-mono tabular-nums">
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="border-t border-border p-4">
          <div className="flex items-center justify-between rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs">
            <span className="flex items-center gap-2 font-medium">
              <span
                className={cn(
                  'h-2 w-2 rounded-full',
                  apiHealthy ? 'bg-success' : 'bg-warning',
                )}
              />
              API Engine
            </span>
            <span className="font-mono text-[11px] text-muted-foreground">
              {apiHealthy ? 'ONLINE' : 'OFFLINE'}
            </span>
          </div>
        </div>
      </aside>

      {/* Main Scrollable Stage */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-border bg-card/60 px-5 backdrop-blur">
          <div className="flex items-center gap-3">
            <h1 className="text-base font-semibold tracking-tight">
              {NAV_ITEMS.find((n) => n.key === nav)?.label}
            </h1>
            <Badge variant="ai" className="hidden sm:inline-flex">
              <ShieldCheck className="h-3 w-3" />
              Human Gate Default • Opt-In Auto-Publish
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => void loadAll()} disabled={refreshing}>
              <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
              Sync
            </Button>
            <Button variant="outline" size="icon" onClick={toggleTheme} aria-label="Toggle theme">
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
          </div>
        </header>

        {/* Mobile Nav Strip */}
        <div className="flex gap-1.5 overflow-x-auto border-b border-border bg-card px-4 py-2 md:hidden">
          {NAV_ITEMS.map((item) => (
            <Button
              key={item.key}
              size="sm"
              variant={nav === item.key ? 'default' : 'outline'}
              onClick={() => setNav(item.key)}
            >
              {item.label}
            </Button>
          ))}
        </div>

        <main className="flex-1 overflow-y-auto p-5 lg:p-7">
          <div className="mx-auto max-w-6xl space-y-6">
            {notice && (
              <div
                className={cn(
                  'flex items-center justify-between rounded-xl border px-4 py-2.5 text-xs font-medium',
                  notice.type === 'success'
                    ? 'border-success/40 bg-success/10 text-success'
                    : 'border-destructive/40 bg-destructive/10 text-destructive',
                )}
              >
                <span>{notice.text}</span>
                <button
                  type="button"
                  onClick={() => setNotice(null)}
                  className="text-xs opacity-75 hover:opacity-100"
                >
                  Dismiss
                </button>
              </div>
            )}

            {/* KPI Strip */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center justify-between">
                    <span>Tagged Creators</span>
                    <Radio className="h-4 w-4 text-primary" />
                  </CardDescription>
                  <CardTitle className="text-2xl font-bold tabular-nums">{creators.length}</CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-muted-foreground">
                  Monitored Twitch, YouTube &amp; Kick channels
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center justify-between">
                    <span>Clipping Accounts</span>
                    <GitBranch className="h-4 w-4 text-primary" />
                  </CardDescription>
                  <CardTitle className="text-2xl font-bold tabular-nums">{accounts.length}</CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-muted-foreground">
                  {routes.length} active Creator → Account route(s)
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center justify-between">
                    <span>Awaiting Approval</span>
                    <Activity className="h-4 w-4 text-warning" />
                  </CardDescription>
                  <CardTitle className="text-2xl font-bold tabular-nums">{awaitingCount}</CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-muted-foreground">
                  Held safely by Human Approval Gate
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center justify-between">
                    <span>Published Clips</span>
                    <CheckCircle2 className="h-4 w-4 text-success" />
                  </CardDescription>
                  <CardTitle className="text-2xl font-bold tabular-nums">{publishedCount}</CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-muted-foreground">
                  Voice-synced subtitles + procedural SFX
                </CardContent>
              </Card>
            </div>

            {/* OVERVIEW */}
            {nav === 'overview' && (
              <div className="grid gap-5 lg:grid-cols-12">
                <Card className="lg:col-span-7">
                  <CardHeader>
                    <CardTitle>Automated Clip Network Pipeline</CardTitle>
                    <CardDescription>
                      Tag source creators, route to linked clipping accounts, and enforce campaign compliance automatically.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {[
                      {
                        step: '1',
                        title: 'Tag Creator Accounts',
                        desc: 'Register Twitch/YouTube creators with campaign rules, zero-logo guard, and SFX defaults.',
                        action: () => setNav('creators'),
                        cta: 'Manage Creators',
                      },
                      {
                        step: '2',
                        title: 'Link Clipping Accounts & Routing',
                        desc: 'Connect Instagram Reels, TikTok, Shorts & X with AES-256-GCM encrypted tokens and opt-in auto-publish.',
                        action: () => setNav('accounts'),
                        cta: 'Configure Routes',
                      },
                      {
                        step: '3',
                        title: 'Ingest Streams → Subtitles + SFX → Publish',
                        desc: 'Extract voice-synced 9:16 shorts with procedural SFX and route compliant clips automatically.',
                        action: () => setNav('ingest'),
                        cta: 'Open Ingest Studio',
                      },
                    ].map((s) => (
                      <div
                        key={s.step}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-muted/30 p-3.5"
                      >
                        <div className="flex items-start gap-3">
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                            {s.step}
                          </span>
                          <div>
                            <div className="text-sm font-semibold">{s.title}</div>
                            <p className="text-xs text-muted-foreground">{s.desc}</p>
                          </div>
                        </div>
                        <Button size="sm" variant="outline" onClick={s.action}>
                          {s.cta}
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card className="lg:col-span-5">
                  <CardHeader>
                    <CardTitle>Recent Routed Activity</CardTitle>
                    <CardDescription>Latest clips pushed through your network.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2.5">
                    {queue.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        No routed clips yet. Ingest a stream to see live routing.
                      </p>
                    ) : (
                      queue.slice(0, 5).map((p) => (
                        <div
                          key={p.id}
                          className="rounded-xl border border-border bg-muted/25 p-3 text-xs"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold">{p.socialAccount.accountHandle}</span>
                            <Badge variant={p.status.startsWith('PUBLISHED') ? 'success' : 'warning'}>
                              {p.status}
                            </Badge>
                          </div>
                          <p className="mt-1 truncate text-muted-foreground">{p.clipJob.title}</p>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

            {/* TAGGED CREATORS */}
            {nav === 'creators' && (
              <div className="grid gap-5 lg:grid-cols-12">
                <Card className="lg:col-span-5">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Plus className="h-4 w-4 text-primary" />
                      Tag Creator Account
                    </CardTitle>
                    <CardDescription>
                      Configure source channel, campaign rules, zero-logo protection, and SFX defaults.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleCreateCreator} className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label>Handle</Label>
                          <Input value={cHandle} onChange={(e) => setCHandle(e.target.value)} required />
                        </div>
                        <div className="space-y-1">
                          <Label>Display Name</Label>
                          <Input value={cName} onChange={(e) => setCName(e.target.value)} required />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label>Platform</Label>
                          <NativeSelect value={cPlatform} onChange={(e) => setCPlatform(e.target.value)}>
                            <option value="TWITCH">Twitch</option>
                            <option value="YOUTUBE">YouTube</option>
                            <option value="KICK">Kick</option>
                          </NativeSelect>
                        </div>
                        <div className="space-y-1">
                          <Label>Default Layout</Label>
                          <NativeSelect value={cLayout} onChange={(e) => setCLayout(e.target.value)}>
                            <option value="SPLIT_FACECAM_BOTTOM">Split-Screen Facecam</option>
                            <option value="CENTER_CROP_9_16">9:16 Center Crop</option>
                          </NativeSelect>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label>Channel URL</Label>
                        <Input value={cUrl} onChange={(e) => setCUrl(e.target.value)} required />
                      </div>
                      <div className="space-y-1">
                        <Label>Required Campaign Topics (comma-separated)</Label>
                        <Input value={cTopics} onChange={(e) => setCTopics(e.target.value)} />
                      </div>
                      <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2">
                        <span className="flex items-center gap-2 text-xs font-medium">
                          <Volume2 className="h-3.5 w-3.5 text-primary" />
                          Auto Procedural SFX (`WHOOSH`/`POP`/`BOOM`)
                        </span>
                        <Switch checked={cEnableSfx} onCheckedChange={setCEnableSfx} />
                      </div>
                      <Button type="submit" className="w-full" disabled={busy}>
                        Tag Creator Account
                      </Button>
                    </form>
                  </CardContent>
                </Card>

                <Card className="lg:col-span-7">
                  <CardHeader>
                    <CardTitle>Monitored Creators ({creators.length})</CardTitle>
                    <CardDescription>Active source channels with campaign guardrails.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {creators.map((c) => (
                      <div
                        key={c.id}
                        className="rounded-xl border border-border bg-muted/25 p-4 text-xs"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <span className="text-sm font-semibold">{c.displayName}</span>
                            <span className="ml-2 font-mono text-muted-foreground">@{c.handle}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Badge variant="ai">{c.platform}</Badge>
                            <Badge variant="outline">{c.defaultLayout}</Badge>
                            {c.enableSfx && <Badge variant="success">SFX ON</Badge>}
                          </div>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {c.requiredTopics.map((t) => (
                            <Badge key={t} variant="secondary">
                              {t}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            )}

            {/* CLIPPING ACCOUNTS & ROUTING */}
            {nav === 'accounts' && (
              <div className="grid gap-5 lg:grid-cols-12">
                <div className="space-y-5 lg:col-span-5">
                  <Card>
                    <CardHeader>
                      <CardTitle>Link Clipping Social Account</CardTitle>
                      <CardDescription>
                        Tokens encrypted at rest with AES-256-GCM. Human approval is ON by default.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <form onSubmit={handleCreateAccount} className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label>Platform</Label>
                            <NativeSelect value={sPlatform} onChange={(e) => setSPlatform(e.target.value)}>
                              <option value="INSTAGRAM_REELS">Instagram Reels</option>
                              <option value="TIKTOK">TikTok</option>
                              <option value="YOUTUBE_SHORTS">YouTube Shorts</option>
                              <option value="X">X (Twitter)</option>
                            </NativeSelect>
                          </div>
                          <div className="space-y-1">
                            <Label>Handle</Label>
                            <Input value={sHandle} onChange={(e) => setSHandle(e.target.value)} required />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <Label>Account Label</Label>
                          <Input value={sName} onChange={(e) => setSName(e.target.value)} required />
                        </div>
                        <div className="space-y-1">
                          <Label>OAuth / Postiz Token (Optional — Sandbox if empty)</Label>
                          <Input
                            type="password"
                            value={sToken}
                            onChange={(e) => setSToken(e.target.value)}
                            placeholder="Encrypted via AES-256-GCM"
                          />
                        </div>
                        <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2">
                          <span className="text-xs font-medium">Opt-In Auto-Publish Compliant Clips</span>
                          <Switch checked={sAutoPub} onCheckedChange={setSAutoPub} />
                        </div>
                        <Button type="submit" className="w-full" disabled={busy}>
                          Link Clipping Account
                        </Button>
                      </form>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Route Creator → Clipping Account</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <form onSubmit={handleCreateRoute} className="space-y-3">
                        <div className="space-y-1">
                          <Label>Source Creator</Label>
                          <NativeSelect value={rCreatorId} onChange={(e) => setRCreatorId(e.target.value)}>
                            {creators.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.displayName} (@{c.handle})
                              </option>
                            ))}
                          </NativeSelect>
                        </div>
                        <div className="space-y-1">
                          <Label>Target Clipping Account</Label>
                          <NativeSelect value={rAccountId} onChange={(e) => setRAccountId(e.target.value)}>
                            {accounts.map((a) => (
                              <option key={a.id} value={a.id}>
                                {a.accountHandle} ({a.platform})
                              </option>
                            ))}
                          </NativeSelect>
                        </div>
                        <div className="space-y-1">
                          <Label>Minimum Compliance QA Score</Label>
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            value={rMinScore}
                            onChange={(e) => setRMinScore(Number(e.target.value))}
                          />
                        </div>
                        <Button type="submit" className="w-full" disabled={busy}>
                          Bind Routing Rule
                        </Button>
                      </form>
                    </CardContent>
                  </Card>
                </div>

                <Card className="lg:col-span-7">
                  <CardHeader>
                    <CardTitle>Connected Clipping Network</CardTitle>
                    <CardDescription>Toggle per-account auto-publish policy and inspect active routes.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2.5">
                      {accounts.map((a) => (
                        <div
                          key={a.id}
                          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-muted/25 p-3.5 text-xs"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold">{a.accountHandle}</span>
                              <Badge variant="outline">{a.platform}</Badge>
                              <Badge variant={a.integrationMode === 'LIVE_OAUTH' ? 'success' : 'warning'}>
                                {a.integrationMode}
                              </Badge>
                              {a.hasEncryptedToken && (
                                <Badge variant="secondary">
                                  <Lock className="h-3 w-3" />
                                  Encrypted
                                </Badge>
                              )}
                            </div>
                            <p className="text-muted-foreground">{a.accountName}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground">
                              {a.autoPublishApproved ? 'Auto-Publish ON' : 'Human Gate'}
                            </span>
                            <Switch
                              checked={a.autoPublishApproved}
                              onCheckedChange={(checked) => void handleToggleAutoPublish(a, checked)}
                            />
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="border-t border-border pt-4">
                      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Active Routing Matrix ({routes.length})
                      </h4>
                      <div className="space-y-2">
                        {routes.map((r) => (
                          <div
                            key={r.id}
                            className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2 text-xs"
                          >
                            <span className="flex items-center gap-2">
                              <Badge variant="secondary">@{r.creator.handle}</Badge>
                              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                              <strong>{r.socialAccount.accountHandle}</strong>
                              <span className="text-muted-foreground">({r.socialAccount.platform})</span>
                            </span>
                            <Badge variant="outline">Min QA {r.minComplianceScore}</Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* STREAM INGEST & CLIPS */}
            {nav === 'ingest' && (
              <div className="grid gap-5 lg:grid-cols-12">
                <Card className="lg:col-span-5">
                  <CardHeader>
                    <CardTitle>Ingest Stream / VOD</CardTitle>
                    <CardDescription>
                      Runs compliance checks, builds ASS karaoke captions, maps procedural SFX, and routes to linked accounts.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleIngest} className="space-y-3">
                      <div className="space-y-1">
                        <Label>Tagged Creator</Label>
                        <NativeSelect value={iCreatorId} onChange={(e) => setICreatorId(e.target.value)}>
                          {creators.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.displayName} (@{c.handle})
                            </option>
                          ))}
                        </NativeSelect>
                      </div>
                      <div className="space-y-1">
                        <Label>Twitch / YouTube VOD URL</Label>
                        <Input value={iUrl} onChange={(e) => setIUrl(e.target.value)} required />
                      </div>
                      <div className="space-y-1">
                        <Label>Clip Title / Hook</Label>
                        <Input value={iTitle} onChange={(e) => setITitle(e.target.value)} required />
                      </div>
                      <div className="space-y-1">
                        <Label>Detected Speech / Transcript</Label>
                        <Textarea rows={4} value={iTranscript} onChange={(e) => setITranscript(e.target.value)} />
                      </div>
                      <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2">
                        <span className="flex items-center gap-2 text-xs font-medium">
                          <Volume2 className="h-3.5 w-3.5 text-primary" />
                          Mix Procedural SFX (`-14 LUFS`)
                        </span>
                        <Switch checked={iEnableSfx} onCheckedChange={setIEnableSfx} />
                      </div>
                      <Button type="submit" className="w-full" disabled={busy || !iCreatorId}>
                        <Sparkles className="h-4 w-4" />
                        Run Compliance, Subtitles, SFX &amp; Route
                      </Button>
                    </form>
                  </CardContent>
                </Card>

                <Card className="lg:col-span-7">
                  <CardHeader>
                    <CardTitle>Processed Clips ({clips.length})</CardTitle>
                    <CardDescription>Inspect QA compliance, SFX cue sheets, and approve for distribution.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {clips.map((c) => (
                      <div key={c.id} className="rounded-xl border border-border bg-muted/25 p-4 text-xs">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <div className="text-sm font-semibold">{c.title}</div>
                            <div className="mt-0.5 text-muted-foreground">
                              @{c.creator.handle} • {c.durationSec}s
                            </div>
                          </div>
                          <Badge variant={c.compliancePassed ? 'success' : 'destructive'}>
                            QA {c.complianceScore} • {c.approvalStatus}
                          </Badge>
                        </div>

                        <div className="mt-2.5 flex flex-wrap gap-1.5">
                          {c.sfxCues.map((s, idx) => (
                            <Badge key={idx} variant="ai">
                              <Volume2 className="h-3 w-3" />
                              {s.preset} @ {s.atSec}s
                            </Badge>
                          ))}
                          {c.complianceReport?.matchedTopics?.map((t) => (
                            <Badge key={t} variant="secondary">
                              Matched: {t}
                            </Badge>
                          ))}
                        </div>

                        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2.5">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setExpandedClipId(expandedClipId === c.id ? null : c.id)}
                          >
                            {expandedClipId === c.id ? 'Hide ASS Subtitles' : 'Inspect ASS Subtitles'}
                          </Button>
                          {c.approvalStatus === 'AWAITING_APPROVAL' && (
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={busy}
                                onClick={() => void handleDecideClip(c.id, 'REJECTED')}
                              >
                                <XCircle className="h-3.5 w-3.5" />
                                Reject
                              </Button>
                              <Button
                                size="sm"
                                disabled={busy}
                                onClick={() => void handleDecideClip(c.id, 'APPROVED')}
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                Approve &amp; Publish
                              </Button>
                            </div>
                          )}
                        </div>

                        {expandedClipId === c.id && (
                          <pre className="mt-2.5 max-h-40 overflow-auto rounded-lg border border-border bg-background p-2.5 font-mono text-[11px] text-muted-foreground">
                            {c.assScript}
                          </pre>
                        )}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            )}

            {/* PUBLISH QUEUE */}
            {nav === 'queue' && (
              <Card>
                <CardHeader>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <CardTitle>Routed Publish Queue</CardTitle>
                      <CardDescription>
                        Every routed post is idempotent and transparently labeled (`SANDBOX_SIMULATED` vs `LIVE_OAUTH`).
                      </CardDescription>
                    </div>
                    <Tabs
                      value={queueFilter}
                      onValueChange={(v) =>
                        setQueueFilter(v as 'ALL' | 'AWAITING_APPROVAL' | 'PUBLISHED')
                      }
                    >
                      <TabsList>
                        <TabsTrigger value="ALL">All ({queue.length})</TabsTrigger>
                        <TabsTrigger value="AWAITING_APPROVAL">Awaiting ({awaitingCount})</TabsTrigger>
                        <TabsTrigger value="PUBLISHED">Published ({publishedCount})</TabsTrigger>
                      </TabsList>
                      <TabsContent value="ALL" className="hidden" />
                      <TabsContent value="AWAITING_APPROVAL" className="hidden" />
                      <TabsContent value="PUBLISHED" className="hidden" />
                    </Tabs>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {filteredQueue.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No posts match this filter.</p>
                  ) : (
                    filteredQueue.map((p) => (
                      <div
                        key={p.id}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-muted/25 p-4 text-xs"
                      >
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-semibold">{p.socialAccount.accountHandle}</span>
                            <Badge variant="outline">{p.platform}</Badge>
                            <Badge
                              variant={
                                p.status.startsWith('PUBLISHED')
                                  ? 'success'
                                  : p.status === 'BLOCKED'
                                    ? 'destructive'
                                    : 'warning'
                              }
                            >
                              {p.status} • {p.executionMode}
                            </Badge>
                          </div>
                          <p className="text-foreground">{p.captionText}</p>
                          {p.externalPostId && (
                            <p className="font-mono text-[11px] text-muted-foreground">
                              Ref: {p.externalPostId}
                            </p>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
