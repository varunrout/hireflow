"""Scheduled automation pipeline task.

This task is triggered by Celery Beat when scheduling is enabled for a user.
It can also be invoked directly to run the pipeline for a specific user.
"""
from __future__ import annotations

import asyncio
import logging
from uuid import UUID

from app.tasks.celery_app import celery

logger = logging.getLogger(__name__)


@celery.task(name="automation.run_scheduled_pipeline", bind=True, max_retries=2)
def run_scheduled_pipeline(self, user_id: str) -> dict:
    """Run the automation pipeline for a user as a background Celery task.

    This is the entry point for scheduled runs triggered by Celery Beat.
    It creates an async event loop to call the pipeline logic.
    """
    try:
        result = asyncio.run(_run_pipeline_async(UUID(user_id)))
        return result
    except Exception as exc:
        logger.exception("Scheduled pipeline run failed for user %s", user_id)
        raise self.retry(exc=exc, countdown=60 * (self.request.retries + 1))


async def _run_pipeline_async(user_id: UUID) -> dict:
    """Execute the pipeline logic within an async database session."""
    from sqlalchemy.ext.asyncio import AsyncSession

    from app.db.session import AsyncSessionLocal
    from app.models.models import (
        AutomationPipelineRun,
        AutomationPipelineSettings,
    )
    from app.services.job_matching import run_matching_for_user

    async with AsyncSessionLocal() as db:
        from sqlalchemy import select

        # Load settings
        result = await db.execute(
            select(AutomationPipelineSettings).where(
                AutomationPipelineSettings.user_id == user_id
            )
        )
        settings = result.scalar_one_or_none()
        if not settings:
            return {"status": "skipped", "reason": "no_settings"}

        if not settings.enabled or not settings.schedule_enabled:
            return {"status": "skipped", "reason": "pipeline_disabled"}

        if settings.schedule_paused:
            return {"status": "skipped", "reason": "schedule_paused"}

        # Create run record
        from datetime import datetime, timezone

        run = AutomationPipelineRun(
            user_id=user_id,
            triggered_by="scheduled",
            status="running",
            summary={"scheduled": True},
        )
        db.add(run)
        await db.flush()

        try:
            import time

            t_start = time.monotonic()

            new_matches = await run_matching_for_user(
                user_id, db, limit=settings.max_jobs_per_run * 2
            )

            scoring_ms = int((time.monotonic() - t_start) * 1000)

            run.status = "completed"
            run.new_matches_count = len(new_matches)
            run.matched_jobs_count = len(new_matches)
            run.scoring_duration_ms = scoring_ms
            run.total_duration_ms = int((time.monotonic() - t_start) * 1000)
            run.finished_at = datetime.now(timezone.utc)
            run.summary = {
                "scheduled": True,
                "newly_matched_jobs": len(new_matches),
                "scoring_ms": scoring_ms,
            }

            await db.commit()
            return {
                "status": "completed",
                "run_id": str(run.id),
                "matched": len(new_matches),
            }

        except Exception:
            run.status = "failed"
            run.finished_at = datetime.now(timezone.utc)
            run.error_message = "Scheduled run failed"
            await db.commit()
            raise

    return {"status": "error"}
