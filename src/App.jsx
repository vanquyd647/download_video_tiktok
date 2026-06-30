import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileVideo,
  Gauge,
  Link2,
  Loader2,
  MessageSquare,
  RefreshCw,
  Send,
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
    platform: 'YouTube',
    title: 'Channel tutorial clip',
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
  const [healthLoading, setHealthLoading] = useState(false);
  const [loadingMeta, setLoadingMeta] = useState(false);
  const [starting, setStarting] = useState(false);
  const [downloadStage, setDownloadStage] = useState(null);
  const [feedbackKind, setFeedbackKind] = useState('error');
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [feedbackContact, setFeedbackContact] = useState('');
  const [feedbackStatus, setFeedbackStatus] = useState(null);
  const [sendingFeedback, setSendingFeedback] = useState(false);

  const platform = useMemo(() => detectPlatform(url), [url]);
  const activity = useMemo(() => {
    if (downloadStage) return downloadStage;
    if (loadingMeta) {
      return {
        title: 'Inspecting link',
        detail: 'Reading video metadata and available formats',
        progress: 48,
      };
    }
    if (healthLoading) {
      return {
        title: 'Checking engine',
        detail: 'Confirming API and yt-dlp runtime are ready',
        progress: 34,
      };
    }
    return null;
  }, [downloadStage, healthLoading, loadingMeta]);

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
    setHealthLoading(true);
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
    } finally {
      setHealthLoading(false);
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

    const urlError = getUrlError(url);
    if (urlError) {
      setNotice(urlError);
      return;
    }

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

  function updateJob(id, patch) {
    setJobs((current) => current.map((job) => (job.id === id ? { ...job, ...patch } : job)));
  }

  async function startDownloadJob() {
    setNotice('');
    setStarting(true);
    const jobId = `${Date.now()}`;
    const jobTitle = metadata?.title || 'Browser download';
    const baseJob = {
      id: jobId,
      platform: platform || metadata?.platform || 'Video',
      title: jobTitle,
      status: 'running',
      progress: 18,
      message: 'Preparing download request',
    };
    setJobs((current) => [baseJob, ...current]);

    try {
      const request = {
        url,
        quality,
        cookiesBrowser,
        cookiesProfile,
        title: metadata?.title,
      };
      setDownloadStage({
        title: 'Preparing download',
        detail: 'Resolving secure media URL through the backend',
        progress: 35,
      });
      updateJob(jobId, {
        progress: 35,
        message: 'Resolving secure media URL',
      });
      const fastDownload = await resolveFastDownload(request);
      setDownloadStage({
        title: 'Opening download',
        detail: 'Starting the browser download with protected media headers',
        progress: 78,
      });
      updateJob(jobId, {
        progress: 78,
        message: fastDownload?.mode === 'direct-proxy'
          ? 'Starting accelerated backend download'
          : 'Starting fallback server stream',
      });
      const downloadUrl = fastDownload?.url || buildDownloadUrl(request);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = fastDownload?.fileName || '';
      document.body.append(link);
      link.click();
      link.remove();

      updateJob(jobId, {
        status: 'complete',
        progress: 100,
        message: fastDownload?.mode === 'direct-proxy'
          ? 'Started accelerated backend download'
          : 'Sent through fallback server stream',
      });
    } catch (error) {
      updateJob(jobId, {
        status: 'error',
        progress: 100,
        message: error.message,
      });
      setNotice(error.message);
    } finally {
      setStarting(false);
      setDownloadStage(null);
    }
  }

  async function submitFeedback(event) {
    event.preventDefault();
    setFeedbackStatus(null);

    if (feedbackMessage.trim().length < 8) {
      setFeedbackStatus({
        type: 'error',
        message: 'Describe the issue or improvement in a little more detail.',
      });
      return;
    }

    setSendingFeedback(true);

    try {
      const response = await fetch(`${API_BASE}/api/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: feedbackKind,
          message: feedbackMessage,
          contact: feedbackContact,
          pageUrl: window.location.href,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message);

      setFeedbackMessage('');
      setFeedbackContact('');
      setFeedbackStatus({
        type: 'success',
        message: 'Feedback sent. Thank you.',
      });
    } catch (error) {
      setFeedbackStatus({
        type: 'error',
        message: error.message,
      });
    } finally {
      setSendingFeedback(false);
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
          <button className="ghost-button" disabled={healthLoading} onClick={refreshHealth} type="button">
            {healthLoading ? <Loader2 className="spin" size={16} /> : <RefreshCw size={16} />}
            {healthLoading ? 'Checking...' : 'Check engine'}
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
              Paste a TikTok, Facebook, or YouTube link. LinkVault asks the platform extractor for the best
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
                  placeholder="https://www.youtube.com/watch?v=..."
                  autoComplete="off"
                />
                <span className={platform ? 'platform good' : 'platform'}>{platform || 'Detect'}</span>
              </div>
              <button className="primary-button" disabled={loadingMeta || !url} type="submit">
                {loadingMeta ? <Loader2 className="spin" size={18} /> : <Gauge size={18} />}
                {loadingMeta ? 'Inspecting link' : 'Inspect link'}
              </button>
            </form>

            {activity && <LoadingStatus activity={activity} />}

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
                <small>Use when TikTok, Facebook, or YouTube blocks anonymous requests</small>
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
                    {starting ? 'Preparing download' : 'Save to computer'}
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

            <form className="feedback-box" onSubmit={submitFeedback}>
              <div className="feedback-heading">
                <MessageSquare size={18} />
                <span>Feedback</span>
              </div>
              <div className="feedback-kind" aria-label="Feedback type">
                <button
                  className={feedbackKind === 'error' ? 'active' : ''}
                  onClick={() => setFeedbackKind('error')}
                  type="button"
                >
                  Error
                </button>
                <button
                  className={feedbackKind === 'improvement' ? 'active' : ''}
                  onClick={() => setFeedbackKind('improvement')}
                  type="button"
                >
                  Improve
                </button>
              </div>
              <label className="sr-only" htmlFor="feedback-message">
                Feedback message
              </label>
              <textarea
                id="feedback-message"
                maxLength={3000}
                onChange={(event) => setFeedbackMessage(event.target.value)}
                placeholder="Tell us what went wrong or what should be improved..."
                value={feedbackMessage}
              />
              <label className="sr-only" htmlFor="feedback-contact">
                Contact info
              </label>
              <input
                id="feedback-contact"
                maxLength={160}
                onChange={(event) => setFeedbackContact(event.target.value)}
                placeholder="Your email or contact (optional)"
                value={feedbackContact}
              />
              <button className="primary-button compact" disabled={sendingFeedback} type="submit">
                {sendingFeedback ? <Loader2 className="spin" size={17} /> : <Send size={17} />}
                {sendingFeedback ? 'Sending feedback' : 'Send feedback'}
              </button>
              {feedbackStatus && (
                <div className={feedbackStatus.type === 'success' ? 'feedback-note success' : 'feedback-note'}>
                  {feedbackStatus.message}
                </div>
              )}
            </form>
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

function LoadingStatus({ activity }) {
  return (
    <div className="loading-status" aria-live="polite" role="status">
      <div>
        <Loader2 className="spin" size={17} />
        <span>{activity.title}</span>
      </div>
      <p>{activity.detail}</p>
      <div className="progress-track active">
        <span style={{ width: `${Math.max(8, Math.min(96, activity.progress || 25))}%` }} />
      </div>
    </div>
  );
}

function JobRow({ job }) {
  const complete = job.status === 'complete' || job.status === 'ready';
  const failed = job.status === 'error';
  const running = !complete && !failed;

  return (
    <article className={running ? 'job-row running' : 'job-row'}>
      <div className="file-icon">
        {complete ? (
          <CheckCircle2 size={19} />
        ) : failed ? (
          <AlertCircle size={19} />
        ) : running ? (
          <Loader2 className="spin" size={19} />
        ) : (
          <FileVideo size={19} />
        )}
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
    if (/youtube\.com$/i.test(host) || /youtu\.be$/i.test(host)) return 'YouTube';
  } catch {
    return '';
  }
  return '';
}

function getUrlError(value) {
  if (!value || typeof value !== 'string') {
    return 'Paste a TikTok, Facebook, or YouTube video link first.';
  }

  let parsed;
  try {
    parsed = new URL(value.trim());
  } catch {
    return 'That does not look like a valid URL.';
  }

  if (!['http:', 'https:'].includes(parsed.protocol) || !detectPlatform(parsed.href)) {
    return 'Only TikTok, Facebook, and YouTube video links are supported.';
  }

  return '';
}

function formatDuration(seconds) {
  if (!seconds) return 'duration unknown';
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.floor(seconds % 60);
  return `${minutes}:${String(remainder).padStart(2, '0')}`;
}
