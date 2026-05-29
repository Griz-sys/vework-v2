"""SSE streams backed by Redis pub/sub for real-time team/task updates."""
import asyncio, json
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from app.models.user import User
from app.deps import get_current_user
from app.config import settings
import redis.asyncio as aioredis

router = APIRouter(prefix="/events", tags=["events"])


async def _sse(channel: str):
    r = aioredis.from_url(settings.redis_url, decode_responses=True)
    ps = r.pubsub()
    await ps.subscribe(channel)
    try:
        yield f"data: {json.dumps({'type': 'connected'})}\n\n"
        async for msg in ps.listen():
            if msg["type"] == "message":
                yield f"data: {msg['data']}\n\n"
            await asyncio.sleep(0.005)
    finally:
        await ps.unsubscribe(channel)
        await ps.aclose()
        await r.aclose()


@router.get("/team-updates")
async def team_updates(user: User = Depends(get_current_user)):
    return StreamingResponse(_sse("vework:team"),
                             media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@router.get("/my-tasks")
async def my_tasks(user: User = Depends(get_current_user)):
    return StreamingResponse(_sse(f"vework:user:{user.id}"),
                             media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})
