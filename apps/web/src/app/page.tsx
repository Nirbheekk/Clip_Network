'use client';

import React, { useCallback, useEffect, useState } from 'react';

const API = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4100';

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
  creator: { displayName: string };
  sfxCues: Array<{ preset: string; atSec: number }>;
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

export default function ClipNetworkDashboard() {
  const [tab, setTab] = useState<'creators' | 'accounts' | 'ingest' | 'queue'>('creators');
  const [creators, setCreators] = useState<CreatorDto[]>([]);
  const [accounts, setAccounts] = useState<SocialAccountDto[]>([]);
  const [routes, setRoutes] = useState<RouteDto[]>([]);
  const [clips, setClips] = useState<ClipDto[]>([]);
  const [queue, setQueue] = useState<PublishPostDto[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

  // Creator form
  const [cHandle, setCHandle] = useState('lacy');
  const [cName, setCName] = useState('Lacy');
  const [cPlatform, setCPlatform] = useState('TWITCH');
  const [cUrl, setCUrl] = useState('https://www.twitch.tv/lacy');
  const [cTopics, setCTopics] = useState('GTA 6, clipping');

  // Social Account form
  const [sPlatform, setSPlatform] = useState('INSTAGRAM_REELS');
  const [sName, setSName] = useState('Lacy Daily Clips');
  const [sHandle, setSHandle] = useState('@lacyclips');
  const [sAutoPub, setSAutoPub] = useState(false);

  // Route form
  const [rCreatorId, setRCreatorId] = useState('');
  const [rAccountId, setRAccountId] = useState('');

  // Ingest form
  const [iCreatorId, setICreatorId] = useState('');
  const [iUrl, setIUrl] = useState('https://www.twitch.tv/videos/2933767012');
  const [iTitle, setITitle] = useState('Lacy GTA 6 Marathon — 30M Views Clipping Roast');
  const [iTranscript, setITranscript] = useState(
    'Day two GTA 6 Marathon! My clipping campaign got 30 million views yesterday, you are just doing something wrong bro.',
  );

  const loadAll = useCallback(async () => {
    try {
      const [c, a, r, cl, q] = await Promise.all([
        fetch(`${API}/api/v1/creators`).then((x) => x.json()),
        fetch(`${API}/api/v1/social-accounts`).then((x) => x.json()),
        fetch(`${API}/api/v1/routes`).then((x) => x.json()),
        fetch(`${API}/api/v1/clips`).then((x) => x.json()),
        fetch(`${API}/api/v1/publish-queue`).then((x) => x.json()),
      ]);
      setCreators(c.data ?? []);
      setAccounts(a.data ?? []);
      setRoutes(r.data ?? []);
      setClips(cl.data ?? []);
      setQueue(q.data ?? []);
      if (!rCreatorId && c.data?.[0]) setRCreatorId(c.data[0].id);
      if (!iCreatorId && c.data?.[0]) setICreatorId(c.data[0].id);
      if (!rAccountId && a.data?.[0]) setRAccountId(a.data[0].id);
    } catch {
      setNotice('Start @clip-network/api on port 4100 to connect live data.');
    }
  }, [iCreatorId, rAccountId, rCreatorId]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const createCreator = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch(`${API}/api/v1/creators`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        handle: cHandle,
        displayName: cName,
        platform: cPlatform,
        channelUrl: cUrl,
        tags: [cHandle, cPlatform],
        requiredTopics: cTopics.split(',').map((s) => s.trim()).filter(Boolean),
        disallowLogos: true,
        enableSfx: true,
      }),
    });
    if (res.ok) {
      setNotice(`Tagged creator @${cHandle}`);
      await loadAll();
    }
  };

  const createSocialAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch(`${API}/api/v1/social-accounts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        platform: sPlatform,
        accountName: sName,
        accountHandle: sHandle,
        autoPublishApproved: sAutoPub,
      }),
    });
    if (res.ok) {
      setNotice(`Linked clipping account ${sHandle} (${sPlatform})`);
      await loadAll();
    }
  };

  const toggleAutoPublish = async (acct: SocialAccountDto) => {
    await fetch(`${API}/api/v1/social-accounts/${acct.id}/auto-publish`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ autoPublishApproved: !acct.autoPublishApproved }),
    });
    await loadAll();
  };

  const createRoute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rCreatorId || !rAccountId) return;
    const res = await fetch(`${API}/api/v1/routes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        creatorId: rCreatorId,
        socialAccountId: rAccountId,
        minComplianceScore: 75,
        hashtags: ['#ViralClips'],
      }),
    });
    if (res.ok) {
      setNotice('Linked Creator -> Clipping Account route.');
      await loadAll();
    }
  };

  const ingestClip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!iCreatorId) return;
    const res = await fetch(`${API}/api/v1/clips/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        creatorId: iCreatorId,
        sourceUrl: iUrl,
        title: iTitle,
        startSec: 27.8,
        endSec: 78.7,
        transcriptText: iTranscript,
        enableSfx: true,
      }),
    });
    if (res.ok) {
      setNotice('Clip ingested, compliance-checked, subtitled, SFX-mapped, and routed.');
      await loadAll();
      setTab('queue');
    }
  };

  const decideClip = async (clipId: string, decision: 'APPROVED' | 'REJECTED') => {
    await fetch(`${API}/api/v1/clips/${clipId}/decision`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision }),
    });
    setNotice(`Clip marked ${decision}.`);
    await loadAll();
  };

  return (
    <main className="container">
      <div className="row">
        <div>
          <h1 style={{ margin: 0, fontSize: 24 }}>Clip Network — Stream-to-Social Engine</h1>
          <p className="muted" style={{ marginTop: 4 }}>
            Tag creators, link clipping accounts, auto-extract voice-synced 9:16 shorts with procedural SFX, and route safely.
          </p>
        </div>
        <span className="badge badge-ok">Human Gate Default • Opt-In Auto-Publish</span>
      </div>

      {notice && (
        <div className="list-item" style={{ marginTop: 14, borderColor: 'var(--primary)' }}>
          {notice}
        </div>
      )}

      <div className="tabs">
        <button className={`tab ${tab === 'creators' ? 'active' : ''}`} onClick={() => setTab('creators')}>
          1. Tagged Creators ({creators.length})
        </button>
        <button className={`tab ${tab === 'accounts' ? 'active' : ''}`} onClick={() => setTab('accounts')}>
          2. Clipping Accounts &amp; Routing ({accounts.length})
        </button>
        <button className={`tab ${tab === 'ingest' ? 'active' : ''}`} onClick={() => setTab('ingest')}>
          3. Stream Ingest &amp; Clips ({clips.length})
        </button>
        <button className={`tab ${tab === 'queue' ? 'active' : ''}`} onClick={() => setTab('queue')}>
          4. Publish Queue ({queue.length})
        </button>
      </div>

      {tab === 'creators' && (
        <div className="grid-2">
          <form className="card" onSubmit={createCreator}>
            <h3 style={{ marginTop: 0 }}>Tag Creator Account</h3>
            <div className="field">
              <label>Handle</label>
              <input value={cHandle} onChange={(e) => setCHandle(e.target.value)} required />
            </div>
            <div className="field">
              <label>Display Name</label>
              <input value={cName} onChange={(e) => setCName(e.target.value)} required />
            </div>
            <div className="field">
              <label>Source Platform</label>
              <select value={cPlatform} onChange={(e) => setCPlatform(e.target.value)}>
                <option value="TWITCH">Twitch</option>
                <option value="YOUTUBE">YouTube</option>
                <option value="KICK">Kick</option>
              </select>
            </div>
            <div className="field">
              <label>Channel URL</label>
              <input value={cUrl} onChange={(e) => setCUrl(e.target.value)} required />
            </div>
            <div className="field">
              <label>Required Campaign Topics (comma-separated)</label>
              <input value={cTopics} onChange={(e) => setCTopics(e.target.value)} />
            </div>
            <button className="btn" type="submit">Tag Creator</button>
          </form>

          <div className="card">
            <h3 style={{ marginTop: 0 }}>Monitored Creators</h3>
            {creators.map((c) => (
              <div key={c.id} className="list-item">
                <div className="row">
                  <strong>{c.displayName} (@{c.handle})</strong>
                  <span className="badge">{c.platform}</span>
                </div>
                <div className="muted" style={{ marginTop: 4 }}>
                  Topics: {c.requiredTopics.join(', ') || 'Any'} • {c.defaultLayout} • SFX: {c.enableSfx ? 'ON' : 'OFF'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'accounts' && (
        <div className="grid-2">
          <div className="card">
            <h3 style={{ marginTop: 0 }}>Link Clipping Social Account</h3>
            <form onSubmit={createSocialAccount}>
              <div className="field">
                <label>Platform</label>
                <select value={sPlatform} onChange={(e) => setSPlatform(e.target.value)}>
                  <option value="INSTAGRAM_REELS">Instagram Reels</option>
                  <option value="TIKTOK">TikTok</option>
                  <option value="YOUTUBE_SHORTS">YouTube Shorts</option>
                  <option value="X">X (Twitter)</option>
                </select>
              </div>
              <div className="field">
                <label>Account Name</label>
                <input value={sName} onChange={(e) => setSName(e.target.value)} required />
              </div>
              <div className="field">
                <label>Handle</label>
                <input value={sHandle} onChange={(e) => setSHandle(e.target.value)} required />
              </div>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, marginBottom: 12 }}>
                <input type="checkbox" checked={sAutoPub} onChange={(e) => setSAutoPub(e.target.checked)} />
                Opt-in Auto-Publish compliant clips (default OFF = human approval gate)
              </label>
              <button className="btn" type="submit">Link Account</button>
            </form>

            <hr style={{ borderColor: 'var(--border)', margin: '18px 0' }} />
            <h3 style={{ marginTop: 0 }}>Route Creator → Clipping Account</h3>
            <form onSubmit={createRoute}>
              <div className="field">
                <label>Creator</label>
                <select value={rCreatorId} onChange={(e) => setRCreatorId(e.target.value)}>
                  {creators.map((c) => <option key={c.id} value={c.id}>{c.displayName} (@{c.handle})</option>)}
                </select>
              </div>
              <div className="field">
                <label>Target Clipping Account</label>
                <select value={rAccountId} onChange={(e) => setRAccountId(e.target.value)}>
                  {accounts.map((a) => <option key={a.id} value={a.id}>{a.accountHandle} ({a.platform})</option>)}
                </select>
              </div>
              <button className="btn" type="submit">Create Routing Rule</button>
            </form>
          </div>

          <div className="card">
            <h3 style={{ marginTop: 0 }}>Linked Clipping Accounts &amp; Active Routes</h3>
            {accounts.map((a) => (
              <div key={a.id} className="list-item">
                <div className="row">
                  <strong>{a.accountHandle} ({a.platform})</strong>
                  <span className="badge badge-warn">{a.integrationMode}</span>
                </div>
                <div className="row" style={{ marginTop: 8 }}>
                  <span className="muted">
                    Policy: {a.autoPublishApproved ? 'Opt-In Auto-Publish' : 'Human Approval Required'}
                  </span>
                  <button className="btn-outline" onClick={() => void toggleAutoPublish(a)}>
                    Toggle Auto-Publish
                  </button>
                </div>
              </div>
            ))}
            <h4 style={{ marginBottom: 8 }}>Active Routes ({routes.length})</h4>
            {routes.map((r) => (
              <div key={r.id} className="list-item muted">
                @{r.creator.handle} → <strong>{r.socialAccount.accountHandle}</strong> ({r.socialAccount.platform}) • Min QA {r.minComplianceScore}
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'ingest' && (
        <div className="grid-2">
          <form className="card" onSubmit={ingestClip}>
            <h3 style={{ marginTop: 0 }}>Ingest Stream / VOD Clip</h3>
            <div className="field">
              <label>Tagged Creator</label>
              <select value={iCreatorId} onChange={(e) => setICreatorId(e.target.value)}>
                {creators.map((c) => <option key={c.id} value={c.id}>{c.displayName} (@{c.handle})</option>)}
              </select>
            </div>
            <div className="field">
              <label>Twitch / YouTube VOD URL</label>
              <input value={iUrl} onChange={(e) => setIUrl(e.target.value)} required />
            </div>
            <div className="field">
              <label>Clip Hook / Title</label>
              <input value={iTitle} onChange={(e) => setITitle(e.target.value)} required />
            </div>
            <div className="field">
              <label>Transcript / Detected Speech</label>
              <textarea rows={3} value={iTranscript} onChange={(e) => setITranscript(e.target.value)} />
            </div>
            <button className="btn" type="submit">Run Compliance, Subtitles, SFX &amp; Route</button>
          </form>

          <div className="card">
            <h3 style={{ marginTop: 0 }}>Ingested Clips</h3>
            {clips.map((c) => (
              <div key={c.id} className="list-item">
                <div className="row">
                  <strong>{c.title}</strong>
                  <span className={`badge ${c.compliancePassed ? 'badge-ok' : 'badge-bad'}`}>
                    QA {c.complianceScore} • {c.approvalStatus}
                  </span>
                </div>
                <div className="muted" style={{ marginTop: 4 }}>
                  {c.creator.displayName} • {c.durationSec}s • SFX cues: {c.sfxCues.length}
                </div>
                {c.approvalStatus === 'AWAITING_APPROVAL' && (
                  <div className="row" style={{ marginTop: 8 }}>
                    <button className="btn" onClick={() => void decideClip(c.id, 'APPROVED')}>
                      Approve &amp; Publish to Linked Accounts
                    </button>
                    <button className="btn-outline" onClick={() => void decideClip(c.id, 'REJECTED')}>
                      Reject
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'queue' && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Routed Publish Queue ({queue.length})</h3>
          {queue.map((p) => (
            <div key={p.id} className="list-item">
              <div className="row">
                <strong>{p.socialAccount.accountHandle} ({p.platform})</strong>
                <span className={`badge ${p.status.startsWith('PUBLISHED') ? 'badge-ok' : 'badge-warn'}`}>
                  {p.status} • {p.executionMode}
                </span>
              </div>
              <div className="muted" style={{ marginTop: 4 }}>{p.captionText}</div>
              {p.externalPostId && <div className="muted">Ref: {p.externalPostId}</div>}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
