'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Film,
  Flame,
  GitBranch,
  Lock,
  Moon,
  Play,
  Plus,
  Radio,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  Subtitles,
  Sun,
  Users,
  Volume2,
  X,
  Zap,
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

type SectionKey = 'studio' | 'creators' | 'routing' | 'queue';

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

export default function ClipNetworkStudio() {
  const [section, setSection] = useState<SectionKey>('studio');
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
  const [showAdvancedComposer, setShowAdvancedComposer] = useState(false);

  // Composer state
  const [iCreatorId, setICreatorId] = useState('');
  const [iUrl, setIUrl] = useState('https://www.twitch.tv/videos/2933767012');
  const [iTitle, setITitle] = useState('Lacy GTA 6 Marathon — 30M Views Clipping Roast');
  const [iTranscript, setITranscript] = useState(
    'Day two GTA 6 Marathon! My clipping campaign got 30 million views yesterday, you are just doing something wrong bro.',
  );
  const [iLayout, setILayout] = useState('SPLIT_FACECAM_BOTTOM');
  const [iCaptionStyle, setICaptionStyle] = useState('HIGH_ENERGY');
  const [iEnableSfx, setIEnableSfx] = useState(true);

  // Creator form
  const [cHandle, setCHandle] = useState('stokestwins');
  const [cName, setCName] = useState('Stokes Twins');
  const [cPlatform, setCPlatform] = useState('YOUTUBE');
  const [cUrl, setCUrl] = useState('https://www.youtube.com/@StokesTwins');
  const [cTopics, setCTopics] = useState('Microsoft, Curry Barker, Stokes Twins');
  const [cLayout, setCLayout] = useState('CENTER_CROP_9_16');
  const [cEnableSfx, setCEnableSfx] = useState(true);

  // Social Account & Route forms
  const [sPlatform, setSPlatform] = useState('INSTAGRAM_REELS');
  const [sName, setSName] = useState('Viral Shorts Network IG');
  const [sHandle, setSHandle] = useState('@viralshorts_net');
  const [sToken, setSToken] = useState('');
  const [sAutoPub, setSAutoPub] = useState(false);

  const [rCreatorId, setRCreatorId] = useState('');
  const [rAccountId, setRAccountId] = useState('');
  const [rMinScore, setRMinScore] = useState(75);
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

  const handleIngest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!iCreatorId) {
      setNotice({ type: 'error', text: 'Tag at least one creator first.' });
      return;
    }
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
          layout: iLayout,
          captionStyle: iCaptionStyle,
          enableSfx: iEnableSfx,
        }),
      });
      if (!res.ok) throw new Error('Stream ingest failed.');
      setNotice({
        type: 'success',
        text: 'Clip extracted, compliance-verified, subtitled, SFX-mapped, and routed.',
      });
      await loadAll();
    } catch (err) {
      setNotice({ type: 'error', text: err instanceof Error ? err.message : 'Ingest failed' });
    } finally {
      setBusy(false);
    }
  };

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
      if (!res.ok) throw new Error('Creator handle already exists or invalid URL.');
      setNotice({ type: 'success', text: `Tagged creator @${cHandle.trim()}.` });
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
      if (!res.ok) throw new Error('Account already linked or invalid.');
      setSToken('');
      setNotice({ type: 'success', text: `Linked ${sHandle.trim()} (${sPlatform}).` });
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
      text: `${acct.accountHandle}: ${checked ? 'Opt-In Auto-Publish ON' : 'Human Approval Gate ON'}.`,
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
      setNotice({ type: 'success', text: 'Bound Creator → Clipping Account route.' });
      await loadAll();
    } catch (err) {
      setNotice({ type: 'error', text: err instanceof Error ? err.message : 'Failed to create route' });
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
            ? 'Clip approved & released to linked clipping accounts.'
            : 'Clip rejected.',
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
    <div className="min-h-screen bg-background text-foreground">
      {/* Higgsfield × Lovable Single-Row Sticky Frosted Top Navigation */}
      <header className="sticky top-0 z-40 border-b border-border/80 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSection('studio')}
              className="flex items-center gap-2.5 text-left"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
                <Zap className="h-4 w-4 fill-current" />
              </span>
              <span className="font-display text-sm font-bold tracking-tight uppercase">
                Clip Network
              </span>
            </button>

            <span className="hidden items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground sm:inline-flex">
              <span className={cn('h-1.5 w-1.5 rounded-full', apiHealthy ? 'bg-success' : 'bg-warning')} />
              {apiHealthy ? 'Engine Live' : 'Offline'}
            </span>
          </div>

          <nav className="hidden items-center gap-1 rounded-full border border-border/80 bg-card/90 p-1 md:flex">
            {[
              { id: 'studio' as const, label: 'Studio', icon: Sparkles, count: clips.length },
              { id: 'creators' as const, label: 'Creators', icon: Users, count: creators.length },
              { id: 'routing' as const, label: 'Accounts & Routing', icon: GitBranch, count: routes.length },
              { id: 'queue' as const, label: 'Publish Queue', icon: Send, count: queue.length },
            ].map((item) => {
              const Icon = item.icon;
              const active = section === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSection(item.id)}
                  className={cn(
                    'flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition-all',
                    active
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{item.label}</span>
                  <span
                    className={cn(
                      'rounded-full px-1.5 py-0.2 font-mono text-[10px] tabular-nums',
                      active ? 'bg-primary-foreground/15 text-primary-foreground' : 'bg-muted text-muted-foreground',
                    )}
                  >
                    {item.count}
                  </span>
                </button>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => void loadAll()}
              disabled={refreshing}
              aria-label="Sync state"
            >
              <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              aria-label="Toggle dark or editorial light mode"
            >
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Button
              size="sm"
              className="rounded-full font-semibold"
              onClick={() => setSection('studio')}
            >
              <Plus className="h-3.5 w-3.5" />
              New Clip
            </Button>
          </div>
        </div>

        {/* Mobile Nav Pills */}
        <div className="flex gap-1.5 overflow-x-auto border-t border-border/60 px-4 py-2 md:hidden">
          {(['studio', 'creators', 'routing', 'queue'] as const).map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setSection(id)}
              className={cn(
                'rounded-full px-3 py-1 text-xs font-medium capitalize',
                section === id ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground border border-border',
              )}
            >
              {id}
            </button>
          ))}
        </div>
      </header>

      {/* Toast Notice */}
      {notice && (
        <div className="mx-auto max-w-7xl px-4 pt-4 sm:px-6">
          <div
            className={cn(
              'flex items-center justify-between rounded-xl border px-4 py-2.5 text-xs font-medium backdrop-blur',
              notice.type === 'success'
                ? 'border-success/30 bg-success/10 text-success'
                : 'border-destructive/30 bg-destructive/10 text-destructive',
            )}
          >
            <span>{notice.text}</span>
            <button type="button" onClick={() => setNotice(null)} aria-label="Close notice">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* SECTION 1: STUDIO (Lovable Floating Hero Composer + Higgsfield 9:16 Cinema Grid) */}
      {section === 'studio' && (
        <div className="relative overflow-hidden">
          <div className="studio-hero-glow studio-grid-bg border-b border-border/60 pb-14 pt-12 sm:pt-16">
            <div className="mx-auto max-w-4xl px-4 text-center sm:px-6">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-card/80 px-3.5 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
                <Flame className="h-3.5 w-3.5 text-primary" />
                <span>Voice-Synced Karaoke • 6 Procedural SFX • Zero Added Logos</span>
              </div>

              <h1 className="font-display text-balance text-4xl font-bold tracking-[-0.04em] sm:text-5xl md:text-6xl">
                Turn Any Stream Into{' '}
                <span className="text-primary">Viral Shorts.</span>
              </h1>
              <p className="mx-auto mt-3 max-w-2xl text-sm text-muted-foreground sm:text-base">
                Tag Twitch &amp; YouTube creators, enforce campaign guardrails automatically, mix studio SFX at -14 LUFS, and route approved clips straight to your clipping network.
              </p>

              {/* Lovable-Style Floating Prompt / Stream Composer */}
              <form
                onSubmit={handleIngest}
                className="mx-auto mt-8 max-w-3xl rounded-2xl border border-border bg-card/95 p-3 text-left shadow-2xl backdrop-blur-xl"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <div className="flex-1">
                    <Input
                      value={iUrl}
                      onChange={(e) => setIUrl(e.target.value)}
                      placeholder="Paste Twitch VOD, YouTube stream, or Kick URL…"
                      className="h-11 border-0 bg-transparent px-3 text-sm shadow-none focus-visible:ring-0"
                      required
                    />
                  </div>
                  <Button
                    type="submit"
                    size="lg"
                    disabled={busy || !iCreatorId}
                    className="h-10 shrink-0 rounded-xl px-5 font-semibold"
                  >
                    <Sparkles className="h-4 w-4" />
                    {busy ? 'Processing…' : 'Extract & Route'}
                  </Button>
                </div>

                {/* Inline Studio Controls Bar */}
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-border/70 pt-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      aria-label="Select creator"
                      value={iCreatorId}
                      onChange={(e) => setICreatorId(e.target.value)}
                      className="h-8 rounded-full border border-border bg-muted/70 px-3 text-xs font-medium text-foreground focus:outline-none"
                    >
                      {creators.length === 0 ? (
                        <option value="">No creators tagged</option>
                      ) : (
                        creators.map((c) => (
                          <option key={c.id} value={c.id}>
                            @{c.handle} ({c.platform})
                          </option>
                        ))
                      )}
                    </select>

                    <select
                      aria-label="Select layout"
                      value={iLayout}
                      onChange={(e) => setILayout(e.target.value)}
                      className="h-8 rounded-full border border-border bg-muted/70 px-3 text-xs font-medium text-foreground focus:outline-none"
                    >
                      <option value="SPLIT_FACECAM_BOTTOM">9:16 Split Facecam</option>
                      <option value="CENTER_CROP_9_16">9:16 Center Crop</option>
                    </select>

                    <select
                      aria-label="Select caption style"
                      value={iCaptionStyle}
                      onChange={(e) => setICaptionStyle(e.target.value)}
                      className="h-8 rounded-full border border-border bg-muted/70 px-3 text-xs font-medium text-foreground focus:outline-none"
                    >
                      <option value="HIGH_ENERGY">High-Energy Karaoke</option>
                      <option value="BOLD_CREATOR">Bold Creator</option>
                      <option value="CLEAN_MINIMAL">Clean Minimal</option>
                      <option value="PODCAST_PREMIUM">Podcast Premium</option>
                    </select>

                    <button
                      type="button"
                      onClick={() => setIEnableSfx((v) => !v)}
                      className={cn(
                        'inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors',
                        iEnableSfx
                          ? 'border-primary/40 bg-primary/15 text-foreground'
                          : 'border-border bg-muted/50 text-muted-foreground',
                      )}
                    >
                      <Volume2 className="h-3.5 w-3.5" />
                      SFX {iEnableSfx ? 'ON' : 'OFF'}
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowAdvancedComposer((v) => !v)}
                    className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
                  >
                    Hook &amp; Transcript
                    {showAdvancedComposer ? (
                      <ChevronUp className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>

                {showAdvancedComposer && (
                  <div className="mt-3 grid gap-3 border-t border-border/70 pt-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label>Clip Hook / Title</Label>
                      <Input value={iTitle} onChange={(e) => setITitle(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label>Detected Speech / Transcript</Label>
                      <Textarea
                        rows={2}
                        value={iTranscript}
                        onChange={(e) => setITranscript(e.target.value)}
                      />
                    </div>
                  </div>
                )}
              </form>

              {/* Compact Metrics Ribbon */}
              <div className="mx-auto mt-8 grid max-w-3xl grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { label: 'Tagged Creators', value: creators.length, onClick: () => setSection('creators') },
                  { label: 'Active Routes', value: routes.length, onClick: () => setSection('routing') },
                  { label: 'Awaiting Review', value: awaitingCount, onClick: () => setSection('queue') },
                  { label: 'Published Shorts', value: publishedCount, onClick: () => setSection('queue') },
                ].map((m) => (
                  <button
                    key={m.label}
                    type="button"
                    onClick={m.onClick}
                    className="rounded-xl border border-border/80 bg-card/70 px-4 py-3 text-left backdrop-blur transition-colors hover:border-primary/40"
                  >
                    <div className="font-display text-2xl font-bold tabular-nums">{m.value}</div>
                    <div className="text-[11px] font-medium text-muted-foreground">{m.label}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Higgsfield-Inspired 9:16 Cinema Clip Showcase */}
          <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
            <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="font-display text-xl font-bold uppercase tracking-tight sm:text-2xl">
                  Generated 9:16 Shorts Feed
                </h2>
                <p className="text-xs text-muted-foreground">
                  Every clip is scored against creator campaign rules, zero-logo verified, and routed to linked accounts.
                </p>
              </div>
              <Button variant="outline" size="sm" className="rounded-full" onClick={() => setSection('queue')}>
                View Publish Queue
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Button>
            </div>

            {clips.length === 0 ? (
              <Card className="p-10 text-center">
                <Film className="mx-auto h-8 w-8 text-muted-foreground" />
                <p className="mt-2 text-sm font-medium">No clips extracted yet</p>
                <p className="text-xs text-muted-foreground">
                  Paste any Twitch or YouTube stream URL in the composer above to generate your first short.
                </p>
              </Card>
            ) : (
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {clips.map((c) => (
                  <div
                    key={c.id}
                    className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card transition-all hover:border-primary/50"
                  >
                    {/* 9:16 Cinema Preview Frame */}
                    <div className="relative flex aspect-[9/11] flex-col justify-between overflow-hidden bg-gradient-to-b from-zinc-900 via-zinc-950 to-black p-4 text-white">
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={cn(
                            'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold backdrop-blur-md',
                            c.compliancePassed
                              ? 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-400/30'
                              : 'bg-rose-500/20 text-rose-300 ring-1 ring-rose-400/30',
                          )}
                        >
                          <ShieldCheck className="h-3 w-3" />
                          QA {c.complianceScore}
                        </span>
                        <span className="rounded-full bg-white/10 px-2.5 py-1 font-mono text-[11px] backdrop-blur-md">
                          {c.durationSec}s • 9:16
                        </span>
                      </div>

                      {/* Simulated Live Seam Karaoke Preview */}
                      <div className="my-auto text-center">
                        <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 backdrop-blur-md transition-transform group-hover:scale-105">
                          <Play className="h-5 w-5 fill-white text-white" />
                        </div>
                        <p className="font-display text-base font-extrabold uppercase leading-tight tracking-tight text-[#D4FF00] drop-shadow">
                          {c.title}
                        </p>
                        <p className="mt-1.5 text-[11px] text-white/60">
                          @{c.creator.handle} • Zero Logos
                        </p>
                      </div>

                      {/* SFX Pills */}
                      <div className="flex flex-wrap items-center gap-1.5">
                        {c.sfxCues.slice(0, 3).map((s, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold backdrop-blur-md"
                          >
                            <Volume2 className="h-2.5 w-2.5 text-[#D4FF00]" />
                            {s.preset} {s.atSec}s
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Card Action Footer */}
                    <div className="flex flex-1 flex-col justify-between gap-3 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        <Badge variant={c.approvalStatus === 'APPROVED' ? 'success' : c.approvalStatus === 'DISQUALIFIED' ? 'destructive' : 'warning'}>
                          {c.approvalStatus}
                        </Badge>
                        <button
                          type="button"
                          onClick={() => setExpandedClipId(expandedClipId === c.id ? null : c.id)}
                          className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
                        >
                          <Subtitles className="h-3.5 w-3.5" />
                          {expandedClipId === c.id ? 'Hide ASS' : 'ASS Script'}
                        </button>
                      </div>

                      {expandedClipId === c.id && (
                        <pre className="max-h-32 overflow-auto rounded-lg border border-border bg-muted/50 p-2 font-mono text-[10px] text-muted-foreground">
                          {c.assScript}
                        </pre>
                      )}

                      {c.approvalStatus === 'AWAITING_APPROVAL' && (
                        <div className="grid grid-cols-2 gap-2 pt-1">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            onClick={() => void handleDecideClip(c.id, 'REJECTED')}
                          >
                            Reject
                          </Button>
                          <Button
                            size="sm"
                            disabled={busy}
                            onClick={() => void handleDecideClip(c.id, 'APPROVED')}
                          >
                            <Check className="h-3.5 w-3.5" />
                            Approve
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {/* SECTION 2: TAGGED CREATORS */}
      {section === 'creators' && (
        <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
          <div className="grid gap-6 lg:grid-cols-12">
            <Card className="lg:col-span-5">
              <CardHeader>
                <CardTitle className="font-display text-lg uppercase">Tag Creator Account</CardTitle>
                <CardDescription>
                  Define source channel, required campaign topics, zero-logo protection, and SFX defaults.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCreateCreator} className="space-y-3.5">
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
                      <Label>Layout</Label>
                      <NativeSelect value={cLayout} onChange={(e) => setCLayout(e.target.value)}>
                        <option value="SPLIT_FACECAM_BOTTOM">9:16 Split Facecam</option>
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
                  <div className="flex items-center justify-between rounded-xl border border-border bg-muted/40 px-3.5 py-2.5">
                    <span className="flex items-center gap-2 text-xs font-medium">
                      <Volume2 className="h-3.5 w-3.5 text-primary" />
                      Procedural SFX Enabled
                    </span>
                    <Switch checked={cEnableSfx} onCheckedChange={setCEnableSfx} />
                  </div>
                  <Button type="submit" className="w-full rounded-xl font-semibold" disabled={busy}>
                    Tag Creator Account
                  </Button>
                </form>
              </CardContent>
            </Card>

            <div className="space-y-4 lg:col-span-7">
              <h2 className="font-display text-lg font-bold uppercase">
                Monitored Creators ({creators.length})
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {creators.map((c) => (
                  <Card key={c.id} className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-display text-base font-bold">{c.displayName}</div>
                        <div className="font-mono text-xs text-muted-foreground">@{c.handle}</div>
                      </div>
                      <Badge variant="outline">{c.platform}</Badge>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {c.requiredTopics.map((t) => (
                        <Badge key={t} variant="secondary">
                          {t}
                        </Badge>
                      ))}
                    </div>
                    <div className="mt-3 flex items-center justify-between border-t border-border pt-2.5 text-[11px] text-muted-foreground">
                      <span>{c.defaultLayout}</span>
                      <span className="font-semibold text-foreground">
                        {c.enableSfx ? 'SFX ON' : 'SFX OFF'}
                      </span>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* SECTION 3: CLIPPING ACCOUNTS & ROUTING */}
      {section === 'routing' && (
        <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
          <div className="grid gap-6 lg:grid-cols-12">
            <div className="space-y-5 lg:col-span-5">
              <Card>
                <CardHeader>
                  <CardTitle className="font-display text-lg uppercase">Link Clipping Account</CardTitle>
                  <CardDescription>
                    OAuth tokens encrypted at rest via AES-256-GCM. Human approval gate is ON by default.
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
                      <Label>Account Name</Label>
                      <Input value={sName} onChange={(e) => setSName(e.target.value)} required />
                    </div>
                    <div className="space-y-1">
                      <Label>OAuth / Postiz Token (Optional)</Label>
                      <Input
                        type="password"
                        value={sToken}
                        onChange={(e) => setSToken(e.target.value)}
                        placeholder="Encrypted via AES-256-GCM"
                      />
                    </div>
                    <div className="flex items-center justify-between rounded-xl border border-border bg-muted/40 px-3.5 py-2.5">
                      <span className="text-xs font-medium">Opt-In Auto-Publish</span>
                      <Switch checked={sAutoPub} onCheckedChange={setSAutoPub} />
                    </div>
                    <Button type="submit" className="w-full rounded-xl font-semibold" disabled={busy}>
                      Link Account
                    </Button>
                  </form>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="font-display text-lg uppercase">Bind Routing Rule</CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleCreateRoute} className="space-y-3">
                    <div className="space-y-1">
                      <Label>Source Creator</Label>
                      <NativeSelect value={rCreatorId} onChange={(e) => setRCreatorId(e.target.value)}>
                        {creators.map((c) => (
                          <option key={c.id} value={c.id}>
                            @{c.handle} ({c.platform})
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
                      <Label>Min QA Compliance Score</Label>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        value={rMinScore}
                        onChange={(e) => setRMinScore(Number(e.target.value))}
                      />
                    </div>
                    <Button type="submit" className="w-full rounded-xl font-semibold" disabled={busy}>
                      Bind Creator → Account
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-5 lg:col-span-7">
              <Card>
                <CardHeader>
                  <CardTitle className="font-display text-lg uppercase">
                    Linked Accounts ({accounts.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {accounts.map((a) => (
                    <div
                      key={a.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-muted/30 p-3.5 text-xs"
                    >
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-bold">{a.accountHandle}</span>
                          <Badge variant="outline">{a.platform}</Badge>
                          <Badge variant={a.integrationMode === 'LIVE_OAUTH' ? 'success' : 'warning'}>
                            {a.integrationMode}
                          </Badge>
                          {a.hasEncryptedToken && (
                            <Badge variant="secondary">
                              <Lock className="h-3 w-3" />
                              AES-256
                            </Badge>
                          )}
                        </div>
                        <p className="mt-0.5 text-muted-foreground">{a.accountName}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">
                          {a.autoPublishApproved ? 'Auto-Publish' : 'Human Gate'}
                        </span>
                        <Switch
                          checked={a.autoPublishApproved}
                          onCheckedChange={(checked) => void handleToggleAutoPublish(a, checked)}
                        />
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="font-display text-lg uppercase">
                    Active Routing Matrix ({routes.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {routes.map((r) => (
                    <div
                      key={r.id}
                      className="flex items-center justify-between rounded-xl border border-border bg-muted/30 px-3.5 py-2.5 text-xs"
                    >
                      <span className="flex items-center gap-2">
                        <Badge variant="secondary">
                          <Radio className="h-3 w-3" />@{r.creator.handle}
                        </Badge>
                        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                        <strong className="text-sm">{r.socialAccount.accountHandle}</strong>
                        <span className="text-muted-foreground">{r.socialAccount.platform}</span>
                      </span>
                      <Badge variant="outline">QA ≥ {r.minComplianceScore}</Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>
        </section>
      )}

      {/* SECTION 4: PUBLISH QUEUE */}
      {section === 'queue' && (
        <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle className="font-display text-xl uppercase">Publish Queue</CardTitle>
                  <CardDescription>
                    Idempotent distribution log with transparent `SANDBOX_SIMULATED` vs `LIVE_OAUTH` states.
                  </CardDescription>
                </div>
                <Tabs
                  value={queueFilter}
                  onValueChange={(v) => setQueueFilter(v as 'ALL' | 'AWAITING_APPROVAL' | 'PUBLISHED')}
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
              {filteredQueue.map((p) => (
                <div
                  key={p.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-muted/30 p-4 text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold">{p.socialAccount.accountHandle}</span>
                      <Badge variant="outline">{p.platform}</Badge>
                      <Badge variant={p.status.startsWith('PUBLISHED') ? 'success' : 'warning'}>
                        <CheckCircle2 className="h-3 w-3" />
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
              ))}
            </CardContent>
          </Card>
        </section>
      )}
    </div>
  );
}
