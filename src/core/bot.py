import discord
from discord.ext import commands
import aiohttp
import asyncpg
from .config import POSTGRES_URL, DATABASE_URL, Log

class GoatsBot(commands.Bot):
    def __init__(self):
        intents = discord.Intents.default()
        intents.message_content = True
        super().__init__(command_prefix=',', intents=intents)
        self.session = None
        self.db_pool = None

    async def setup_hook(self):
        self.session = aiohttp.ClientSession()
        db_conn_string = POSTGRES_URL or DATABASE_URL
        if db_conn_string:
            try:
                self.db_pool = await asyncpg.create_pool(db_conn_string)
                print(f"{Log.GREEN}>>> Connected to Neon PostgreSQL{Log.RESET}")
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
        cogs = ['src.commands.admin', 'src.commands.lastfm', 'src.commands.importer']
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
