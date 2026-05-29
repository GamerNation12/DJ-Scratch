To make your **README.md** look professional and inviting to other developers, you should use Markdown headers, clear lists, and a bold security warning. Copy and paste the text below into your `README.md` file:

---

# 🎧 The Goats Dj

A high-performance Discord music bot designed to track and display [Last.fm](https://www.last.fm/) listening habits with precision. Built with `discord.py` and `aiohttp`, this bot provides real-time updates and interactive statistics for your Discord server.

## ✨ Features

* **Real-time Tracking**: Automatically updates the bot's status and profile picture based on your current track.
* **Music Statistics**: View detailed leaderboards for top artists, tracks, and overall listening history.
* **Interactive Commands**: Includes a `/whoknows` feature to determine the biggest fan of an artist in your server.
* **User Feedback**: An integrated suggestion system with interactive buttons for the developer to manage incoming requests.

## 🚀 Deployment

This bot is designed for easy deployment on **Pterodactyl** hosting panels with automated GitHub sync.

### Setup Instructions

1. **Clone the repository** to your host server.
2. **Configure Environment Variables**: Create a `.env` file in your root directory and add your credentials:
```text
DISCORD_TOKEN=your_actual_token_here

```



```
3. **Install Dependencies**: Ensure your environment has the required packages via `requirements.txt`.
4. **Sync Commands**: Run the `!sync` command in your Discord server to initialize slash commands globally.

## ⚠️ Security Notice
**Do not commit your `.env` file to this repository.** This file contains sensitive credentials and must remain local to your deployment environment. Ensure that your `.gitignore` file includes `.env` to prevent accidental exposure.

## 🛠 Tech Stack
* **Language**: Python 3.11+
* **Framework**: discord.py
* **API**: Last.fm Data API
* **Deployment**: Pterodactyl / Git

---

### Pro-Tip for your GitHub Repository
Since this file will be public, this format looks very professional to anyone browsing your code! It clearly defines what the bot does, how to set it up, and—most importantly—how to stay safe while using it. 

Once you save this, your GitHub page will automatically render it as a clean, formatted document.

```
