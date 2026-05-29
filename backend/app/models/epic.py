import uuid, enum
from datetime import datetime, date
from sqlalchemy import String, DateTime, Date, ForeignKey, Enum as SAEnum, func, Text, Table, Column
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class EpicStatus(str, enum.Enum):
    not_started = "not_started"
    in_progress = "in_progress"
    done = "done"


class EpicScope(str, enum.Enum):
    tech = "tech"
    civil = "civil"
    marketing = "marketing"
    design = "design"


epic_assignees_table = Table(
    "epic_assignees",
    Base.metadata,
    Column("epic_id", UUID(as_uuid=True), ForeignKey("epics.id", ondelete="CASCADE"), primary_key=True),
    Column("user_id", UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
)


class Epic(Base):
    __tablename__ = "epics"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[str] = mapped_column(Text, server_default="")
    project_tag: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    scope: Mapped[EpicScope | None] = mapped_column(SAEnum(EpicScope, name="epicscope"), nullable=True)
    assigned_by_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    status: Mapped[EpicStatus] = mapped_column(SAEnum(EpicStatus, name="epicstatus"), nullable=False, default=EpicStatus.not_started)
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    assigner: Mapped["User"] = relationship("User", foreign_keys=[assigned_by_id], back_populates="epics_assigned_by")
    assignees: Mapped[list["User"]] = relationship("User", secondary=epic_assignees_table, lazy="noload")
    subtasks: Mapped[list["Subtask"]] = relationship("Subtask", back_populates="epic", cascade="all, delete-orphan", lazy="noload")
    documents: Mapped[list["Document"]] = relationship("Document", back_populates="epic", lazy="noload")
