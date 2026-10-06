import discord
from discord.ext import commands
from src.core.config import OWNER_ID, Log

SUPPORT_GUILD_ID = 1527127381897383946
LOG_CHANNEL_ID = 1517288950522187947  # same log channel the import worker uses


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


async def setup(bot):
    await bot.add_cog(SupportInviteCog(bot))
