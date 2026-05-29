import uuid, enum
from datetime import datetime
from sqlalchemy import String, DateTime, Integer, ForeignKey, Enum as SAEnum, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class DriveSyncStatus(str, enum.Enum):
    pending = "pending"
    synced = "synced"
    failed = "failed"


class Document(Base):
    __tablename__ = "documents"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    file_path: Mapped[str] = mapped_column(String(1000), nullable=False)
    file_size: Mapped[int] = mapped_column(Integer, nullable=False)
    mime_type: Mapped[str] = mapped_column(String(255), nullable=False)
    uploaded_by_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    epic_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("epics.id", ondelete="SET NULL"), nullable=True)
    subtask_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("subtasks.id", ondelete="SET NULL"), nullable=True)
    project_folder: Mapped[str | None] = mapped_column(String(255), nullable=True)
    drive_file_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    drive_sync_status: Mapped[DriveSyncStatus] = mapped_column(SAEnum(DriveSyncStatus, name="drivesyncstatus"), default=DriveSyncStatus.pending)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    uploader: Mapped["User"] = relationship("User", back_populates="documents")
    epic: Mapped["Epic"] = relationship("Epic", back_populates="documents")
    subtask: Mapped["Subtask"] = relationship("Subtask", back_populates="documents")
