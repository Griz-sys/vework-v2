import os, uuid as _uuid
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import aiofiles
from app.database import get_db
from app.models.user import User
from app.models.document import Document
from app.models.epic import Epic
from app.deps import get_current_user
from app.config import settings

router = APIRouter(prefix="/documents", tags=["documents"])


def _doc_dict(d: Document) -> dict:
    return {
        "id": str(d.id), "title": d.title, "file_size": d.file_size, "mime_type": d.mime_type,
        "epic_id": str(d.epic_id) if d.epic_id else None,
        "subtask_id": str(d.subtask_id) if d.subtask_id else None,
        "project_folder": d.project_folder, "drive_file_id": d.drive_file_id,
        "drive_sync_status": d.drive_sync_status, "created_at": d.created_at.isoformat(),
        "uploaded_by_id": str(d.uploaded_by_id),
    }


@router.post("/upload")
async def upload(
    file: UploadFile = File(...),
    epic_id: UUID | None = Form(None),
    subtask_id: UUID | None = Form(None),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    os.makedirs(settings.storage_path, exist_ok=True)
    ext = os.path.splitext(file.filename or "")[1]
    fname = f"{_uuid.uuid4()}{ext}"
    fpath = os.path.join(settings.storage_path, fname)
    content = await file.read()
    async with aiofiles.open(fpath, "wb") as f:
        await f.write(content)

    folder = None
    if epic_id:
        epic = await db.scalar(select(Epic).where(Epic.id == epic_id))
        if epic:
            folder = epic.project_tag

    doc = Document(
        title=file.filename or fname, file_path=fpath, file_size=len(content),
        mime_type=file.content_type or "application/octet-stream",
        uploaded_by_id=user.id, epic_id=epic_id, subtask_id=subtask_id, project_folder=folder,
    )
    db.add(doc)
    await db.commit()
    await db.refresh(doc)
    return _doc_dict(doc)


@router.get("")
async def list_docs(
    epic_id: UUID | None = None, subtask_id: UUID | None = None, project: str | None = None,
    db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user),
):
    q = select(Document)
    if epic_id:
        q = q.where(Document.epic_id == epic_id)
    if subtask_id:
        q = q.where(Document.subtask_id == subtask_id)
    if project:
        q = q.where(Document.project_folder == project)
    rows = (await db.execute(q.order_by(Document.created_at.desc()))).scalars().all()
    return [_doc_dict(d) for d in rows]


@router.delete("/{doc_id}")
async def delete_doc(doc_id: UUID, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    doc = await db.scalar(select(Document).where(Document.id == doc_id))
    if not doc:
        raise HTTPException(404, "Document not found")
    if doc.uploaded_by_id != user.id:
        raise HTTPException(403, "Access denied")
    try:
        os.remove(doc.file_path)
    except FileNotFoundError:
        pass
    await db.delete(doc)
    await db.commit()
    return {"detail": "deleted"}


@router.post("/{doc_id}/sync-drive")
async def sync_drive(doc_id: UUID, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    doc = await db.scalar(select(Document).where(Document.id == doc_id))
    if not doc:
        raise HTTPException(404, "Document not found")
    # Celery task would be dispatched here
    return {"detail": "sync queued", "document_id": str(doc_id)}
