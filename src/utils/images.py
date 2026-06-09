from PIL import Image, ImageDraw, ImageFont
import io
import os
import textwrap

FONT_PATH = os.path.join(os.path.dirname(__file__), "Inconsolata.ttf")

def generate_receipt_image(username, period_str, tracks):
    """Generates a shopping receipt image for top tracks."""
    width = 400
    base_height = 300
    item_height = 45
    height = base_height + (len(tracks) * item_height)
    
    # Off-white receipt color
    img = Image.new('RGB', (width, height), color=(245, 245, 240))
    draw = ImageDraw.Draw(img)
    
    try:
        font_title = ImageFont.truetype(FONT_PATH, 32)
        font_header = ImageFont.truetype(FONT_PATH, 16)
        font_item = ImageFont.truetype(FONT_PATH, 16)
        font_artist = ImageFont.truetype(FONT_PATH, 14)
    except:
        font_title = font_header = font_item = font_artist = ImageFont.load_default()
        
    # Draw Header
    draw.text((width/2, 40), "THE GOATS DJ", fill=(0,0,0), font=font_title, anchor="mm")
    draw.text((width/2, 80), "RECEIPT OF SCROBBLES", fill=(0,0,0), font=font_header, anchor="mm")
    draw.text((width/2, 100), "-" * 38, fill=(0,0,0), font=font_header, anchor="mm")
    
    # Draw Customer Info
    draw.text((20, 130), f"CUSTOMER: {username.upper()}", fill=(0,0,0), font=font_header)
    draw.text((20, 150), f"PERIOD:   {period_str.upper()}", fill=(0,0,0), font=font_header)
    
    draw.text((width/2, 180), "-" * 38, fill=(0,0,0), font=font_header, anchor="mm")
    
    # Draw Tracks
    y = 210
    total_plays = 0
    for i, (track, artist, plays) in enumerate(tracks):
        # Format strings
        track_disp = track[:26] + ("..." if len(track) > 26 else "")
        artist_disp = artist[:28] + ("..." if len(artist) > 28 else "")
        
        # Track number and name
        draw.text((20, y), f"{i+1:02d} {track_disp.upper()}", fill=(0,0,0), font=font_item)
        # Artist name (indented)
        draw.text((45, y + 20), f"{artist_disp.upper()}", fill=(100,100,100), font=font_artist)
        # Playcount (right aligned)
        draw.text((width - 20, y), f"{plays}", fill=(0,0,0), font=font_item, anchor="ra")
        
        y += item_height
        total_plays += plays
        
    # Draw Footer
    draw.text((width/2, y + 10), "-" * 38, fill=(0,0,0), font=font_header, anchor="mm")
    y += 30
    
    draw.text((20, y), "ITEM COUNT:", fill=(0,0,0), font=font_header)
    draw.text((width - 20, y), f"{len(tracks)}", fill=(0,0,0), font=font_header, anchor="ra")
    y += 25
    draw.text((20, y), "TOTAL PLAYS:", fill=(0,0,0), font=font_header)
    draw.text((width - 20, y), f"{total_plays}", fill=(0,0,0), font=font_header, anchor="ra")
    
    y += 50
    draw.text((width/2, y), "THANK YOU FOR SCROBBLING!", fill=(0,0,0), font=font_header, anchor="mm")
    draw.text((width/2, y + 25), "SEE YOU SOON", fill=(0,0,0), font=font_header, anchor="mm")
    
    buf = io.BytesIO()
    img.save(buf, format='PNG')
    buf.seek(0)
    return buf
