"""ListenBrainz linking (read-only v1): /linklb + ,linklb, /unlinklb + ,unlinklb."""
import discord
from discord.ext import commands
from discord import app_commands

from src.core.theme import Theme
from src.core.config import Log


class ListenBrainzCog(commands.Cog):
    def __init__(self, bot):
        self.bot = bot

    async def _do_link(self, user, lb_username):
        from src.utils.listenbrainz import fetch_lb_listen_count
        from src.core.database import set_listenbrainz_username
        name = (lb_username or "").strip()
        if not name:
            return Theme.get_error_embed(description="Give your ListenBrainz username: `/linklb <username>`")
        total = await fetch_lb_listen_count(name)
        if total is None:
            return Theme.get_error_embed(
                description=f"Couldn't find ListenBrainz user **{name}**.\nCheck the spelling — it's the name on your listenbrainz.org profile.")
        ok = await set_listenbrainz_username(user.id, name)
        if not ok:
            return Theme.get_error_embed(description="Database is not available right now. Please try again later.")
        return Theme.get_embed(
            title="✅ ListenBrainz Linked",
            description=f"Linked as **[{name}](https://listenbrainz.org/user/{name}/)** with **{total:,}** scrobbles.\n\n"
                        "`/fm` will now fall back to ListenBrainz when Last.fm has nothing playing.",
            color=discord.Color.green())

    @app_commands.command(name="linklb", description="Link your ListenBrainz account for now-playing fallback")
    @app_commands.describe(username="Your ListenBrainz username")
    @app_commands.allowed_installs(guilds=True, users=True)
    @app_commands.allowed_contexts(guilds=True, dms=True, private_channels=True)
    async def linklb_slash(self, interaction: discord.Interaction, username: str):
        await interaction.response.defer(ephemeral=True)
        try:
            embed = await self._do_link(interaction.user, username)
            await interaction.followup.send(embed=embed, ephemeral=True)
        except Exception as e:
            print(f"{Log.RED}>>> /linklb failed: {e}{Log.RESET}")
            try:
                await interaction.followup.send("❌ Something went wrong. Please try again.", ephemeral=True)
            except Exception:
                pass

    @commands.command(name="linklb")
    async def linklb_prefix(self, ctx, *, username: str = None):
        embed = await self._do_link(ctx.author, username)
        await ctx.reply(embed=embed, mention_author=False)

    @app_commands.command(name="unlinklb", description="Unlink your ListenBrainz account")
    @app_commands.allowed_installs(guilds=True, users=True)
    @app_commands.allowed_contexts(guilds=True, dms=True, private_channels=True)
    async def unlinklb_slash(self, interaction: discord.Interaction):
        await interaction.response.defer(ephemeral=True)
        try:
            from src.core.database import get_listenbrainz_username, unlink_listenbrainz
            current = await get_listenbrainz_username(interaction.user.id)
            if not current:
                embed = Theme.get_error_embed(description="No ListenBrainz account linked.")
            elif await unlink_listenbrainz(interaction.user.id):
                embed = Theme.get_embed(title="✅ ListenBrainz Unlinked",
                                        description=f"Unlinked **{current}**.",
                                        color=discord.Color.green())
            else:
                embed = Theme.get_error_embed(description="Database is not available right now. Please try again later.")
            await interaction.followup.send(embed=embed, ephemeral=True)
        except Exception as e:
            print(f"{Log.RED}>>> /unlinklb failed: {e}{Log.RESET}")
            try:
                await interaction.followup.send("❌ Something went wrong. Please try again.", ephemeral=True)
            except Exception:
                pass

    @commands.command(name="unlinklb")
    async def unlinklb_prefix(self, ctx):
        from src.core.database import get_listenbrainz_username, unlink_listenbrainz
        current = await get_listenbrainz_username(ctx.author.id)
        if not current:
            await ctx.reply(embed=Theme.get_error_embed(description="No ListenBrainz account linked."),
                            mention_author=False)
        elif await unlink_listenbrainz(ctx.author.id):
            await ctx.reply(embed=Theme.get_embed(title="✅ ListenBrainz Unlinked",
                                                  description=f"Unlinked **{current}**.",
                                                  color=discord.Color.green()),
                            mention_author=False)
        else:
            await ctx.reply(embed=Theme.get_error_embed(description="Database is not available right now."),
                            mention_author=False)


async def setup(bot):
    await bot.add_cog(ListenBrainzCog(bot))
