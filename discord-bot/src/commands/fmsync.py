import discord
from discord.ext import commands, tasks
from src.core.config import OWNER_ID
import src.core.database as dbmod
from src.core import fm_sync


def _is_owner(uid) -> bool:
    try:
        return int(uid) == int(OWNER_ID)
    except Exception:
        return False


class SyncCog(commands.Cog):
    def __init__(self, bot):
        self.bot = bot
        self._running = False

    async def cog_load(self):
        await fm_sync.ensure_sync_tables()
        if not self._tick.is_running():
            self._tick.start()

    async def cog_unload(self):
        try:
            if self._tick.is_running():
                self._tick.cancel()
        except Exception:
            pass

    @tasks.loop(minutes=10)
    async def _tick(self):
        if self._running:
            return
        self._running = True
        try:
            await self.bot.wait_until_ready()
            pool = dbmod.db_pool
            if not pool:
                return
            # 1) Oldest incomplete backfill first.
            async with pool.acquire() as conn:
                row = await conn.fetchrow(
                    "SELECT user_id, lastfm_username FROM fm_sync_state "
                    "WHERE COALESCE(backfill_done, FALSE) = FALSE "
                    "ORDER BY updated_at ASC NULLS FIRST LIMIT 1")
            if row and row["lastfm_username"]:
                await fm_sync.sync_user_backfill(str(row["user_id"]), row["lastfm_username"])
                await fm_sync.sync_user_incremental(str(row["user_id"]), row["lastfm_username"])
                return
            # 2) Otherwise incremental for recently active linked users.
            async with pool.acquire() as conn:
                rows = await conn.fetch(
                    """SELECT u.user_id, u.lastfm_username FROM user_settings u
                       LEFT JOIN fm_sync_state s ON s.user_id = u.user_id
                       WHERE u.lastfm_username IS NOT NULL AND u.lastfm_username != ''
                       AND (u.last_active IS NULL OR u.last_active > CURRENT_TIMESTAMP - INTERVAL '1 day')
                       ORDER BY s.updated_at ASC NULLS FIRST LIMIT 3""")
            for r in rows:
                try:
                    await fm_sync.sync_user_incremental(str(r["user_id"]), r["lastfm_username"])
                except Exception:
                    continue
        except Exception:
            pass
        finally:
            self._running = False

    @_tick.before_loop
    async def _before_tick(self):
        try:
            await self.bot.wait_until_ready()
        except Exception:
            pass

    @_tick.before_loop
    async def _before_tick(self):
        try:
            await self.bot.wait_until_ready()
        except Exception:
            pass

    @commands.command(name="syncnow", aliases=["sync", "fmbackfill"])
    async def syncnow_prefix(self, ctx, target: discord.Member = None):
        """Sync your Last.fm history (exact playcounts). Owner can sync others."""
        me = str(ctx.author.id)
        uid, lname = me, None
        if target is not None:
            if not _is_owner(ctx.author.id):
                return await ctx.send("Only the bot owner can sync other users.")
            uid = str(target.id)
        try:
            pool = dbmod.db_pool
            if pool:
                async with pool.acquire() as conn:
                    r = await conn.fetchrow(
                        "SELECT lastfm_username FROM user_settings WHERE user_id = $1", uid)
                    lname = (r["lastfm_username"] if r else None) or None
            if not lname:
                if target is None:
                    return await ctx.send("Link Last.fm first with `/login`.")
                return await ctx.send("That user has no linked Last.fm account.")
            msg = await ctx.send("⏳ Syncing Last.fm history (backfill runs in the background)…")
            back = await fm_sync.sync_user_backfill(uid, lname)
            inc = await fm_sync.sync_user_incremental(uid, lname)
            st = await fm_sync.sync_status(uid)
            done = "✅ backfill complete" if (st or {}).get("backfill_done") else "⏳ backfill continuing in background"
            await msg.edit(content=f"Synced **{lname}**: +{back['inserted'] + inc['inserted']} new, "
                           f"{back['dupes'] + inc['dupes']} dupes skipped. {done}.")
        except Exception as e:
            await ctx.send(f"Sync failed: {e}")

    @commands.command(name="syncstatus", aliases=["syncstat"])
    async def syncstatus_prefix(self, ctx, target: discord.Member = None):
        uid = str(ctx.author.id)
        if target is not None:
            if not _is_owner(ctx.author.id):
                return await ctx.send("Only the bot owner can check others.")
            uid = str(target.id)
        st = await fm_sync.sync_status(uid)
        if not st:
            return await ctx.send("No sync history yet — run `,syncnow` to start.")
        from datetime import datetime, timezone
        def _d(uts):
            try:
                return datetime.fromtimestamp(int(uts), tz=timezone.utc).strftime("%Y-%m-%d") if uts else "—"
            except Exception:
                return "—"
        await ctx.send(
            f"**Sync: {st['username']}**\n"
            f"Backfill: {'✅ done' if st['backfill_done'] else '⏳ in progress'}\n"
            f"Synced scrobbles: **{st['synced_scrobbles']:,}**\n"
            f"Range: {_d(st['oldest'])} → {_d(st['newest'])}")


async def setup(bot):
    await fm_sync.ensure_sync_tables()
    await bot.add_cog(SyncCog(bot))
