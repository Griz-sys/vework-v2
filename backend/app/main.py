import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from app.database import engine, Base
from app.config import settings
from app.routers import auth, epics, subtasks, documents, team, ai, analytics, events, admin, projects


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        # Add new enum values outside a transaction (Postgres restriction)
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
    except Exception as e:
        print(f"[startup] DB migration warning (non-fatal): {e}")
    os.makedirs(settings.storage_path, exist_ok=True)
    yield
    await engine.dispose()


app = FastAPI(title="VeWork API", version="2.0.0", lifespan=lifespan)

_cors_raw = os.getenv("CORS_ORIGINS", "http://localhost:5175,http://127.0.0.1:5175")
_cors_origins = [o.strip().rstrip("/") for o in _cors_raw.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

for r in [auth.router, epics.router, subtasks.router, documents.router,
          team.router, ai.router, analytics.router, events.router, admin.router, projects.router]:
    app.include_router(r)


@app.get("/health")
async def health():
    return {"status": "ok", "version": "2.0.0"}
