from uuid import UUID
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel
from typing import Any
from app.database import get_db
from app.models.user import User, UserRole
from app.models.epic import Epic, EpicStatus
from app.models.subtask import Subtask
from app.deps import require_manager

router = APIRouter(prefix="/team", tags=["team"])


def _user_dict(u: User) -> dict:
    return {"id": str(u.id), "email": u.email, "name": u.name, "role": u.role,
            "skill_profile": u.skill_profile, "created_at": u.created_at.isoformat()}


@router.get("/members")
async def members(db: AsyncSession = Depends(get_db), user: User = Depends(require_manager)):
    rows = (await db.execute(select(User).where(User.role == UserRole.employee).order_by(User.name))).scalars().all()
    return [_user_dict(u) for u in rows]


@router.get("/workload")
async def workload(db: AsyncSession = Depends(get_db), user: User = Depends(require_manager)):
    employees = (await db.execute(select(User).where(User.role == UserRole.employee))).scalars().all()
    now = datetime.now(timezone.utc)
    week_start = now - timedelta(days=now.weekday())
    result = []
    for emp in employees:
        active_epics = await db.scalar(select(func.count()).where(Epic.assigned_to_id == emp.id, Epic.status == EpicStatus.in_progress)) or 0
        total_subtasks = await db.scalar(select(func.count()).where(Subtask.created_by_id == emp.id)) or 0
        done_this_week = (await db.execute(
            select(Subtask).where(Subtask.created_by_id == emp.id, Subtask.ended_at >= week_start)
        )).scalars().all()
        hours_this_week = round(sum(s.total_time_seconds for s in done_this_week) / 3600, 1)
        result.append({**_user_dict(emp), "active_epics": active_epics,
                       "subtask_count": total_subtasks, "hours_this_week": hours_this_week})
    return result


class SkillsBody(BaseModel):
    skill_profile: dict[str, Any]


@router.patch("/members/{user_id}/skills")
async def update_skills(user_id: UUID, body: SkillsBody, db: AsyncSession = Depends(get_db), user: User = Depends(require_manager)):
    target = await db.scalar(select(User).where(User.id == user_id))
    if not target:
        raise HTTPException(404, "User not found")
    target.skill_profile = body.skill_profile
    await db.commit()
    await db.refresh(target)
    return _user_dict(target)
