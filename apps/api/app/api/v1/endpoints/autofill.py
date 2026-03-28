"""Autofill suggestion endpoint for the browser extension."""
from __future__ import annotations

import json

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user
from app.core.config import settings
from app.db.session import get_db
from app.models.models import CandidateProfile, User

router = APIRouter(prefix="/autofill", tags=["autofill"])


# ---------------------------------------------------------------------------
# Request / Response schemas
# ---------------------------------------------------------------------------


class DetectedField(BaseModel):
    id: str
    name: str
    label: str
    type: str
    placeholder: str | None = None
    required: bool = False
    currentValue: str | None = None


class AutofillSuggestRequest(BaseModel):
    job_url: str
    fields: list[DetectedField]


class AutofillSuggestion(BaseModel):
    field_id: str
    suggested_value: str
    confidence: float
    source: str  # "profile" | "ai"


class AutofillSuggestResponse(BaseModel):
    suggestions: list[AutofillSuggestion]
    fields_detected: int
    fields_filled: int


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------


@router.post("/suggest", response_model=AutofillSuggestResponse)
async def suggest_autofill(
    payload: AutofillSuggestRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AutofillSuggestResponse:
    result = await db.execute(
        select(CandidateProfile)
        .where(CandidateProfile.user_id == current_user.id)
        .options(
            selectinload(CandidateProfile.work_experiences),
            selectinload(CandidateProfile.education),
            selectinload(CandidateProfile.skills),
        )
    )
    profile = result.scalar_one_or_none()

    profile_context = _build_profile_context(current_user, profile)

    # Step 1: fast heuristic fill (no API call, deterministic)
    suggestions = _heuristic_fill(payload.fields, profile_context)
    filled_ids = {s.field_id for s in suggestions}

    # Step 2: AI fill for remaining fields (cover letter, behavioral, etc.)
    unfilled = [f for f in payload.fields if f.id not in filled_ids]
    if unfilled and settings.OPENAI_API_KEY:
        try:
            ai_suggestions = await _ai_fill(unfilled, profile_context, payload.job_url)
            suggestions.extend(ai_suggestions)
        except Exception:
            pass  # graceful degradation — return heuristic suggestions only

    return AutofillSuggestResponse(
        suggestions=suggestions,
        fields_detected=len(payload.fields),
        fields_filled=len(suggestions),
    )


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _build_profile_context(user: User, profile: CandidateProfile | None) -> dict:
    return {
        "name": user.full_name,
        "email": user.email,
        "phone": profile.phone if profile else None,
        "location": profile.location if profile else None,
        "headline": profile.headline if profile else None,
        "summary": profile.summary if profile else None,
        "linkedin_url": profile.linkedin_url if profile else None,
        "github_url": profile.github_url if profile else None,
        "website_url": profile.website_url if profile else None,
        "years_of_experience": profile.years_of_experience if profile else None,
        "skills": [s.name for s in profile.skills] if profile else [],
        "work_experiences": [
            {
                "company": w.company,
                "title": w.title,
                "start_date": w.start_date,
                "end_date": "Present" if w.is_current else w.end_date,
                "description": w.description,
            }
            for w in (profile.work_experiences if profile else [])
        ],
        "education": [
            {
                "institution": e.institution,
                "degree": e.degree,
                "field_of_study": e.field_of_study,
                "end_date": e.end_date,
            }
            for e in (profile.education if profile else [])
        ],
    }


def _heuristic_fill(
    fields: list[DetectedField], profile: dict
) -> list[AutofillSuggestion]:
    """Rule-based fill for well-known fields — fast, no API cost."""
    suggestions: list[AutofillSuggestion] = []

    for field in fields:
        hint = (
            field.label.lower()
            + " "
            + field.name.lower()
            + " "
            + (field.placeholder or "").lower()
        )

        value: str | None = None

        if any(k in hint for k in ["first name", "firstname", "given name"]):
            parts = (profile.get("name") or "").split()
            value = parts[0] if parts else None
        elif any(k in hint for k in ["last name", "lastname", "surname", "family name"]):
            parts = (profile.get("name") or "").split()
            value = " ".join(parts[1:]) if len(parts) > 1 else None
        elif "email" in hint:
            value = profile.get("email")
        elif any(k in hint for k in ["phone", "mobile", "tel"]):
            value = profile.get("phone")
        elif any(k in hint for k in ["city", "location", "address"]) and "company" not in hint:
            value = profile.get("location")
        elif "linkedin" in hint:
            value = profile.get("linkedin_url")
        elif "github" in hint:
            value = profile.get("github_url")
        elif any(k in hint for k in ["website", "portfolio", "personal url"]):
            value = profile.get("website_url")
        elif any(k in hint for k in ["headline", "current role", "current title"]):
            value = profile.get("headline")
        elif "years" in hint and "experience" in hint:
            yoe = profile.get("years_of_experience")
            value = str(yoe) if yoe is not None else None
        elif any(k in hint for k in ["full name", "your name"]) and "company" not in hint:
            value = profile.get("name")

        if value:
            suggestions.append(
                AutofillSuggestion(
                    field_id=field.id,
                    suggested_value=value,
                    confidence=0.95,
                    source="profile",
                )
            )

    return suggestions


async def _ai_fill(
    fields: list[DetectedField],
    profile: dict,
    job_url: str,
) -> list[AutofillSuggestion]:
    """Use OpenAI to answer behavioral, cover letter, and open-ended fields."""
    from openai import AsyncOpenAI

    client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

    field_lines = "\n".join(
        f"- id={f.id!r} | label={f.label!r} | type={f.type} | required={f.required}"
        for f in fields
    )

    prompt = f"""You are a professional job application assistant. Fill in the application form fields below using the candidate's profile.

Candidate profile:
{json.dumps(profile, indent=2)}

Job URL: {job_url}

Fields to fill:
{field_lines}

Return ONLY a JSON array (no markdown, no explanation) like:
[{{"field_id": "...", "suggested_value": "...", "confidence": 0.85, "source": "ai"}}]

Guidelines:
- cover_letter / motivation / why us → write 2–3 compelling paragraphs (250–350 words) drawing on the candidate's experience
- "Tell us about yourself" → concise 120-word professional summary
- salary / compensation → omit (set confidence to 0 and skip)
- Fields you cannot answer confidently → omit entirely
- Do NOT wrap output in a code block"""

    response = await client.chat.completions.create(
        model=settings.OPENAI_FAST_MODEL,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.3,
        max_tokens=2000,
    )

    raw = (response.choices[0].message.content or "").strip()
    data: list[dict] = json.loads(raw)

    return [
        AutofillSuggestion(
            field_id=item["field_id"],
            suggested_value=item["suggested_value"],
            confidence=float(item.get("confidence", 0.7)),
            source="ai",
        )
        for item in data
        if float(item.get("confidence", 0)) > 0 and item.get("suggested_value")
    ]
