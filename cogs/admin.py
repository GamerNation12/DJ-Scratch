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

class AdminCog(commands.Cog):
    def __init__(self, bot):
        self.bot = bot


    @commands.command(name="sync")
    async def sync_commands(self, ctx):
        if ctx.author.id != OWNER_ID: return
        msg = await ctx.send("Syncing slash commands globally... (This may take a moment)")
        try:
            synced = await self.bot.tree.sync()
            await msg.edit(content=f"✅ Synced {len(synced)} slash commands globally!")
            print(f"{Log.GREEN}>>> Owner synced {len(synced)} slash commands.{Log.RESET}")
        except Exception as e:
            await msg.edit(content=f"❌ Sync failed: {e}")

    @commands.command(name="stats", aliases=["guilds", "servers"])
    async def stats_command(self, ctx):
        if ctx.author.id != OWNER_ID: return
        
        guilds = sorted(self.bot.guilds, key=lambda g: g.member_count or 0, reverse=True)
        total_servers = len(guilds)
        total_members = sum(g.member_count for g in guilds if g.member_count)
        
        desc_lines = []
        for idx, guild in enumerate(guilds[:25], 1):
            desc_lines.append(f"**{idx}. {guild.name}**\n   └ ID: `{guild.id}` | Members: **{guild.member_count}**")
            
        if len(guilds) > 25:
            desc_lines.append(f"\n*...and {len(guilds) - 25} more servers.*")
            
        embed = discord.Embed(
            title="📊 Bot Server Usage Statistics",
            description=chr(10).join(desc_lines) if desc_lines else "Currently not in any servers.",
            color=discord.Color.blue()
        )
        embed.add_field(name="Total Servers", value=f"`{total_servers}`", inline=True)
        embed.add_field(name="Total Reach", value=f"`{total_members}` members", inline=True)
        
        await ctx.send(embed=embed)

    @commands.command(name="cleanduplicates")
    async def clean_duplicates_command(self, ctx):
        if ctx.author.id != OWNER_ID: return
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

    @commands.command(name="testautorestart")
    async def test_auto_restart(self, ctx):
        if ctx.author.id != OWNER_ID: return
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

    @commands.command(name="wipedata")
    async def wipe_data(self, ctx):
        if ctx.author.id != OWNER_ID: return
        msg = await ctx.send("🧨 Wiping ALL imported data from the database. This cannot be undone...")
        try:
            from src.core.database import db_pool, USERS_FILE
            import json
            import os
            
            if not db_pool:
                await msg.edit(content="❌ Database is currently offline.")
                return
            
            async with db_pool.acquire() as conn:
                await conn.execute("TRUNCATE TABLE listens;")
                await conn.execute("TRUNCATE TABLE imported_users;")
                
            if os.path.exists(USERS_FILE):
                with open(USERS_FILE, "w") as f:
                    json.dump({}, f)
                
            await msg.edit(content="✅ Successfully wiped ALL data (listens, users, settings). Rebuild from the ground up!")
            print(f"{Log.RED}>>> Owner executed global wipe of all tables.{Log.RESET}")
        except Exception as e:
            await msg.edit(content=f"❌ Failed to wipe data: {e}")

    @commands.command(name="restart")
    async def restart_bot(self, ctx):
        if ctx.author.id != OWNER_ID: return
        await ctx.send("🔄 Restarting bot...")
        print(f"{Log.RED}>>> Restart triggered by owner. Exiting process...{Log.RESET}")
        try:
            await ctx.author.send("🔄 **Manual Restart Initiated**\\nThe bot is now restarting via the `.restart` command.")
        except Exception as e:
            pass
        if getattr(self.bot, 'session', None):
            await self.bot.session.close()
        await self.bot.close()
        os._exit(0)


async def setup(bot):
    await bot.add_cog(AdminCog(bot))
