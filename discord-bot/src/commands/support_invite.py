import asyncio
import logging
import re

import discord
from discord.ext import commands
from src.core.config import OWNER_ID, Log

SUPPORT_GUILD_ID = 1527127381897383946
LOG_CHANNEL_ID = 1517288950522187947  # same log channel the import worker uses
GUILD_JOIN_LOG_ID = 1527127384535334954
GUILD_LEAVE_LOG_ID = 1527127384535334955
_ID_RE = re.compile(r"\*\*ID:\*\*\s*`(\d+)`")
_NAME_RE = re.compile(r"\*\*Name:\*\*\s*(.+)")


def _is_owner(uid) -> bool:
    try:
        return int(uid) == int(OWNER_ID)
    except Exception:
        return False


class SupportInviteCog(commands.Cog):
    def __init__(self, bot):
        self.bot = bot
        self._fixlogs_stop = False

    @commands.Cog.listener()
    async def on_member_join(self, member: discord.Member):
        # The bot's invite can't carry roles (Discord API has no such field),
        # so grant Members at join time instead. Matches the old invites.
        try:
            if member.bot or member.guild is None or member.guild.id != SUPPORT_GUILD_ID:
                return
            role = discord.utils.get(member.guild.roles, name="Members")
            if role is None:
                for r in member.guild.roles:
                    if r.name.lower() == "members":
                        role = r
                        break
            if role is None or role in member.roles:
                print(f"{Log.YELLOW}>>> [AUTOROLE] skip {member} ({member.id}): role missing or already present{Log.RESET}")
                return
            await member.add_roles(role, reason="Auto-role: joined support server")
            print(f"{Log.GREEN}>>> [AUTOROLE] granted Members to {member} ({member.id}){Log.RESET}")
            try:
                log_channel = self.bot.get_channel(LOG_CHANNEL_ID)
                if log_channel:
                    await log_channel.send(f"✅ Auto-role: granted **Members** to **{member}** (`{member.id}`) on join.")
            except Exception:
                pass
        except Exception as e:
            print(f"{Log.RED}>>> [AUTOROLE] failed for {member} ({getattr(member, 'id', '?')}): {e}{Log.RESET}")

    @commands.command(name="newinvite", aliases=["makeinvite", "botinvite"])
    async def newinvite_prefix(self, ctx, channel: discord.TextChannel = None):
        """Owner-only: bot creates a permanent support-server invite (bot shows as inviter)."""
        if not _is_owner(ctx.author.id):
            return await ctx.send("Only the bot owner can do that.")
        try:
            guild = None
            target = channel
            if target is not None:
                guild = target.guild
            elif ctx.guild is not None and ctx.guild.id == SUPPORT_GUILD_ID:
                guild = ctx.guild
                target = ctx.channel if isinstance(ctx.channel, discord.TextChannel) else None
            else:
                guild = self.bot.get_guild(SUPPORT_GUILD_ID)
                if guild is None:
                    try:
                        guild = await self.bot.fetch_guild(SUPPORT_GUILD_ID)
                    except Exception:
                        guild = None
                if guild is None:
                    return await ctx.send("I can't see the support server right now.")
            if target is None or target.guild.id != guild.id:
                target = guild.system_channel
                if target is None:
                    me = guild.me or guild.get_member(self.bot.user.id)
                    for ch in guild.text_channels:
                        try:
                            if ch.permissions_for(me).create_instant_invite:
                                target = ch
                                break
                        except Exception:
                            continue
                if target is None:
                    return await ctx.send("No channel found where I can create invites.")
            invite = await target.create_invite(
                max_age=0, max_uses=0, unique=True,
                reason="Owner-requested permanent bot invite",
            )
            await ctx.send(
                f"New bot-created invite: {invite.url}\n"
                f"Channel: #{target.name} — never expires, unlimited uses.\n"
                f"Swap it into the hardcoded `discord.gg/…` links (bot, website) so invites stop showing your name."
            )
        except discord.Forbidden:
            await ctx.send("I need the **Create Invite** permission in the support server.")
        except Exception as e:
            await ctx.send(f"Couldn't create the invite: {e}")

    @commands.command(name="fixlogs", aliases=["backfilllogs"])
    async def fixlogs_prefix(self, ctx, limit: str = "200"):
        """Owner-only one-time backfill: rewrite old guild join/leave log embeds in the new style."""
        if not _is_owner(ctx.author.id):
            return await ctx.send("Only the bot owner can do that.")
        if isinstance(limit, str) and limit.lower() == "stop":
            self._fixlogs_stop = True
            return await ctx.send("🛑 Current `,fixlogs` run will stop after this edit. Already-fixed messages stay fixed.")
        try:
            limit_n = max(1, min(int(limit), 500))
        except (TypeError, ValueError):
            return await ctx.send("Usage: `,fixlogs [limit]` or `,fixlogs stop`.")
        self._fixlogs_stop = False
        status = await ctx.send(f"🔧 Scanning guild log channels (last {limit_n} messages each)…")
        # Message edits are tightly bucketed and discord.py retries every 429
        # with a scary WARNING; quiet those for the run (restored after).
        http_log = logging.getLogger("discord.http")
        old_level = http_log.level
        http_log.setLevel(logging.ERROR)
        fixed, skipped = 0, 0
        try:
            for channel_id, is_join in ((GUILD_JOIN_LOG_ID, True), (GUILD_LEAVE_LOG_ID, False)):
                if self._fixlogs_stop:
                    break
                channel = self.bot.get_channel(channel_id)
                if channel is None:
                    try:
                        channel = await self.bot.fetch_channel(channel_id)
                    except Exception:
                        channel = None
                if channel is None:
                    await ctx.send(f"⚠️ Can't see <#{channel_id}>, skipping.")
                    continue
                try:
                    count = 0
                    async for msg in channel.history(limit=limit_n, oldest_first=False):
                        if self._fixlogs_stop:
                            break
                        count += 1
                        try:
                            if not msg.embeds or (msg.author != self.bot.user):
                                continue
                            old = msg.embeds[0]
                            title = old.title or ""
                            is_old_style = title in ("📥 Joined New Server!", "📤 Left Server")
                            m_new = re.match(r"^[📥📤]\s+(.*)$", title)
                            if not is_old_style and not m_new:
                                continue
                            try:
                                fields = {str(f.name): str(f.value) for f in (old.fields or [])}
                            except Exception:
                                fields = {}
                            gid = None
                            if "🆔 Server ID" in fields:
                                mm = re.search(r"(\d{5,25})", fields["🆔 Server ID"])
                                if mm:
                                    gid = int(mm.group(1))
                            if gid is None:
                                m = _ID_RE.search(old.description or "")
                                if m:
                                    gid = int(m.group(1))
                            if gid is None:
                                skipped += 1
                                continue
                            if is_old_style and not old.fields:
                                needs_fix = True
                            else:
                                # Already converted: repair only if something is still
                                # Unknown-but-recoverable or the name is wrong.
                                cur_title_name = m_new.group(1).strip() if m_new else ""
                                needs_fix = (
                                    "Unknown" in fields.get("🏠 Server created", "")
                                    or (is_join and "Unknown" in fields.get("🤖 Bot joined", ""))
                                    or (not cur_title_name or "Name:" in cur_title_name
                                        or cur_title_name in ("Joined New Server!", "Left Server"))
                                )
                                if not needs_fix:
                                    continue
                            guild = self.bot.get_guild(gid)
                            if guild is None and is_join:
                                try:
                                    guild = await self.bot.fetch_guild(gid)
                                except Exception:
                                    guild = None
                            # Server name: live guild > clean title > **Name:** line > Unknown.
                            name = None
                            if guild:
                                name = guild.name
                            if not name and m_new:
                                cand = m_new.group(1).strip()
                                if cand and "Name:" not in cand and cand not in ("Joined New Server!", "Left Server"):
                                    name = cand
                            if not name and old.description:
                                nm = _NAME_RE.search(old.description)
                                if nm and nm.group(1).strip():
                                    name = nm.group(1).strip()
                            if not name:
                                name = "Unknown server"
                            try:
                                if guild:
                                    created_ts = int(guild.created_at.timestamp())
                                else:
                                    created_ts = int(discord.utils.snowflake_time(gid).timestamp())
                            except Exception:
                                created_ts = None
                            members = f"{guild.member_count:,}" if guild and getattr(guild, "member_count", None) else "Unknown"
                            joined_value = "Unknown"
                            if is_join:
                                try:
                                    from src.core.database import db_pool
                                    if db_pool:
                                        async with db_pool.acquire() as conn:
                                            row = await conn.fetchrow(
                                                "SELECT joined_at FROM guild_membership WHERE guild_id = $1", str(gid))
                                            if row and row["joined_at"]:
                                                ts = int(row["joined_at"].timestamp())
                                                joined_value = f"<t:{ts}:D>\n<t:{ts}:R>"
                                except Exception:
                                    pass
                                if joined_value == "Unknown" and msg.created_at:
                                    # Join logs are posted at join time, so the message
                                    # timestamp is a good stand-in for old entries.
                                    jts = int(msg.created_at.timestamp())
                                    joined_value = f"<t:{jts}:D>\n<t:{jts}:R>"
                            from src.core.theme import Theme
                            kwargs = {}
                            if is_join:
                                try:
                                    owner = str(guild.owner) if guild and guild.owner else "Unknown"
                                except Exception:
                                    owner = "Unknown"
                                kwargs["owner"] = owner
                            embed = Theme.guild_log_embed(
                                "join" if is_join else "leave", name,
                                members=members,
                                created_ts=created_ts,
                                joined_value=joined_value,
                                guild_id=gid,
                                icon_url=old.thumbnail.url if old.thumbnail and old.thumbnail.url else None,
                                timestamp=old.timestamp,
                                **kwargs,
                            )
                            await msg.edit(embed=embed)
                            fixed += 1
                            if fixed % 10 == 0:
                                try:
                                    await status.edit(content=f"🔧 Working… rewrote **{fixed}** so far (scanned {count} in this channel)…")
                                except Exception:
                                    pass
                            await asyncio.sleep(4)  # message edits are tightly rate limited
                        except Exception:
                            skipped += 1
                            continue
                except Exception as e:
                    await ctx.send(f"⚠️ Scan failed in <#{channel_id}>: {e}")
        finally:
            http_log.setLevel(old_level)
        if self._fixlogs_stop:
            await status.edit(content=f"🛑 Stopped — rewrote **{fixed}** log message(s), skipped {skipped}. Re-run anytime to continue.")
        else:
            await status.edit(content=f"✅ Done — rewrote **{fixed}** log message(s), skipped {skipped}.")


async def setup(bot):
    await bot.add_cog(SupportInviteCog(bot))
