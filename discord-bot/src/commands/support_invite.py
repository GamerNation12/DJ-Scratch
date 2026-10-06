import discord
from discord.ext import commands
from src.core.config import OWNER_ID

SUPPORT_GUILD_ID = 1527127381897383946


def _is_owner(uid) -> bool:
    try:
        return int(uid) == int(OWNER_ID)
    except Exception:
        return False


class SupportInviteCog(commands.Cog):
    def __init__(self, bot):
        self.bot = bot

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
