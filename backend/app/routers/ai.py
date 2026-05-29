from uuid import UUID
from datetime import datetime, timezone, date
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.database import get_db
from app.models.user import User, UserRole
from app.models.epic import Epic
from app.models.subtask import Subtask, SubtaskStatus
from app.deps import get_current_user, require_manager
from app.services import ai as svc

router = APIRouter(prefix="/ai", tags=["ai"])


@router.post("/summarise-epic")
async def summarise(body: dict, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    epic_id = UUID(str(body["epic_id"]))
    epic = await db.scalar(select(Epic).options(selectinload(Epic.assignee), selectinload(Epic.subtasks)).where(Epic.id == epic_id))
    if not epic:
        raise HTTPException(404, "Epic not found")
    text, cached = await svc.summarise_epic(epic, epic.assignee, epic.subtasks, db)
    return {"summary": text, "cached": cached}


@router.post("/suggest-assignment")
async def suggest(body: dict, db: AsyncSession = Depends(get_db), user: User = Depends(require_manager)):
    epic_id = UUID(str(body["epic_id"]))
    epic = await db.scalar(select(Epic).where(Epic.id == epic_id))
    if not epic:
        raise HTTPException(404, "Epic not found")
    employees = (await db.execute(select(User).where(User.role == UserRole.employee))).scalars().all()
    profiles = [{"user_id": str(e.id), "name": e.name,
                 "skills": e.skill_profile.get("skills", []),
                 "seniority": e.skill_profile.get("seniority", ""),
                 "current_workload_hours": 0} for e in employees]
    return await svc.suggest_assignment(epic, profiles, db)


@router.post("/daily-recap")
async def recap(body: dict, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    uid = UUID(str(body.get("user_id", str(user.id))))
    d = datetime.strptime(body.get("date", date.today().isoformat()), "%Y-%m-%d").replace(tzinfo=timezone.utc)
    target = await db.scalar(select(User).where(User.id == uid))
    if not target:
        raise HTTPException(404, "User not found")
    completed = (await db.execute(select(Subtask).where(
        Subtask.created_by_id == uid, Subtask.status == SubtaskStatus.done, Subtask.ended_at >= d
    ))).scalars().all()
    wip = (await db.execute(select(Subtask).where(
        Subtask.created_by_id == uid, Subtask.status.in_([SubtaskStatus.in_progress, SubtaskStatus.paused])
    ))).scalars().all()
    return await svc.daily_recap(target, completed, wip)


@router.post("/prioritise-tasks")
async def prioritise(body: dict, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    uid = UUID(str(body.get("user_id", str(user.id))))
    target = await db.scalar(select(User).where(User.id == uid))
    if not target:
        raise HTTPException(404, "User not found")
    subtasks = (await db.execute(select(Subtask).where(
        Subtask.created_by_id == uid,
        Subtask.status.in_([SubtaskStatus.not_started, SubtaskStatus.in_progress, SubtaskStatus.paused])
    ))).scalars().all()
    return await svc.prioritise_tasks(target, subtasks)


@router.get("/analytics-insight")
async def insight(db: AsyncSession = Depends(get_db), user: User = Depends(require_manager)):
    from app.routers.analytics import _build_overview
    data = await _build_overview(db)
    text = await svc.analytics_insight(data)
    return {"insight": text}
