"""
Run from backend directory:
    python seed.py

Creates test accounts and sample epics/subtasks.

Credentials:
    admin@vework.com    / Password123   (admin)
    manager@vework.com  / Password123   (manager)
    sarah@vework.com    / Password123   (manager)
    alice@vework.com    / Password123   (employee)
    bob@vework.com      / Password123   (employee)
    carol@vework.com    / Password123   (employee)
    dan@vework.com      / Password123   (employee)
"""
import asyncio
from datetime import date, timedelta
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy import select, text
from app.config import settings
from app.database import Base
from app.models.user import User, UserRole
from app.models.epic import Epic, EpicStatus, EpicScope, epic_assignees_table
from app.models.subtask import Subtask, SubtaskStatus
from app.models.manager_employee import ManagerEmployee
from app.models.project import Project
from app.services.security import hash_password

engine = create_async_engine(settings.database_url, echo=False)
Session = async_sessionmaker(engine, expire_on_commit=False)

TODAY = date.today()

USERS = [
    {"email": "admin@vework.com",   "name": "VeWork Admin",   "role": UserRole.admin,    "password": "Password123"},
    {"email": "manager@vework.com", "name": "Alex Morgan",    "role": UserRole.manager,  "password": "Password123"},
    {"email": "sarah@vework.com",   "name": "Sarah Patel",    "role": UserRole.manager,  "password": "Password123"},
    {"email": "alice@vework.com",   "name": "Alice Chen",     "role": UserRole.employee, "password": "Password123"},
    {"email": "bob@vework.com",     "name": "Bob Martinez",   "role": UserRole.employee, "password": "Password123"},
    {"email": "carol@vework.com",   "name": "Carol Williams", "role": UserRole.employee, "password": "Password123"},
    {"email": "dan@vework.com",     "name": "Dan Kim",        "role": UserRole.employee, "password": "Password123"},
]

EPICS = [
    {
        "title": "Rebuild Homepage",
        "description": "Redesign and rebuild the company homepage with new brand guidelines.",
        "project_tag": "Amara",
        "scope": EpicScope.design,
        "status": EpicStatus.in_progress,
        "due_date": TODAY + timedelta(days=14),
        "assignees": ["alice@vework.com", "bob@vework.com"],   # two employees
        "subtasks": [
            {"title": "Wireframe layout",            "status": SubtaskStatus.done,        "total_time_seconds": 7200},
            {"title": "Design system tokens",        "status": SubtaskStatus.done,        "total_time_seconds": 5400},
            {"title": "Hero section implementation", "status": SubtaskStatus.in_progress, "total_time_seconds": 3600},
            {"title": "Footer & navigation",         "status": SubtaskStatus.not_started, "total_time_seconds": 0},
            {"title": "Cross-browser testing",       "status": SubtaskStatus.not_started, "total_time_seconds": 0},
        ],
    },
    {
        "title": "API Rate Limiting",
        "description": "Implement token-bucket rate limiting across all public endpoints.",
        "project_tag": "Amara",
        "scope": EpicScope.tech,
        "status": EpicStatus.in_progress,
        "due_date": TODAY + timedelta(days=7),
        "assignees": ["bob@vework.com"],
        "subtasks": [
            {"title": "Research Redis sliding window", "status": SubtaskStatus.done,        "total_time_seconds": 3600},
            {"title": "Middleware implementation",     "status": SubtaskStatus.in_progress, "total_time_seconds": 5400},
            {"title": "Load test at 10k RPM",          "status": SubtaskStatus.not_started, "total_time_seconds": 0},
        ],
    },
    {
        "title": "Q3 Marketing Campaign",
        "description": "Plan and execute the Q3 digital campaign across social and paid channels.",
        "project_tag": "Phoenix",
        "scope": EpicScope.marketing,
        "status": EpicStatus.not_started,
        "due_date": TODAY + timedelta(days=30),
        "assignees": ["carol@vework.com", "dan@vework.com"],
        "subtasks": [
            {"title": "Audience segmentation",  "status": SubtaskStatus.not_started, "total_time_seconds": 0},
            {"title": "Copy & creative briefs", "status": SubtaskStatus.not_started, "total_time_seconds": 0},
            {"title": "Ad spend allocation",    "status": SubtaskStatus.not_started, "total_time_seconds": 0},
            {"title": "Campaign launch",        "status": SubtaskStatus.not_started, "total_time_seconds": 0},
        ],
    },
    {
        "title": "Site Foundation Survey",
        "description": "Conduct geotechnical survey for Phoenix Phase 2 foundation work.",
        "project_tag": "Phoenix",
        "scope": EpicScope.civil,
        "status": EpicStatus.done,
        "due_date": TODAY - timedelta(days=5),
        "assignees": ["alice@vework.com"],
        "subtasks": [
            {"title": "Bore hole drilling",        "status": SubtaskStatus.done, "total_time_seconds": 28800},
            {"title": "Soil sample analysis",      "status": SubtaskStatus.done, "total_time_seconds": 14400},
            {"title": "Survey report compilation", "status": SubtaskStatus.done, "total_time_seconds": 7200},
        ],
    },
    {
        "title": "Mobile App Redesign",
        "description": "Refresh the iOS & Android app UI to match new design language.",
        "project_tag": "Cobalt",
        "scope": EpicScope.design,
        "status": EpicStatus.in_progress,
        "due_date": TODAY + timedelta(days=21),
        "assignees": ["carol@vework.com", "alice@vework.com"],
        "subtasks": [
            {"title": "Audit existing screens",   "status": SubtaskStatus.done,        "total_time_seconds": 3600},
            {"title": "Component library update", "status": SubtaskStatus.in_progress, "total_time_seconds": 9000},
            {"title": "Prototype key flows",      "status": SubtaskStatus.not_started, "total_time_seconds": 0},
            {"title": "Usability testing",        "status": SubtaskStatus.not_started, "total_time_seconds": 0},
        ],
    },
    {
        "title": "Database Migration to PG 16",
        "description": "Migrate all Cobalt services from Postgres 14 to 16 with zero downtime.",
        "project_tag": "Cobalt",
        "scope": EpicScope.tech,
        "status": EpicStatus.not_started,
        "due_date": TODAY + timedelta(days=45),
        "assignees": ["bob@vework.com", "dan@vework.com"],
        "subtasks": [
            {"title": "Compatibility audit",       "status": SubtaskStatus.not_started, "total_time_seconds": 0},
            {"title": "Staging migration dry-run", "status": SubtaskStatus.not_started, "total_time_seconds": 0},
            {"title": "Production cutover",        "status": SubtaskStatus.not_started, "total_time_seconds": 0},
        ],
    },
]


async def main():
    # Enum alterations must run outside a transaction
    async with engine.connect() as conn:
        ac = await conn.execution_options(isolation_level="AUTOCOMMIT")
        await ac.execute(text("ALTER TYPE userrole ADD VALUE IF NOT EXISTS 'admin'"))
        await ac.execute(text(
            "DO $$ BEGIN "
            "  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'epicscope') THEN "
            "    CREATE TYPE epicscope AS ENUM ('tech', 'civil', 'marketing', 'design'); "
            "  END IF; "
            "END $$;"
        ))

    async with engine.begin() as conn:
        await conn.execute(text("ALTER TABLE epics ADD COLUMN IF NOT EXISTS scope epicscope;"))
        await conn.run_sync(Base.metadata.create_all)
        # Migrate assigned_to_id → epic_assignees if old column still exists
        col_exists = await conn.scalar(text(
            "SELECT COUNT(*) FROM information_schema.columns "
            "WHERE table_name='epics' AND column_name='assigned_to_id'"
        ))
        if col_exists:
            await conn.execute(text(
                "INSERT INTO epic_assignees (epic_id, user_id) "
                "SELECT id, assigned_to_id FROM epics WHERE assigned_to_id IS NOT NULL "
                "ON CONFLICT DO NOTHING"
            ))
            await conn.execute(text("ALTER TABLE epics DROP COLUMN assigned_to_id"))

    async with Session() as db:
        # Create users (skip if already exist)
        user_map: dict[str, User] = {}
        for u in USERS:
            existing = await db.scalar(select(User).where(User.email == u["email"]))
            if existing:
                user_map[u["email"]] = existing
                print(f"  skip  {u['email']} (already exists)")
            else:
                user = User(
                    email=u["email"], name=u["name"], role=u["role"],
                    hashed_password=hash_password(u["password"]),
                )
                db.add(user)
                await db.flush()
                user_map[u["email"]] = user
                print(f"  create {u['email']}")

        manager = user_map["manager@vework.com"]

        # Create projects (idempotent)
        PROJECTS = [
            {"name": "Amara",   "tag": "Amara",  "description": "Frontend & API work for Amara platform."},
            {"name": "Phoenix", "tag": "Phoenix", "description": "Civil and marketing work for Phoenix Phase 2."},
            {"name": "Cobalt",  "tag": "Cobalt",  "description": "Mobile app and infrastructure for Cobalt."},
        ]
        for proj in PROJECTS:
            existing_proj = await db.scalar(select(Project).where(Project.tag == proj["tag"]))
            if not existing_proj:
                db.add(Project(**proj, created_by_id=manager.id))
                print(f"  create project '{proj['name']}'")
            else:
                print(f"  skip  project '{proj['name']}' (already exists)")
        await db.flush()

        # Manager-employee assignments (idempotent)
        ASSIGNMENTS = [
            ("manager@vework.com", "alice@vework.com"),
            ("manager@vework.com", "bob@vework.com"),
            ("sarah@vework.com",   "carol@vework.com"),
            ("sarah@vework.com",   "dan@vework.com"),
            ("manager@vework.com", "dan@vework.com"),
        ]
        for mgr_email, emp_email in ASSIGNMENTS:
            mgr_user = user_map[mgr_email]
            emp_user = user_map[emp_email]
            exists = await db.scalar(
                select(ManagerEmployee).where(
                    ManagerEmployee.manager_id == mgr_user.id,
                    ManagerEmployee.employee_id == emp_user.id,
                )
            )
            if not exists:
                db.add(ManagerEmployee(manager_id=mgr_user.id, employee_id=emp_user.id))
                print(f"  assign {emp_email} → {mgr_email}")
        await db.flush()

        EPIC_MANAGERS = {
            "Rebuild Homepage":          "manager@vework.com",
            "API Rate Limiting":         "manager@vework.com",
            "Q3 Marketing Campaign":     "sarah@vework.com",
            "Site Foundation Survey":    "sarah@vework.com",
            "Mobile App Redesign":       "sarah@vework.com",
            "Database Migration to PG 16": "manager@vework.com",
        }

        for ep in EPICS:
            existing = await db.scalar(select(Epic).where(Epic.title == ep["title"]))
            if existing:
                print(f"  skip  epic '{ep['title']}' (already exists)")
                continue

            assigner = user_map[EPIC_MANAGERS.get(ep["title"], "manager@vework.com")]
            epic = Epic(
                title=ep["title"], description=ep["description"],
                project_tag=ep["project_tag"], scope=ep["scope"],
                status=ep["status"], due_date=ep["due_date"],
                assigned_by_id=assigner.id,
            )
            db.add(epic)
            await db.flush()

            # Assign employees
            for email in ep["assignees"]:
                assignee = user_map[email]
                await db.execute(
                    epic_assignees_table.insert().values(epic_id=epic.id, user_id=assignee.id)
                )

            # Subtasks created by first assignee
            first_assignee = user_map[ep["assignees"][0]]
            for st in ep["subtasks"]:
                subtask = Subtask(
                    epic_id=epic.id, created_by_id=first_assignee.id,
                    title=st["title"], status=st["status"],
                    total_time_seconds=st["total_time_seconds"],
                )
                db.add(subtask)

            print(f"  create epic '{ep['title']}' → {ep['assignees']} ({len(ep['subtasks'])} subtasks)")

        await db.commit()

    print("\nDone! Log in with:")
    for u in USERS:
        print(f"  {u['email']}  /  {u['password']}  ({u['role'].value})")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
