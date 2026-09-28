import os
import secrets
import discord
from discord.ext import commands, tasks
from discord import app_commands
from src.core.config import OWNER_ID
import src.core.database as dbmod

SUPPORT_GUILD_ID = 1527127381897383946
TICKETS_CHANNEL_ID = 1527127384053121036
APP_BASE = "https://dj-scratch.is-a-fullstack.dev"


def _slug(name: str, prefix: str, fallback: str) -> str:
    """Discord channel names: lowercase letters, numbers, dashes."""
    import re
    s = re.sub(r"[^a-z0-9]+", "-", (name or "").lower()).strip("-")
    s = f"{prefix}-{s}" if s else fallback
    return s[:90] or fallback


async def _ticket_category(guild: discord.Guild) -> discord.CategoryChannel | None:
    """Find or create the private Tickets category. ID is shared with the
    website via global_settings so web tickets land in the same place."""
    try:
        for c in guild.categories:
            if c.name.lower() == "tickets":
                await _save_ticket_category(str(c.id))
                return c
        for c in guild.categories:
            # Misspelled leftovers from earlier ("Tikets") get renamed.
            if "tiket" in c.name.lower() or "ticket" in c.name.lower():
                try:
                    await c.edit(name="Tickets", reason="DJ Scratch ticket category")
                except Exception:
                    pass
                await _save_ticket_category(str(c.id))
                return c
        overwrites = {
            guild.default_role: discord.PermissionOverwrite(view_channel=False),
        }
        try:
            overwrites[guild.me] = discord.PermissionOverwrite(
                view_channel=True, send_messages=True, manage_channels=True,
                manage_messages=True)
        except Exception:
            pass
        cat = await guild.create_category("Tickets", overwrites=overwrites,
                                          reason="DJ Scratch ticket channels")
        await _save_ticket_category(str(cat.id))
        return cat
    except Exception:
        return None


async def _save_ticket_category(cat_id: str):
    try:
        pool = dbmod.db_pool
        if not pool:
            return
        async with pool.acquire() as conn:
            await conn.execute(
                "CREATE TABLE IF NOT EXISTS global_settings (key VARCHAR(255) PRIMARY KEY, value TEXT)")
            await conn.execute(
                "INSERT INTO global_settings (key, value) VALUES ('ticket_category_id', $1) "
                "ON CONFLICT (key) DO UPDATE SET value = $1", str(cat_id))
    except Exception:
        pass


def _service_key() -> str:
    return (os.getenv("SERVICE_KEY") or "").strip()


def _is_staff(member: discord.Member | discord.User, channel=None) -> bool:
    try:
        if int(member.id) == int(OWNER_ID):
            return True
    except Exception:
        pass
    try:
        if channel is not None:
            return bool(channel.permissions_for(member).administrator)
    except Exception:
        pass
    return False


TICKET_SCHEMA_VERSION = "1"


async def _ensure_tables():
    # Version-gated like boot DDL: these statements take locks, and support
    # tables are hot (polls every few seconds), so never run them every boot.
    try:
        pool = dbmod.db_pool
        if not pool:
            return
        try:
            async with pool.acquire() as conn:
                v = await conn.fetchval(
                    "SELECT value FROM global_settings WHERE key = 'schema_tickets_v'",
                    timeout=15)
                if v == TICKET_SCHEMA_VERSION:
                    return
        except Exception:
            pass
        async with pool.acquire() as conn:
            await conn.execute(
                """CREATE TABLE IF NOT EXISTS discord_tickets (
                    thread_id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    kind TEXT NOT NULL DEFAULT 'discord',
                    web_thread_id TEXT,
                    status TEXT NOT NULL DEFAULT 'open',
                    reason TEXT,
                    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
                )""", timeout=20)
            try:
                await conn.execute(
                    "ALTER TABLE support_threads ADD COLUMN IF NOT EXISTS discord_thread_id TEXT",
                    timeout=20)
            except Exception:
                pass
            try:
                await conn.execute(
                    "ALTER TABLE support_threads ADD COLUMN IF NOT EXISTS close_reason TEXT",
                    timeout=20)
            except Exception:
                pass
            try:
                await conn.execute(
                    "ALTER TABLE support_messages ADD COLUMN IF NOT EXISTS "
                    "discord_forwarded BOOLEAN NOT NULL DEFAULT FALSE", timeout=20)
            except Exception:
                pass
            try:
                await conn.execute(
                    "INSERT INTO global_settings (key, value) VALUES ('schema_tickets_v', $1) "
                    "ON CONFLICT (key) DO UPDATE SET value = $1",
                    TICKET_SCHEMA_VERSION, timeout=20)
            except Exception:
                pass
    except Exception:
        pass


async def _web_thread_for_discord(thread_id: str):
    """Open web thread linked to a Discord thread (pure-web threads have no tracker row)."""
    try:
        pool = dbmod.db_pool
        if not pool:
            return None
        async with pool.acquire() as conn:
            return await conn.fetchrow(
                "SELECT id, name, status FROM support_threads WHERE discord_thread_id = $1",
                str(thread_id))
    except Exception:
        return None


async def _new_web_thread(name: str) -> str | None:
    try:
        pool = dbmod.db_pool
        if not pool:
            return None
        tid = secrets.token_hex(8)
        secret = secrets.token_hex(16)
        async with pool.acquire() as conn:
            await conn.execute(
                "INSERT INTO support_threads (id, secret, name, email, last_visitor_seen) "
                "VALUES ($1, $2, $3, '', CURRENT_TIMESTAMP)",
                tid, secret, (name or "Discord user")[:120])
        return tid
    except Exception:
        return None


async def _insert_visitor(web_thread_id: str, body: str):
    try:
        pool = dbmod.db_pool
        if not pool:
            return
        async with pool.acquire() as conn:
            await conn.execute(
                "INSERT INTO support_messages (thread_id, sender, body) VALUES ($1, 'visitor', $2)",
                str(web_thread_id), (body or "")[:3000])
            await conn.execute(
                "UPDATE support_threads SET updated_at = CURRENT_TIMESTAMP WHERE id = $1",
                str(web_thread_id))
    except Exception:
        pass


async def _ticket_row(thread_id: str):
    try:
        pool = dbmod.db_pool
        if not pool:
            return None
        async with pool.acquire() as conn:
            return await conn.fetchrow(
                "SELECT thread_id, user_id, kind, web_thread_id, status, reason "
                "FROM discord_tickets WHERE thread_id = $1", str(thread_id))
    except Exception:
        return None


async def _web_api(action: str, payload: dict):
    """POST to the website support API as the bot service. Returns (ok, data)."""
    key = _service_key()
    if not key:
        return False, {"error": "SERVICE_KEY is not set on the bot host."}
    try:
        import aiohttp
        async with aiohttp.ClientSession() as session:
            async with session.post(
                f"{APP_BASE}/api/support-chat",
                json={"action": action, **payload},
                headers={"x-service-key": key},
                timeout=15,
            ) as resp:
                try:
                    data = await resp.json()
                except Exception:
                    data = {}
                return resp.status < 300 and bool(data.get("success", resp.status < 300)), data
    except Exception as e:
        return False, {"error": str(e)}


class TicketCloseModal(discord.ui.Modal, title="Close Ticket"):
    reason_input = discord.ui.TextInput(
        label="Reason (shown to the user)",
        style=discord.TextStyle.paragraph,
        placeholder="Why is this ticket being closed?",
        required=True,
        max_length=500,
    )

    async def on_submit(self, interaction: discord.Interaction):
        ch = interaction.channel
        if ch is None or (not isinstance(ch, discord.Thread)
                          and not isinstance(ch, discord.TextChannel)):
            return await interaction.response.send_message(
                "Use this inside a ticket.", ephemeral=True)
        if not _is_staff(interaction.user, ch):
            return await interaction.response.send_message(
                "Only support staff can close tickets.", ephemeral=True)
        reason = str(self.reason_input.value or "").strip()
        if not reason:
            return await interaction.response.send_message(
                "Give a reason so the user knows why.", ephemeral=True)
        await interaction.response.defer(ephemeral=True)
        row = await _ticket_row(str(ch.id))
        web_thread = (row["web_thread_id"] if row and row["web_thread_id"] else None)
        ticket_user_id = str(row["user_id"]) if row and row["user_id"] else None
        if web_thread:
            ok, data = await _web_api("close", {"threadId": web_thread, "reason": reason})
            if not ok:
                return await interaction.followup.send(
                    f"⚠️ Web close failed: {data.get('error') or 'the website timed out'}. "
                    "Is SERVICE_KEY set on Vercel and the bot host?", ephemeral=True)
        try:
            pool = dbmod.db_pool
            if pool:
                async with pool.acquire() as conn:
                    await conn.execute(
                        "UPDATE discord_tickets SET status = 'closed', reason = $2 WHERE thread_id = $1",
                        str(ch.id), reason)
        except Exception:
            pass
        closer = getattr(interaction.user, "display_name", "Staff")
        if isinstance(ch, discord.Thread):
            # Legacy thread ticket: post the reason and archive.
            try:
                embed = discord.Embed(
                    title="🔒 Ticket closed",
                    description=f"**Reason:** {reason}",
                    color=0x808080,
                )
                await ch.send(embed=embed)
            except Exception:
                pass
            try:
                await ch.edit(archived=True, reason=f"Closed: {reason[:100]}")
            except Exception:
                pass
        else:
            # Channel ticket: log the summary in the tickets channel, then delete.
            try:
                panel = ch.guild.get_channel(TICKETS_CHANNEL_ID) if ch.guild else None
                if panel is None and ch.guild:
                    try:
                        panel = await ch.guild.fetch_channel(TICKETS_CHANNEL_ID)
                    except Exception:
                        panel = None
                if panel is not None and isinstance(panel, discord.TextChannel):
                    who = f"<@{ticket_user_id}>" if ticket_user_id else "unknown user"
                    summary = discord.Embed(
                        title="🔒 Ticket closed",
                        description=f"**User:** {who}\n**Closed by:** {closer}\n**Reason:** {reason}",
                        color=0x808080,
                    )
                    await panel.send(embed=summary)
            except Exception:
                pass
            try:
                await ch.delete(reason=f"Ticket closed by {closer}: {reason[:100]}")
            except Exception:
                pass
        await interaction.followup.send("Ticket closed.", ephemeral=True)


class TicketControlsView(discord.ui.View):
    def __init__(self):
        super().__init__(timeout=None)

    @discord.ui.button(label="Close with reason", emoji="🔒",
                       style=discord.ButtonStyle.danger, custom_id="ticket_close")
    async def close_btn(self, interaction: discord.Interaction, _b: discord.ui.Button):
        await interaction.response.send_modal(TicketCloseModal())


class TicketPanelView(discord.ui.View):
    def __init__(self):
        super().__init__(timeout=None)

    @discord.ui.button(label="Get Support", emoji="🎫",
                       style=discord.ButtonStyle.primary, custom_id="ticket_open")
    async def open_btn(self, interaction: discord.Interaction, _b: discord.ui.Button):
        if not interaction.guild or interaction.guild.id != SUPPORT_GUILD_ID:
            return await interaction.response.send_message(
                "Use this button in the support server.", ephemeral=True)
        user = interaction.user
        await interaction.response.defer(ephemeral=True)
        try:
            pool = dbmod.db_pool
            if pool:
                async with pool.acquire() as conn:
                    existing = await conn.fetchrow(
                        "SELECT thread_id FROM discord_tickets "
                        "WHERE user_id = $1 AND kind = 'discord' AND status = 'open' "
                        "ORDER BY created_at DESC LIMIT 1", str(user.id))
                    if existing:
                        tid = str(existing["thread_id"])
                        ch = None
                        try:
                            ch = interaction.guild.get_channel(int(tid))
                            if ch is None:
                                ch = await interaction.guild.fetch_channel(int(tid))
                        except Exception:
                            ch = None
                        if ch is None:
                            # Stale row (thread deleted) — drop it and open fresh.
                            try:
                                await conn.execute(
                                    "UPDATE discord_tickets SET status = 'closed', "
                                    "reason = 'thread gone' WHERE thread_id = $1", tid)
                            except Exception:
                                pass
                        else:
                            try:
                                if isinstance(ch, discord.Thread):
                                    await ch.add_user(user)
                            except Exception:
                                pass
                            jump = f"https://discord.com/channels/{interaction.guild.id}/{tid}"
                            return await interaction.followup.send(
                                f"You already have an open ticket: {ch.mention}\n{jump}",
                                ephemeral=True)
        except Exception:
            pass
        channel = interaction.guild.get_channel(TICKETS_CHANNEL_ID)
        if channel is None:
            try:
                channel = await interaction.guild.fetch_channel(TICKETS_CHANNEL_ID)
            except Exception:
                channel = None
        if channel is None:
            return await interaction.followup.send(
                "Tickets channel not found. Tell the bot owner.", ephemeral=True)
        category = await _ticket_category(interaction.guild)
        overwrites = {
            interaction.guild.default_role: discord.PermissionOverwrite(view_channel=False),
            user: discord.PermissionOverwrite(view_channel=True, send_messages=True,
                                              read_message_history=True, attach_files=True,
                                              embed_links=True),
        }
        try:
            overwrites[interaction.guild.me] = discord.PermissionOverwrite(
                view_channel=True, send_messages=True, manage_channels=True,
                manage_messages=True, embed_links=True)
        except Exception:
            pass
        ticket_ch = None
        try:
            ticket_ch = await interaction.guild.create_text_channel(
                _slug(user.display_name, "ticket", f"ticket-{user.id}"),
                category=category,
                overwrites=overwrites,
                reason=f"Support ticket for {user.id}",
            )
        except Exception as e:
            return await interaction.followup.send(
                f"Couldn't open a ticket: {e}", ephemeral=True)
        try:
            pool = dbmod.db_pool
            if pool:
                async with pool.acquire() as conn:
                    await conn.execute(
                        "INSERT INTO discord_tickets (thread_id, user_id, kind, status) "
                        "VALUES ($1, $2, 'discord', 'open') "
                        "ON CONFLICT (thread_id) DO UPDATE SET status = 'open', reason = NULL",
                        str(ticket_ch.id), str(user.id))
        except Exception:
            pass
        try:
            embed = discord.Embed(
                title=f"🎫 Ticket — {user.display_name}",
                description="Support will be with you shortly.\nType your issue below.",
                color=0x5865F2,
            )
            await ticket_ch.send(content=user.mention, embed=embed, view=TicketControlsView())
        except Exception:
            pass
        await interaction.followup.send(f"Ticket opened: {ticket_ch.mention}", ephemeral=True)


class TicketsCog(commands.Cog):
    def __init__(self, bot):
        self.bot = bot

    async def cog_load(self):
        await _ensure_tables()
        await self._backfill_native()
        if not self._forward_loop.is_running():
            self._forward_loop.start()

    async def cog_unload(self):
        try:
            if self._forward_loop.is_running():
                self._forward_loop.cancel()
        except Exception:
            pass

    async def _backfill_native(self):
        """Link pre-existing native tickets to web threads (and import their history)."""
        try:
            pool = dbmod.db_pool
            if not pool:
                return
            async with pool.acquire() as conn:
                rows = await conn.fetch(
                    "SELECT thread_id, user_id FROM discord_tickets "
                    "WHERE kind = 'discord' AND status = 'open' AND web_thread_id IS NULL")
            for r in rows:
                try:
                    tid = str(r["thread_id"])
                    user = self.bot.get_user(int(r["user_id"]))
                    if user is None:
                        try:
                            user = await self.bot.fetch_user(int(r["user_id"]))
                        except Exception:
                            user = None
                    name = (getattr(user, "display_name", None)
                            or getattr(user, "name", None) or "Discord user")
                    web_id = await _new_web_thread(name)
                    if not web_id:
                        continue
                    try:
                        pool = dbmod.db_pool
                        if pool:
                            async with pool.acquire() as conn:
                                await conn.execute(
                                    "UPDATE discord_tickets SET web_thread_id = $2 WHERE thread_id = $1",
                                    tid, web_id)
                                await conn.execute(
                                    "UPDATE support_threads SET discord_thread_id = $2 WHERE id = $1",
                                    web_id, tid)
                    except Exception:
                        pass
                    # Import recent thread history as visitor messages.
                    try:
                        ch = self.bot.get_channel(int(tid))
                        if ch is None:
                            ch = await self.bot.fetch_channel(int(tid))
                        if ch is not None:
                            async for m in ch.history(limit=50, oldest_first=True):
                                try:
                                    if m.author.bot or not (m.content or "").strip():
                                        continue
                                    await _insert_visitor(web_id, m.content)
                                except Exception:
                                    continue
                    except Exception:
                        pass
                except Exception:
                    continue
        except Exception:
            pass

    @tasks.loop(seconds=15)
    async def _forward_loop(self):
        """Post owner inbox replies into linked Discord threads."""
        try:
            if not self.bot.is_ready():
                return
            pool = dbmod.db_pool
            if not pool:
                return
            async with pool.acquire() as conn:
                rows = await conn.fetch(
                    """SELECT m.id, m.body, t.discord_thread_id FROM support_messages m
                       JOIN support_threads t ON t.id = m.thread_id
                       WHERE m.sender = 'owner'
                       AND COALESCE(m.discord_forwarded, FALSE) = FALSE
                       AND t.discord_thread_id IS NOT NULL
                       ORDER BY m.id ASC LIMIT 20""")
            for r in rows:
                try:
                    ch = self.bot.get_channel(int(r["discord_thread_id"]))
                    if ch is None:
                        try:
                            ch = await self.bot.fetch_channel(int(r["discord_thread_id"]))
                        except Exception:
                            ch = None
                    if ch is not None:
                        try:
                            embed = discord.Embed(
                                description=str(r["body"] or "")[:4000],
                                color=0x5865F2,
                            )
                            embed.set_author(name="Support")
                            await ch.send(embed=embed)
                        except Exception:
                            pass
                except Exception:
                    pass
                finally:
                    try:
                        pool = dbmod.db_pool
                        if pool:
                            async with pool.acquire() as conn:
                                await conn.execute(
                                    "UPDATE support_messages SET discord_forwarded = TRUE WHERE id = $1",
                                    r["id"])
                    except Exception:
                        pass
        except Exception:
            pass

    def _panel_embed(self) -> discord.Embed:
        return discord.Embed(
            title="DJ Support",
            description="Click the button to get support with DJ Scratch",
            color=0x5865F2,
        )

    @commands.command(name="ticketpanel", aliases=["tpanel"])
    @commands.is_owner()
    async def ticket_panel_prefix(self, ctx):
        if ctx.guild is None or ctx.guild.id != SUPPORT_GUILD_ID:
            return await ctx.send("Run this in the support server.")
        await ctx.send(embed=self._panel_embed(), view=TicketPanelView())
        try:
            await ctx.message.delete()
        except Exception:
            pass

    @app_commands.command(name="ticketpanel", description="Post the support ticket panel (Owner only)")
    @app_commands.allowed_installs(guilds=True, users=False)
    @app_commands.allowed_contexts(guilds=True, dms=False, private_channels=False)
    async def ticket_panel_slash(self, interaction: discord.Interaction):
        if interaction.guild is None or interaction.guild.id != SUPPORT_GUILD_ID:
            return await interaction.response.send_message(
                "Run this in the support server.", ephemeral=True)
        try:
            if int(interaction.user.id) != int(OWNER_ID):
                return await interaction.response.send_message(
                    "Owner only.", ephemeral=True)
        except Exception:
            return await interaction.response.send_message(
                "Owner only.", ephemeral=True)
        channel = interaction.guild.get_channel(TICKETS_CHANNEL_ID)
        if channel is None:
            try:
                channel = await interaction.guild.fetch_channel(TICKETS_CHANNEL_ID)
            except Exception:
                channel = None
        if channel is None or not isinstance(channel, discord.TextChannel):
            return await interaction.response.send_message(
                "Tickets channel not found.", ephemeral=True)
        await channel.send(embed=self._panel_embed(), view=TicketPanelView())
        await interaction.response.send_message(
            f"Panel posted in {channel.mention}.", ephemeral=True)

    @commands.Cog.listener()
    async def on_message(self, message: discord.Message):
        try:
            if message.author.bot or not message.guild:
                return
            if message.guild.id != SUPPORT_GUILD_ID:
                return
            ch = message.channel
            if not message.content or not message.content.strip():
                return
            staff = _is_staff(message.author, ch)
            row = await _ticket_row(str(ch.id))
            web_id = None
            ticket_user = None
            if row and (row["status"] or "open") == "open":
                # Tracked ticket: works for channels and legacy threads.
                ticket_user = str(row["user_id"] or "") or None
                if row["web_thread_id"]:
                    web_id = str(row["web_thread_id"])
                elif (row["kind"] or "discord") == "discord":
                    # Native ticket without a web link yet — create one.
                    try:
                        u = message.author if str(message.author.id) == ticket_user else None
                        nm = (getattr(u or message.author, "display_name", None)
                              or getattr(message.author, "name", None) or "Discord user")
                    except Exception:
                        nm = "Discord user"
                    web_id = await _new_web_thread(nm)
                    if web_id:
                        try:
                            pool = dbmod.db_pool
                            if pool:
                                async with pool.acquire() as conn:
                                    await conn.execute(
                                        "UPDATE discord_tickets SET web_thread_id = $2 WHERE thread_id = $1",
                                        str(ch.id), web_id)
                                    await conn.execute(
                                        "UPDATE support_threads SET discord_thread_id = $2 WHERE id = $1",
                                        web_id, str(ch.id))
                        except Exception:
                            pass
            if not web_id:
                # Pure-web thread (created via REST, no tracker row).
                wrow = await _web_thread_for_discord(str(ch.id))
                if wrow and (wrow["status"] or "open") == "open":
                    web_id = str(wrow["id"])
            if not web_id:
                return
            if ticket_user and str(message.author.id) == ticket_user:
                # Ticket owner talking in their own ticket → visitor message
                # (even if they're staff testing — their replies to others
                # go in threads they didn't open).
                await _insert_visitor(web_id, message.content)
                return
            if staff:
                # Staff reply → deliver to the visitor (web chat + email).
                ok, data = await _web_api("reply", {
                    "threadId": web_id,
                    "body": message.content.strip()[:3000],
                })
                if ok:
                    try:
                        await message.add_reaction("✅")
                    except Exception:
                        pass
                else:
                    try:
                        await ch.send(
                            f"⚠️ Couldn't deliver that to the web chat: "
                            f"{data.get('error') or 'the website timed out'}",
                            delete_after=60,
                        )
                    except Exception:
                        pass
        except Exception:
            pass


async def setup(bot):
    await _ensure_tables()
    await bot.add_cog(TicketsCog(bot))
