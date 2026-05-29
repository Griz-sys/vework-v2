"""All Anthropic API calls. Haiku for fast/cheap tasks, Sonnet for reasoning."""
import json, hashlib
from datetime import datetime, timedelta, timezone
from typing import Any

from anthropic import AsyncAnthropic
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.config import settings
from app.models.ai_cache import AICache

_client: AsyncAnthropic | None = None

SYSTEM = (
    "You are the AI assistant inside VeWork, a task management tool for creative and marketing teams. "
    "You are concise, direct, and practical. Never use bullet points in summaries — write in plain prose. "
    "Always respond in valid JSON when structured output is requested."
)


def _client_() -> AsyncAnthropic:
    global _client
    if _client is None:
        _client = AsyncAnthropic(api_key=settings.anthropic_api_key)
    return _client


def _cache_key(prefix: str, data: Any) -> tuple[str, str]:
    raw = json.dumps(data, sort_keys=True, default=str)
    h = hashlib.sha256(raw.encode()).hexdigest()
    return f"{prefix}:{h[:40]}", h


async def _get_cache(db: AsyncSession, key: str) -> str | None:
    now = datetime.now(timezone.utc)
    row = await db.scalar(select(AICache).where(AICache.cache_key == key, AICache.expires_at > now))
    return row.response_text if row else None


async def _set_cache(db: AsyncSession, key: str, h: str, model: str, text: str) -> None:
    row = await db.scalar(select(AICache).where(AICache.cache_key == key))
    exp = datetime.now(timezone.utc) + timedelta(minutes=30)
    if row:
        row.response_text, row.expires_at, row.model_used = text, exp, model
    else:
        db.add(AICache(cache_key=key, model_used=model, prompt_hash=h, response_text=text, expires_at=exp))
    await db.commit()


async def _call(prompt: str, model: str) -> str:
    msg = await _client_().messages.create(
        model=model, max_tokens=1024, system=SYSTEM,
        messages=[{"role": "user", "content": prompt}]
    )
    return msg.content[0].text


async def summarise_epic(epic: Any, assignee: Any, subtasks: list[Any], db: AsyncSession) -> tuple[str, bool]:
    cache_key, h = _cache_key("epic_sum", {"id": str(epic.id), "updated": str(epic.updated_at)})
    if cached := await _get_cache(db, cache_key):
        return cached, True

    lines = "\n".join(
        f"- [{s.status}] {s.title} ({s.total_time_seconds // 3600}h {(s.total_time_seconds % 3600) // 60}m logged)"
        for s in subtasks
    ) or "No subtasks yet."
    due = epic.due_date.isoformat() if epic.due_date else "no due date"

    prompt = f"""Summarise the current state of this epic for the manager.

Epic: {epic.title}
Project: {epic.project_tag}
Assigned to: {assignee.name if assignee else "unassigned"}
Due: {due}

Subtasks:
{lines}

Write 2–3 sentences covering: what's done, what's in progress, any visible blockers. No bullet points. Be direct."""

    text = await _call(prompt, "claude-haiku-4-5-20251001")
    await _set_cache(db, cache_key, h, "claude-haiku-4-5-20251001", text)
    return text, False


async def suggest_assignment(epic: Any, employees: list[dict], db: AsyncSession) -> dict:
    cache_key, h = _cache_key("assign", {"id": str(epic.id), "emps": [e["user_id"] for e in employees]})
    if cached := await _get_cache(db, cache_key):
        return json.loads(cached)

    prompt = f"""A manager needs to assign the following task. Rank the available employees by fit.

Task: {epic.title}
Description: {epic.description}
Project: {epic.project_tag}

Available employees and their skill profiles:
{json.dumps(employees, indent=2)}

Return JSON only:
{{
  "ranked": [
    {{ "user_id": "...", "name": "...", "reason": "one sentence why they fit", "fit_score": 0 }}
  ]
}}"""

    text = await _call(prompt, "claude-sonnet-4-6")
    await _set_cache(db, cache_key, h, "claude-sonnet-4-6", text)
    return json.loads(text)


async def daily_recap(user: Any, completed: list[Any], in_progress: list[Any]) -> dict:
    done_str = "\n".join(f"- {t.title} ({t.total_time_seconds // 3600}h logged)" for t in completed) or "None"
    wip_str = "\n".join(f"- {t.title}" for t in in_progress) or "None"

    prompt = f"""Generate a daily recap for {user.name}.

Tasks completed today:
{done_str}

Tasks still in progress:
{wip_str}

Write a 2–3 sentence summary of their day. Then list up to 3 suggested priorities for tomorrow.

Return JSON:
{{
  "summary": "...",
  "tomorrow_priorities": ["...", "...", "..."]
}}"""
    return json.loads(await _call(prompt, "claude-haiku-4-5-20251001"))


async def prioritise_tasks(user: Any, subtasks: list[Any]) -> dict:
    tasks = [{"id": str(s.id), "title": s.title, "status": s.status, "time_logged_s": s.total_time_seconds} for s in subtasks]
    prompt = f"""Prioritise the following open tasks for {user.name}. Consider status, time invested, and urgency.

{json.dumps(tasks, indent=2)}

Return JSON only:
{{
  "ranked": [
    {{ "subtask_id": "...", "title": "...", "reason": "one sentence" }}
  ]
}}"""
    return json.loads(await _call(prompt, "claude-sonnet-4-6"))


async def analytics_insight(data: dict) -> str:
    prompt = f"""Write a concise narrative insight (2–3 sentences, no bullet points) summarising this team analytics data:

{json.dumps(data, indent=2)}

Focus on trends, bottlenecks, or achievements."""
    return await _call(prompt, "claude-haiku-4-5-20251001")
