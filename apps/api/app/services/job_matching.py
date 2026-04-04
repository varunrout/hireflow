"""Job matching engine — scores job postings against a candidate profile."""
from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import datetime, timezone

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.models import (
    CandidatePreference,
    CandidateProfile,
    Education,
    JobMatch,
    JobParseResult,
    JobPosting,
    Skill,
    WorkExperience,
)


@dataclass(slots=True)
class MatchScores:
    overall_score: float
    skill_score: float
    experience_score: float
    education_score: float
    location_score: float
    salary_score: float
    matching_skills: list[str]
    missing_skills: list[str]
    disqualifiers: list[str]
    recommendation: str
    explanation: str


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_EDUCATION_RANK = {
    "bachelor": 1,
    "bachelor's": 1,
    "bachelor's degree": 1,
    "master": 2,
    "master's": 2,
    "master's degree": 2,
    "mba": 2,
    "phd": 3,
    "doctorate": 3,
}


def _normalise(text: str) -> str:
    return text.strip().lower().replace("-", " ").replace("_", " ")


def _education_level(text: str | None) -> int:
    if not text:
        return 0
    normed = _normalise(text)
    for keyword, level in _EDUCATION_RANK.items():
        if keyword in normed:
            return level
    return 0


def _location_matches(job_location: str | None, profile_location: str | None,
                      desired_locations: list[str] | None,
                      remote_type: str | None, remote_pref: str | None) -> float:
    """Return 0.0–1.0 score for location compatibility."""
    # Fully remote jobs always score 1
    if remote_type and _normalise(remote_type) == "remote":
        return 1.0
    # If user wants remote-only and job isn't remote, partial score
    if remote_pref and _normalise(remote_pref) == "remote":
        if remote_type and _normalise(remote_type) == "hybrid":
            return 0.6
        return 0.3

    # No location info → neutral
    if not job_location:
        return 0.7

    normed_job = _normalise(job_location)

    # Check against desired locations
    if desired_locations:
        for loc in desired_locations:
            if _normalise(loc) in normed_job or normed_job in _normalise(loc):
                return 1.0

    # Check against profile location
    if profile_location and _normalise(profile_location) in normed_job:
        return 0.9

    # Unknown or mismatched location → partial
    return 0.5


def _salary_fits(
    job_min: int | None,
    job_max: int | None,
    pref_min: int | None,
    pref_max: int | None,
) -> float:
    """Return 0.0–1.0 for salary compatibility."""
    if job_min is None and job_max is None:
        return 0.7  # neutral, no data
    if pref_min is None and pref_max is None:
        return 0.8  # user doesn't have a pref, slight boost

    job_top = job_max or job_min or 0
    job_bottom = job_min or job_max or 0
    user_min = pref_min or 0
    user_max = pref_max or 999_999_999

    if job_top >= user_min:
        return 1.0
    if job_bottom > 0 and user_min > 0:
        ratio = job_bottom / user_min
        if ratio >= 0.85:
            return 0.7
        return 0.3
    return 0.5


def _title_relevance(headline: str | None, job_title: str | None) -> float:
    """Return 0.0–1.0 for how well the candidate headline matches the job title."""
    if not headline or not job_title:
        return 0.5  # neutral
    h_words = set(_normalise(headline).split())
    j_words = set(_normalise(job_title).split())
    # Remove common stop words
    stop = {"a", "an", "the", "and", "or", "of", "in", "at", "to", "for", "ii", "iii", "iv", "v"}
    h_words -= stop
    j_words -= stop
    if not h_words or not j_words:
        return 0.5
    overlap = h_words & j_words
    # Jaccard-like similarity with bias toward overlap count
    if overlap:
        ratio = len(overlap) / min(len(h_words), len(j_words))
        return min(0.5 + ratio * 0.5, 1.0)
    return 0.3


def _compute_skill_score(
    candidate_skills: set[str],
    required_skills: list[str],
    preferred_skills: list[str],
    job_description: str,
) -> tuple[float, list[str], list[str]]:
    """Compare candidate skills against job requirements.

    Returns (score 0-1, matching_skills, missing_skills).
    """
    if not candidate_skills:
        # No skills on profile — give benefit of doubt if job also has none
        if not required_skills and not preferred_skills:
            return 0.65, [], []
        return 0.3, [], list(required_skills)

    normed_candidate = {_normalise(s) for s in candidate_skills}
    normed_desc = _normalise(job_description)

    matching: list[str] = []
    missing: list[str] = []

    # Score required skills (weighted 70%)
    req_total = len(required_skills) or 1
    req_found = 0
    for skill in required_skills:
        ns = _normalise(skill)
        if ns in normed_candidate or any(ns in cs or cs in ns for cs in normed_candidate):
            req_found += 1
            matching.append(skill)
        else:
            missing.append(skill)
    req_ratio = req_found / req_total

    # Score preferred skills (weighted 30%)
    pref_total = len(preferred_skills) or 1
    pref_found = 0
    for skill in preferred_skills:
        ns = _normalise(skill)
        if ns in normed_candidate or any(ns in cs or cs in ns for cs in normed_candidate):
            pref_found += 1
            if skill not in matching:
                matching.append(skill)
    pref_ratio = pref_found / pref_total

    # If no required/preferred skills extracted, do a keyword scan on the description
    if not required_skills and not preferred_skills:
        desc_hits = sum(1 for s in normed_candidate if s in normed_desc)
        if normed_candidate:
            ratio = min(desc_hits / max(len(normed_candidate), 1), 1.0)
            matching = [s for s in candidate_skills if _normalise(s) in normed_desc]
            # Higher base when job has no parsed skills (can't penalise what we don't know)
            return 0.55 + ratio * 0.4, matching, []
        return 0.55, [], []

    score = req_ratio * 0.7 + pref_ratio * 0.3
    return score, matching, missing


def _experience_score(
    years: int | None,
    required_years: int | None,
) -> float:
    if required_years is None:
        return 0.8  # no info → benefit of doubt
    if years is None:
        return 0.5  # user hasn't filled years
    if years >= required_years:
        return 1.0
    ratio = years / max(required_years, 1)
    if ratio >= 0.7:
        return 0.7
    return max(ratio, 0.2)


def _education_score(candidate_level: int, required_level: int) -> float:
    if required_level == 0:
        return 0.9  # no requirement → benefit of doubt
    if candidate_level >= required_level:
        return 1.0
    if candidate_level == required_level - 1:
        return 0.6
    return 0.3


def _recommendation_from_score(score: float) -> str:
    if score >= 80:
        return "strong_match"
    if score >= 65:
        return "good_match"
    if score >= 50:
        return "potential_match"
    return "weak_match"


def score_job(
    candidate_skills: set[str],
    candidate_years: int | None,
    candidate_education_level: int,
    candidate_location: str | None,
    candidate_headline: str | None,
    pref: CandidatePreference | None,
    job: JobPosting,
    parse: JobParseResult | None,
) -> MatchScores:
    """Score a single job against the candidate profile."""
    required_skills = parse.required_skills if parse else []
    preferred_skills = parse.preferred_skills if parse else []
    required_years = parse.required_experience_years if parse else None
    required_edu = parse.required_education if parse else None

    sk_score, matching, missing = _compute_skill_score(
        candidate_skills, required_skills, preferred_skills, job.description or ""
    )
    exp_score = _experience_score(candidate_years, required_years)
    edu_score = _education_score(
        candidate_education_level,
        _education_level(required_edu),
    )
    raw_remote = job.remote_type
    remote_type_str = raw_remote.value if hasattr(raw_remote, "value") else raw_remote
    loc_score = _location_matches(
        job.location,
        candidate_location,
        pref.desired_locations if pref else None,
        remote_type_str if remote_type_str else None,
        pref.remote_preference if pref else None,
    )
    sal_score = _salary_fits(
        job.salary_min, job.salary_max,
        pref.min_salary if pref else None,
        pref.max_salary if pref else None,
    )
    title_score = _title_relevance(candidate_headline, job.title)

    # Weighted overall: skills 30%, title 10%, experience 25%, education 10%, location 15%, salary 10%
    overall = (
        sk_score * 30
        + title_score * 10
        + exp_score * 25
        + edu_score * 10
        + loc_score * 15
        + sal_score * 10
    )

    disqualifiers: list[str] = []
    if sk_score < 0.15:
        disqualifiers.append("Very few matching skills")
    if exp_score < 0.3:
        disqualifiers.append("Significantly under-qualified on experience")

    recommendation = _recommendation_from_score(overall)

    explanation_parts: list[str] = []
    if matching:
        explanation_parts.append(f"Matching skills: {', '.join(matching[:8])}")
    if missing:
        explanation_parts.append(f"Missing skills: {', '.join(missing[:5])}")
    explanation_parts.append(f"Overall score {overall:.0f}/100")

    return MatchScores(
        overall_score=round(overall, 2),
        skill_score=round(sk_score * 100, 2),
        experience_score=round(exp_score * 100, 2),
        education_score=round(edu_score * 100, 2),
        location_score=round(loc_score * 100, 2),
        salary_score=round(sal_score * 100, 2),
        matching_skills=matching[:20],
        missing_skills=missing[:20],
        disqualifiers=disqualifiers,
        recommendation=recommendation,
        explanation=". ".join(explanation_parts),
    )


# ---------------------------------------------------------------------------
# Public API — run matching for a user
# ---------------------------------------------------------------------------


async def run_matching_for_user(
    user_id: uuid.UUID,
    db: AsyncSession,
    *,
    limit: int = 50,
) -> list[JobMatch]:
    """Score all unmatched job postings for the user and create JobMatch rows.

    Returns the list of newly-created JobMatch records.
    """
    # 1. Load profile with eager relations
    profile_result = await db.execute(
        select(CandidateProfile)
        .where(CandidateProfile.user_id == user_id)
        .options(
            selectinload(CandidateProfile.skills),
            selectinload(CandidateProfile.work_experiences),
            selectinload(CandidateProfile.education),
        )
    )
    profile = profile_result.scalar_one_or_none()
    if not profile:
        return []

    # 2. Load preferences
    pref_result = await db.execute(
        select(CandidatePreference).where(CandidatePreference.user_id == user_id)
    )
    pref = pref_result.scalar_one_or_none()

    # 3. Gather candidate data
    candidate_skills: set[str] = set()
    for skill in profile.skills:
        candidate_skills.add(skill.name)
    # Also add technologies from work experiences
    for we in profile.work_experiences:
        for tech in (we.technologies or []):
            candidate_skills.add(tech)

    candidate_years = profile.years_of_experience

    # Determine max education level from education entries
    candidate_edu_level = 0
    for edu in profile.education:
        level = _education_level(edu.degree)
        if level > candidate_edu_level:
            candidate_edu_level = level

    # 4. Find job postings that haven't been matched yet
    already_matched_result = await db.execute(
        select(JobMatch.job_posting_id).where(JobMatch.user_id == user_id)
    )
    already_matched_ids = set(already_matched_result.scalars().all())

    jobs_query = (
        select(JobPosting)
        .where(
            JobPosting.is_active == True,  # noqa: E712
            or_(JobPosting.user_id == user_id, JobPosting.user_id.is_(None)),
        )
        .options(selectinload(JobPosting.parse_result))
        .order_by(JobPosting.created_at.desc())
        .limit(limit)
    )
    jobs_result = await db.execute(jobs_query)
    all_jobs = list(jobs_result.scalars().all())

    # Filter out already matched
    unmatched_jobs = [j for j in all_jobs if j.id not in already_matched_ids]

    if not unmatched_jobs:
        return []

    # 5. Score each job
    new_matches: list[JobMatch] = []
    now = datetime.now(timezone.utc)

    for job in unmatched_jobs:
        parse = job.parse_result
        scores = score_job(
            candidate_skills=candidate_skills,
            candidate_years=candidate_years,
            candidate_education_level=candidate_edu_level,
            candidate_location=profile.location,
            candidate_headline=profile.headline,
            pref=pref,
            job=job,
            parse=parse,
        )

        match = JobMatch(
            user_id=user_id,
            job_posting_id=job.id,
            profile_id=profile.id,
            overall_score=scores.overall_score,
            skill_score=scores.skill_score,
            experience_score=scores.experience_score,
            education_score=scores.education_score,
            location_score=scores.location_score,
            salary_score=scores.salary_score,
            matching_skills=scores.matching_skills,
            missing_skills=scores.missing_skills,
            disqualifiers=scores.disqualifiers,
            recommendation=scores.recommendation,
            explanation=scores.explanation,
            computed_at=now,
        )
        db.add(match)
        new_matches.append(match)

    await db.flush()
    for m in new_matches:
        await db.refresh(m)

    return new_matches
