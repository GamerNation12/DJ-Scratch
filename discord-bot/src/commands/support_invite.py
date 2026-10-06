import asyncio
import re

import discord
from discord.ext import commands
from src.core.config import OWNER_ID, Log

SUPPORT_GUILD_ID = 1527127381897383946
LOG_CHANNEL_ID = 1517288950522187947  # same log channel the import worker uses
GUILD_JOIN_LOG_ID = 1527127384535334954
GUILD_LEAVE_LOG_ID = 1527127384535334955
_ID_RE = re.compile(r"\*\*ID:\*\*\s*`(\d+)`")


def _is_owner(uid) -> bool:
    try:
        return int(uid) == int(OWNER_ID)
    except Exception:
        return False


class SupportInviteCog(commands.Cog):
    def __init__(self, bot):
        self.bot = bot

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
    async def fixlogs_prefix(self, ctx, limit: int = 200):
        """Owner-only one-time backfill: rewrite old guild join/leave log embeds in the new style."""
        if not _is_owner(ctx.author.id):
            return await ctx.send("Only the bot owner can do that.")
        limit = max(1, min(limit, 500))
        status = await ctx.send(f"🔧 Scanning guild log channels (last {limit} messages each)…")
        fixed, skipped = 0, 0
        for channel_id, is_join in ((GUILD_JOIN_LOG_ID, True), (GUILD_LEAVE_LOG_ID, False)):
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
                async for msg in channel.history(limit=limit, oldest_first=False):
                    try:
                        if not msg.embeds or (msg.author != self.bot.user):
                            continue
                        old = msg.embeds[0]
                        if (old.title or "") not in ("📥 Joined New Server!", "📤 Left Server"):
                            continue
                        if old.fields:  # already new style
                            continue
                        m = _ID_RE.search(old.description or "")
                        if not m:
                            skipped += 1
                            continue
                        gid = int(m.group(1))
                        guild = self.bot.get_guild(gid)
                        if guild is None and is_join:
                            try:
                                guild = await self.bot.fetch_guild(gid)
                            except Exception:
                                guild = None
                        name = guild.name if guild else (old.title or "Unknown server")
                        created_ts = None
                        try:
                            if guild:
                                created_ts = int(guild.created_at.timestamp())
                        except Exception:
                            pass
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
                        from src.core.theme import Theme
                        embed = Theme.get_embed(
                            title="📥 Joined New Server!" if is_join else "📤 Left Server",
                            description=f"**{name}**",
                            color=discord.Color.green() if is_join else discord.Color.red(),
                        )
                        embed.add_field(name="👥 Members", value=members, inline=True)
                        if is_join:
                            try:
                                owner = str(guild.owner) if guild and guild.owner else "Unknown"
                            except Exception:
                                owner = "Unknown"
                            embed.add_field(name="👑 Owner", value=owner, inline=True)
                        embed.add_field(
                            name="🏠 Server created",
                            value=f"<t:{created_ts}:D>\n<t:{created_ts}:R>" if created_ts else "Unknown",
                            inline=True,
                        )
                        embed.add_field(name="🤖 Bot joined", value=joined_value, inline=True)
                        embed.add_field(name="🆔 Server ID", value=f"`{gid}`", inline=True)
                        if old.thumbnail and old.thumbnail.url:
                            embed.set_thumbnail(url=old.thumbnail.url)
                        await msg.edit(embed=embed)
                        fixed += 1
                        await asyncio.sleep(1)  # stay clear of edit rate limits
                    except Exception:
                        skipped += 1
                        continue
            except Exception as e:
                await ctx.send(f"⚠️ Scan failed in <#{channel_id}>: {e}")
        await status.edit(content=f"✅ Done — rewrote **{fixed}** log message(s), skipped {skipped}.")


async def setup(bot):
    await bot.add_cog(SupportInviteCog(bot))
