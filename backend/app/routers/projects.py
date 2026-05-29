from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from pydantic import BaseModel
from app.database import get_db
from app.models.user import User
from app.models.project import Project
from app.deps import get_current_user, require_manager

router = APIRouter(prefix="/projects", tags=["projects"])


def _proj_dict(p: Project) -> dict:
    return {
        "id": str(p.id), "name": p.name, "tag": p.tag,
        "description": p.description,
        "created_by_id": str(p.created_by_id),
        "created_by": {"id": str(p.created_by.id), "name": p.created_by.name} if p.created_by else None,
        "created_at": p.created_at.isoformat(),
    }


class ProjectCreate(BaseModel):
    name: str
    tag: str
    description: str = ""


@router.get("")
async def list_projects(db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    rows = (await db.execute(
        select(Project).options(selectinload(Project.created_by)).order_by(Project.name)
    )).scalars().all()
    return [_proj_dict(p) for p in rows]


@router.post("")
async def create_project(body: ProjectCreate, db: AsyncSession = Depends(get_db), user: User = Depends(require_manager)):
    existing = await db.scalar(select(Project).where(Project.tag == body.tag))
    if existing:
        raise HTTPException(400, f"Project tag '{body.tag}' already exists")
    p = Project(**body.model_dump(), created_by_id=user.id)
    db.add(p)
    await db.commit()
    row = await db.scalar(select(Project).options(selectinload(Project.created_by)).where(Project.id == p.id))
    return _proj_dict(row)


@router.delete("/{project_id}")
async def delete_project(project_id: UUID, db: AsyncSession = Depends(get_db), _: User = Depends(require_manager)):
    p = await db.scalar(select(Project).where(Project.id == project_id))
    if not p:
        raise HTTPException(404, "Project not found")
    await db.delete(p)
    await db.commit()
    return {"detail": "deleted"}
