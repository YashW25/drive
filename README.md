# Zentro Drive

**Zentro Drive** — A private, self-hosted cloud storage platform powered by Supabase PostgreSQL, Telegram file storage, and WhatsApp OTP authentication via OpenWA.

---

## 🏗️ Architecture

```
Submission/
├── frontend/          # Vite + React SPA (Vercel Static Build)
├── backend/           # Express.js API (Vercel Serverless Function)
├── vercel.json        # Vercel deployment config
├── .env.example       # Environment variables template
└── README.md
```

**External services (NOT on Vercel):**
- **Supabase** — PostgreSQL database
- **Telegram** — File storage backend
- **OpenWA** — WhatsApp OTP gateway (must run on your own VPS/server)

---

## 🚀 Deploying to Vercel

### 1. Push to GitHub

Make sure your repository is on GitHub (private or public).

### 2. Import to Vercel

1. Go to [vercel.com](https://vercel.com) → New Project
2. Import your GitHub repository
3. Set **Root Directory** to `/` (the repo root, not `frontend/`)
4. Vercel will auto-detect the `vercel.json` config

### 3. Configure Environment Variables

In Vercel dashboard → Settings → Environment Variables, add:

| Variable | Description |
|---|---|
| `DATABASE_URL` | Supabase PostgreSQL connection string |
| `JWT_SECRET` | Strong random string (min 32 chars) |
| `SESSION_SECRET` | Strong random string |
| `ENCRYPTION_KEY` | 32-byte hex string for AES-256 |
| `FRONTEND_URL` | Your Vercel domain e.g. `https://drive.failedengineers.site` |
| `OPENWA_API_URL` | Your OpenWA VPS URL e.g. `https://openwa.yourdomain.com/api` |
| `OPENWA_SESSION_ID` | Your OpenWA session UUID |
| `OPENWA_API_KEY` | Your OpenWA API key |
| `STORAGE_PROVIDER` | `TELEGRAM` (required for Vercel) |
| `TELEGRAM_API_ID` | From https://my.telegram.org/apps |
| `TELEGRAM_API_HASH` | From https://my.telegram.org/apps |
| `TELEGRAM_PHONE` | Your Telegram phone number |
| `GOOGLE_CLIENT_ID` | Google OAuth Client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth Client Secret |
| `GOOGLE_REDIRECT_URI` | `https://yourdomain.com/api/google/callback` |
| `NODE_ENV` | `production` |

### 4. Update Google OAuth

In [Google Cloud Console](https://console.cloud.google.com):
- Add your Vercel domain to **Authorized JavaScript Origins**
- Add `https://yourdomain.com/api/google/callback` to **Authorized redirect URIs**

### 5. Deploy!

Click **Deploy** in Vercel dashboard, or push to your main branch.

---

## 💻 Local Development

```bash
# Install all dependencies
cd backend && npm install
cd ../frontend && npm install

# Copy and fill in environment variables
cp .env.example backend/.env
# Edit backend/.env with your values

# Start backend (port 5000)
cd backend && npm run dev

# Start frontend (port 5173, proxies /api to backend)
cd frontend && npm run dev
```

---

## 🔐 OpenWA Setup (WhatsApp OTP)

OpenWA must run on a persistent server (VPS, Render, Railway, etc.) — **it cannot run on Vercel**.

1. Clone/install OpenWA on your VPS
2. Start OpenWA and note the API URL and session ID
3. Scan the QR code from the **Admin Portal → OpenWA Signup** page
4. Set `OPENWA_API_URL`, `OPENWA_SESSION_ID`, `OPENWA_API_KEY` in your Vercel env vars

---

## 🛠️ Database Setup

```bash
# Push schema to Supabase
cd backend && npm run prisma:db-push

# Or generate migration
npx prisma migrate dev
```

---

## 📦 Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, Tailwind CSS |
| Backend | Express.js, TypeScript, Prisma ORM |
| Database | Supabase (PostgreSQL) |
| File Storage | Telegram Bot API |
| Auth | WhatsApp OTP via OpenWA |
| Deployment | Vercel (Frontend + Backend) |
