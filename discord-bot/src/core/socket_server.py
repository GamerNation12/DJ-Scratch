import socketio
import os
from aiohttp import web
from src.core.config import Log

sio = socketio.AsyncServer(async_mode='aiohttp', cors_allowed_origins='*')
app = web.Application()
sio.attach(app)

user_sockets = {}

@sio.event
async def connect(sid, environ):
    pass

@sio.event
async def authenticate(sid, user_id):
    user_sockets[sid] = user_id

@sio.event
async def new_message(sid, msg_data):
    receiver_id = msg_data.get('receiver_id')
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
