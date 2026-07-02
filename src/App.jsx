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
const API_IS_HOSTED = /^https?:\/\/[^/]*onrender\.com/i.test(API_BASE);
const API_IS_NGROK = /^https?:\/\/[^/]*\.ngrok-free\.app/i.test(API_BASE);
const sampleRows = [
  {
    id: 'seed-1',
    platform: 'TikTok',
    title: 'Bản nháp công thức trong studio',
    status: 'ready',
    progress: 100,
    meta: 'Sẵn sàng trong thư mục Tải về',
  },
  {
    id: 'seed-2',
    platform: 'YouTube',
    title: 'Video hướng dẫn của kênh',
    status: 'idle',
    progress: 0,
    meta: 'Đang chờ liên kết mới',
  },
];

export function App() {
  const [url, setUrl] = useState('');
  const [quality, setQuality] = useState('best');
  const [cookiesBrowser, setCookiesBrowser] = useState('none');
  const [cookiesProfile, setCookiesProfile] = useState('');
  const [cookiesText, setCookiesText] = useState('');
  const [poToken, setPoToken] = useState('');
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
  const browserCookiesAvailable = health?.browserCookiesAvailable ?? !API_IS_HOSTED;
  const effectiveCookiesBrowser = browserCookiesAvailable ? cookiesBrowser : 'none';
  const activity = useMemo(() => {
    if (downloadStage) return downloadStage;
    if (loadingMeta) {
      return {
        title: 'Đang kiểm tra liên kết',
        detail: 'Đọc thông tin video và các định dạng có thể tải',
        progress: 48,
      };
    }
    if (healthLoading) {
      return {
        title: 'Đang kiểm tra máy tải',
        detail: 'Xác nhận API và yt-dlp đã sẵn sàng',
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

  useEffect(() => {
    if (!browserCookiesAvailable && cookiesBrowser !== 'none') {
      setCookiesBrowser('none');
      setCookiesProfile('');
    }
  }, [browserCookiesAvailable, cookiesBrowser]);

  async function refreshHealth() {
    setHealthLoading(true);
    try {
      const response = await apiFetch('/api/health');
      setHealth(await response.json());
    } catch {
      setHealth({
        ytDlp: {
          available: false,
          message: 'API chưa hoạt động. Hãy bật backend trước.',
        },
      });
    } finally {
      setHealthLoading(false);
    }
  }

  async function fetchBrowserProfiles() {
    try {
      const response = await apiFetch('/api/browser-profiles');
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
      const response = await apiFetch('/api/metadata', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          cookiesBrowser: effectiveCookiesBrowser,
          cookiesProfile,
          cookiesText,
          poToken,
        }),
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
    const jobTitle = metadata?.title || 'Video tải xuống';
    const baseJob = {
      id: jobId,
      platform: platform || metadata?.platform || 'Video',
      title: jobTitle,
      status: 'running',
      progress: 18,
      message: 'Đang chuẩn bị yêu cầu tải',
    };
    setJobs((current) => [baseJob, ...current]);

    try {
      const request = {
        url,
        quality,
        cookiesBrowser: effectiveCookiesBrowser,
        cookiesProfile,
        cookiesText,
        poToken,
        title: metadata?.title,
      };
      setDownloadStage({
        title: 'Đang chuẩn bị tải',
        detail: 'Backend đang lấy liên kết media an toàn',
        progress: 35,
      });
      updateJob(jobId, {
        progress: 35,
        message: 'Đang lấy liên kết media',
      });
      const fastDownload = await resolveFastDownload(request);
      setDownloadStage({
        title: 'Đang mở tải xuống',
        detail: 'Trình duyệt đang bắt đầu tải tệp',
        progress: 78,
      });
      updateJob(jobId, {
        progress: 78,
        message: fastDownload?.mode === 'direct-proxy'
          ? 'Đang tải nhanh qua backend'
          : 'Đang tải qua luồng dự phòng',
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
          ? 'Đã bắt đầu tải nhanh qua backend'
          : 'Đã gửi qua luồng dự phòng',
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
        message: 'Bạn mô tả thêm một chút để mình xử lý chính xác hơn nhé.',
      });
      return;
    }

    setSendingFeedback(true);

    try {
      const response = await apiFetch('/api/feedback', {
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
        message: 'Đã gửi góp ý. Cảm ơn bạn.',
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
              <small>Trình lưu video cục bộ</small>
            </div>
          </div>
          <button className="ghost-button" disabled={healthLoading} onClick={refreshHealth} type="button">
            {healthLoading ? <Loader2 className="spin" size={16} /> : <RefreshCw size={16} />}
            {healthLoading ? 'Đang kiểm tra' : 'Kiểm tra máy tải'}
          </button>
        </header>

        <div className="grid">
          <section className="input-panel" aria-labelledby="download-heading">
            <div className="engine-strip">
                <StatusDot ok={health?.ytDlp?.available} />
                <span>
                  {health?.ytDlp?.available
                  ? `yt-dlp ${health.ytDlp.version} sẵn sàng`
                  : health?.ytDlp?.message || 'Đang kiểm tra máy tải...'}
              </span>
            </div>

            <div className="server-status">
              <StatusPill
                ok={health?.youtubePotProvider?.available}
                text={health?.youtubePotProvider?.available ? 'Tự lấy PO token' : 'Chưa có PO token tự động'}
              />
              <StatusPill
                ok={health?.cookiesSource?.available}
                text={health?.cookiesSource?.available ? 'Cookie Render sẵn sàng' : 'Thiếu cookie Render'}
              />
              <StatusPill
                ok={health?.youtubeProxy?.configured}
                text={
                  health?.youtubeProxy?.configured
                    ? 'Đã cấu hình proxy YouTube'
                    : health?.youtubeProxy?.mode === 'placeholder'
                      ? 'Proxy YouTube chưa hợp lệ'
                      : 'Chưa có proxy YouTube'
                }
              />
              {health?.hostedRuntime && <StatusPill ok text="API đang chạy hosted" />}
            </div>

            <h1 id="download-heading">Lưu video hợp lệ ở chất lượng gốc.</h1>
            <p className="lede">
              Dành cho liên kết TikTok, Facebook và YouTube mà bạn sở hữu hoặc được phép tải xuống.
            </p>

            <form className="url-form" onSubmit={fetchMetadata}>
              <label htmlFor="video-url">Dán liên kết video</label>
              <div className="url-box">
                <Link2 size={18} />
                <input
                  id="video-url"
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                  placeholder="https://www.youtube.com/watch?v=..."
                  autoComplete="off"
                />
                <span className={platform ? 'platform good' : 'platform'}>{platform || 'Nhận diện'}</span>
              </div>
              <button className="primary-button" disabled={loadingMeta || !url} type="submit">
                {loadingMeta ? <Loader2 className="spin" size={18} /> : <Gauge size={18} />}
                {loadingMeta ? 'Đang kiểm tra' : 'Kiểm tra liên kết'}
              </button>
            </form>

            {activity && <LoadingStatus activity={activity} />}

            <div className="section-label">Chất lượng tải</div>
            <div className="quality-group" aria-label="Chất lượng tải">
              <QualityOption
                active={quality === 'best'}
                title="Tốt nhất"
                detail="Video và âm thanh cao nhất có thể"
                onClick={() => setQuality('best')}
              />
              <QualityOption
                active={quality === 'mp4'}
                title="MP4 tương thích"
                detail="Ưu tiên tệp MP4 dễ mở"
                onClick={() => setQuality('mp4')}
              />
              <QualityOption
                active={quality === 'clean'}
                title="Nguồn sạch"
                detail="Không watermark nếu nền tảng cung cấp"
                onClick={() => setQuality('clean')}
              />
            </div>

            <div className="cookies-row">
              <span>
                Cookie trình duyệt
                <small>
                  {browserCookiesAvailable
                    ? 'Chỉ dùng khi backend chạy cùng máy với trình duyệt'
                    : 'Không khả dụng trên API hosted; hãy dán cookie YouTube bên dưới'}
                </small>
              </span>
              <div className="cookies-controls">
                <label htmlFor="cookies-browser" className="sr-only">
                  Cookie trình duyệt
                </label>
                <select
                  id="cookies-browser"
                  value={cookiesBrowser}
                  disabled={!browserCookiesAvailable}
                  onChange={(event) => setCookiesBrowser(event.target.value)}
                >
                  <option value="none">Tắt</option>
                  <option value="chrome">Chrome</option>
                  <option value="safari">Safari</option>
                  <option value="firefox">Firefox</option>
                  <option value="edge">Edge</option>
                  <option value="brave">Brave</option>
                </select>
                {cookiesBrowser !== 'none' && (browserProfiles[cookiesBrowser] || []).length > 0 && (
                  <>
                    <label htmlFor="cookies-profile" className="sr-only">
                      Hồ sơ trình duyệt
                    </label>
                    <select
                      id="cookies-profile"
                      value={cookiesProfile}
                      onChange={(event) => setCookiesProfile(event.target.value)}
                    >
                      <option value="">Tất cả hồ sơ</option>
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

            <div className="cookies-text-box">
              <label htmlFor="cookies-text">
                Cookie YouTube
                <small>Dán nội dung cookies.txt dạng Netscape khi YouTube chặn máy chủ</small>
              </label>
              <textarea
                id="cookies-text"
                autoCapitalize="off"
                autoComplete="off"
                autoCorrect="off"
                spellCheck="false"
                onChange={(event) => setCookiesText(event.target.value)}
                placeholder="# Netscape HTTP Cookie File&#10;.youtube.com&#9;TRUE&#9;/&#9;TRUE..."
                value={cookiesText}
              />
              <label htmlFor="po-token">
                Mã PO YouTube
                <small>Tùy chọn dự phòng; backend sẽ thử lấy GVS token tự động trước</small>
              </label>
              <input
                id="po-token"
                autoCapitalize="off"
                autoComplete="off"
                autoCorrect="off"
                onChange={(event) => setPoToken(event.target.value)}
                placeholder="Dán token thô hoặc mweb.gvs+TOKEN"
                spellCheck="false"
                type="password"
                value={poToken}
              />
            </div>

            {metadata && (
              <article className="metadata">
                {metadata.thumbnail && <img src={metadata.thumbnail} alt="" />}
                <div>
                  <span className="mini-label">{metadata.platform}</span>
                  <h2>{metadata.title}</h2>
	                  <p>
	                    {metadata.uploader} · {formatDuration(metadata.duration)} ·{' '}
	                    {metadata.formats?.length || 0} định dạng
	                  </p>
                  <button
                    className="primary-button compact"
                    disabled={starting}
                    onClick={startDownloadJob}
                    type="button"
                  >
	                    {starting ? <Loader2 className="spin" size={17} /> : <Download size={17} />}
	                    {starting ? 'Đang chuẩn bị' : 'Tải về máy'}
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
	                Chỉ tải video bạn tạo, sở hữu hoặc có quyền lưu. Ứng dụng không xóa hay chỉnh sửa watermark.
	              </p>
	            </div>
	          </section>

	          <section className="queue-panel" aria-labelledby="queue-heading">
	            <div className="panel-heading">
	              <div>
	                <span className="mini-label">Cục bộ</span>
	                <h2 id="queue-heading">Lượt tải gần đây</h2>
	              </div>
	              <span className="download-path">Thư mục Tải về</span>
	            </div>

	            <div className="queue-list">
	              {visibleRows.map((job) => (
	                <JobRow key={job.id} job={job} />
	              ))}
	            </div>

	            <form className="feedback-box" onSubmit={submitFeedback}>
	              <div className="feedback-heading">
	                <MessageSquare size={18} />
	                <span>Góp ý</span>
	              </div>
	              <div className="feedback-kind" aria-label="Loại góp ý">
	                <button
	                  className={feedbackKind === 'error' ? 'active' : ''}
	                  onClick={() => setFeedbackKind('error')}
	                  type="button"
	                >
	                  Báo lỗi
	                </button>
	                <button
	                  className={feedbackKind === 'improvement' ? 'active' : ''}
	                  onClick={() => setFeedbackKind('improvement')}
	                  type="button"
	                >
	                  Đề xuất
	                </button>
	              </div>
	              <label className="sr-only" htmlFor="feedback-message">
	                Nội dung góp ý
	              </label>
	              <textarea
	                id="feedback-message"
	                maxLength={3000}
	                onChange={(event) => setFeedbackMessage(event.target.value)}
	                placeholder="Mô tả lỗi hoặc điều bạn muốn cải thiện..."
	                value={feedbackMessage}
	              />
	              <label className="sr-only" htmlFor="feedback-contact">
	                Thông tin liên hệ
	              </label>
	              <input
	                id="feedback-contact"
	                maxLength={160}
	                onChange={(event) => setFeedbackContact(event.target.value)}
	                placeholder="Email hoặc liên hệ của bạn (không bắt buộc)"
	                value={feedbackContact}
	              />
	              <button className="primary-button compact" disabled={sendingFeedback} type="submit">
	                {sendingFeedback ? <Loader2 className="spin" size={17} /> : <Send size={17} />}
	                {sendingFeedback ? 'Đang gửi' : 'Gửi góp ý'}
	              </button>
	              {feedbackStatus && (
	                <div className={feedbackStatus.type === 'success' ? 'feedback-note success' : 'feedback-note'}>
	                  {feedbackStatus.message}
	                </div>
	              )}
	            </form>
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
          <strong>{job.fileName || job.title || `Tải ${job.platform || 'video'}`}</strong>
          <span>{job.platform}</span>
        </div>
        <p>{job.message || job.meta || 'Sẵn sàng'}</p>
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

async function resolveFastDownload({ url, quality, cookiesBrowser, cookiesProfile, cookiesText, poToken, title }) {
  const response = await apiFetch('/api/download-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, quality, cookiesBrowser, cookiesProfile, cookiesText, poToken, title }),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.message);
  if (payload.ok && payload.url) {
    return payload;
  }
  return null;
}

function apiFetch(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (API_IS_NGROK) {
    headers.set('ngrok-skip-browser-warning', 'true');
  }

  return fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });
}

function StatusDot({ ok }) {
  return <span className={ok ? 'status-dot ok' : 'status-dot'} />;
}

function StatusPill({ ok, text }) {
  return (
    <span className={ok ? 'status-pill ok' : 'status-pill'}>
      <StatusDot ok={ok} />
      {text}
    </span>
  );
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
    return 'Bạn hãy dán liên kết TikTok, Facebook hoặc YouTube trước.';
  }

  let parsed;
  try {
    parsed = new URL(value.trim());
  } catch {
    return 'Liên kết này chưa đúng định dạng URL.';
  }

  if (!['http:', 'https:'].includes(parsed.protocol) || !detectPlatform(parsed.href)) {
    return 'Hiện chỉ hỗ trợ liên kết TikTok, Facebook và YouTube.';
  }

  return '';
}

function formatDuration(seconds) {
  if (!seconds) return 'chưa rõ thời lượng';
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.floor(seconds % 60);
  return `${minutes}:${String(remainder).padStart(2, '0')}`;
}
