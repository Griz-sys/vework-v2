from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from pydantic import BaseModel
from app.database import get_db
from app.models.user import User, UserRole
from app.models.epic import Epic, epic_assignees_table
from app.models.subtask import Subtask, SubtaskStatus
from app.models.comment import Comment
from app.models.document import Document
from app.deps import get_current_user
from app.services import time_tracker as tt

router = APIRouter(tags=["subtasks"])

_LOAD = [selectinload(Subtask.created_by)]


def _st_dict(st: Subtask, comment_count: int = 0, doc_count: int = 0) -> dict:
    return {
        "id": str(st.id), "epic_id": str(st.epic_id), "created_by_id": str(st.created_by_id),
        "title": st.title, "description": st.description, "status": st.status,
        "started_at": st.started_at.isoformat() if st.started_at else None,
        "paused_at": st.paused_at.isoformat() if st.paused_at else None,
        "ended_at": st.ended_at.isoformat() if st.ended_at else None,
        "total_time_seconds": st.total_time_seconds,
        "created_at": st.created_at.isoformat(), "updated_at": st.updated_at.isoformat(),
        "created_by": {"id": str(st.created_by.id), "name": st.created_by.name} if st.created_by else None,
        "comment_count": comment_count, "document_count": doc_count,
    }


async def _counts(db: AsyncSession, subtask_id: UUID) -> tuple[int, int]:
    c = await db.scalar(select(func.count()).where(Comment.subtask_id == subtask_id))
    d = await db.scalar(select(func.count()).where(Document.subtask_id == subtask_id))
    return c or 0, d or 0


class SubtaskCreate(BaseModel):
    title: str
    description: str = ""
    status: SubtaskStatus = SubtaskStatus.not_started
    total_time_seconds: int = 0


class SubtaskUpdate(BaseModel):
    title: str | None = None
    description: str | None = None


class CommentBody(BaseModel):
    body: str


@router.get("/epics/{epic_id}/subtasks")
async def list_subtasks(epic_id: UUID, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    if not await db.scalar(select(Epic).where(Epic.id == epic_id)):
        raise HTTPException(404, "Epic not found")
    if user.role == UserRole.employee:
        is_assignee = await db.scalar(
            select(epic_assignees_table.c.user_id).where(
                (epic_assignees_table.c.epic_id == epic_id) &
                (epic_assignees_table.c.user_id == user.id)
            )
        )
        if not is_assignee:
            raise HTTPException(403, "Access denied")
    q = select(Subtask).options(*_LOAD).where(Subtask.epic_id == epic_id)
    rows = (await db.execute(q)).scalars().all()
    result = []
    for st in rows:
        c, d = await _counts(db, st.id)
        result.append(_st_dict(st, c, d))
    return result


@router.post("/epics/{epic_id}/subtasks")
async def create_subtask(epic_id: UUID, body: SubtaskCreate, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    if not await db.scalar(select(Epic).where(Epic.id == epic_id)):
        raise HTTPException(404, "Epic not found")
    st = Subtask(**body.model_dump(), epic_id=epic_id, created_by_id=user.id)
    db.add(st)
    await db.commit()
    row = await db.scalar(select(Subtask).options(*_LOAD).where(Subtask.id == st.id))
    return _st_dict(row)


@router.get("/subtasks/{subtask_id}")
async def get_subtask(subtask_id: UUID, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    st = await db.scalar(select(Subtask).options(*_LOAD).where(Subtask.id == subtask_id))
    if not st:
        raise HTTPException(404, "Subtask not found")
    if user.role == UserRole.employee and st.created_by_id != user.id:
        raise HTTPException(403, "Access denied")
    c, d = await _counts(db, subtask_id)
    return _st_dict(st, c, d)


@router.patch("/subtasks/{subtask_id}")
async def update_subtask(subtask_id: UUID, body: SubtaskUpdate, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    st = await db.scalar(select(Subtask).where(Subtask.id == subtask_id))
    if not st:
        raise HTTPException(404, "Subtask not found")
    if user.role == UserRole.employee and st.created_by_id != user.id:
        raise HTTPException(403, "Access denied")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(st, k, v)
    await db.commit()
    row = await db.scalar(select(Subtask).options(*_LOAD).where(Subtask.id == subtask_id))
    c, d = await _counts(db, subtask_id)
    return _st_dict(row, c, d)


@router.delete("/subtasks/{subtask_id}")
async def delete_subtask(subtask_id: UUID, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    st = await db.scalar(select(Subtask).where(Subtask.id == subtask_id))
    if not st:
        raise HTTPException(404, "Subtask not found")
    if user.role == UserRole.employee and st.created_by_id != user.id:
        raise HTTPException(403, "Access denied")
    await db.delete(st)
    await db.commit()
    return {"detail": "deleted"}


async def _after_action(subtask_id: UUID, db: AsyncSession) -> dict:
    row = await db.scalar(select(Subtask).options(*_LOAD).where(Subtask.id == subtask_id))
    c, d = await _counts(db, subtask_id)
    return _st_dict(row, c, d)


@router.post("/subtasks/{subtask_id}/start")
async def start(subtask_id: UUID, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    await tt.start(subtask_id, user, db)
    return await _after_action(subtask_id, db)


@router.post("/subtasks/{subtask_id}/pause")
async def pause(subtask_id: UUID, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    await tt.pause(subtask_id, user, db)
    return await _after_action(subtask_id, db)


@router.post("/subtasks/{subtask_id}/resume")
async def resume(subtask_id: UUID, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    await tt.resume(subtask_id, user, db)
    return await _after_action(subtask_id, db)


@router.post("/subtasks/{subtask_id}/end")
async def end(subtask_id: UUID, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    await tt.end(subtask_id, user, db)
    return await _after_action(subtask_id, db)


@router.get("/subtasks/{subtask_id}/comments")
async def list_comments(subtask_id: UUID, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    rows = (await db.execute(
        select(Comment).options(selectinload(Comment.user))
        .where(Comment.subtask_id == subtask_id).order_by(Comment.created_at)
    )).scalars().all()
    return [{"id": str(c.id), "body": c.body, "created_at": c.created_at.isoformat(),
             "user": {"id": str(c.user.id), "name": c.user.name} if c.user else None} for c in rows]


@router.post("/subtasks/{subtask_id}/comments")
async def add_comment(subtask_id: UUID, body: CommentBody, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    c = Comment(subtask_id=subtask_id, user_id=user.id, body=body.body)
    db.add(c)
    await db.commit()
    await db.refresh(c)
    return {"id": str(c.id), "body": c.body, "created_at": c.created_at.isoformat(),
            "user": {"id": str(user.id), "name": user.name}}
