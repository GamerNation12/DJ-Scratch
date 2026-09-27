<div align="center">
  <img src="./assets/logo.png" alt="DJ Scratch Logo" width="150" />
  <h1>DJ Scratch</h1>
  <p><em>Discord music-stats bot tracking Last.fm and Spotify listening, with a web dashboard and mobile/desktop apps.</em></p>
</div>

---

## About

DJ Scratch is a Discord bot that shows what you're listening to (`/fm`), plus top artists/tracks, server leaderboards and crowns, listening streaks, history imports, and AI roast commands. It ships with a Next.js web dashboard and work-in-progress Flutter (Android) and Electron (desktop) apps.

## Repo layout

| Folder | What it is |
|---|---|
| `discord-bot/` | The Python bot (`discord.py`). Run this. |
| `web/` | Next.js dashboard + API (Vercel). |
| `android-app/` | Flutter app (early, default template stage). |
| `desktop-app/` | Electron + Vite app (`dj-scratch-desktop`). |
| `scripts/` | `watchdog.py` — heartbeat monitor that flags a dead bot. |
| `deploy.py` | SFTP deploy script for the Pterodactyl host. |

## Prerequisites

1. Python **3.11+** (bot)
2. Node.js **18+** (web panel)
3. A **Supabase** Postgres database (free tier works — use the **transaction pooler** URL, port `6543`)
4. Discord bot token ([developer portal](https://discord.com/developers/applications))
5. Last.fm API key + secret ([create here](https://www.last.fm/api/account/create))

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

Create `web/.env.local` with your Discord OAuth credentials, `NEXTAUTH_SECRET`, `DATABASE_URL`, and Spotify keys (see `SPOTIFY_CLIENT_ID`, `NEXT_PUBLIC_BASE_URL` usage in the app). Production lives at `https://dj-scratch.is-a-fullstack.dev`.

## Mobile / desktop apps

- `android-app/` — Flutter project, still at template stage. Needs `flutter pub get` / `flutter run` once developed.
- `desktop-app/` — Electron + Vite: `npm install`, `npm run dev` to develop, `npm run build` for an installer.

## Deployment

- **Bot:** pushing to `main` triggers the `deploy` workflow — it SFTPs `discord-bot/src`, `cogs`, `main.py`, `requirements.txt` and `.env` to the Pterodactyl server and touches `.restart_flag` for a graceful restart. Web/mobile folders are ignored by this workflow. Requires the `PTERO_PASSWORD` repo secret.
- **Web:** deploys via Vercel from `web/`.
- **Watchdog:** the `watchdog` workflow + `scripts/watchdog.py` check the bot heartbeat through the database and Discord.

## Commands (all work as `/slash` and `,prefix`)

| Command | Does what |
|---|---|
| `/fm` (`,fm`, `,fm1/2/3`) | Now playing / last played |
| `/ta` `/tt` `/topalbums` `/rt` `/at` | Top artists / tracks / albums, recents, per-artist tracks (periods: `7day 1month 3month 6month 12month overall`) |
| `/whoknows` `/whoknowstrack` `/whoknowsalbum` (`,wk` `,wkt` `,wka`) | Server leaders for an artist/track/album |
| `/crowns` `/crownseeder` | Server crowns |
| `/profile` `/taste` `/streak` `/chart` | Profile card, taste compare, streaks, collage charts |
| `/login` `/logout` `/import` `/settings` | Link Last.fm, import Spotify/Apple history, settings |
| `/judge` `/guess` `/receipt` `/guide` `/help` | AI roast, games, receipt image, guide, this help menu |

## Security

Never commit `.env` or `web/.env.local` — only `.env.example` is tracked. The Last.fm keys have no in-code fallback on purpose: missing keys fail fast at startup instead of silently using someone else's.
