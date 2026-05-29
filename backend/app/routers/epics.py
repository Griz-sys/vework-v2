from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from pydantic import BaseModel
from datetime import date
from app.database import get_db
from app.models.user import User, UserRole
from app.models.epic import Epic, EpicStatus, EpicScope, epic_assignees_table
from app.models.subtask import SubtaskStatus
from app.deps import get_current_user, require_manager
from app.services.ai import summarise_epic

router = APIRouter(prefix="/epics", tags=["epics"])

_LOAD = [selectinload(Epic.assignees), selectinload(Epic.assigner), selectinload(Epic.subtasks)]


def _progress(subtasks) -> dict:
    total = len(subtasks)
    counts = {s: 0 for s in SubtaskStatus}
    for st in subtasks:
        counts[st.status] += 1
    done = counts[SubtaskStatus.done]
    return {
        "total": total, "done": done,
        "in_progress": counts[SubtaskStatus.in_progress],
        "not_started": counts[SubtaskStatus.not_started],
        "paused": counts[SubtaskStatus.paused],
        "percent": round(done / total * 100, 1) if total else 0.0,
    }


def _epic_dict(epic: Epic) -> dict:
    prog = _progress(epic.subtasks or [])
    return {
        "id": str(epic.id), "title": epic.title, "description": epic.description,
        "project_tag": epic.project_tag, "scope": epic.scope, "status": epic.status,
        "assigned_by_id": str(epic.assigned_by_id),
        "due_date": epic.due_date.isoformat() if epic.due_date else None,
        "created_at": epic.created_at.isoformat(), "updated_at": epic.updated_at.isoformat(),
        "assignees": [
            {"id": str(u.id), "name": u.name, "email": u.email, "role": u.role}
            for u in (epic.assignees or [])
        ],
        "assigner": {"id": str(epic.assigner.id), "name": epic.assigner.name} if epic.assigner else None,
        "progress": prog,
    }


class EpicCreate(BaseModel):
    title: str
    description: str = ""
    project_tag: str
    scope: EpicScope | None = None
    assignee_ids: list[UUID]
    status: EpicStatus = EpicStatus.not_started
    due_date: date | None = None


class EpicUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    project_tag: str | None = None
    scope: EpicScope | None = None
    assignee_ids: list[UUID] | None = None
    status: EpicStatus | None = None
    due_date: date | None = None


@router.get("")
async def list_epics(
    assigned_to: UUID | None = None, status: str | None = None, project: str | None = None,
    db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user),
):
    q = select(Epic).options(*_LOAD)
    if user.role == UserRole.employee:
        subq = select(epic_assignees_table.c.epic_id).where(
            epic_assignees_table.c.user_id == user.id
        ).scalar_subquery()
        q = q.where(Epic.id.in_(subq))
    else:
        if assigned_to:
            subq = select(epic_assignees_table.c.epic_id).where(
                epic_assignees_table.c.user_id == assigned_to
            ).scalar_subquery()
            q = q.where(Epic.id.in_(subq))
    if status:
        q = q.where(Epic.status == status)
    if project:
        q = q.where(Epic.project_tag == project)
    q = q.order_by(Epic.created_at.desc())
    rows = (await db.execute(q)).scalars().all()
    return [_epic_dict(e) for e in rows]


@router.post("")
async def create_epic(body: EpicCreate, db: AsyncSession = Depends(get_db), user: User = Depends(require_manager)):
    epic_data = body.model_dump(exclude={'assignee_ids'})
    epic = Epic(**epic_data, assigned_by_id=user.id)
    db.add(epic)
    await db.flush()
    for uid in body.assignee_ids:
        await db.execute(epic_assignees_table.insert().values(epic_id=epic.id, user_id=uid))
    await db.commit()
    row = await db.scalar(select(Epic).options(*_LOAD).where(Epic.id == epic.id))
    return _epic_dict(row)


@router.get("/{epic_id}")
async def get_epic(epic_id: UUID, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    epic = await db.scalar(select(Epic).options(*_LOAD).where(Epic.id == epic_id))
    if not epic:
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
    return _epic_dict(epic)


@router.patch("/{epic_id}")
async def update_epic(epic_id: UUID, body: EpicUpdate, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    epic = await db.scalar(select(Epic).where(Epic.id == epic_id))
    if not epic:
        raise HTTPException(404, "Epic not found")
    for k, v in body.model_dump(exclude_none=True, exclude={'assignee_ids'}).items():
        setattr(epic, k, v)
    if body.assignee_ids is not None:
        await db.execute(
            epic_assignees_table.delete().where(epic_assignees_table.c.epic_id == epic_id)
        )
        for uid in body.assignee_ids:
            await db.execute(epic_assignees_table.insert().values(epic_id=epic_id, user_id=uid))
    await db.commit()
    row = await db.scalar(select(Epic).options(*_LOAD).where(Epic.id == epic_id))
    return _epic_dict(row)


@router.delete("/{epic_id}")
async def delete_epic(epic_id: UUID, db: AsyncSession = Depends(get_db), user: User = Depends(require_manager)):
    epic = await db.scalar(select(Epic).where(Epic.id == epic_id))
    if not epic:
        raise HTTPException(404, "Epic not found")
    await db.delete(epic)
    await db.commit()
    return {"detail": "deleted"}


@router.get("/{epic_id}/progress")
async def epic_progress(epic_id: UUID, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    epic = await db.scalar(select(Epic).options(selectinload(Epic.subtasks)).where(Epic.id == epic_id))
    if not epic:
        raise HTTPException(404, "Epic not found")
    return _progress(epic.subtasks)


@router.get("/{epic_id}/ai-summary")
async def ai_summary(epic_id: UUID, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    epic = await db.scalar(select(Epic).options(*_LOAD).where(Epic.id == epic_id))
    if not epic:
        raise HTTPException(404, "Epic not found")
    primary_assignee = epic.assignees[0] if epic.assignees else None
    text, cached = await summarise_epic(epic, primary_assignee, epic.subtasks, db)
    return {"summary": text, "cached": cached}
