import discord

def create_simple_layout(description: str, color: discord.Color = discord.Color.default(), title: str = None, thumbnail_url: str = None) -> discord.ui.LayoutView:
    """Creates a basic LayoutView container with text and an accent color."""
    view = discord.ui.LayoutView()
    
    components = []
    if title:
        components.append(discord.ui.TextDisplay(title))
    
    components.append(discord.ui.TextDisplay(description))
    
    accessory = discord.ui.Thumbnail(thumbnail_url) if thumbnail_url else discord.ui.Thumbnail("https://upload.wikimedia.org/wikipedia/commons/c/ce/Transparent.gif")
    
    section = discord.ui.Section(*components, accessory=accessory)
        
    container = discord.ui.Container(section, accent_color=color)
    view.add_item(container)
    
    return view

def create_error_layout(error_message: str, thumbnail_url: str = None) -> discord.ui.LayoutView:
    """Creates a red-accented LayoutView for errors."""
    return create_simple_layout(error_message, color=discord.Color.red(), thumbnail_url=thumbnail_url)

def create_success_layout(success_message: str, thumbnail_url: str = None) -> discord.ui.LayoutView:
    """Creates a green-accented LayoutView for success messages."""
    return create_simple_layout(success_message, color=discord.Color.green(), thumbnail_url=thumbnail_url)

def create_info_layout(info_message: str, thumbnail_url: str = None) -> discord.ui.LayoutView:
    """Creates a blue-accented LayoutView for info messages."""
    return create_simple_layout(info_message, color=discord.Color.blue(), thumbnail_url=thumbnail_url)
