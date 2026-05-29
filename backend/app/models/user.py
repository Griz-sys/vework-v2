import uuid, enum
from datetime import datetime
from sqlalchemy import String, DateTime, Enum as SAEnum, func
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class UserRole(str, enum.Enum):
    admin = "admin"
    manager = "manager"
    employee = "employee"


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(SAEnum(UserRole, name="userrole"), nullable=False, default=UserRole.employee)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    skill_profile: Mapped[dict] = mapped_column(JSONB, server_default="{}")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    epics_assigned_by: Mapped[list["Epic"]] = relationship("Epic", foreign_keys="Epic.assigned_by_id", back_populates="assigner", lazy="noload")
    time_logs: Mapped[list["TimeLog"]] = relationship("TimeLog", back_populates="user", lazy="noload")
    documents: Mapped[list["Document"]] = relationship("Document", back_populates="uploader", lazy="noload")
    comments: Mapped[list["Comment"]] = relationship("Comment", back_populates="user", lazy="noload")
