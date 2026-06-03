<div align="center">
  <img src="https://media.discordapp.net/attachments/1118335048560066601/1118335345793617930/goat.png" alt="The Goats DJ Logo" width="150" />
  <h1>🐐 The Goats DJ</h1>
  <p><em>The ultimate high-performance Discord music statistics bot for tracking Last.fm and Spotify listening habits with precision.</em></p>
</div>

---

## ✨ About The Bot

The Goats DJ is a heavily integrated Last.fm and Spotify statistics bot built with `discord.py` and a clean modular architecture. It connects directly to your music history to bring live stats, leaderboards, and personalized embeds right into your Discord server.

### 🔥 Key Features
* **Real-time Tracking**: Automatically updates the bot's status and profile picture to match the track you're currently listening to!
* **Deep Spotify Integration**: Import your massive extended Spotify history ZIP file natively within Discord so you never lose your old plays.
* **Music Statistics**: View detailed leaderboards for your top artists, tracks, and overall listening history across customizable time periods.
* **Who Knows**: Use `/whoknows` to pit your server members against each other and determine who the true biggest fan of an artist is.
* **Custom Layouts**: Users can choose exactly how their `/fm` command looks (compact text, rich images, or detailed statistics).
* **Next.js Web Admin Panel**: A beautiful, Discord OAuth-secured website for the bot owner to monitor the bot's status and database in real-time.

---

## 🚀 How to Host The Bot

The Goats DJ is built on **Python 3.11+** and **Node.js** (for the web panel), and utilizes a **PostgreSQL Database** (Neon). 

### Prerequisites
1. Python 3.11 or higher
2. Node.js (v18+) for the web panel
3. A PostgreSQL Database (We recommend a free serverless tier from [Neon.tech](https://neon.tech))
4. Discord Bot Token ([Discord Developer Portal](https://discord.com/developers/applications))
5. Last.fm API Key ([Last.fm API](https://www.last.fm/api/account/create))

### Step 1: Clone the Repository
Clone the repository to your VPS, dedicated server, or Pterodactyl hosting panel:
```bash
git clone https://github.com/GamerNation12/The-Goats-Dj.git
cd The-Goats-Dj
```

### Step 2: Configure Environment Variables
You must create a `.env` file in the root directory for the bot to read your secret credentials.
```bash
touch .env
```
Inside the `.env` file, paste the following and fill in your keys:
```env
# Discord Bot
DISCORD_TOKEN=your_discord_bot_token_here

# Database (Neon PostgreSQL)
DATABASE_URL=postgres://user:pass@host/dbname
POSTGRES_URL=postgres://user:pass@host/dbname
```

> **Note**: Your Last.fm keys and your Discord User ID (for bot ownership) are safely stored in `src/core/config.py`. Make sure to update `OWNER_ID` to your personal Discord ID!

### Step 3: Install Python Dependencies
Install the required Python modules:
```bash
pip install -r requirements.txt
```

### Step 4: Launch the Bot!
The Goats DJ uses a highly optimized modular architecture. To start the bot, run the lightning-fast launcher:
```bash
python main.py
```
*The bot will automatically connect to your database, initialize its tables, and come online in Discord!*

---

## 🌐 Hosting the Web Admin Panel

The repository includes a dedicated Next.js web application with an Admin Dashboard.

1. Navigate to the `web/` directory:
```bash
cd web
```
2. Create a `.env.local` file inside the `web/` directory:
```env
# Discord OAuth (Create this in your Discord Dev Portal -> OAuth2)
DISCORD_CLIENT_ID=your_client_id
DISCORD_CLIENT_SECRET=your_client_secret

# NextAuth Configuration
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=generate_a_random_secret_string

# Database Connection
DATABASE_URL=postgres://user:pass@host/dbname
```
3. Install web dependencies:
```bash
npm install
```
4. Start the production web server:
```bash
npm run build
npm run start
```
You can now access your beautifully styled homepage, log in via Discord, and view your exclusive Admin Panel!

---

## 🛠 Tech Stack
* **Language**: Python 3.11+, TypeScript
* **Framework**: `discord.py`, `Next.js`, `TailwindCSS`
* **Database**: PostgreSQL (via `asyncpg` and `@vercel/postgres`)
* **API**: Last.fm Data API & Spotify OAuth

## ⚠️ Security Notice
**Never commit your `.env` files to GitHub!** These files contain your sensitive credentials. Ensure that your `.gitignore` file includes `.env` and `web/.env.local` to prevent accidental exposure.
