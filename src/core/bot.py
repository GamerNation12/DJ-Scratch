from src.core.config import Log
import discord
from discord.ext import commands
import aiohttp
import asyncpg
from .config import POSTGRES_URL, DATABASE_URL, Log

from src.core.database import format_name


class GoatsBot(commands.Bot):
    def __init__(self):
        intents = discord.Intents.default()
        intents.message_content = True
        
        # Power/Memory Saving Tweaks:
        # 1. max_messages=None disables message caching
        # 2. chunk_guilds_at_startup=False stops the bot from downloading member lists
        # 3. member_cache_flags.none() stops the bot from keeping users in RAM unless active
        super().__init__(
            command_prefix=',', 
            intents=intents,
            max_messages=None,
            chunk_guilds_at_startup=False,
            member_cache_flags=discord.MemberCacheFlags.none()
        )
        self.session = None
        self.db_pool = None

    async def setup_hook(self):
        self.session = aiohttp.ClientSession()
        db_conn_string = POSTGRES_URL or DATABASE_URL
        if db_conn_string:
            try:
                self.db_pool = await asyncpg.create_pool(db_conn_string)
                print(f"{Log.GREEN}>>> Connected to Postgres DB{Log.RESET}")
                async with self.db_pool.acquire() as conn:
                    await conn.execute('''
                        CREATE TABLE IF NOT EXISTS user_settings (
                            user_id TEXT PRIMARY KEY,
                            fm_mode TEXT,
                            show_features BOOLEAN DEFAULT FALSE,
                            data_source TEXT DEFAULT 'combined'
                        )
                    ''')
            except Exception as e:
                print(f"{Log.RED}>>> Failed to connect to DB: {e}{Log.RESET}")
        
        # Load extensions
        cogs = ['src.commands.admin', 'src.commands.lastfm', 'src.commands.importer', 'src.commands.games', 'src.commands.spotify_remote']
        for cog in cogs:
            try:
                await self.load_extension(cog)
                print(f"{Log.GREEN}>>> Loaded {cog}{Log.RESET}")
            except Exception as e:
                print(f"{Log.RED}>>> Failed to load {cog}: {e}{Log.RESET}")

    async def close(self):
        if self.session:
            await self.session.close()
        if self.db_pool:
            await self.db_pool.close()
        await super().close()

bot = GoatsBot()
