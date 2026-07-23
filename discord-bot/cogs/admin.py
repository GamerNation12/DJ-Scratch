import discord
from discord.ext import commands, tasks
import os
import sys

# Temporarily hardcode or import these until we build config.py
OWNER_ID = 759433582107426816

class Log:
    RESET = '\033[0m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    CYAN = '\033[96m'
    MAGENTA = '\033[95m'

class OwnerCommands(commands.Cog, name="Owner Commands"):
    def __init__(self, bot):
        self.bot = bot

    async def cog_check(self, ctx):
        from src.core.database import has_command_permission
        return await has_command_permission(str(ctx.author.id), ctx.command.name)

    @commands.command(name="cancel")
    async def cancel_restart(self, ctx):
        if getattr(self.bot, 'is_restarting', False):
            self.bot.is_restarting = False
            await ctx.send("✅ **Restart cancelled.** The bot will remain online.")
            
            try:
                import discord
                from src.core.database import db_pool
                if db_pool:
                    async with db_pool.acquire() as conn:
                        row = await conn.fetchrow("SELECT value FROM global_settings WHERE key = 'bot_status'")
                        if row and row['value']:
                            await self.bot.change_presence(status=discord.Status.online, activity=discord.Activity(type=discord.ActivityType.listening, name=row['value']))
                        else:
                            await self.bot.change_presence(status=discord.Status.online, activity=None)
                else:
                    await self.bot.change_presence(status=discord.Status.online, activity=None)
                    
                status_cog = self.bot.get_cog("StatusCog")
                if status_cog:
                    await status_cog.force_update_statuses()
            except Exception as e:
                print(f"Failed to reset status on cancel: {e}")
        else:
            await ctx.send("⚠️ No restart is currently in progress.")

    @commands.command(name="sync", aliases=["sy"])
    async def sync_commands(self, ctx):
        msg = await ctx.send("Syncing slash commands globally... (This may take a moment)")
        try:
            app_id = self.bot.application_id or (await self.bot.application_info()).id
            
            # Fetch existing global commands to find any protected Entry Points (type 4)
            existing_cmds = await self.bot.http.get_global_commands(app_id)
            entry_points = [cmd for cmd in existing_cmds if cmd.get('type') == 4]
            
            # Get the payload of our bot's current commands from the tree
            local_cmds = self.bot.tree._get_all_commands(guild=None)
            payload = [c.to_dict(self.bot.tree) for c in local_cmds]
            
            # Append the protected entry point commands to the payload
            payload.extend(entry_points)
            
            # Bulk upsert the commands directly to the API
            synced_data = await self.bot.http.bulk_upsert_global_commands(app_id, payload)
            
            await msg.edit(content=f"✅ Synced {len(synced_data)} slash commands globally (including {len(entry_points)} protected Entry Points)!")
            print(f"{Log.GREEN}>>> Owner synced {len(synced_data)} slash commands.{Log.RESET}")
        except Exception as e:
            await msg.edit(content=f"❌ Sync failed: {e}")

    @commands.command(name="stats", aliases=["guilds", "servers", "st"])
    async def stats_command(self, ctx):
        guilds = sorted(self.bot.guilds, key=lambda g: g.member_count or 0, reverse=True)
        total_servers = len(guilds)
        total_members = sum(g.member_count for g in guilds if g.member_count)
        
        desc_lines = []
        for idx, guild in enumerate(guilds[:25], 1):
            desc_lines.append(f"**{idx}. {guild.name}**\n   └ ID: `{guild.id}` | Members: **{guild.member_count}**")
            
        if len(guilds) > 25:
            desc_lines.append(f"\n*...and {len(guilds) - 25} more servers.*")
            
        from src.core.theme import Theme
        embed = discord.Embed(
            title="📊 Bot Server Usage Statistics",
            description=chr(10).join(desc_lines) if desc_lines else "Currently not in any servers.",
            color=Theme.PRIMARY
        )
        embed.add_field(name="Total Servers", value=f"`{total_servers}`", inline=True)
        embed.add_field(name="Total Reach", value=f"`{total_members}` members", inline=True)
        
        await ctx.send(embed=embed)

    @commands.command(name="cleanduplicates", aliases=["cdp", "cleand"])
    async def clean_duplicates_command(self, ctx):
        msg = await ctx.send("🧹 Scanning database for bugged duplicates (Account Data & overlapping timestamps)...")
        try:
            if not getattr(self.bot, 'db_pool', None):
                await msg.edit(content="❌ Database is currently offline.")
                return
                
            async with self.bot.db_pool.acquire() as conn:
                await conn.execute("DELETE FROM listens WHERE album_name = '' OR album_name IS NULL")
                
                result = await conn.execute("""
                    DELETE FROM listens a USING listens b
                    WHERE a.user_id = b.user_id 
                      AND a.artist_name = b.artist_name 
                      AND a.track_name = b.track_name 
                      AND a.ctid > b.ctid 
                      AND a.played_at >= b.played_at - interval '2 minutes' 
                      AND a.played_at <= b.played_at + interval '2 minutes'
                """)
                deleted_count = result.split()[-1] if isinstance(result, str) and result.startswith("DELETE") else "unknown number of"
                
            await msg.edit(content=f"✅ Successfully deleted **{deleted_count}** time-window overlapping duplicate entries!")
            print(f"{Log.GREEN}>>> Owner cleared {deleted_count} time-window duplicates.{Log.RESET}")
        except Exception as e:
            await msg.edit(content=f"❌ Failed to clean duplicates: {e}")

    @commands.command(name="testautorestart", aliases=["tar"])
    async def test_auto_restart(self, ctx):
        await ctx.send("🔄 Simulating high RAM usage. Auto-restarting bot...")
        print(f"{Log.RED}>>> CRITICAL: System RAM usage is at 99.9%. Auto-restarting bot... (SIMULATION){Log.RESET}")
        try:
            await ctx.author.send(f"🚨 **CRITICAL ALERT:** System RAM usage reached **99.9%**.\\nThe bot is now auto-restarting to prevent a crash. *(Simulation)*")
        except Exception as e:
            pass
        if getattr(self.bot, 'session', None):
            await self.bot.session.close()
        await self.bot.close()
        os._exit(0)

    @commands.command(name="testscrobble", hidden=True)
    @commands.is_owner()
    async def testscrobble(self, ctx, artist: str, track: str):
        from src.utils.api import scrobble_bot_track
        await ctx.send(f"Testing scrobble: {artist} - {track}")
        try:
            res = await scrobble_bot_track(self.bot.session, artist, track)
            await ctx.send(f"Result: {res}")
        except Exception as e:
            await ctx.send(f"Error: {e}")

    @commands.command(name="wipedata", aliases=["wd", "wipe"])
    async def wipe_data(self, ctx):
        msg = await ctx.send("🧨 Wiping ALL imported data from the database. This cannot be undone...")
        try:
            from src.core.database import db_pool
            import json
            import os
            
            if not db_pool:
                await msg.edit(content="❌ Database is currently offline.")
                return
            
            async with db_pool.acquire() as conn:
                await conn.execute("TRUNCATE TABLE listens;")
                await conn.execute("TRUNCATE TABLE imported_users;")
                
                await conn.execute("TRUNCATE TABLE user_settings;")
            await msg.edit(content="✅ Successfully wiped ALL data (listens, users, settings). Rebuild from the ground up!")
            print(f"{Log.RED}>>> Owner executed global wipe of all tables.{Log.RESET}")
        except Exception as e:
            await msg.edit(content=f"❌ Failed to wipe data: {e}")

    @commands.command(name="restart", aliases=["rs"])
    async def restart_bot(self, ctx):
        await ctx.send("🔄 Restarting bot in 1 minute...")
        print(f"{Log.RED}>>> Restart triggered by owner. Exiting process in 1 minute...{Log.RESET}")
        
        # Change presence to warn users across servers
        try:
            import time
            self.bot.is_restarting = time.time() + 60
            self.bot.restart_reason = "Manual restart by Developer"
            status_cog = self.bot.get_cog("StatusCog")
            if status_cog:
                await status_cog.force_update_statuses()
            await self.bot.change_presence(
                status=discord.Status.do_not_disturb, 
                activity=discord.Game(name="Restarting in 1 min...")
            )
        except Exception:
            pass
            
        try:
            await ctx.author.send("🔄 **Manual Restart Initiated**\\nThe bot is now restarting via the `.restart` command in 1 minute.")
        except Exception:
            pass
            
        import asyncio
        for _ in range(60):
            if not getattr(self.bot, 'is_restarting', False):
                # If it's cancelled, we don't need to exit. The cancel command handles status resets.
                return
            await asyncio.sleep(1)
        
        if getattr(self.bot, 'session', None):
            await self.bot.session.close()
        await self.bot.close()
        os._exit(0)


    @commands.command(name="resetcd", aliases=["rcd"])
    async def resetcd(self, ctx):
        from src.core.database import db_pool
        from datetime import datetime, timedelta
        if db_pool:
            past_dt = datetime.utcnow() - timedelta(hours=1)
            async with db_pool.acquire() as conn:
                await conn.execute("INSERT INTO global_settings (key, value) VALUES ('avatar_cooldown', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value", past_dt.isoformat())
            await ctx.send("✅ Avatar cooldown has been bypassed.")
        else:
            await ctx.send("❌ Database not connected.")


    @commands.command(name="inactive_users", aliases=["iu"])
    async def inactive_users(self, ctx, *, days_input: str = "60"):
        from src.core.database import db_pool
        from datetime import datetime, timedelta, timezone
        import re
        
        match = re.search(r'\d+', days_input)
        days = int(match.group()) if match else 60
        
        if not db_pool:
            return await ctx.send("❌ Database not connected.")
            
        async with db_pool.acquire() as conn:
            total_users = await conn.fetchval("SELECT COUNT(*) FROM user_settings")
            cutoff = datetime.now(timezone.utc) - timedelta(days=days)
            
            active_users = await conn.fetchval(
                "SELECT COUNT(*) FROM user_settings WHERE last_active >= $1", 
                cutoff
            )
            
            inactive_users = total_users - active_users
            
            embed = discord.Embed(title="📊 Bot User Activity", color=discord.Color.blue())
            embed.add_field(name="Total Registered Users", value=f"{total_users:,}", inline=False)
            embed.add_field(name=f"Active (Last {days} days)", value=f"{active_users:,}", inline=True)
            embed.add_field(name=f"Inactive (> {days} days)", value=f"{inactive_users:,}", inline=True)
            
            oldest = await conn.fetch(
                "SELECT user_id, last_active FROM user_settings WHERE last_active < $1 OR last_active IS NULL ORDER BY last_active ASC NULLS FIRST LIMIT 5",
                cutoff
            )
            
            if oldest:
                oldest_str = ""
                for row in oldest:
                    uid = row['user_id']
                    la = row['last_active']
                    if la:
                        oldest_str += f"<@{uid}> (Last active: <t:{int(la.timestamp())}:R>)\n"
                    else:
                        oldest_str += f"<@{uid}> (Never tracked)\n"
                embed.add_field(name="Sample Inactive Users", value=oldest_str, inline=False)
                
            await ctx.send(embed=embed)

    @commands.command(name="simulate_inactive")
    async def simulate_inactive(self, ctx, days: int = 54):
        """Sets your own account's inactivity timestamp back to test the purge system."""
        from src.core.database import db_pool
        from datetime import datetime, timedelta, timezone
        if not db_pool:
            return await ctx.send("❌ Database not connected.")
            
        async with db_pool.acquire() as conn:
            past_dt = datetime.now(timezone.utc) - timedelta(days=days)
            await conn.execute("UPDATE user_settings SET last_active = $1, purge_warning_sent = FALSE WHERE user_id = $2", past_dt, str(ctx.author.id))
            await ctx.send(f"✅ Your `last_active` timestamp has been manually set to **{days} days ago** (and warning flag reset)!\n\n**To test the DM warning:** Run `,trigger_purge`.\n**To test account deletion:** Run `,simulate_inactive 61` and then `,trigger_purge`.")

    @commands.command(name="trigger_purge")
    async def trigger_purge(self, ctx):
        """Manually forces the automated purge loop to run instantly."""
        from src.core.events import run_inactive_purge
        msg = await ctx.send("⏳ Forcing the background purge task to run right now...")
        await run_inactive_purge()
        await msg.edit(content="✅ Purge task finished running! Check your DMs (if you were in the 53-60 day range) or the terminal for deletion logs.")

    @commands.command(name="debug", aliases=["db"])
    async def debug_cmd(self, ctx):
        embed = discord.Embed(title="<a:VinylRecord:1527125818713837701> System Debug Info", color=discord.Color.gold(), timestamp=discord.utils.utcnow())
        
        # CPU & RAM
        import psutil
        cpu_usage = psutil.cpu_percent(interval=None)
        ram_usage = psutil.virtual_memory().percent
        
        # Database
        from src.core.database import db_pool
        db_status = "🟢 Connected" if db_pool else "🔴 Disconnected"
        
        # Web Socket
        from src.core.socket_server import user_sockets
        socket_status = f"🟢 Online ({len(user_sockets)} connected)"
        if getattr(self.bot, 'is_test_bot', False):
            socket_status = "⚪ Disabled (Test Bot)"
        
        # Discord API
        latency = round(self.bot.latency * 1000)
        
        embed.add_field(name="Server Resources", value=f"**CPU:** {cpu_usage}%\n**RAM:** {ram_usage}%", inline=True)
        embed.add_field(name="Database", value=db_status, inline=True)
        embed.add_field(name="Web Socket IPC", value=socket_status, inline=True)
        embed.add_field(name="Discord API", value=f"**Latency:** {latency}ms\n**Guilds:** {len(self.bot.guilds)}\n**Users:** {len(self.bot.users)}", inline=False)
        
        # Spotify Scanner
        try:
            from src.core.events import SPOTIFY_PREMIUM_ERROR
            if SPOTIFY_PREMIUM_ERROR:
                embed.add_field(name="Spotify Scanner", value="🔴 Paused (Premium Required)", inline=False)
            else:
                embed.add_field(name="Spotify Scanner", value="🟢 Active", inline=False)
        except Exception:
            pass
            
        await ctx.send(embed=embed)

async def setup(bot):
    await bot.add_cog(OwnerCommands(bot))
