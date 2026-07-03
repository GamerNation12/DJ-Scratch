import socketio
import os
from aiohttp import web
from src.core.config import Log

import sys
import asyncio

sio = socketio.AsyncServer(async_mode='aiohttp', cors_allowed_origins='*')
app = web.Application()
sio.attach(app)

user_sockets = {}

async def handle_log_dm(request):
    try:
        data = await request.json()
        sender_id = data.get('sender_id')
        receiver_id = data.get('receiver_id')
        try:
            from src.core.events import bot
            sender = await bot.fetch_user(int(sender_id))
            receiver = await bot.fetch_user(int(receiver_id))
            print(f"\033[94m>>> [WEBSITE DM] {sender.name} sent a message to {receiver.name}\033[0m")
        except Exception as e:
            print(f"\033[94m>>> [WEBSITE DM] User {sender_id} sent a message to {receiver_id}\033[0m")
        return web.json_response({'status': 'ok'})
    except Exception as e:
        return web.json_response({'error': str(e)}, status=400)

async def handle_get_emojis(request):
    try:
        from src.core.events import bot
        emojis = []
        
        # Try to get emojis from the specific server first
        target_guild_id = 1360772594122358834
        guild = bot.get_guild(target_guild_id)
        
        source_emojis = guild.emojis if guild else bot.emojis
        
        for emoji in source_emojis:
            emojis.append({
                'id': str(emoji.id),
                'name': emoji.name,
                'url': str(emoji.url)
            })
            
        return web.json_response({'emojis': emojis})
    except Exception as e:
        return web.json_response({'error': str(e)}, status=500)

async def handle_run_web_command(request):
    try:
        data = await request.json()
        sender_id = data.get('sender_id')
        command = data.get('command', '').strip()
        
        from src.core.events import bot, process_fm, process_top_artists, process_top_tracks
        user = await bot.fetch_user(int(sender_id))
        
        if not user:
            return web.json_response({'error': 'User not found'}, status=400)
            
        result_text = "Command not recognized or supported on web."
        cmd = command.lower()
        
        if cmd.startswith(",fm") or cmd.startswith(",np"):
            res = await process_fm(None, user, mode="full")
            if isinstance(res, tuple) and len(res) == 2:
                r_dict, is_p = res
                if isinstance(r_dict, dict) and "embed" in r_dict:
                    e = r_dict["embed"]
                    title = e.author.name if e.author else "Now Playing"
                    desc = str(e.description).replace("\n\n", "\n")
                    result_text = f"**{title}**\n{desc}"
                elif isinstance(r_dict, dict) and "content" in r_dict:
                    result_text = r_dict['content']
        elif cmd.startswith(",ta"):
            embed, _, err = await bot.process_top_artists(user, 'all')
            if err:
                result_text = err
            elif embed:
                title = embed.author.name if embed.author else "Top Artists"
                desc = str(embed.description).replace("\n\n", "\n")
                result_text = f"**{title}**\n{desc}"
        elif cmd.startswith(",tt"):
            embed, _, err = await bot.process_top_tracks(user, 'all')
            if err:
                result_text = err
            elif embed:
                title = embed.author.name if embed.author else "Top Tracks"
                desc = str(embed.description).replace("\n\n", "\n")
                result_text = f"**{title}**\n{desc}"

        return web.json_response({'result': result_text})
        
    except Exception as e:
        return web.json_response({'error': str(e)}, status=500)

app.router.add_post('/log_dm', handle_log_dm)
app.router.add_get('/emojis', handle_get_emojis)
app.router.add_post('/run_web_command', handle_run_web_command)

class OutputInterceptor:
    def __init__(self, original_stream):
        self.original_stream = original_stream

    def write(self, message):
        self.original_stream.write(message)
        if message.strip():
            try:
                loop = asyncio.get_running_loop()
                if loop.is_running():
                    loop.create_task(sio.emit('terminal_log', {'log': message}, room='admins'))
            except RuntimeError:
                pass

    def flush(self):
        self.original_stream.flush()

sys.stdout = OutputInterceptor(sys.stdout)
sys.stderr = OutputInterceptor(sys.stderr)

@sio.event
async def connect(sid, environ):
    pass

@sio.event
async def admin_auth(sid, token):
    # Very basic auth logic could go here; for now, we trust the admin dashboard connection
    sio.enter_room(sid, 'admins')

@sio.event
async def authenticate(sid, user_id):
    user_sockets[sid] = user_id

@sio.event
async def new_message(sid, msg_data):
    receiver_id = msg_data.get('receiver_id')
    sender_id = msg_data.get('sender_id')
    
    # Log the DM to the console
    try:
        from src.core.events import bot
        sender = await bot.fetch_user(int(sender_id))
        receiver = await bot.fetch_user(int(receiver_id))
        print(f"\033[94m>>> [WEBSITE DM] {sender.name} sent a message to {receiver.name}\033[0m")
    except Exception as e:
        print(f"\033[94m>>> [WEBSITE DM] User {sender_id} sent a message to {receiver_id}\033[0m")

    # Broadcast message to the receiver's connected sockets
    for s_id, u_id in user_sockets.items():
        if u_id == receiver_id:
            await sio.emit('receive_message', msg_data, to=s_id)

@sio.event
async def disconnect(sid):
    user_sockets.pop(sid, None)

async def start_socket_server():
    port = int(os.getenv("SOCKET_PORT", 3001))
    try:
        runner = web.AppRunner(app)
        await runner.setup()
        site = web.TCPSite(runner, '0.0.0.0', port)
        await site.start()
        print(f"{Log.GREEN}>>> Python Socket.io server started on port {port}{Log.RESET}")
    except Exception as e:
        print(f"{Log.RED}>>> Failed to start Python Socket.io server: {e}{Log.RESET}")
