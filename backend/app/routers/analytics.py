from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.database import get_db
from app.models.user import User, UserRole
from app.models.epic import Epic, EpicStatus
from app.models.subtask import Subtask, SubtaskStatus
from app.deps import require_manager

router = APIRouter(prefix="/analytics", tags=["analytics"])


async def _build_overview(db: AsyncSession) -> dict:
    total = await db.scalar(select(func.count()).select_from(Epic)) or 0
    done = await db.scalar(select(func.count()).where(Epic.status == EpicStatus.done)) or 0
    wip = await db.scalar(select(func.count()).where(Epic.status == EpicStatus.in_progress)) or 0
    return {"epics_total": total, "done": done, "in_progress": wip,
            "completion_rate": round(done / total * 100, 1) if total else 0.0}


@router.get("/overview")
async def overview(db: AsyncSession = Depends(get_db), user: User = Depends(require_manager)):
    return await _build_overview(db)


@router.get("/time-by-project")
async def time_by_project(db: AsyncSession = Depends(get_db), user: User = Depends(require_manager)):
    now = datetime.now(timezone.utc)
    week_start = now - timedelta(days=now.weekday())
    rows = (await db.execute(
        select(Epic.project_tag, Subtask.total_time_seconds)
        .join(Subtask, Subtask.epic_id == Epic.id)
        .where(Subtask.ended_at >= week_start)
    )).all()
    agg: dict[str, int] = {}
    for tag, secs in rows:
        agg[tag] = agg.get(tag, 0) + secs
    return [{"project": k, "hours": round(v / 3600, 2)} for k, v in sorted(agg.items())]


@router.get("/team-velocity")
async def team_velocity(db: AsyncSession = Depends(get_db), user: User = Depends(require_manager)):
    cutoff = datetime.now(timezone.utc) - timedelta(days=30)
    rows = (await db.execute(
        select(Subtask.created_by_id, Subtask.ended_at)
        .where(Subtask.status == SubtaskStatus.done, Subtask.ended_at >= cutoff)
    )).all()
    by_week: dict = {}
    for uid, ended_at in rows:
        if ended_at:
            week = ended_at.strftime("%Y-W%W")
            key = (str(uid), week)
            by_week[key] = by_week.get(key, 0) + 1
    return [{"user_id": k[0], "week": k[1], "tasks_completed": v} for k, v in by_week.items()]


@router.get("/productivity")
async def productivity(db: AsyncSession = Depends(get_db), user: User = Depends(require_manager)):
    now = datetime.now(timezone.utc)
    week_start = now - timedelta(days=now.weekday())
    employees = (await db.execute(select(User).where(User.role == UserRole.employee))).scalars().all()
    result = []
    for emp in employees:
        done = (await db.execute(select(Subtask).where(
            Subtask.created_by_id == emp.id, Subtask.status == SubtaskStatus.done, Subtask.ended_at >= week_start
        ))).scalars().all()
        tasks_done = len(done)
        total_h = sum(s.total_time_seconds for s in done) / 3600
        result.append({
            "user_id": str(emp.id), "name": emp.name,
            "tasks_done_this_week": tasks_done,
            "total_hours": round(total_h, 1),
            "avg_hours_per_task": round(total_h / tasks_done, 1) if tasks_done else 0.0,
        })
    return result
