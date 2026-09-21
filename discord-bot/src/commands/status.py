import discord
from discord.ext import commands, tasks
import psutil
import time
from datetime import datetime, timedelta
from src.core.theme import Theme
from src.core.database import get_global_setting, set_global_setting, get_total_linked_users

class StatusCog(commands.Cog):
    def __init__(self, bot):
        self.bot = bot
        self.process = psutil.Process()
        self._presence_sig = None
        self._recap_running = False
        self.status_loop.start()
        self.presence_loop.start()
        self.recap_scheduler.start()

    def cog_unload(self):
        self.status_loop.cancel()
        try:
            self.presence_loop.cancel()
        except Exception:
            pass
        try:
            self.recap_scheduler.cancel()
        except Exception:
            pass

    @commands.command(name="setstatus", hidden=True)
    @commands.is_owner()
    async def setstatus(self, ctx):
        embed = await self.build_status_embed(offline=False)
        msg = await ctx.send(embed=embed)
        
        import json
        raw_msgs = await get_global_setting('status_messages')
        messages = []
        if raw_msgs:
            try:
                messages = json.loads(raw_msgs)
            except:
                pass
                
        messages.append({"channel_id": str(ctx.channel.id), "message_id": str(msg.id)})
        await set_global_setting('status_messages', json.dumps(messages))
        
        await ctx.send("✅ Status monitoring channel set! The message above will now update every minute.", delete_after=5)

    async def build_status_embed(self, offline=False):
        if offline:
            embed = discord.Embed(title="<a:VinylRecord:1527125818713837701> DJ Scratch - System Status", color=discord.Color.red(), timestamp=discord.utils.utcnow())
            embed.description = "**🔴 STATUS: OFFLINE (CRASHED)**\n*The bot has lost connection to the server.*"
            embed.set_footer(text="Watchdog Monitor")
            return embed
            
        is_restarting = getattr(self.bot, 'is_restarting', False)
        color = discord.Color.gold() if is_restarting else discord.Color.green()
        embed = discord.Embed(title="<a:VinylRecord:1527125818713837701> DJ Scratch - System Status", color=color, timestamp=discord.utils.utcnow())
        
        if is_restarting:
            timestamp = int(self.bot.is_restarting) if isinstance(self.bot.is_restarting, float) else int(time.time() + 60)
            reason = getattr(self.bot, 'restart_reason', 'Maintenance')
            embed.description = f"**🟡 STATUS: RESTARTING**\n*The bot is shutting down <t:{timestamp}:R> because: **{reason}**.*"
        else:
            embed.description = "**🟢 STATUS: ONLINE**"
            
        # Calculate uptime
        uptime = time.time() - self.process.create_time()
        uptime_td = timedelta(seconds=uptime)
        days = uptime_td.days
        hours, remainder = divmod(uptime_td.seconds, 3600)
        minutes, seconds = divmod(remainder, 60)
        uptime_str = f"{days}d {hours}h {minutes}m" if days > 0 else f"{hours}h {minutes}m {seconds}s"
        
        # Ping
        try:
            ping = round(self.bot.latency * 1000)
        except (OverflowError, ValueError, TypeError):
            ping = 0
        
        # Guilds and members
        server_count = len(self.bot.guilds)
        total_members = sum(g.member_count for g in self.bot.guilds if g.member_count)
        
        # Resources
        cpu_usage = self.process.cpu_percent()
        ram_usage_bytes = self.process.memory_info().rss
        ram_usage_mb = ram_usage_bytes / (1024 * 1024)
        
        embed.add_field(name="🟢 Uptime", value=f"`{uptime_str}`", inline=True)
        embed.add_field(name="🏓 Ping", value=f"`{ping}ms`", inline=True)
        embed.add_field(name="🌐 Servers", value=f"`{server_count:,}`", inline=True)
        
        embed.add_field(name="👥 Users", value=f"`{total_members:,}`", inline=True)
        
        total_linked_users = await get_total_linked_users()
        embed.add_field(name="🎧 Bot Users", value=f"`{total_linked_users:,}`", inline=True)
        
        active_users_count = 0
        if hasattr(self.bot, 'active_users_dict'):
            current_time = time.time()
            self.bot.active_users_dict = {uid: t for uid, t in self.bot.active_users_dict.items() if current_time - t <= 300}
            active_users_count = len(self.bot.active_users_dict)
            
        embed.add_field(name="⚡ Active Cmds (5m)", value=f"`{active_users_count:,}`", inline=True)
        
        embed.add_field(name="💻 CPU Usage", value=f"`{cpu_usage}%`", inline=True)
        embed.add_field(name="💾 RAM Usage", value=f"`{ram_usage_mb:.1f} MB`", inline=True)
        
        embed.set_footer(text="Live Updating Dashboard • Last Updated")
        return embed

    async def force_update_statuses(self):
        if getattr(self.bot, 'is_test_bot', False): return
        try:
            import json
            raw_msgs = await get_global_setting('status_messages')
            if not raw_msgs:
                return
            messages = json.loads(raw_msgs)
            for item in messages:
                channel_id = item.get('channel_id')
                message_id = item.get('message_id')
                if channel_id and message_id:
                    channel = self.bot.get_channel(int(channel_id))
                    if channel:
                        try:
                            msg = await channel.fetch_message(int(message_id))
                            embed = await self.build_status_embed(offline=False)
                            await msg.edit(embed=embed)
                        except Exception:
                            pass
        except Exception as e:
            from src.core.config import Log
            print(f"{Log.RED}>>> Error in force_update_statuses: {e}{Log.RESET}")

    @tasks.loop(minutes=1)
    async def status_loop(self):
        if getattr(self.bot, 'is_test_bot', False): return
        await self.bot.wait_until_ready()
        try:
            # 1. Update heartbeat
            now = datetime.utcnow().isoformat()
            await set_global_setting('last_heartbeat', now)
            
            # 2. Fetch status messages
            import json
            raw_msgs = await get_global_setting('status_messages')
            if not raw_msgs:
                return
                
            messages = []
            try:
                messages = json.loads(raw_msgs)
            except:
                return
                
            updated_messages = []
            changed = False
            
            for item in messages:
                channel_id = item.get('channel_id')
                message_id = item.get('message_id')
                
                if channel_id and message_id:
                    channel = self.bot.get_channel(int(channel_id))
                    if not channel:
                        try:
                            channel = await self.bot.fetch_channel(int(channel_id))
                        except Exception:
                            pass
                            
                    if channel:
                        try:
                            msg = await channel.fetch_message(int(message_id))
                            embed = await self.build_status_embed(offline=False)
                            await msg.edit(embed=embed)
                            updated_messages.append(item)
                        except discord.NotFound:
                            changed = True # Message deleted
                        except discord.HTTPException as e:
                            if e.status not in [500, 502, 503, 504]:
                                print(f"Error updating status message {message_id}: {e}")
                            updated_messages.append(item)
                        except Exception as e:
                            print(f"Error updating status message {message_id}: {e}")
                            updated_messages.append(item)
                    else:
                        changed = True # Channel deleted/inaccessible
                        
            if changed:
                await set_global_setting('status_messages', json.dumps(updated_messages))
        except Exception as e:
            from src.core.config import Log
            print(f"{Log.RED}>>> Error in status loop: {e}{Log.RESET}")

    @tasks.loop(seconds=30)
    async def presence_loop(self):
        """Billboard: bot's Listening activity follows the avatar track.

        When someone sets the bot avatar via ,fm, update_bot_avatar_and_status
        stores that song (bot_status/bot_track/bot_album). This loop keeps a
        rich Listening activity on it (also repairing it after reconnects,
        which reset presence). Updates Discord only when the song changes."""
        if getattr(self.bot, 'is_test_bot', False):
            return
        await self.bot.wait_until_ready()
        if getattr(self.bot, 'is_restarting', False):
            return
        try:
            from src.core.database import get_global_setting
            artist = await get_global_setting('bot_status')
            if not artist:
                return  # avatar never set — leave presence alone
            track = await get_global_setting('bot_track')
            album = await get_global_setting('bot_album')
            sig = (artist, track, album)
            if sig == getattr(self, '_presence_sig', None):
                return
            self._presence_sig = sig
            kwargs = dict(type=discord.ActivityType.listening, name=artist[:128])
            if track:
                kwargs["details"] = track[:128]
            if album:
                kwargs["state"] = album[:128]
            await self.bot.change_presence(activity=discord.Activity(**kwargs))
        except Exception as e:
            from src.core.config import Log
            print(f"{Log.RED}>>> Error in presence loop: {e}{Log.RESET}")

    @tasks.loop(minutes=30)
    async def recap_scheduler(self):
        """Auto-DM weekly/monthly recap images at each period rollover.

        Once per ISO week / calendar month, every linked + recently-active
        user with DMs on gets their recap DM'd (closed DMs are skipped).
        First run only baselines the keys so deploys don't blast everyone
        immediately. Sequential + paced for the small host."""
        if getattr(self.bot, 'is_test_bot', False):
            return
        await self.bot.wait_until_ready()
        if getattr(self.bot, 'is_restarting', False):
            return
        if self._recap_running:
            return
        self._recap_running = True
        try:
            import io as _io
            import asyncio as _aio
            from datetime import datetime, timezone
            from src.core.config import Log
            from src.core.database import get_global_setting, set_global_setting, db_pool
            now = datetime.now(timezone.utc)
            iso = now.isocalendar()
            week_key = f"{iso[0]}-W{iso[1]:02d}"
            month_key = now.strftime("%Y-%m")
            last_week = await get_global_setting('recap_last_week')
            last_month = await get_global_setting('recap_last_month')
            due = []
            if last_week is None:
                await set_global_setting('recap_last_week', week_key)
            elif last_week != week_key:
                due.append(("week", week_key, 'recap_last_week'))
            if last_month is None:
                await set_global_setting('recap_last_month', month_key)
            elif last_month != month_key:
                due.append(("month", month_key, 'recap_last_month'))
            if not due or not db_pool:
                return
            try:
                async with db_pool.acquire() as conn:
                    rows = await conn.fetch(
                        "SELECT user_id FROM user_settings WHERE lastfm_username IS NOT NULL "
                        "AND (last_active IS NULL OR last_active > CURRENT_TIMESTAMP - INTERVAL '14 days')")
            except Exception:
                rows = []
            cog = self.bot.get_cog("LastFmCog")
            if cog is None or not rows:
                for _p, _k, _s in due:
                    await set_global_setting(_s, _k)
                return
            for period, key, setting in due:
                sent = 0
                word = "month" if period == "month" else "week"
                for row in rows:
                    uid = row['user_id']
                    try:
                        u = self.bot.get_user(int(uid))
                        if u is None:
                            u = await self.bot.fetch_user(int(uid))
                        if u is None:
                            continue
                        result, err = await cog._recap_result(u, period)
                        if err or not result:
                            continue
                        img_bytes, invite_url = result
                        caption = f"📊 Here's your {word}ly recap!"
                        if invite_url:
                            caption += f" Share it! Friends who join via <{invite_url}> earn badges with you."
                        await u.send(content=caption,
                                     file=discord.File(_io.BytesIO(img_bytes), filename="recap.jpg"))
                        sent += 1
                        await _aio.sleep(2)
                    except discord.Forbidden:
                        # DMs closed: flag for in-channel delivery on their
                        # next command (claimed one-shot by the hook).
                        try:
                            _col = 'recap_pending_month' if period == 'month' else 'recap_pending_week'
                            async with db_pool.acquire() as _conn:
                                await _conn.execute(
                                    f"UPDATE user_settings SET {_col} = $2 WHERE user_id = $1",
                                    uid, key)
                        except Exception:
                            pass
                        continue
                    except Exception as e:
                        print(f"{Log.RED}>>> Auto-recap DM failed for {uid}: {e}{Log.RESET}")
                        continue
                await set_global_setting(setting, key)
                print(f"{Log.GREEN}>>> Auto-recap ({period} {key}) sent to {sent} users{Log.RESET}")
        except Exception as e:
            try:
                from src.core.config import Log
                print(f"{Log.RED}>>> Error in recap scheduler: {e}{Log.RESET}")
            except Exception:
                pass
        finally:
            self._recap_running = False

async def setup(bot):
    await bot.add_cog(StatusCog(bot))
