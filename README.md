# Timelogs ⏳

**Timelogs** is a lightweight, fully customizable activity and time-tracking PWA. Define your own tasks with custom emojis and colors, manually log when you did them (start / end / notes), and see beautiful mobile-first charts over any date range.

## Features ✨

* **Custom tasks** — create activities with any emoji (full emoji palette) and any color (native picker + quick swatches).
* **Manual time logging** — tap a task and enter start time, end time, and optional notes. No start/stop clock to babysit.
* **Smart activity log** — each day rolls up to a single row per task with total time. Tap to expand and see every session's start, end, and notes.
* **Mobile-first charts** — stacked bar chart by task (per hour for Today, per day for Week/Month), doughnut breakdown, quick stats, and a fullscreen mode for detailed viewing on phone.
* **Flexible date ranges** — Today, Week, Month, or a custom from → to range.
* **Google sign-in** — fast onboarding, zero password friction.
* **Dark & light themes** — automatic or manual, with proper safe-area handling.

## 🔗 Live Demo
👉 **[timelog-production-4f7b.up.railway.app](https://timelog-production-4f7b.up.railway.app)**

## 📱 Install as a PWA
Timelogs runs as a Progressive Web App — install it from your browser for a fullscreen native-app experience.

1. **iOS (Safari)**: Tap the **Share** icon → **Add to Home Screen**.
2. **Android (Chrome)**: Tap the 3-dot menu → **Add to Home screen** (or **Install app**).

*If you installed an earlier version under a different name, uninstall it from your home screen first so the new name and icon take effect.*

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/en/) (v18+)
- A [Google Cloud Console project](https://console.cloud.google.com/) with an OAuth 2.0 Client ID

### Installation

```bash
git clone https://github.com/vineetjangiriitb/timelog.git
cd timelog
npm install
```

Create a `.env` file in the project root:

```env
GOOGLE_CLIENT_ID=your_google_client_id_here.apps.googleusercontent.com
JWT_SECRET=your_super_secret_jwt_string_here
PORT=3000
```

Run it:

```bash
npm start
```

Then open `http://localhost:3000`.

## 🧭 Usage

1. Sign in with Google.
2. On **Home**, tap **+ Add Task** to create an activity (name, color, emoji).
3. Tap a task to open the **Log activity** modal — set start time, end time, optional notes, save.
4. Open **Log** to see each day grouped by task with totals. Tap a task row to expand and see every session.
5. Open **Charts** to see stacked-by-task time per hour (Today) or per day (Week/Month/Custom). Tap the ⛶ button on any chart for fullscreen.

## 🔐 Security & Privacy

* `data/timelog.db` (your personal SQLite store) is `.gitignored`.
* `.env` (containing `GOOGLE_CLIENT_ID` and `JWT_SECRET`) is `.gitignored`.
* Forks must supply their own `.env` to enable auth.

## 🚢 Deployment (Railway)

Timelogs uses **SQLite**, so a persistent volume is required on PaaS hosts.

1. Connect the GitHub repo to a new Railway project.
2. Under **Variables**, set `GOOGLE_CLIENT_ID` and `JWT_SECRET`.
3. After the first deploy, go to **Volumes** → **Add a Volume**.
4. Mount it at `/app/data` (matches Railway's default `/app` root).
5. Redeploy.

## License
MIT — fork, use, hack.
