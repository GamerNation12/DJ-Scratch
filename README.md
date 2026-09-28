<div align="center">
  <img src="./web/public/logo.png" alt="DJ Scratch Logo" width="150" />
  <h1>DJ Scratch</h1>
  <p><em>Discord music-stats bot tracking Last.fm and Spotify listening, with a web dashboard and Android/desktop apps.</em></p>
  <p>
    <a href="https://dj-scratch.is-a-fullstack.dev">Website</a> ·
    <a href="https://discord.gg/53sxaVWn92">Support server</a> ·
    <a href="https://github.com/GamerNation12/DJ-Scratch/releases/latest">Download apps</a>
  </p>
</div>

---

## About

DJ Scratch is a Discord bot that shows what you're listening to (`/fm`), plus top artists/tracks, server leaderboards and crowns, listening streaks, history imports, AI roasts, weekly/monthly recap images, taste compares, pace/milestone tracking, and WhoKnows. It ships with a Next.js web dashboard, a Discord Activity, and Flutter (Android) + Electron (desktop) apps — all with support chat, Spotify remote control, and self-updating releases.

## Repo layout

| Folder | What it is |
|---|---|
| `discord-bot/` | The Python bot (`discord.py`). Run this. |
| `web/` | Next.js dashboard + API (Vercel). |
| `android-app/` | Flutter app: dashboard, player, ranks, friends, chat, tools, support, auto-updates. |
| `desktop-app/` | Electron + Vite app: same features as mobile, plus Discord Rich Presence. |
| `scripts/` | `watchdog.py` — heartbeat monitor that flags a dead bot. |
| `deploy.py` | SFTP deploy script for the Pterodactyl host. |

## Prerequisites

1. Python **3.11+** (bot)
2. Node.js **22+** (web + desktop)
3. Flutter **3.24+** (Android app)
4. A **Supabase** Postgres database (free tier works — use the **transaction pooler** URL, port `6543`)
5. Discord bot token ([developer portal](https://discord.com/developers/applications))
6. Last.fm API key + secret ([create here](https://www.last.fm/api/account/create))

## Run the bot

```bash
cd discord-bot
pip install -r requirements.txt   # versions are pinned
python main.py
```

Test mode (separate test bot, owner-only):

```bash
python main.py --test   # needs TEST_DISCORD_TOKEN in discord-bot/.env
```

### Environment variables

The bot reads `.env` from the repo root (falls back to `discord-bot/.env`). Copy `.env.example` to `.env` and fill it in:

| Variable | Required | What for |
|---|---|---|
| `DISCORD_TOKEN` | Yes | Bot login |
| `DATABASE_URL` | Yes | Supabase **transaction pooler** URL (`...pooler.supabase.com:6543/...`) |
| `LASTFM_API_KEY` / `LASTFM_API_SECRET` | Yes | Last.fm API (no defaults — bot refuses to start without them) |
| `BOT_LASTFM_SESSION_KEY` | For avatar scrobbles | Scrobbling the bot's own profile |
| `SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET` | For Spotify features | Track art, previews, playback |
| `GROQ_API_KEY` / `GEMINI_API_KEY` | For `/judge` etc. | AI features |
| `OWNER_ID` | No (defaults to current) | Your Discord user ID (admin commands, alerts) |
| `PTERO_PASSWORD` | For deploys only | SFTP password used by `deploy.py` / CI |

Tables and indexes are created automatically on first boot.

## Run the web dashboard

```bash
cd web
npm install
npm run build
npm start
```

Create `web/.env.local` with your Discord OAuth credentials (`DISCORD_CLIENT_ID` / `DISCORD_CLIENT_SECRET`), `DATABASE_URL`, Last.fm + Spotify keys, and `MAILJET_API_KEY` / `MAILJET_SECRET_KEY` (support reply emails). Production lives at `https://dj-scratch.is-a-fullstack.dev`.

## Mobile / desktop apps

- `android-app/` — Flutter app (`flutter pub get` / `flutter run`). Discord login returns straight to the app; in-app updater pulls new APKs from [releases](https://github.com/GamerNation12/DJ-Scratch/releases/latest).
- `desktop-app/` — Electron + Vite: `npm install`, `npm run dev` to develop, `npm run build` for an installer. Self-updates via `electron-updater` from GitHub Releases.

Releases are built automatically: pushing to `main` with changes under `android-app/` or `desktop-app/` triggers the `auto-release` workflow (patch bump, Windows `.exe` + Android `.apk` + Linux `.AppImage`/`.deb`).

## Deployment

- **Bot:** pushing to `main` triggers the `deploy` workflow — it SFTPs `discord-bot/src`, `cogs`, `main.py`, `requirements.txt` and `.env` to the Pterodactyl server and touches `.restart_flag` for a graceful restart. Web/mobile folders are ignored by this workflow. Requires the `PTERO_PASSWORD` repo secret.
- **Web:** deploys via Vercel from `web/`.
- **Apps:** see above — automatic GitHub Releases, or run `auto-release` manually from the Actions tab (custom bump + per-platform toggles).
- **Watchdog:** the `watchdog` workflow + `scripts/watchdog.py` check the bot heartbeat through the database and Discord.

## Commands (all work as `/slash` and `,prefix`)

| Command | Does what |
|---|---|
| `/fm` (`,fm`, `,fm1/2/3`) | Now playing / last played |
| `/ta` `/tt` `/topalbums` `/rt` `/at` | Top artists / tracks / albums, recents, per-artist tracks (periods: `7day 1month 3month 6month 12month overall`) |
| `/whoknows` `/whoknowstrack` `/whoknowsalbum` (`,wk` `,wkt` `,wka`) | Server leaders for an artist/track/album |
| `/crowns` `/crownseeder` | Server crowns |
| `/profile` `/taste` `/streak` `/chart` | Profile card, taste compare, streaks, collage charts |
| `/pace` `/milestone` | Play pace, next-milestone ETAs |
| `/recap` | Weekly/monthly recap image (also auto-DMed) |
| `/share` `/musiccard` `/badges` | Referral sharing + badges, music card, badge showcase |
| `/login` `/logout` `/import` `/settings` | Link Last.fm/Spotify, import history, settings |
| `/judge` `/guess` `/receipt` `/guide` `/help` | AI roast, games, receipt image, guide, this help menu |

## Security

Never commit `.env` or `web/.env.local` — only `.env.example` is tracked. The Last.fm keys have no in-code fallback on purpose: missing keys fail fast at startup instead of silently using someone else's.
