from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, delete
from app.database import get_db
from app.models.user import User, UserRole
from app.models.epic import Epic, EpicStatus
from app.models.manager_employee import ManagerEmployee
from app.deps import require_admin

router = APIRouter(prefix="/admin", tags=["admin"])


def _user_dict(u: User) -> dict:
    return {"id": str(u.id), "name": u.name, "email": u.email, "role": u.role, "created_at": u.created_at.isoformat()}


@router.get("/overview")
async def overview(db: AsyncSession = Depends(get_db), _: User = Depends(require_admin)):
    all_users = (await db.execute(select(User).order_by(User.created_at))).scalars().all()

    admins    = [u for u in all_users if u.role == UserRole.admin]
    managers  = [u for u in all_users if u.role == UserRole.manager]
    employees = [u for u in all_users if u.role == UserRole.employee]

    # Load all manager-employee links
    links = (await db.execute(select(ManagerEmployee))).scalars().all()
    emp_by_manager: dict[str, list] = {str(m.id): [] for m in managers}
    for link in links:
        mid = str(link.manager_id)
        eid = str(link.employee_id)
        if mid in emp_by_manager:
            emp = next((e for e in employees if str(e.id) == eid), None)
            if emp:
                emp_by_manager[mid].append(_user_dict(emp))

    # Epic counts per manager
    epic_rows = (await db.execute(
        select(Epic.assigned_by_id, func.count(Epic.id)).group_by(Epic.assigned_by_id)
    )).all()
    epic_count_by_manager = {str(r[0]): r[1] for r in epic_rows}

    assigned_employee_ids = {str(link.employee_id) for link in links}
    unassigned = [_user_dict(e) for e in employees if str(e.id) not in assigned_employee_ids]

    total_epics = await db.scalar(select(func.count(Epic.id))) or 0
    active_epics = await db.scalar(
        select(func.count(Epic.id)).where(Epic.status == EpicStatus.in_progress)
    ) or 0

    return {
        "stats": {
            "admins": len(admins),
            "managers": len(managers),
            "employees": len(employees),
            "total_epics": total_epics,
            "active_epics": active_epics,
        },
        "managers": [
            {
                **_user_dict(m),
                "employees": emp_by_manager.get(str(m.id), []),
                "epic_count": epic_count_by_manager.get(str(m.id), 0),
            }
            for m in managers
        ],
        "unassigned_employees": unassigned,
        "all_employees": [_user_dict(e) for e in employees],
    }


@router.get("/users")
async def list_users(db: AsyncSession = Depends(get_db), _: User = Depends(require_admin)):
    users = (await db.execute(select(User).order_by(User.role, User.name))).scalars().all()
    return [_user_dict(u) for u in users]


@router.post("/managers/{manager_id}/employees/{employee_id}")
async def assign_employee(
    manager_id: UUID, employee_id: UUID,
    db: AsyncSession = Depends(get_db), _: User = Depends(require_admin),
):
    manager = await db.scalar(select(User).where(User.id == manager_id))
    employee = await db.scalar(select(User).where(User.id == employee_id))
    if not manager or manager.role != UserRole.manager:
        raise HTTPException(400, "Invalid manager")
    if not employee or employee.role != UserRole.employee:
        raise HTTPException(400, "Invalid employee")

    existing = await db.scalar(
        select(ManagerEmployee).where(
            ManagerEmployee.manager_id == manager_id,
            ManagerEmployee.employee_id == employee_id,
        )
    )
    if existing:
        return {"detail": "already assigned"}

    db.add(ManagerEmployee(manager_id=manager_id, employee_id=employee_id))
    await db.commit()
    return {"detail": "assigned"}


@router.delete("/managers/{manager_id}/employees/{employee_id}")
async def unassign_employee(
    manager_id: UUID, employee_id: UUID,
    db: AsyncSession = Depends(get_db), _: User = Depends(require_admin),
):
    result = await db.execute(
        delete(ManagerEmployee).where(
            ManagerEmployee.manager_id == manager_id,
            ManagerEmployee.employee_id == employee_id,
        )
    )
    await db.commit()
    if result.rowcount == 0:
        raise HTTPException(404, "Assignment not found")
    return {"detail": "unassigned"}
