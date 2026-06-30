# download_video_tiktok

Frontend React/Vite for LinkVault social video downloader. Supports authorized TikTok, Facebook, and YouTube downloads.

## Run

```bash
npm install
cp .env.example .env.local
npm run dev
```

The backend API defaults to `http://localhost:8787`. Change `VITE_API_BASE` in `.env.local` if your backend runs elsewhere.

If YouTube blocks the hosted backend, paste a Netscape `cookies.txt` export into
the YouTube cookies field before inspecting the link. Export only cookies for
YouTube/Google from a browser account that has permission to view the video.
