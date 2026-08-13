from src.core.config import Log
import discord
from discord.ext import commands
import aiohttp
import asyncpg
from .config import POSTGRES_URL, DATABASE_URL, Log

from src.core.database import format_name

class ScratchBot(commands.Bot):
    async def get_dynamic_prefix(self, bot, message):
        default_prefix = [',']
        if not message.guild: return default_prefix
        if not self.db_pool: return default_prefix
        try:
            async with self.db_pool.acquire() as conn:
                row = await conn.fetchrow("SELECT prefix FROM server_settings WHERE guild_id=$1", str(message.guild.id))
                if row and row['prefix']:
                    p = row['prefix']
                    if p != ',': return [p, ',']
        except Exception: pass
        return default_prefix

    def __init__(self):
        intents = discord.Intents.default()
        intents.message_content = True
        
        # Power/Memory Saving Tweaks:
        # 1. max_messages=None disables message caching
        # 2. chunk_guilds_at_startup=False stops the bot from downloading member lists
        # 3. member_cache_flags.none() stops the bot from keeping users in RAM unless active
        super().__init__(
            command_prefix=self.get_dynamic_prefix,  
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
                    await conn.execute('''
                        CREATE TABLE IF NOT EXISTS server_settings (
                            guild_id TEXT PRIMARY KEY,
                            prefix TEXT DEFAULT ','
                        )
                    ''')
                    try:
                        await conn.execute('''
                            CREATE TABLE IF NOT EXISTS command_permissions (
                                user_id TEXT,
                                command_name TEXT,
                                granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                                expires_at TIMESTAMP,
                                PRIMARY KEY (user_id, command_name)
                            )
                        ''')
                        await conn.execute("ALTER TABLE command_permissions ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP")
                    except Exception as e:
                        print(f"Error migrating command_permissions: {e}")
            except Exception as e:
                print(f"{Log.RED}>>> Failed to connect to DB: {e}{Log.RESET}")
        
        # Load extensions
        cogs = ['src.commands.admin', 'src.commands.lastfm', 'src.commands.importer', 'src.commands.games', 'src.commands.spotify_remote', 'src.commands.social', 'src.commands.status', 'src.commands.settings']
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

bot = ScratchBot()
