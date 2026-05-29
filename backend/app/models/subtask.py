import uuid, enum
from datetime import datetime
from sqlalchemy import String, DateTime, Integer, ForeignKey, Enum as SAEnum, func, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class SubtaskStatus(str, enum.Enum):
    not_started = "not_started"
    in_progress = "in_progress"
    paused = "paused"
    done = "done"


class TimeAction(str, enum.Enum):
    start = "start"
    pause = "pause"
    resume = "resume"
    end = "end"


class Subtask(Base):
    __tablename__ = "subtasks"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    epic_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("epics.id", ondelete="CASCADE"), nullable=False, index=True)
    created_by_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[str] = mapped_column(Text, server_default="")
    status: Mapped[SubtaskStatus] = mapped_column(SAEnum(SubtaskStatus, name="subtaskstatus"), nullable=False, default=SubtaskStatus.not_started)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    paused_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    total_time_seconds: Mapped[int] = mapped_column(Integer, server_default="0")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    epic: Mapped["Epic"] = relationship("Epic", back_populates="subtasks")
    created_by: Mapped["User"] = relationship("User", foreign_keys=[created_by_id])
    time_logs: Mapped[list["TimeLog"]] = relationship("TimeLog", back_populates="subtask", cascade="all, delete-orphan", lazy="noload")
    documents: Mapped[list["Document"]] = relationship("Document", back_populates="subtask", lazy="noload")
    comments: Mapped[list["Comment"]] = relationship("Comment", back_populates="subtask", cascade="all, delete-orphan", lazy="noload")


class TimeLog(Base):
    __tablename__ = "time_logs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    subtask_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("subtasks.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    action: Mapped[TimeAction] = mapped_column(SAEnum(TimeAction, name="timeaction"), nullable=False)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    note: Mapped[str | None] = mapped_column(String(1000), nullable=True)

    subtask: Mapped["Subtask"] = relationship("Subtask", back_populates="time_logs")
    user: Mapped["User"] = relationship("User", back_populates="time_logs")
