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
    # Custom animated fire (mc_fire) used for streaks / top-track markers.
    FIRE = "<a:mc_fire:1551046550862569561>"
    
    # Support redirect appended to every error embed.
    SUPPORT_LINE = (
        "\n\n🆘 Still stuck? [Join the support server](https://discord.gg/MT6d7jh3rv) "
        "and click **🎫 Get Support** in the tickets channel."
    )

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
        
        if include_timestamp and 'timestamp' not in kwargs:
            embed.timestamp = discord.utils.utcnow()
            
        embed.set_footer(text=cls.FOOTER_TEXT)
        return embed

    @classmethod
    def guild_log_embed(cls, kind, server_name, *, members="Unknown", owner=None,
                        created_ts=None, joined_value="Unknown", guild_id=None,
                        icon_url=None, timestamp=None):
        """Join/leave log card: server name in the title, stats as fields."""
        title = f"📥 {server_name}" if kind == "join" else f"📤 {server_name}"
        kwargs = {}
        if timestamp is not None:
            kwargs["timestamp"] = timestamp
        embed = cls.get_embed(
            title=title,
            color=cls.SUCCESS if kind == "join" else cls.ERROR,
            **kwargs,
        )
        embed.add_field(name="👥 Members", value=members, inline=True)
        if kind == "join":
            embed.add_field(name="👑 Owner", value=owner or "Unknown", inline=True)
        embed.add_field(
            name="🏠 Server created",
            value=f"<t:{created_ts}:D>\n<t:{created_ts}:R>" if created_ts else "Unknown",
            inline=True,
        )
        embed.add_field(name="🤖 Bot joined", value=joined_value, inline=True)
        if guild_id is not None:
            embed.add_field(name="🆔 Server ID", value=f"`{guild_id}`", inline=True)
        if icon_url:
            embed.set_thumbnail(url=icon_url)
        return embed

    @classmethod
    def get_success_embed(cls, title="Success", description=None, user=None):
        return cls.get_embed(title=f"✅ {title}", description=description, color=cls.SUCCESS, user=user)

    @classmethod
    def get_error_embed(cls, title="Error", description=None, user=None):
        desc = description or ""
        if "discord.gg/MT6d7jh3rv" not in desc:
            desc = f"{desc}{cls.SUPPORT_LINE}" if desc else cls.SUPPORT_LINE.strip()
        return cls.get_embed(title=f"❌ {title}", description=desc, color=cls.ERROR, user=user)

    @classmethod
    def get_warning_embed(cls, title="Warning", description=None, user=None):
        return cls.get_embed(title=f"⚠️ {title}", description=description, color=cls.WARNING, user=user)

    @classmethod
    def get_premium_embed(cls, title="Premium Feature", description=None, user=None):
        return cls.get_embed(title=f"🔒 {title}", description=description, color=cls.PREMIUM, user=user)
