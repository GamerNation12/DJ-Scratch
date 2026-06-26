import discord
from datetime import datetime

from src.core.database import format_name


class Theme:
    # Colors
    PRIMARY = 0x0AB5CD  # The Goats DJ Cyan/Teal
    SUCCESS = 0x2ecc71
    ERROR = 0xe74c3c
    WARNING = 0xf1c40f
    LASTFM = 0xba0000

    # Formatting
    FOOTER_TEXT = "The Goats DJ | By GamerNation12"
    
    @classmethod
    def get_embed(cls, title=None, description=None, color=None, include_timestamp=True, **kwargs):
        """Creates a standardized embed with the bot's theme."""
        color = color if color is not None else cls.PRIMARY
        
        embed = discord.Embed(
            title=title,
            description=description,
            color=color,
            **kwargs
        )
        
        if include_timestamp:
            embed.timestamp = datetime.utcnow()
            
        embed.set_footer(text=cls.FOOTER_TEXT)
        return embed

    @classmethod
    def get_success_embed(cls, title="Success", description=None):
        return cls.get_embed(title=f"✅ {title}", description=description, color=cls.SUCCESS)

    @classmethod
    def get_error_embed(cls, title="Error", description=None):
        return cls.get_embed(title=f"❌ {title}", description=description, color=cls.ERROR)

    @classmethod
    def get_warning_embed(cls, title="Warning", description=None):
        return cls.get_embed(title=f"⚠️ {title}", description=description, color=cls.WARNING)
