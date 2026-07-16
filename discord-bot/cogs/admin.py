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
            self.bot.is_restarting = True
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
        await asyncio.sleep(60)
        
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


async def setup(bot):
    await bot.add_cog(OwnerCommands(bot))
