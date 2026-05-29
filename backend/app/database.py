from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase
from app.config import settings

# Railway/Heroku provide plain postgresql:// — asyncpg needs postgresql+asyncpg://
_db_url = settings.database_url \
    .replace("postgres://", "postgresql+asyncpg://", 1) \
    .replace("postgresql://", "postgresql+asyncpg://", 1)

# Railway's public proxy requires SSL
_connect_args = {"ssl": "require"} if "railway" in _db_url else {}

engine = create_async_engine(_db_url, pool_pre_ping=True, connect_args=_connect_args)
SessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


class Base(DeclarativeBase):
    pass


async def get_db():
    async with SessionLocal() as session:
        yield session
