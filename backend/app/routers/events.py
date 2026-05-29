"""SSE streams backed by Redis pub/sub — gracefully disabled if Redis is unavailable."""
import asyncio, json
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from app.models.user import User
from app.deps import get_current_user
from app.config import settings

router = APIRouter(prefix="/events", tags=["events"])

REDIS_AVAILABLE = bool(settings.redis_url and settings.redis_url != "")


async def _sse_no_redis():
    """Fallback: keep connection alive with periodic pings, no real-time events."""
    yield f"data: {json.dumps({'type': 'connected', 'realtime': False})}\n\n"
    while True:
        await asyncio.sleep(30)
        yield f"data: {json.dumps({'type': 'ping'})}\n\n"


async def _sse(channel: str):
    try:
        import redis.asyncio as aioredis
        r = aioredis.from_url(settings.redis_url, decode_responses=True, socket_connect_timeout=3)
        ps = r.pubsub()
        await ps.subscribe(channel)
        try:
            yield f"data: {json.dumps({'type': 'connected', 'realtime': True})}\n\n"
            async for msg in ps.listen():
                if msg["type"] == "message":
                    yield f"data: {msg['data']}\n\n"
                await asyncio.sleep(0.005)
        finally:
            await ps.unsubscribe(channel)
            await ps.aclose()
            await r.aclose()
    except Exception:
        async for chunk in _sse_no_redis():
            yield chunk


@router.get("/team-updates")
async def team_updates(user: User = Depends(get_current_user)):
    stream = _sse("vework:team") if REDIS_AVAILABLE else _sse_no_redis()
    return StreamingResponse(stream,
                             media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@router.get("/my-tasks")
async def my_tasks(user: User = Depends(get_current_user)):
    stream = _sse(f"vework:user:{user.id}") if REDIS_AVAILABLE else _sse_no_redis()
    return StreamingResponse(stream,
                             media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})
