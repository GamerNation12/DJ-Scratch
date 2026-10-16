"""Outbound push notifications via Firebase Cloud Messaging.

Inert unless Firebase is configured: needs the service-account JSON in
FIREBASE_CREDENTIALS (raw JSON) or GOOGLE_APPLICATION_CREDENTIALS (path),
plus device tokens in push_subscriptions (see web /api/push/register).
"""
import asyncio

_fcm_app = None
_warned = False


def _warn_once(msg):
    global _warned
    if not _warned:
        _warned = True
        print(f"[push] {msg}")


def _init_app():
    global _fcm_app
    if _fcm_app is not None:
        return _fcm_app
    try:
        import json
        import os
        import firebase_admin
        from firebase_admin import credentials
        raw = os.getenv("FIREBASE_CREDENTIALS")
        path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
        if raw:
            cred = credentials.Certificate(json.loads(raw))
        elif path:
            cred = credentials.Certificate(path)
        else:
            # Zero-config fallback: firebase-service-account.json uploaded
            # next to the bot entrypoint (Pterodactyl file manager).
            for candidate in ("firebase-service-account.json", "/home/container/firebase-service-account.json"):
                try:
                    with open(candidate) as f:
                        cred = credentials.Certificate(json.load(f))
                    break
                except Exception:
                    continue
            else:
                return None
        _fcm_app = firebase_admin.initialize_app(cred)
        return _fcm_app
    except Exception as e:
        _warn_once(f"push disabled: {e}")
        return None


async def send_push(user_id, title: str, body: str, data: dict | None = None) -> bool:
    """Push to all of a user's devices. True if at least one was accepted."""
    try:
        from src.core.database import db_pool
        if not db_pool:
            return False
        async with db_pool.acquire() as conn:
            rows = await conn.fetch(
                "SELECT fcm_token FROM push_subscriptions WHERE user_id = $1", str(user_id))
        tokens = [r["fcm_token"] for r in rows if r["fcm_token"]]
        if not tokens:
            return False
        app = await asyncio.to_thread(_init_app)
        if app is None:
            return False
        from firebase_admin import messaging
        clean = {str(k): str(v) for k, v in (data or {}).items()}
        try:
            resp = await asyncio.to_thread(
                messaging.send_each_for_multicast,
                messaging.MulticastMessage(
                    notification=messaging.Notification(title=title, body=body),
                    data=clean,
                    tokens=tokens,
                ),
            )
        except AttributeError:
            # Older firebase-admin: one-by-one fallback.
            ok = False
            for t in tokens:
                try:
                    await asyncio.to_thread(
                        messaging.send,
                        messaging.Message(
                            notification=messaging.Notification(title=title, body=body),
                            data=clean,
                            token=t,
                        ),
                    )
                    ok = True
                except Exception:
                    continue
            return ok
        # Prune dead tokens so the table doesn't rot.
        try:
            dead = []
            for t, r in zip(tokens, resp.responses):
                if not r.success and r.exception is not None:
                    name = type(r.exception).__name__
                    if "nregistered" in name or "nvalid" in name:
                        dead.append(t)
            if dead:
                async with db_pool.acquire() as conn:
                    await conn.execute(
                        "DELETE FROM push_subscriptions WHERE fcm_token = ANY($1)", dead)
        except Exception:
            pass
        return resp.success_count > 0
    except Exception:
        return False
