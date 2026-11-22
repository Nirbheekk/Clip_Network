'use client';

import React from 'react';
import Link from 'next/link';
import { PublicFooter, PublicNavbar } from '@/components/layout/PublicChrome';
import { API_BASE } from '@/lib/saas-types';

export default function DocsPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <PublicNavbar />
      <main className="mx-auto max-w-[1100px] px-4 py-16 sm:px-6 grid gap-12 lg:grid-cols-12">
        <aside className="lg:col-span-3 space-y-2 text-xs">
          <div className="font-mono uppercase text-muted-foreground mb-3">Documentation</div>
          {[
            ['#getting-started', 'Getting Started'],
            ['#compliance', 'Campaign Compliance'],
            ['#approval', 'Human Approval Gate'],
            ['#api-reference', 'REST API Reference'],
            ['#billing', 'Quotas & Webhooks'],
            ['#privacy', 'Security & Privacy'],
          ].map(([href, label]) => (
            <a key={href} href={href} className="block py-1 text-muted-foreground hover:text-foreground">
              {label}
            </a>
          ))}
        </aside>

        <article className="lg:col-span-9 space-y-12 text-sm leading-relaxed">
          <section id="getting-started" className="space-y-3">
            <h1 className="font-display text-3xl font-semibold">Clip Network Documentation</h1>
            <p className="text-muted-foreground">
              Clip Network is a multi-tenant creator-content distribution platform. All workspace
              data—creators, social accounts, routing rules, clips, publish posts, and API keys—is
              strictly scoped by <code className="font-mono text-foreground">workspaceId</code>.
            </p>
            <ol className="list-decimal pl-5 space-y-1.5 text-muted-foreground">
              <li>Create an account at <Link href="/register" className="text-primary hover:underline">/register</Link> and complete onboarding.</li>
              <li>Tag a Twitch, YouTube, or Kick creator under <code className="font-mono text-foreground">/creators</code> with campaign rules.</li>
              <li>Link one or more social accounts under <code className="font-mono text-foreground">/social-accounts</code> and create a route under <code className="font-mono text-foreground">/routes</code>.</li>
              <li>Ingest a stream clip at <code className="font-mono text-foreground">/clips/new</code>, review it at <code className="font-mono text-foreground">/clips/[id]</code>, and approve for publishing.</li>
            </ol>
          </section>

          <section id="compliance" className="space-y-3 border-t border-border pt-8">
            <h2 className="font-display text-xl font-semibold">Campaign Compliance Scoring</h2>
            <p className="text-muted-foreground">
              Every ingested clip is evaluated by <code className="font-mono text-foreground">evaluateClipCompliance()</code>.
              Clips start at 100 points and are penalized for missing required topics (-50), added
              logos when <code className="font-mono text-foreground">disallowLogos</code> is enabled (-60),
              generic clickbait phrasing (-35), or banned keywords (-30 each). A clip passes only
              with 0 disqualifiers and score &gt;= 70.
            </p>
          </section>

          <section id="approval" className="space-y-3 border-t border-border pt-8">
            <h2 className="font-display text-xl font-semibold">Human Approval Gate</h2>
            <p className="text-muted-foreground">
              By default, <code className="font-mono text-foreground">autoPublishApproved</code> is{' '}
              <code className="font-mono text-foreground">false</code> on every linked social
              account. Compliant clips remain in <code className="font-mono text-foreground">AWAITING_APPROVAL</code>{' '}
              until approved by a workspace Member, Admin, or Owner.
            </p>
          </section>

          <section id="api-reference" className="space-y-3 border-t border-border pt-8">
            <h2 className="font-display text-xl font-semibold">REST API Reference</h2>
            <p className="text-muted-foreground">
              Authenticate programmatic requests with a workspace API key generated at{' '}
              <code className="font-mono text-foreground">/settings/api-keys</code> using the{' '}
              <code className="font-mono text-foreground">X-Api-Key</code> header.
            </p>
            <pre className="overflow-x-auto rounded-md border border-border bg-card p-4 font-mono text-xs">
{`curl -X POST ${API_BASE}/api/v1/clips/ingest \\
  -H "Content-Type: application/json" \\
  -H "X-Api-Key: cn_live_YOUR_WORKSPACE_KEY" \\
  -d '{
    "creatorId": "CREATOR_UUID",
    "sourceUrl": "https://www.twitch.tv/videos/2933767012",
    "title": "Lacy GTA 6 Marathon Highlight",
    "startSec": 120,
    "endSec": 145,
    "transcriptText": "We are live on the GTA 6 marathon tonight!",
    "captionStyle": "HIGH_ENERGY",
    "layout": "SPLIT_FACECAM_BOTTOM",
    "enableSfx": true
  }'`}
            </pre>
          </section>

          <section id="billing" className="space-y-3 border-t border-border pt-8">
            <h2 className="font-display text-xl font-semibold">Quotas &amp; Billing Webhooks</h2>
            <p className="text-muted-foreground">
              When <code className="font-mono text-foreground">clipsUsedThisPeriod &gt;= monthlyClipLimit</code>,
              the API returns HTTP <code className="font-mono text-foreground">402 QUOTA_EXCEEDED</code>.
              Plan upgrades are activated exclusively via <code className="font-mono text-foreground">POST /api/v1/billing/webhook</code>{' '}
              verified with <code className="font-mono text-foreground">x-billing-signature</code> (HMAC-SHA256).
            </p>
          </section>

          <section id="privacy" className="space-y-3 border-t border-border pt-8">
            <h2 id="terms" className="font-display text-xl font-semibold">Security, Privacy &amp; Terms</h2>
            <p className="text-muted-foreground">
              Passwords are salted and hashed with <code className="font-mono text-foreground">scrypt</code>.
              Session tokens and API keys are stored only as <code className="font-mono text-foreground">SHA-256</code>{' '}
              hashes. Third-party OAuth tokens are encrypted at rest with{' '}
              <code className="font-mono text-foreground">AES-256-GCM</code> and never returned to browser clients.
            </p>
          </section>
        </article>
      </main>
      <PublicFooter />
    </div>
  );
}
