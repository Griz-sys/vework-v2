"""Additive time tracking: each pause/end accumulates (now - started_at) into total_time_seconds."""
from datetime import datetime, timezone
from uuid import UUID
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.subtask import Subtask, SubtaskStatus, TimeLog, TimeAction
from app.models.user import User


async def _fetch(subtask_id: UUID, user: User, db: AsyncSession) -> Subtask:
    st = await db.scalar(select(Subtask).where(Subtask.id == subtask_id))
    if not st:
        raise HTTPException(404, "Subtask not found")
    return st


def _log(db: AsyncSession, subtask_id: UUID, user_id: UUID, action: TimeAction) -> None:
    db.add(TimeLog(subtask_id=subtask_id, user_id=user_id, action=action))


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _elapsed(started_at: datetime) -> int:
    return max(0, int((_now() - started_at.replace(tzinfo=timezone.utc)).total_seconds()))


async def start(subtask_id: UUID, user: User, db: AsyncSession) -> Subtask:
    st = await _fetch(subtask_id, user, db)
    if st.status != SubtaskStatus.not_started:
        raise HTTPException(400, f"Cannot start a task with status '{st.status}'")
    st.status = SubtaskStatus.in_progress
    st.started_at = _now()
    _log(db, subtask_id, user.id, TimeAction.start)
    await db.commit()
    await db.refresh(st)
    return st


async def pause(subtask_id: UUID, user: User, db: AsyncSession) -> Subtask:
    st = await _fetch(subtask_id, user, db)
    if st.status != SubtaskStatus.in_progress:
        raise HTTPException(400, "Task is not in progress")
    if st.started_at:
        st.total_time_seconds += _elapsed(st.started_at)
    st.status = SubtaskStatus.paused
    st.paused_at = _now()
    st.started_at = None
    _log(db, subtask_id, user.id, TimeAction.pause)
    await db.commit()
    await db.refresh(st)
    return st


async def resume(subtask_id: UUID, user: User, db: AsyncSession) -> Subtask:
    st = await _fetch(subtask_id, user, db)
    if st.status != SubtaskStatus.paused:
        raise HTTPException(400, "Task is not paused")
    st.status = SubtaskStatus.in_progress
    st.started_at = _now()
    st.paused_at = None
    _log(db, subtask_id, user.id, TimeAction.resume)
    await db.commit()
    await db.refresh(st)
    return st


async def end(subtask_id: UUID, user: User, db: AsyncSession) -> Subtask:
    st = await _fetch(subtask_id, user, db)
    if st.status not in (SubtaskStatus.in_progress, SubtaskStatus.paused):
        raise HTTPException(400, f"Cannot end a task with status '{st.status}'")
    if st.status == SubtaskStatus.in_progress and st.started_at:
        st.total_time_seconds += _elapsed(st.started_at)
    st.status = SubtaskStatus.done
    st.ended_at = _now()
    st.started_at = None
    _log(db, subtask_id, user.id, TimeAction.end)
    await db.commit()
    await db.refresh(st)
    return st
