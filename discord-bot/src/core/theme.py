import discord
from datetime import datetime


class Theme:
    # Colors
    PRIMARY = 0x0AB5CD  # DJ Scratch Cyan/Teal
    SUCCESS = 0x2ecc71
    ERROR = 0xe74c3c
    WARNING = 0xf1c40f
    LASTFM = 0xba0000
    PREMIUM = 0xFFD700  # Premium Gold

    # Formatting
    FOOTER_TEXT = "DJ Scratch • Seamless Music Experience"
    
    @classmethod
    def get_embed(cls, title=None, description=None, color=None, user=None, include_timestamp=True, **kwargs):
        """Creates a standardized embed with the bot's theme."""
        if color is None:
            color = user.color if user and hasattr(user, 'color') and user.color.value != 0 else cls.PRIMARY
            
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
    def get_success_embed(cls, title="Success", description=None, user=None):
        return cls.get_embed(title=f"✅ {title}", description=description, color=cls.SUCCESS, user=user)

    @classmethod
    def get_error_embed(cls, title="Error", description=None, user=None):
        return cls.get_embed(title=f"❌ {title}", description=description, color=cls.ERROR, user=user)

    @classmethod
    def get_warning_embed(cls, title="Warning", description=None, user=None):
        return cls.get_embed(title=f"⚠️ {title}", description=description, color=cls.WARNING, user=user)

    @classmethod
    def get_premium_embed(cls, title="Premium Feature", description=None, user=None):
        return cls.get_embed(title=f"🔒 {title}", description=description, color=cls.PREMIUM, user=user)
