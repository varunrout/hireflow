"""Automation pipeline configuration, scheduling, approval-queue, analytics endpoints."""
from __future__ import annotations

import time
from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import case, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.models import (
    Application,
    ApplicationStatusEnum,
    AutomationApprovalQueueItem,
    AutomationNotification,
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
    ApprovalBatchDecisionRequest,
    ApprovalDecisionRequest,
    ApprovalQueueItemResponse,
    ApprovalQueueListResponse,
    AutomationAnalyticsResponse,
    AutomationPipelineSettingsResponse,
    AutomationPipelineSettingsUpdate,
    AutomationReadinessResponse,
    AutomationRunListResponse,
    AutomationRunRequest,
    AutomationRunResponse,
    NotificationListResponse,
    NotificationResponse,
    ScheduleInfoResponse,
    SchedulePreset,
)
from app.services.job_matching import run_matching_for_user
from app.services.external_jobs import ExternalJobSearchService
from app.services.job_ai import JobExtractionService

router = APIRouter(prefix="/automation", tags=["automation"])

DEFAULT_ALLOWED_SOURCES = ["linkedin", "indeed", "greenhouse", "lever", "workday"]

SCHEDULE_PRESETS: list[dict] = [
    {"label": "Every 6 hours", "cron": "0 */6 * * *", "description": "Run 4 times a day"},
    {"label": "Every 12 hours", "cron": "0 */12 * * *", "description": "Run twice a day"},
    {"label": "Daily (9 AM)", "cron": "0 9 * * *", "description": "Run once daily at 9 AM"},
    {"label": "Weekdays (9 AM)", "cron": "0 9 * * 1-5", "description": "Mon-Fri at 9 AM"},
    {"label": "Twice a week", "cron": "0 9 * * 1,4", "description": "Monday and Thursday at 9 AM"},
    {"label": "Weekly (Monday)", "cron": "0 9 * * 1", "description": "Every Monday at 9 AM"},
]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


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
        "schedule_enabled": False,
        "schedule_cron": None,
        "schedule_timezone": "UTC",
        "schedule_paused": False,
        "run_window_start": None,
        "run_window_end": None,
        "freshness_days": 30,
        "company_blacklist": [],
        "company_whitelist": [],
        "min_salary_floor": None,
        "experience_levels": [],
        "employment_types": [],
        "target_industries": [],
        "excluded_industries": [],
        "confidence_auto_apply_threshold": 90.0,
        "confidence_review_threshold": 75.0,
        "confidence_save_threshold": 65.0,
        "persona_id": None,
        "email_digest_enabled": False,
        "email_digest_frequency": "weekly",
        "high_match_alert_enabled": False,
        "high_match_alert_threshold": 90.0,
    }


async def _get_or_create_settings(
    user_id: UUID, db: AsyncSession
) -> AutomationPipelineSettings:
    result = await db.execute(
        select(AutomationPipelineSettings).where(
            AutomationPipelineSettings.user_id == user_id
        )
    )
    settings = result.scalar_one_or_none()
    if settings:
        return settings

    settings = AutomationPipelineSettings(
        user_id=user_id, **_default_settings_payload()
    )
    db.add(settings)
    await db.flush()
    await db.refresh(settings)
    return settings


async def _count_today_applied(user_id: UUID, db: AsyncSession) -> int:
    today = datetime.now(timezone.utc).date()
    result = await db.execute(
        select(func.count(Application.id)).where(
            Application.user_id == user_id,
            Application.applied_at.is_not(None),
            func.date(Application.applied_at) == today,
        )
    )
    return int(result.scalar_one() or 0)


def _compute_profile_completeness(
    profile: CandidateProfile | None,
) -> tuple[float, dict]:
    """Return (0-100 score, breakdown dict)."""
    if profile is None:
        return 0.0, {}

    fields = {
        "headline": bool(profile.headline),
        "summary": bool(profile.summary),
        "phone": bool(profile.phone),
        "location": bool(profile.location),
        "linkedin_url": bool(profile.linkedin_url),
        "years_of_experience": profile.years_of_experience is not None,
        "work_experience": len(getattr(profile, "work_experiences", []) or []) > 0,
        "education": len(getattr(profile, "education", []) or []) > 0,
        "skills": len(getattr(profile, "skills", []) or []) > 0,
    }
    filled = sum(1 for v in fields.values() if v)
    score = round((filled / len(fields)) * 100, 1) if fields else 0.0
    return score, fields


async def _create_notification(
    db: AsyncSession,
    user_id: UUID,
    ntype: str,
    title: str,
    message: str,
    data: dict | None = None,
) -> AutomationNotification:
    notif = AutomationNotification(
        user_id=user_id,
        type=ntype,
        title=title,
        message=message,
        data=data or {},
    )
    db.add(notif)
    await db.flush()
    return notif


# ---------------------------------------------------------------------------
# Settings
# ---------------------------------------------------------------------------


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


# ---------------------------------------------------------------------------
# Readiness (enhanced with profile completeness, data quality, skill coverage)
# ---------------------------------------------------------------------------


@router.get("/readiness", response_model=AutomationReadinessResponse)
async def get_readiness(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AutomationReadinessResponse:
    settings = await _get_or_create_settings(current_user.id, db)

    # Load profile with relationships for completeness check
    profile_result = await db.execute(
        select(CandidateProfile)
        .options(
            selectinload(CandidateProfile.work_experiences),
            selectinload(CandidateProfile.education),
            selectinload(CandidateProfile.skills),
        )
        .where(CandidateProfile.user_id == current_user.id)
    )
    profile = profile_result.scalar_one_or_none()

    preferences_result = await db.execute(
        select(CandidatePreference.id).where(
            CandidatePreference.user_id == current_user.id
        )
    )
    resume_count_result = await db.execute(
        select(func.count(ResumeVersion.id)).where(
            ResumeVersion.user_id == current_user.id
        )
    )
    saved_job_count_result = await db.execute(select(func.count(JobPosting.id)))
    application_count_result = await db.execute(
        select(func.count(Application.id)).where(
            Application.user_id == current_user.id
        )
    )
    job_match_count_result = await db.execute(
        select(func.count(JobMatch.id)).where(JobMatch.user_id == current_user.id)
    )

    has_profile = profile is not None
    has_preferences = preferences_result.scalar_one_or_none() is not None
    resume_count = int(resume_count_result.scalar_one() or 0)
    saved_job_count = int(saved_job_count_result.scalar_one() or 0)
    application_count = int(application_count_result.scalar_one() or 0)
    job_match_count = int(job_match_count_result.scalar_one() or 0)

    # Profile completeness
    completeness_score, completeness_breakdown = _compute_profile_completeness(
        profile
    )

    # Data quality warnings
    data_quality_warnings: list[str] = []
    if profile:
        skills = getattr(profile, "skills", []) or []
        if len(skills) < 5:
            data_quality_warnings.append(
                f"You have only {len(skills)} skill(s). Add more for better matching."
            )
        work_exp = getattr(profile, "work_experiences", []) or []
        if len(work_exp) == 0:
            data_quality_warnings.append(
                "No work experience entries. Add experience to improve match quality."
            )
        if not profile.headline:
            data_quality_warnings.append(
                "Missing headline. A headline improves target-role matching."
            )

    # Skill coverage
    skill_coverage = 0.0
    if profile and has_profile:
        user_skills = {
            s.name.lower() for s in (getattr(profile, "skills", []) or [])
        }
        if user_skills:
            recent_match_result = await db.execute(
                select(JobMatch.missing_skills)
                .where(JobMatch.user_id == current_user.id)
                .order_by(JobMatch.computed_at.desc())
                .limit(10)
            )
            all_missing: set[str] = set()
            for row in recent_match_result:
                if row[0]:
                    all_missing.update(s.lower() for s in row[0])
            total_required = len(user_skills) + len(all_missing)
            if total_required > 0:
                skill_coverage = round(
                    (len(user_skills) / total_required) * 100, 1
                )

    # Resume quality — simple heuristic
    resume_quality_score = min(100.0, resume_count * 33.3) if resume_count > 0 else 0.0

    blockers: list[str] = []
    suggestions: list[str] = []

    if not has_profile:
        blockers.append("Create your profile before running job matching.")
    if not has_preferences:
        blockers.append(
            "Add candidate preferences so the pipeline knows what to target."
        )
    if resume_count == 0:
        blockers.append(
            "Create at least one resume version before enabling auto-apply."
        )
    if len(settings.search_terms) == 0:
        suggestions.append(
            "Add search terms to focus discovery on the roles you want most."
        )
    if len(settings.target_locations) == 0:
        suggestions.append(
            "Add target locations to make automated search more precise."
        )
    if not settings.enabled:
        suggestions.append(
            "Enable the pipeline when you are ready to start running discovery and matching."
        )
    if settings.auto_apply_enabled and settings.require_human_review:
        suggestions.append(
            "Auto-apply is enabled with human review. "
            "Submissions will go to the approval queue first."
        )
    if completeness_score < 70:
        suggestions.append(
            f"Profile completeness is {completeness_score:.0f}%. "
            "Fill in missing fields to improve match quality."
        )

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
        profile_completeness=completeness_score,
        profile_completeness_breakdown=completeness_breakdown,
        data_quality_warnings=data_quality_warnings,
        skill_coverage=skill_coverage,
        resume_quality_score=resume_quality_score,
    )


# ---------------------------------------------------------------------------
# Pipeline run (enhanced with confidence tiers + approval queue)
# ---------------------------------------------------------------------------


@router.post("/runs", response_model=AutomationRunResponse)
async def run_pipeline_now(
    payload: AutomationRunRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AutomationPipelineRun:
    settings = await _get_or_create_settings(current_user.id, db)

    # Allow run-level overrides
    min_score = (
        payload.override_min_score
        if payload.override_min_score is not None
        else settings.min_match_score
    )
    max_jobs = (
        payload.override_max_jobs
        if payload.override_max_jobs is not None
        else settings.max_jobs_per_run
    )

    run = AutomationPipelineRun(
        user_id=current_user.id,
        triggered_by="manual",
        status="running",
        summary={"dry_run": payload.dry_run},
    )
    db.add(run)
    await db.flush()

    t_start = time.monotonic()

    # ── Step 0: Discover new jobs from external APIs ──
    discovered_job_count = 0
    if settings.search_terms:
        try:
            search_svc = ExternalJobSearchService()
            extraction_svc = JobExtractionService()

            # Collect existing source_job_ids to avoid duplicate imports
            existing_source_ids_result = await db.execute(
                select(JobPosting.source_job_id).where(
                    JobPosting.user_id == current_user.id,
                    JobPosting.source_job_id.is_not(None),
                )
            )
            existing_source_ids: set[str] = {
                str(sid) for sid in existing_source_ids_result.scalars().all() if sid
            }

            # Search each term against external providers
            per_term_limit = max(max_jobs // len(settings.search_terms), 5)
            all_external_items: list[dict] = []
            for term in settings.search_terms[:5]:  # cap to 5 terms
                loc = settings.target_locations[0] if settings.target_locations else None
                try:
                    items = await search_svc.search_jobs(
                        role=term, location=loc, remote_only=False, limit=per_term_limit,
                    )
                    all_external_items.extend(items)
                except Exception:
                    continue  # skip failed providers, don't kill the run

            # Deduplicate and import
            seen_source_ids: set[str] = set()
            for item in all_external_items:
                sid = item.get("source_job_id")
                if sid and (sid in existing_source_ids or sid in seen_source_ids):
                    continue
                if sid:
                    seen_source_ids.add(sid)

                # Quick import — create JobPosting + parse via heuristics
                try:
                    extraction = await extraction_svc.extract_job(
                        item.get("description") or "",
                        source_url=item.get("source_url"),
                    )
                    source_val = item.get("source", "other")
                    valid_sources = {
                        "linkedin", "indeed", "glassdoor", "greenhouse",
                        "lever", "workday", "manual", "other",
                    }
                    job = JobPosting(
                        title=item.get("title") or "Untitled",
                        company=item.get("company") or "Unknown",
                        location=item.get("location"),
                        remote_type=item.get("remote_type"),
                        employment_type=item.get("employment_type"),
                        description=item.get("description") or "",
                        requirements=item.get("requirements") or extraction.job.get("requirements", []),
                        nice_to_haves=item.get("nice_to_haves") or extraction.job.get("nice_to_haves", []),
                        source=source_val if source_val in valid_sources else "other",
                        source_url=item.get("source_url"),
                        source_job_id=sid,
                        user_id=current_user.id,
                    )
                    db.add(job)
                    await db.flush()

                    from app.models.models import JobParseResult as JPR
                    parse_result = JPR(
                        job_posting_id=job.id,
                        parser_version=extraction.extraction_method,
                        raw_output={"job": extraction.job, "parse_result": extraction.parse_result},
                        **extraction.parse_result,
                    )
                    db.add(parse_result)
                    await db.flush()
                    discovered_job_count += 1
                except Exception:
                    continue  # skip individual failed imports
        except Exception:
            pass  # discovery failure should not block the rest of the pipeline

    # ── Step 1: Run job matching ──
    t_score_start = time.monotonic()
    new_matches = await run_matching_for_user(
        current_user.id,
        db,
        limit=max_jobs * 2,
    )
    scoring_duration_ms = int((time.monotonic() - t_score_start) * 1000)
    newly_matched_count = len(new_matches)

    # ── Step 2: Retrieve matches above save threshold, apply discovery filters ──
    save_threshold = settings.confidence_save_threshold
    match_query = (
        select(JobMatch)
        .join(JobPosting, JobMatch.job_posting_id == JobPosting.id)
        .where(
            JobMatch.user_id == current_user.id,
            JobMatch.overall_score >= save_threshold,
        )
    )

    # Freshness filter
    if settings.freshness_days and settings.freshness_days > 0:
        cutoff = datetime.now(timezone.utc) - timedelta(days=settings.freshness_days)
        match_query = match_query.where(JobPosting.created_at >= cutoff)

    # Company filters
    if settings.company_blacklist:
        bl = [c.lower() for c in settings.company_blacklist]
        match_query = match_query.where(
            func.lower(JobPosting.company).notin_(bl)
        )
    if settings.company_whitelist:
        wl = [c.lower() for c in settings.company_whitelist]
        match_query = match_query.where(func.lower(JobPosting.company).in_(wl))

    # Salary floor
    if settings.min_salary_floor:
        match_query = match_query.where(
            (JobPosting.salary_max >= settings.min_salary_floor)
            | (JobPosting.salary_max.is_(None))
        )

    match_query = (
        match_query.order_by(JobMatch.overall_score.desc()).limit(max_jobs)
    )

    match_result = await db.execute(match_query)
    matched_jobs = list(match_result.scalars().all())

    # Deduplicate by job_posting_id
    deduplicated: list[JobMatch] = []
    seen_job_ids: set[UUID] = set()
    for match in matched_jobs:
        if match.job_posting_id in seen_job_ids:
            continue
        seen_job_ids.add(match.job_posting_id)
        deduplicated.append(match)

    # Build a lookup of job posting info for readable summaries
    job_info_map: dict[UUID, dict] = {}
    if seen_job_ids:
        jp_result = await db.execute(
            select(JobPosting.id, JobPosting.title, JobPosting.company, JobPosting.location)
            .where(JobPosting.id.in_(seen_job_ids))
        )
        for row in jp_result:
            job_info_map[row[0]] = {
                "title": row[1] or "Untitled",
                "company": row[2] or "Unknown",
                "location": row[3],
            }

    jobs_evaluated = len(matched_jobs)

    # ── Step 3: Classify into confidence tiers ──
    auto_apply_tier: list[JobMatch] = []
    review_tier: list[JobMatch] = []
    save_tier: list[JobMatch] = []

    for match in deduplicated:
        score = match.overall_score
        if score >= settings.confidence_auto_apply_threshold:
            auto_apply_tier.append(match)
        elif score >= settings.confidence_review_threshold:
            review_tier.append(match)
        else:
            save_tier.append(match)

    matched_jobs_count = len(deduplicated)

    # ── Step 4: Process each tier ──
    applied_jobs_count = 0
    skipped_details: list[dict] = []
    created_application_ids: list[str] = []
    queued_for_review_count = 0

    today_applied = await _count_today_applied(current_user.id, db)
    remaining_daily_capacity = max(
        settings.max_applications_per_day - today_applied, 0
    )

    can_auto_apply = (
        settings.enabled and settings.auto_apply_enabled and not payload.dry_run
    )

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

    # Get existing applications to avoid duplicates
    all_job_ids = [m.job_posting_id for m in deduplicated]
    existing_application_job_ids: set[UUID] = set()
    if all_job_ids:
        existing_result = await db.execute(
            select(Application.job_posting_id).where(
                Application.user_id == current_user.id,
                Application.job_posting_id.in_(all_job_ids),
            )
        )
        existing_application_job_ids = set(existing_result.scalars().all())

    # Get existing queue items to avoid re-queueing
    existing_queue_job_ids: set[UUID] = set()
    if all_job_ids:
        eq_result = await db.execute(
            select(AutomationApprovalQueueItem.job_posting_id).where(
                AutomationApprovalQueueItem.user_id == current_user.id,
                AutomationApprovalQueueItem.job_posting_id.in_(all_job_ids),
                AutomationApprovalQueueItem.status == "pending",
            )
        )
        existing_queue_job_ids = set(eq_result.scalars().all())

    now_utc = datetime.now(timezone.utc)

    # 4a: Auto-apply tier
    for match in auto_apply_tier:
        jpid = match.job_posting_id
        if jpid in existing_application_job_ids:
            skipped_details.append(
                {
                    "job_posting_id": str(jpid),
                    "reason": "already_applied",
                    "tier": "auto_apply",
                }
            )
            continue

        if can_auto_apply and not settings.require_human_review:
            if remaining_daily_capacity <= 0:
                skipped_details.append(
                    {
                        "job_posting_id": str(jpid),
                        "reason": "daily_limit_reached",
                        "tier": "auto_apply",
                    }
                )
                continue
            app = Application(
                user_id=current_user.id,
                job_posting_id=jpid,
                resume_version_id=default_resume_id,
                status=ApplicationStatusEnum.applied,
                applied_at=now_utc,
                source="automation",
                notes=f"Auto-applied by pipeline (score: {match.overall_score:.1f})",
            )
            db.add(app)
            await db.flush()
            await db.refresh(app)
            existing_application_job_ids.add(jpid)
            created_application_ids.append(str(app.id))
            applied_jobs_count += 1
            remaining_daily_capacity -= 1
            continue

        # Needs human review — add to approval queue
        if jpid not in existing_queue_job_ids and not payload.dry_run:
            queue_item = AutomationApprovalQueueItem(
                user_id=current_user.id,
                job_posting_id=jpid,
                job_match_id=match.id,
                pipeline_run_id=run.id,
                status="pending",
                score=match.overall_score,
                recommendation="auto_apply",
                expires_at=now_utc + timedelta(days=7),
            )
            db.add(queue_item)
            existing_queue_job_ids.add(jpid)
            queued_for_review_count += 1
        elif payload.dry_run:
            skipped_details.append(
                {
                    "job_posting_id": str(jpid),
                    "reason": "dry_run",
                    "tier": "auto_apply",
                }
            )

    # 4b: Review tier — always queue for review
    for match in review_tier:
        jpid = match.job_posting_id
        if jpid in existing_application_job_ids:
            skipped_details.append(
                {
                    "job_posting_id": str(jpid),
                    "reason": "already_applied",
                    "tier": "review",
                }
            )
            continue
        if jpid in existing_queue_job_ids:
            skipped_details.append(
                {
                    "job_posting_id": str(jpid),
                    "reason": "already_queued",
                    "tier": "review",
                }
            )
            continue
        if not payload.dry_run:
            queue_item = AutomationApprovalQueueItem(
                user_id=current_user.id,
                job_posting_id=jpid,
                job_match_id=match.id,
                pipeline_run_id=run.id,
                status="pending",
                score=match.overall_score,
                recommendation="review",
                expires_at=now_utc + timedelta(days=7),
            )
            db.add(queue_item)
            existing_queue_job_ids.add(jpid)
            queued_for_review_count += 1
        else:
            skipped_details.append(
                {
                    "job_posting_id": str(jpid),
                    "reason": "dry_run_review",
                    "tier": "review",
                }
            )

    # 4c: Save tier — just record, don't queue
    for match in save_tier:
        jpid = match.job_posting_id
        if jpid in existing_application_job_ids:
            skipped_details.append(
                {
                    "job_posting_id": str(jpid),
                    "reason": "already_applied",
                    "tier": "save",
                }
            )
            continue
        skipped_details.append(
            {
                "job_posting_id": str(jpid),
                "reason": "below_review_threshold",
                "tier": "save",
                "score": round(match.overall_score, 1),
            }
        )

    skipped_jobs_count = len(skipped_details)

    # Enrich skipped details with job info
    for entry in skipped_details:
        jpid_str = entry.get("job_posting_id")
        if jpid_str:
            try:
                jpid = UUID(jpid_str)
                info = job_info_map.get(jpid, {})
                entry["job_title"] = info.get("title", "Untitled")
                entry["job_company"] = info.get("company", "Unknown")
            except (ValueError, AttributeError):
                pass

    reviewed_jobs_count = len(review_tier) + len(auto_apply_tier)
    total_duration_ms = int((time.monotonic() - t_start) * 1000)

    # Build score distribution
    score_ranges = {
        "90-100": 0,
        "80-89": 0,
        "70-79": 0,
        "60-69": 0,
        "below_60": 0,
    }
    for match in deduplicated:
        s = match.overall_score
        if s >= 90:
            score_ranges["90-100"] += 1
        elif s >= 80:
            score_ranges["80-89"] += 1
        elif s >= 70:
            score_ranges["70-79"] += 1
        elif s >= 60:
            score_ranges["60-69"] += 1
        else:
            score_ranges["below_60"] += 1

    run.status = "completed"
    run.matched_jobs_count = matched_jobs_count
    run.reviewed_jobs_count = reviewed_jobs_count
    run.applied_jobs_count = applied_jobs_count
    run.skipped_jobs_count = skipped_jobs_count
    run.queued_for_review_count = queued_for_review_count
    run.jobs_evaluated = jobs_evaluated
    run.new_matches_count = newly_matched_count
    run.scoring_duration_ms = scoring_duration_ms
    run.total_duration_ms = total_duration_ms
    run.finished_at = datetime.now(timezone.utc)
    run.summary = {
        "dry_run": payload.dry_run,
        "newly_matched_jobs": newly_matched_count,
        "discovered_from_external": discovered_job_count,
        "settings_enabled": settings.enabled,
        "auto_apply_enabled": settings.auto_apply_enabled,
        "require_human_review": settings.require_human_review,
        "daily_applied_before_run": today_applied,
        "daily_capacity_remaining": remaining_daily_capacity,
        "eligible_match_threshold": settings.min_match_score,
        "confidence_tiers": {
            "auto_apply": len(auto_apply_tier),
            "review": len(review_tier),
            "save": len(save_tier),
        },
        "score_distribution": score_ranges,
        "matched_job_details": [
            {
                "match_id": str(m.id),
                "job_posting_id": str(m.job_posting_id),
                "score": round(m.overall_score, 1),
                "title": job_info_map.get(m.job_posting_id, {}).get("title", "Untitled"),
                "company": job_info_map.get(m.job_posting_id, {}).get("company", "Unknown"),
                "location": job_info_map.get(m.job_posting_id, {}).get("location"),
                "tier": (
                    "auto_apply" if m.overall_score >= settings.confidence_auto_apply_threshold
                    else "review" if m.overall_score >= settings.confidence_review_threshold
                    else "save"
                ),
            }
            for m in deduplicated
        ],
        "evaluated_match_ids": [str(m.id) for m in deduplicated],
        "candidate_job_posting_ids": [
            str(m.job_posting_id) for m in deduplicated
        ],
        "created_application_ids": created_application_ids,
        "skipped": skipped_details,
        "timing": {
            "scoring_ms": scoring_duration_ms,
            "total_ms": total_duration_ms,
        },
    }

    await db.flush()
    await db.refresh(run)

    # Create completion notification
    if not payload.dry_run:
        await _create_notification(
            db,
            current_user.id,
            "run_completed",
            "Pipeline run completed",
            f"Matched {matched_jobs_count} jobs, applied to {applied_jobs_count}, "
            f"queued {queued_for_review_count} for review.",
            data={"run_id": str(run.id)},
        )

        # High-match alerts
        if settings.high_match_alert_enabled:
            high_matches = [
                m
                for m in deduplicated
                if m.overall_score >= settings.high_match_alert_threshold
            ]
            if high_matches:
                await _create_notification(
                    db,
                    current_user.id,
                    "high_match",
                    f"{len(high_matches)} high-scoring match(es) found!",
                    f"Found {len(high_matches)} job(s) scoring above "
                    f"{settings.high_match_alert_threshold:.0f}%.",
                    data={"match_ids": [str(m.id) for m in high_matches]},
                )

    return run


# ---------------------------------------------------------------------------
# Run list / detail / controls
# ---------------------------------------------------------------------------


@router.get("/runs", response_model=AutomationRunListResponse)
async def list_runs(
    limit: int = 20,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    bounded_limit = min(max(limit, 1), 100)

    total_result = await db.execute(
        select(func.count(AutomationPipelineRun.id)).where(
            AutomationPipelineRun.user_id == current_user.id,
            AutomationPipelineRun.deleted_at.is_(None),
        )
    )
    total = int(total_result.scalar_one() or 0)

    runs_result = await db.execute(
        select(AutomationPipelineRun)
        .where(
            AutomationPipelineRun.user_id == current_user.id,
            AutomationPipelineRun.deleted_at.is_(None),
        )
        .order_by(AutomationPipelineRun.started_at.desc())
        .limit(bounded_limit)
    )
    runs = list(runs_result.scalars().all())
    serialized_runs = [
        AutomationRunResponse.model_validate(run).model_dump(mode="json")
        for run in runs
    ]

    return {"items": serialized_runs, "total": total}


@router.get("/runs/{run_id}", response_model=AutomationRunResponse)
async def get_run_detail(
    run_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AutomationPipelineRun:
    result = await db.execute(
        select(AutomationPipelineRun).where(
            AutomationPipelineRun.id == run_id,
            AutomationPipelineRun.user_id == current_user.id,
            AutomationPipelineRun.deleted_at.is_(None),
        )
    )
    run = result.scalar_one_or_none()
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    return run


@router.post("/runs/{run_id}/cancel", response_model=AutomationRunResponse)
async def cancel_run(
    run_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AutomationPipelineRun:
    result = await db.execute(
        select(AutomationPipelineRun).where(
            AutomationPipelineRun.id == run_id,
            AutomationPipelineRun.user_id == current_user.id,
        )
    )
    run = result.scalar_one_or_none()
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    if run.status not in ("running", "pending"):
        raise HTTPException(
            status_code=400, detail="Only running or pending runs can be cancelled"
        )
    run.status = "cancelled"
    run.finished_at = datetime.now(timezone.utc)
    run.error_message = "Cancelled by user"
    await db.flush()
    await db.refresh(run)
    return run


@router.post("/runs/{run_id}/retry", response_model=AutomationRunResponse)
async def retry_run(
    run_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AutomationPipelineRun:
    result = await db.execute(
        select(AutomationPipelineRun).where(
            AutomationPipelineRun.id == run_id,
            AutomationPipelineRun.user_id == current_user.id,
        )
    )
    old_run = result.scalar_one_or_none()
    if not old_run:
        raise HTTPException(status_code=404, detail="Run not found")
    if old_run.status not in ("failed", "cancelled"):
        raise HTTPException(
            status_code=400,
            detail="Only failed or cancelled runs can be retried",
        )
    dry_run = (
        old_run.summary.get("dry_run", True) if old_run.summary else True
    )
    request = AutomationRunRequest(dry_run=dry_run)
    return await run_pipeline_now(request, current_user, db)


@router.delete("/runs/{run_id}", status_code=204)
async def delete_run(
    run_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    result = await db.execute(
        select(AutomationPipelineRun).where(
            AutomationPipelineRun.id == run_id,
            AutomationPipelineRun.user_id == current_user.id,
            AutomationPipelineRun.deleted_at.is_(None),
        )
    )
    run = result.scalar_one_or_none()
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    run.deleted_at = datetime.now(timezone.utc)
    await db.flush()


# ---------------------------------------------------------------------------
# Approval queue
# ---------------------------------------------------------------------------


@router.get("/approval-queue", response_model=ApprovalQueueListResponse)
async def list_approval_queue(
    status: str = Query("pending", description="Filter by status"),
    limit: int = 50,
    offset: int = 0,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    bounded_limit = min(max(limit, 1), 100)

    base_where = [AutomationApprovalQueueItem.user_id == current_user.id]
    if status != "all":
        base_where.append(AutomationApprovalQueueItem.status == status)

    total_result = await db.execute(
        select(func.count(AutomationApprovalQueueItem.id)).where(*base_where)
    )
    total = int(total_result.scalar_one() or 0)

    items_result = await db.execute(
        select(AutomationApprovalQueueItem)
        .where(*base_where)
        .order_by(AutomationApprovalQueueItem.score.desc())
        .offset(offset)
        .limit(bounded_limit)
    )
    items = list(items_result.scalars().all())

    # Load job posting info for each item
    job_ids = [item.job_posting_id for item in items]
    job_map: dict[UUID, JobPosting] = {}
    if job_ids:
        jp_result = await db.execute(
            select(JobPosting).where(JobPosting.id.in_(job_ids))
        )
        for jp in jp_result.scalars().all():
            job_map[jp.id] = jp

    serialized: list[dict] = []
    for item in items:
        jp = job_map.get(item.job_posting_id)
        serialized.append(
            {
                "id": item.id,
                "user_id": item.user_id,
                "job_posting_id": item.job_posting_id,
                "job_match_id": item.job_match_id,
                "pipeline_run_id": item.pipeline_run_id,
                "status": item.status,
                "score": item.score,
                "recommendation": item.recommendation,
                "decided_at": item.decided_at,
                "expires_at": item.expires_at,
                "notes": item.notes,
                "created_at": item.created_at,
                "job_title": jp.title if jp else None,
                "job_company": jp.company if jp else None,
                "job_location": jp.location if jp else None,
            }
        )

    return {"items": serialized, "total": total}


@router.post(
    "/approval-queue/{item_id}/decide",
    response_model=ApprovalQueueItemResponse,
)
async def decide_approval(
    item_id: UUID,
    payload: ApprovalDecisionRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    if payload.action not in ("approved", "rejected", "deferred"):
        raise HTTPException(
            status_code=400,
            detail="Action must be approved, rejected, or deferred",
        )

    result = await db.execute(
        select(AutomationApprovalQueueItem).where(
            AutomationApprovalQueueItem.id == item_id,
            AutomationApprovalQueueItem.user_id == current_user.id,
        )
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Queue item not found")

    item.status = payload.action
    item.decided_at = datetime.now(timezone.utc)
    if payload.notes:
        item.notes = payload.notes

    # If approved, create an application
    if payload.action == "approved":
        existing_app = await db.execute(
            select(Application.id).where(
                Application.user_id == current_user.id,
                Application.job_posting_id == item.job_posting_id,
            )
        )
        if existing_app.scalar_one_or_none() is None:
            resume_result = await db.execute(
                select(ResumeVersion.id)
                .where(ResumeVersion.user_id == current_user.id)
                .order_by(ResumeVersion.updated_at.desc())
                .limit(1)
            )
            resume_id = resume_result.scalar_one_or_none()
            app = Application(
                user_id=current_user.id,
                job_posting_id=item.job_posting_id,
                resume_version_id=resume_id,
                status=ApplicationStatusEnum.applied,
                applied_at=datetime.now(timezone.utc),
                source="automation_approval",
                notes=f"Approved from queue (score: {item.score:.1f})",
            )
            db.add(app)

    await db.flush()
    await db.refresh(item)

    jp_result = await db.execute(
        select(JobPosting).where(JobPosting.id == item.job_posting_id)
    )
    jp = jp_result.scalar_one_or_none()

    return {
        "id": item.id,
        "user_id": item.user_id,
        "job_posting_id": item.job_posting_id,
        "job_match_id": item.job_match_id,
        "pipeline_run_id": item.pipeline_run_id,
        "status": item.status,
        "score": item.score,
        "recommendation": item.recommendation,
        "decided_at": item.decided_at,
        "expires_at": item.expires_at,
        "notes": item.notes,
        "created_at": item.created_at,
        "job_title": jp.title if jp else None,
        "job_company": jp.company if jp else None,
        "job_location": jp.location if jp else None,
    }


@router.post("/approval-queue/batch", response_model=ApprovalQueueListResponse)
async def batch_decide(
    payload: ApprovalBatchDecisionRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    if payload.action not in ("approved", "rejected", "deferred"):
        raise HTTPException(
            status_code=400,
            detail="Action must be approved, rejected, or deferred",
        )

    result = await db.execute(
        select(AutomationApprovalQueueItem).where(
            AutomationApprovalQueueItem.id.in_(payload.item_ids),
            AutomationApprovalQueueItem.user_id == current_user.id,
            AutomationApprovalQueueItem.status == "pending",
        )
    )
    items = list(result.scalars().all())

    now_utc = datetime.now(timezone.utc)
    for item in items:
        item.status = payload.action
        item.decided_at = now_utc
        if payload.notes:
            item.notes = payload.notes

        if payload.action == "approved":
            existing_app = await db.execute(
                select(Application.id).where(
                    Application.user_id == current_user.id,
                    Application.job_posting_id == item.job_posting_id,
                )
            )
            if existing_app.scalar_one_or_none() is None:
                resume_result = await db.execute(
                    select(ResumeVersion.id)
                    .where(ResumeVersion.user_id == current_user.id)
                    .order_by(ResumeVersion.updated_at.desc())
                    .limit(1)
                )
                resume_id = resume_result.scalar_one_or_none()
                app = Application(
                    user_id=current_user.id,
                    job_posting_id=item.job_posting_id,
                    resume_version_id=resume_id,
                    status=ApplicationStatusEnum.applied,
                    applied_at=now_utc,
                    source="automation_approval",
                    notes=f"Batch approved (score: {item.score:.1f})",
                )
                db.add(app)

    await db.flush()

    job_ids = [item.job_posting_id for item in items]
    job_map: dict[UUID, JobPosting] = {}
    if job_ids:
        jp_result = await db.execute(
            select(JobPosting).where(JobPosting.id.in_(job_ids))
        )
        for jp in jp_result.scalars().all():
            job_map[jp.id] = jp

    serialized: list[dict] = []
    for item in items:
        await db.refresh(item)
        jp = job_map.get(item.job_posting_id)
        serialized.append(
            {
                "id": item.id,
                "user_id": item.user_id,
                "job_posting_id": item.job_posting_id,
                "job_match_id": item.job_match_id,
                "pipeline_run_id": item.pipeline_run_id,
                "status": item.status,
                "score": item.score,
                "recommendation": item.recommendation,
                "decided_at": item.decided_at,
                "expires_at": item.expires_at,
                "notes": item.notes,
                "created_at": item.created_at,
                "job_title": jp.title if jp else None,
                "job_company": jp.company if jp else None,
                "job_location": jp.location if jp else None,
            }
        )

    return {"items": serialized, "total": len(serialized)}


# ---------------------------------------------------------------------------
# Analytics
# ---------------------------------------------------------------------------


@router.get("/analytics", response_model=AutomationAnalyticsResponse)
async def get_analytics(
    days: int = Query(30, ge=1, le=365),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AutomationAnalyticsResponse:
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    uid = current_user.id

    # Total runs
    total_runs_res = await db.execute(
        select(func.count(AutomationPipelineRun.id)).where(
            AutomationPipelineRun.user_id == uid,
            AutomationPipelineRun.created_at >= cutoff,
        )
    )
    total_runs = int(total_runs_res.scalar_one() or 0)

    # Total matches
    total_matches_res = await db.execute(
        select(func.count(JobMatch.id)).where(
            JobMatch.user_id == uid,
            JobMatch.computed_at >= cutoff,
        )
    )
    total_matches = int(total_matches_res.scalar_one() or 0)

    # Total applications
    total_apps_res = await db.execute(
        select(func.count(Application.id)).where(
            Application.user_id == uid,
            Application.created_at >= cutoff,
        )
    )
    total_applications = int(total_apps_res.scalar_one() or 0)

    # Approval queue stats
    approvals_res = await db.execute(
        select(func.count(AutomationApprovalQueueItem.id)).where(
            AutomationApprovalQueueItem.user_id == uid,
            AutomationApprovalQueueItem.status == "approved",
            AutomationApprovalQueueItem.created_at >= cutoff,
        )
    )
    total_approvals = int(approvals_res.scalar_one() or 0)

    rejections_res = await db.execute(
        select(func.count(AutomationApprovalQueueItem.id)).where(
            AutomationApprovalQueueItem.user_id == uid,
            AutomationApprovalQueueItem.status == "rejected",
            AutomationApprovalQueueItem.created_at >= cutoff,
        )
    )
    total_rejections = int(rejections_res.scalar_one() or 0)

    # Average match score
    avg_score_res = await db.execute(
        select(func.avg(JobMatch.overall_score)).where(
            JobMatch.user_id == uid,
            JobMatch.computed_at >= cutoff,
        )
    )
    avg_match_score = round(float(avg_score_res.scalar_one() or 0), 1)

    # Score distribution
    score_dist_res = await db.execute(
        select(
            case(
                (JobMatch.overall_score >= 90, "90-100"),
                (JobMatch.overall_score >= 80, "80-89"),
                (JobMatch.overall_score >= 70, "70-79"),
                (JobMatch.overall_score >= 60, "60-69"),
                else_="below_60",
            ).label("bucket"),
            func.count(JobMatch.id),
        )
        .where(JobMatch.user_id == uid, JobMatch.computed_at >= cutoff)
        .group_by("bucket")
    )
    score_distribution = {row[0]: row[1] for row in score_dist_res}

    # Match trend (daily)
    trend_days = min(days, 30)
    trend_cutoff = datetime.now(timezone.utc) - timedelta(days=trend_days)
    match_trend_res = await db.execute(
        select(
            func.date(JobMatch.computed_at).label("day"),
            func.count(JobMatch.id),
            func.avg(JobMatch.overall_score),
        )
        .where(
            JobMatch.user_id == uid, JobMatch.computed_at >= trend_cutoff
        )
        .group_by("day")
        .order_by("day")
    )
    match_trend = [
        {
            "date": str(row[0]),
            "count": row[1],
            "avg_score": round(float(row[2] or 0), 1),
        }
        for row in match_trend_res
    ]

    # Top matching companies
    top_companies_res = await db.execute(
        select(
            JobPosting.company,
            func.count(JobMatch.id).label("match_count"),
            func.avg(JobMatch.overall_score).label("avg_score"),
        )
        .join(JobPosting, JobMatch.job_posting_id == JobPosting.id)
        .where(JobMatch.user_id == uid, JobMatch.computed_at >= cutoff)
        .group_by(JobPosting.company)
        .order_by(func.count(JobMatch.id).desc())
        .limit(10)
    )
    top_companies = [
        {
            "company": row[0],
            "match_count": row[1],
            "avg_score": round(float(row[2] or 0), 1),
        }
        for row in top_companies_res
    ]

    # Application funnel
    funnel_res = await db.execute(
        select(Application.status, func.count(Application.id))
        .where(
            Application.user_id == uid, Application.created_at >= cutoff
        )
        .group_by(Application.status)
    )
    application_funnel: dict[str, int] = {}
    for row in funnel_res:
        status_val = row[0]
        if hasattr(status_val, "value"):
            status_val = status_val.value
        application_funnel[str(status_val)] = row[1]

    # Source effectiveness
    source_eff_res = await db.execute(
        select(
            JobPosting.source,
            func.count(JobMatch.id).label("matches"),
            func.avg(JobMatch.overall_score).label("avg_score"),
        )
        .join(JobPosting, JobMatch.job_posting_id == JobPosting.id)
        .where(JobMatch.user_id == uid, JobMatch.computed_at >= cutoff)
        .group_by(JobPosting.source)
        .order_by(func.count(JobMatch.id).desc())
    )
    source_effectiveness = [
        {
            "source": str(row[0]) if row[0] else "unknown",
            "matches": row[1],
            "avg_score": round(float(row[2] or 0), 1),
        }
        for row in source_eff_res
    ]

    # Daily stats (runs + applications)
    daily_stats_res = await db.execute(
        select(
            func.date(AutomationPipelineRun.started_at).label("day"),
            func.count(AutomationPipelineRun.id).label("runs"),
            func.sum(AutomationPipelineRun.applied_jobs_count).label(
                "applied"
            ),
            func.sum(AutomationPipelineRun.matched_jobs_count).label(
                "matched"
            ),
        )
        .where(
            AutomationPipelineRun.user_id == uid,
            AutomationPipelineRun.started_at >= trend_cutoff,
        )
        .group_by("day")
        .order_by("day")
    )
    daily_stats = [
        {
            "date": str(row[0]),
            "runs": row[1],
            "applied": int(row[2] or 0),
            "matched": int(row[3] or 0),
        }
        for row in daily_stats_res
    ]

    return AutomationAnalyticsResponse(
        total_runs=total_runs,
        total_matches=total_matches,
        total_applications=total_applications,
        total_approvals=total_approvals,
        total_rejections=total_rejections,
        avg_match_score=avg_match_score,
        score_distribution=score_distribution,
        match_trend=match_trend,
        top_companies=top_companies,
        application_funnel=application_funnel,
        source_effectiveness=source_effectiveness,
        daily_stats=daily_stats,
    )


# ---------------------------------------------------------------------------
# Schedule
# ---------------------------------------------------------------------------


@router.get("/schedule", response_model=ScheduleInfoResponse)
async def get_schedule(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ScheduleInfoResponse:
    settings = await _get_or_create_settings(current_user.id, db)
    presets = [SchedulePreset(**p) for p in SCHEDULE_PRESETS]
    return ScheduleInfoResponse(
        schedule_enabled=settings.schedule_enabled,
        schedule_cron=settings.schedule_cron,
        schedule_timezone=settings.schedule_timezone,
        schedule_paused=settings.schedule_paused,
        next_scheduled_at=settings.next_scheduled_at,
        presets=presets,
    )


# ---------------------------------------------------------------------------
# Notifications
# ---------------------------------------------------------------------------


@router.get("/notifications", response_model=NotificationListResponse)
async def list_notifications(
    limit: int = 20,
    unread_only: bool = False,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    bounded_limit = min(max(limit, 1), 100)
    base_where = [AutomationNotification.user_id == current_user.id]
    if unread_only:
        base_where.append(AutomationNotification.is_read == False)  # noqa: E712

    total_result = await db.execute(
        select(func.count(AutomationNotification.id)).where(*base_where)
    )
    total = int(total_result.scalar_one() or 0)

    unread_result = await db.execute(
        select(func.count(AutomationNotification.id)).where(
            AutomationNotification.user_id == current_user.id,
            AutomationNotification.is_read == False,  # noqa: E712
        )
    )
    unread_count = int(unread_result.scalar_one() or 0)

    items_result = await db.execute(
        select(AutomationNotification)
        .where(*base_where)
        .order_by(AutomationNotification.created_at.desc())
        .limit(bounded_limit)
    )
    items = list(items_result.scalars().all())

    serialized = [
        NotificationResponse.model_validate(item).model_dump(mode="json")
        for item in items
    ]

    return {"items": serialized, "total": total, "unread_count": unread_count}


@router.post(
    "/notifications/{notification_id}/read",
    response_model=NotificationResponse,
)
async def mark_notification_read(
    notification_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AutomationNotification:
    result = await db.execute(
        select(AutomationNotification).where(
            AutomationNotification.id == notification_id,
            AutomationNotification.user_id == current_user.id,
        )
    )
    notif = result.scalar_one_or_none()
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")
    notif.is_read = True
    await db.flush()
    await db.refresh(notif)
    return notif


@router.post("/notifications/read-all")
async def mark_all_notifications_read(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    await db.execute(
        update(AutomationNotification)
        .where(
            AutomationNotification.user_id == current_user.id,
            AutomationNotification.is_read == False,  # noqa: E712
        )
        .values(is_read=True)
    )
    await db.flush()
    return {"status": "ok"}
