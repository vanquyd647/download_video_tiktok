import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileVideo,
  Gauge,
  Link2,
  Loader2,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8787';
const sampleRows = [
  {
    id: 'seed-1',
    platform: 'TikTok',
    title: 'Studio recipe draft',
    status: 'ready',
    progress: 100,
    meta: 'Browser download demo',
  },
  {
    id: 'seed-2',
    platform: 'Facebook',
    title: 'Community event clip',
    status: 'idle',
    progress: 0,
    meta: 'Waiting for link',
  },
];

export function App() {
  const [url, setUrl] = useState('');
  const [quality, setQuality] = useState('best');
  const [cookiesBrowser, setCookiesBrowser] = useState('none');
  const [cookiesProfile, setCookiesProfile] = useState('');
  const [browserProfiles, setBrowserProfiles] = useState({});
  const [health, setHealth] = useState(null);
  const [metadata, setMetadata] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [notice, setNotice] = useState('');
  const [loadingMeta, setLoadingMeta] = useState(false);
  const [starting, setStarting] = useState(false);

  const platform = useMemo(() => detectPlatform(url), [url]);

  useEffect(() => {
    refreshHealth();
    fetchBrowserProfiles();
  }, []);

  useEffect(() => {
    const availableProfiles = browserProfiles[cookiesBrowser] || [];
    if (!availableProfiles.includes(cookiesProfile)) {
      setCookiesProfile('');
    }
  }, [browserProfiles, cookiesBrowser, cookiesProfile]);

  async function refreshHealth() {
    try {
      const response = await fetch(`${API_BASE}/api/health`);
      setHealth(await response.json());
    } catch {
      setHealth({
        ytDlp: {
          available: false,
          message: 'API is offline. Start it with npm run dev:server.',
        },
      });
    }
  }

  async function fetchBrowserProfiles() {
    try {
      const response = await fetch(`${API_BASE}/api/browser-profiles`);
      const payload = await response.json();
      setBrowserProfiles(payload.profiles || {});
    } catch {
      setBrowserProfiles({});
    }
  }

  async function fetchMetadata(event) {
    event?.preventDefault();
    setNotice('');
    setMetadata(null);
    setLoadingMeta(true);

    try {
      const response = await fetch(`${API_BASE}/api/metadata`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, cookiesBrowser, cookiesProfile }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message);
      if (payload.ok === false) {
        setNotice(payload.message);
        return;
      }
      setMetadata(payload);
    } catch (error) {
      setNotice(error.message);
    } finally {
      setLoadingMeta(false);
    }
  }

  async function startDownloadJob() {
    setNotice('');
    setStarting(true);

    try {
      const request = {
        url,
        quality,
        cookiesBrowser,
        cookiesProfile,
        title: metadata?.title,
      };
      const fastDownload = await resolveFastDownload(request);
      const downloadUrl = fastDownload?.url || buildDownloadUrl(request);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = fastDownload?.fileName || '';
      document.body.append(link);
      link.click();
      link.remove();

      setJobs((current) => [
        {
          id: `${Date.now()}`,
          platform: platform || metadata?.platform || 'Video',
          title: metadata?.title || 'Browser download',
          status: 'complete',
          progress: 100,
          message: fastDownload?.mode === 'direct'
            ? 'Opened direct source download'
            : 'Sent through fallback server stream',
        },
        ...current,
      ]);
    } catch (error) {
      setNotice(error.message);
    } finally {
      setStarting(false);
    }
  }

  const visibleRows = jobs.length ? jobs : sampleRows;

  return (
    <main className="app-shell">
      <section className="workspace">
        <header className="topbar">
          <div className="brand">
            <div className="brand-mark">
              <Download size={18} strokeWidth={2.4} />
            </div>
            <div>
              <span>LinkVault</span>
              <small>Local social video saver</small>
            </div>
          </div>
          <button className="ghost-button" onClick={refreshHealth} type="button">
            <RefreshCw size={16} />
            Check engine
          </button>
        </header>

        <div className="grid">
          <section className="input-panel" aria-labelledby="download-heading">
            <div className="engine-strip">
              <StatusDot ok={health?.ytDlp?.available} />
              <span>
                {health?.ytDlp?.available
                  ? `yt-dlp ${health.ytDlp.version} ready`
                  : health?.ytDlp?.message || 'Checking download engine...'}
              </span>
            </div>

            <h1 id="download-heading">Download an authorized video at source quality.</h1>
            <p className="lede">
              Paste a TikTok or Facebook link. LinkVault asks the platform extractor for the best
              available stream and prefers a clean source when one is exposed.
            </p>

            <form className="url-form" onSubmit={fetchMetadata}>
              <label htmlFor="video-url">Video link</label>
              <div className="url-box">
                <Link2 size={18} />
                <input
                  id="video-url"
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                  placeholder="https://www.tiktok.com/@creator/video/..."
                  autoComplete="off"
                />
                <span className={platform ? 'platform good' : 'platform'}>{platform || 'Detect'}</span>
              </div>
              <button className="primary-button" disabled={loadingMeta || !url} type="submit">
                {loadingMeta ? <Loader2 className="spin" size={18} /> : <Gauge size={18} />}
                Inspect link
              </button>
            </form>

            <div className="quality-group" aria-label="Download quality">
              <QualityOption
                active={quality === 'best'}
                title="Best source"
                detail="Highest video and audio available"
                onClick={() => setQuality('best')}
              />
              <QualityOption
                active={quality === 'mp4'}
                title="MP4 preferred"
                detail="Best compatible MP4 output"
                onClick={() => setQuality('mp4')}
              />
              <QualityOption
                active={quality === 'clean'}
                title="Clean source"
                detail="No-watermark stream if exposed"
                onClick={() => setQuality('clean')}
              />
            </div>

            <div className="cookies-row">
              <span>
                Browser cookies
                <small>Use when TikTok or Facebook blocks anonymous requests</small>
              </span>
              <div className="cookies-controls">
                <label htmlFor="cookies-browser" className="sr-only">
                  Browser cookies
                </label>
                <select
                  id="cookies-browser"
                  value={cookiesBrowser}
                  onChange={(event) => setCookiesBrowser(event.target.value)}
                >
                  <option value="none">Off</option>
                  <option value="chrome">Chrome</option>
                  <option value="safari">Safari</option>
                  <option value="firefox">Firefox</option>
                  <option value="edge">Edge</option>
                  <option value="brave">Brave</option>
                </select>
                {cookiesBrowser !== 'none' && (browserProfiles[cookiesBrowser] || []).length > 0 && (
                  <>
                    <label htmlFor="cookies-profile" className="sr-only">
                      Browser profile
                    </label>
                    <select
                      id="cookies-profile"
                      value={cookiesProfile}
                      onChange={(event) => setCookiesProfile(event.target.value)}
                    >
                      <option value="">All profiles</option>
                      {(browserProfiles[cookiesBrowser] || []).map((profile) => (
                        <option key={profile} value={profile}>
                          {profile}
                        </option>
                      ))}
                    </select>
                  </>
                )}
              </div>
            </div>

            {metadata && (
              <article className="metadata">
                {metadata.thumbnail && <img src={metadata.thumbnail} alt="" />}
                <div>
                  <span className="mini-label">{metadata.platform}</span>
                  <h2>{metadata.title}</h2>
                  <p>
                    {metadata.uploader} · {formatDuration(metadata.duration)} ·{' '}
                    {metadata.formats?.length || 0} formats found
                  </p>
                  <button
                    className="primary-button compact"
                    disabled={starting}
                    onClick={startDownloadJob}
                    type="button"
                  >
                    {starting ? <Loader2 className="spin" size={17} /> : <Download size={17} />}
                    Save to computer
                  </button>
                </div>
              </article>
            )}

            {notice && (
              <div className="notice" role="alert">
                <AlertCircle size={17} />
                {notice}
              </div>
            )}

            <div className="permission">
              <ShieldCheck size={18} />
              <p>
                Use the exact share URL for videos you created, own, or have permission to
                download. The app does not remove or alter watermarks.
              </p>
            </div>
          </section>

          <section className="queue-panel" aria-labelledby="queue-heading">
            <div className="panel-heading">
              <div>
                <span className="mini-label">Local</span>
                <h2 id="queue-heading">Browser downloads</h2>
              </div>
              <span className="download-path">Your Downloads</span>
            </div>

            <div className="queue-list">
              {visibleRows.map((job) => (
                <JobRow key={job.id} job={job} />
              ))}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}

function QualityOption({ active, title, detail, onClick }) {
  return (
    <button className={active ? 'quality active' : 'quality'} onClick={onClick} type="button">
      <span>{title}</span>
      <small>{detail}</small>
    </button>
  );
}

function JobRow({ job }) {
  const complete = job.status === 'complete' || job.status === 'ready';
  const failed = job.status === 'error';

  return (
    <article className="job-row">
      <div className="file-icon">
        {complete ? <CheckCircle2 size={19} /> : failed ? <AlertCircle size={19} /> : <FileVideo size={19} />}
      </div>
      <div className="job-main">
        <div className="job-title-line">
          <strong>{job.fileName || job.title || `${job.platform || 'Video'} download`}</strong>
          <span>{job.platform}</span>
        </div>
        <p>{job.message || job.meta || 'Ready'}</p>
        <div className="progress-track">
          <span style={{ width: `${Math.max(0, Math.min(100, job.progress || 0))}%` }} />
        </div>
      </div>
    </article>
  );
}

function buildDownloadUrl({ url, quality, cookiesBrowser, cookiesProfile, title }) {
  const params = new URLSearchParams({
    url,
    quality,
    cookiesBrowser,
    cookiesProfile,
    title: title || 'video',
  });
  return `${API_BASE}/api/download-local?${params.toString()}`;
}

async function resolveFastDownload({ url, quality, cookiesBrowser, cookiesProfile, title }) {
  const response = await fetch(`${API_BASE}/api/download-url`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, quality, cookiesBrowser, cookiesProfile, title }),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.message);
  if (payload.ok && payload.url) {
    return payload;
  }
  return null;
}

function StatusDot({ ok }) {
  return <span className={ok ? 'status-dot ok' : 'status-dot'} />;
}

function detectPlatform(value) {
  try {
    const host = new URL(value).hostname;
    if (/tiktok\.com$/i.test(host)) return 'TikTok';
    if (/facebook\.com$/i.test(host) || /fb\.watch$/i.test(host)) return 'Facebook';
  } catch {
    return '';
  }
  return '';
}

function formatDuration(seconds) {
  if (!seconds) return 'duration unknown';
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.floor(seconds % 60);
  return `${minutes}:${String(remainder).padStart(2, '0')}`;
}
