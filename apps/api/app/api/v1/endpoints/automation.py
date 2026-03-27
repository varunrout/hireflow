"""Automation pipeline configuration endpoints."""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.models import (
    Application,
    ApplicationStatusEnum,
    AutomationPipelineRun,
    AutomationPipelineSettings,
    CandidatePreference,
    CandidateProfile,
    JobMatch,
    JobPosting,
    ResumeVersion,
    User,
)
from app.schemas.schemas import (
    AutomationRunListResponse,
    AutomationRunRequest,
    AutomationRunResponse,
    AutomationPipelineSettingsResponse,
    AutomationPipelineSettingsUpdate,
    AutomationReadinessResponse,
)

router = APIRouter(prefix="/automation", tags=["automation"])

DEFAULT_ALLOWED_SOURCES = ["linkedin", "indeed", "greenhouse", "lever", "workday"]


def _default_settings_payload() -> dict:
    return {
        "enabled": False,
        "auto_apply_enabled": False,
        "require_human_review": True,
        "auto_tailor_resume": True,
        "auto_generate_cover_letter": False,
        "allowed_sources": DEFAULT_ALLOWED_SOURCES.copy(),
        "search_terms": [],
        "target_locations": [],
        "excluded_keywords": [],
        "min_match_score": 70.0,
        "max_jobs_per_run": 25,
        "max_applications_per_day": 5,
    }


async def _get_or_create_settings(user_id, db: AsyncSession) -> AutomationPipelineSettings:
    result = await db.execute(
        select(AutomationPipelineSettings).where(AutomationPipelineSettings.user_id == user_id)
    )
    settings = result.scalar_one_or_none()
    if settings:
        return settings

    settings = AutomationPipelineSettings(user_id=user_id, **_default_settings_payload())
    db.add(settings)
    await db.flush()
    await db.refresh(settings)
    return settings


async def _count_today_applied(user_id, db: AsyncSession) -> int:
    today = datetime.now(timezone.utc).date()
    result = await db.execute(
        select(func.count(Application.id)).where(
            Application.user_id == user_id,
            Application.applied_at.is_not(None),
            func.date(Application.applied_at) == today,
        )
    )
    return int(result.scalar_one() or 0)


@router.get("/settings", response_model=AutomationPipelineSettingsResponse)
async def get_settings(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AutomationPipelineSettings:
    return await _get_or_create_settings(current_user.id, db)


@router.put("/settings", response_model=AutomationPipelineSettingsResponse)
async def upsert_settings(
    payload: AutomationPipelineSettingsUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AutomationPipelineSettings:
    settings = await _get_or_create_settings(current_user.id, db)
    for field, value in payload.model_dump().items():
        setattr(settings, field, value)
    await db.flush()
    await db.refresh(settings)
    return settings


@router.get("/readiness", response_model=AutomationReadinessResponse)
async def get_readiness(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AutomationReadinessResponse:
    settings = await _get_or_create_settings(current_user.id, db)

    profile_result = await db.execute(
        select(CandidateProfile.id).where(CandidateProfile.user_id == current_user.id)
    )
    preferences_result = await db.execute(
        select(CandidatePreference.id).where(CandidatePreference.user_id == current_user.id)
    )
    resume_count_result = await db.execute(
        select(func.count(ResumeVersion.id)).where(ResumeVersion.user_id == current_user.id)
    )
    saved_job_count_result = await db.execute(select(func.count(JobPosting.id)))
    application_count_result = await db.execute(
        select(func.count(Application.id)).where(Application.user_id == current_user.id)
    )
    job_match_count_result = await db.execute(
        select(func.count(JobMatch.id)).where(JobMatch.user_id == current_user.id)
    )

    has_profile = profile_result.scalar_one_or_none() is not None
    has_preferences = preferences_result.scalar_one_or_none() is not None
    resume_count = int(resume_count_result.scalar_one() or 0)
    saved_job_count = int(saved_job_count_result.scalar_one() or 0)
    application_count = int(application_count_result.scalar_one() or 0)
    job_match_count = int(job_match_count_result.scalar_one() or 0)

    blockers: list[str] = []
    suggestions: list[str] = []

    if not has_profile:
        blockers.append("Create your profile before running job matching.")
    if not has_preferences:
        blockers.append("Add candidate preferences so the pipeline knows what to target.")
    if resume_count == 0:
        blockers.append("Create at least one resume version before enabling auto-apply.")
    if len(settings.search_terms) == 0:
        suggestions.append("Add search terms to focus discovery on the roles you want most.")
    if len(settings.target_locations) == 0:
        suggestions.append("Add target locations to make automated search more precise.")
    if not settings.enabled:
        suggestions.append("Enable the pipeline when you are ready to start running discovery and matching.")
    if settings.auto_apply_enabled and settings.require_human_review:
        suggestions.append("Auto-apply is enabled with human review, so submissions will still wait for approval.")

    ready_for_matching = has_profile and has_preferences
    ready_for_auto_apply = (
        ready_for_matching
        and resume_count > 0
        and settings.enabled
        and settings.auto_apply_enabled
    )

    return AutomationReadinessResponse(
        has_profile=has_profile,
        has_preferences=has_preferences,
        resume_count=resume_count,
        saved_job_count=saved_job_count,
        application_count=application_count,
        job_match_count=job_match_count,
        ready_for_matching=ready_for_matching,
        ready_for_auto_apply=ready_for_auto_apply,
        blockers=blockers,
        suggestions=suggestions,
    )


@router.post("/runs", response_model=AutomationRunResponse)
async def run_pipeline_now(
    payload: AutomationRunRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AutomationPipelineRun:
    settings = await _get_or_create_settings(current_user.id, db)

    run = AutomationPipelineRun(
        user_id=current_user.id,
        triggered_by="manual",
        status="running",
        summary={"dry_run": payload.dry_run},
    )
    db.add(run)
    await db.flush()

    match_query = (
        select(JobMatch)
        .where(
            JobMatch.user_id == current_user.id,
            JobMatch.overall_score >= settings.min_match_score,
        )
        .order_by(JobMatch.overall_score.desc())
        .limit(settings.max_jobs_per_run)
    )
    match_result = await db.execute(match_query)
    matched_jobs = list(match_result.scalars().all())
    deduplicated_job_ids: list = []
    seen_job_ids = set()
    for match in matched_jobs:
        if match.job_posting_id in seen_job_ids:
            continue
        seen_job_ids.add(match.job_posting_id)
        deduplicated_job_ids.append(match.job_posting_id)

    matched_jobs_count = len(deduplicated_job_ids)

    if settings.require_human_review:
        reviewed_jobs_count = matched_jobs_count
    else:
        reviewed_jobs_count = 0

    applied_jobs_count = 0
    skipped_details: list[dict] = []
    created_application_ids: list[str] = []
    today_applied = await _count_today_applied(current_user.id, db)
    remaining_daily_capacity = max(settings.max_applications_per_day - today_applied, 0)

    can_auto_apply = (
        settings.enabled
        and settings.auto_apply_enabled
        and not settings.require_human_review
        and not payload.dry_run
    )

    non_apply_reason: str | None = None
    if payload.dry_run:
        non_apply_reason = "dry_run"
    elif not settings.enabled:
        non_apply_reason = "pipeline_disabled"
    elif not settings.auto_apply_enabled:
        non_apply_reason = "auto_apply_disabled"
    elif settings.require_human_review:
        non_apply_reason = "requires_human_review"

    default_resume_id = None
    if can_auto_apply:
        resume_result = await db.execute(
            select(ResumeVersion.id)
            .where(ResumeVersion.user_id == current_user.id)
            .order_by(ResumeVersion.updated_at.desc())
            .limit(1)
        )
        default_resume_id = resume_result.scalar_one_or_none()
        if default_resume_id is None:
            can_auto_apply = False
            non_apply_reason = "no_resume_available"

    existing_application_job_ids: set = set()
    if deduplicated_job_ids:
        existing_result = await db.execute(
            select(Application.job_posting_id).where(
                Application.user_id == current_user.id,
                Application.job_posting_id.in_(deduplicated_job_ids),
            )
        )
        existing_application_job_ids = set(existing_result.scalars().all())

    now_utc = datetime.now(timezone.utc)

    for job_posting_id in deduplicated_job_ids:
        if job_posting_id in existing_application_job_ids:
            skipped_details.append(
                {
                    "job_posting_id": str(job_posting_id),
                    "reason": "already_applied_or_saved",
                }
            )
            continue

        if not can_auto_apply:
            skipped_details.append(
                {
                    "job_posting_id": str(job_posting_id),
                    "reason": non_apply_reason or "not_eligible_for_auto_apply",
                }
            )
            continue

        if remaining_daily_capacity <= 0:
            skipped_details.append(
                {
                    "job_posting_id": str(job_posting_id),
                    "reason": "daily_limit_reached",
                }
            )
            continue

        duplicate_guard_result = await db.execute(
            select(Application.id).where(
                Application.user_id == current_user.id,
                Application.job_posting_id == job_posting_id,
            )
        )
        if duplicate_guard_result.scalar_one_or_none() is not None:
            skipped_details.append(
                {
                    "job_posting_id": str(job_posting_id),
                    "reason": "already_applied_or_saved",
                }
            )
            continue

        application = Application(
            user_id=current_user.id,
            job_posting_id=job_posting_id,
            resume_version_id=default_resume_id,
            status=ApplicationStatusEnum.applied,
            applied_at=now_utc,
            source="automation",
            notes="Created by automation pipeline run",
        )
        db.add(application)
        await db.flush()
        await db.refresh(application)

        existing_application_job_ids.add(job_posting_id)
        created_application_ids.append(str(application.id))
        applied_jobs_count += 1
        remaining_daily_capacity -= 1

    skipped_jobs_count = len(skipped_details)

    run.status = "completed"
    run.matched_jobs_count = matched_jobs_count
    run.reviewed_jobs_count = reviewed_jobs_count
    run.applied_jobs_count = applied_jobs_count
    run.skipped_jobs_count = skipped_jobs_count
    run.finished_at = datetime.now(timezone.utc)
    run.summary = {
        "dry_run": payload.dry_run,
        "settings_enabled": settings.enabled,
        "auto_apply_enabled": settings.auto_apply_enabled,
        "require_human_review": settings.require_human_review,
        "daily_applied_before_run": today_applied,
        "daily_capacity_remaining": remaining_daily_capacity,
        "eligible_match_threshold": settings.min_match_score,
        "evaluated_match_ids": [str(match.id) for match in matched_jobs],
        "candidate_job_posting_ids": [str(job_id) for job_id in deduplicated_job_ids],
        "created_application_ids": created_application_ids,
        "skipped": skipped_details,
    }

    await db.flush()
    await db.refresh(run)
    return run


@router.get("/runs", response_model=AutomationRunListResponse)
async def list_runs(
    limit: int = 20,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    bounded_limit = min(max(limit, 1), 100)

    total_result = await db.execute(
        select(func.count(AutomationPipelineRun.id)).where(
            AutomationPipelineRun.user_id == current_user.id
        )
    )
    total = int(total_result.scalar_one() or 0)

    runs_result = await db.execute(
        select(AutomationPipelineRun)
        .where(AutomationPipelineRun.user_id == current_user.id)
        .order_by(AutomationPipelineRun.started_at.desc())
        .limit(bounded_limit)
    )
    runs = list(runs_result.scalars().all())
    serialized_runs = [
        AutomationRunResponse.model_validate(run).model_dump(mode="json") for run in runs
    ]

    return {"items": serialized_runs, "total": total}
