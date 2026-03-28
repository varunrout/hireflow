"""PDF resume parsing: extract text → GPT-4o → structured profile data."""
from __future__ import annotations

import json
import re
from io import BytesIO
from typing import Any

from app.core.config import settings

# ---------------------------------------------------------------------------
# PDF text extraction
# ---------------------------------------------------------------------------


def extract_text_from_pdf(pdf_bytes: bytes) -> str:
    """Extract raw text from PDF bytes using pypdf (pure-Python, no binaries)."""
    try:
        from pypdf import PdfReader  # type: ignore[import]
    except ImportError as exc:
        raise RuntimeError("pypdf not installed — run: pip install pypdf") from exc

    reader = PdfReader(BytesIO(pdf_bytes))
    pages: list[str] = []
    for page in reader.pages:
        text = page.extract_text() or ""
        pages.append(text)

    raw = "\n".join(pages)
    # Collapse excessive whitespace while preserving line breaks
    raw = re.sub(r"[ \t]{2,}", " ", raw)
    raw = re.sub(r"\n{3,}", "\n\n", raw)
    return raw.strip()


# ---------------------------------------------------------------------------
# AI parsing
# ---------------------------------------------------------------------------

_PARSE_SYSTEM = """\
You are an expert resume parser. Extract structured data from the resume text the user provides.
Return ONLY a valid JSON object matching the schema below — no markdown, no extra text.

Schema:
{
  "headline": string | null,
  "summary": string | null,
  "phone": string | null,
  "location": string | null,
  "linkedin_url": string | null,
  "github_url": string | null,
  "website_url": string | null,
  "years_of_experience": integer | null,
  "work_experiences": [
    {
      "company": string,
      "title": string,
      "location": string | null,
      "start_date": string,          // "YYYY-MM" or "YYYY"
      "end_date": string | null,     // null if current
      "is_current": boolean,
      "description": string | null,
      "achievements": [string],
      "technologies": [string]
    }
  ],
  "education": [
    {
      "institution": string,
      "degree": string,
      "field_of_study": string | null,
      "start_date": string,
      "end_date": string | null,
      "gpa": float | null,
      "description": string | null
    }
  ],
  "skills": [
    {
      "name": string,
      "category": "technical" | "soft" | "language" | "tool" | "framework" | "other",
      "proficiency": "beginner" | "intermediate" | "advanced" | "expert" | null
    }
  ],
  "certifications": [
    {
      "name": string,
      "issuer": string,
      "issued_date": string | null,
      "expiry_date": string | null,
      "credential_id": string | null,
      "credential_url": string | null
    }
  ],
  "projects": [
    {
      "name": string,
      "description": string | null,
      "url": string | null,
      "repo_url": string | null,
      "technologies": [string],
      "start_date": string | null,
      "end_date": string | null
    }
  ]
}

Rules:
- Infer years_of_experience from work history if not stated explicitly.
- For start/end dates use "YYYY-MM" when month is known, "YYYY" otherwise.
- Classify skills accurately: Python/JS/SQL → technical, Git/Docker → tool, React/FastAPI → framework, English/French → language, leadership/communication → soft.
- If a field cannot be determined, use null. Never invent data.
"""


async def parse_resume_with_ai(text: str) -> dict[str, Any]:
    """Send extracted resume text to GPT-4o and return structured profile dict."""
    from openai import AsyncOpenAI

    client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

    # Truncate to ~12k chars to stay within token budget (fits ~3k tokens of context)
    truncated = text[:12_000]

    response = await client.chat.completions.create(
        model=settings.OPENAI_DEFAULT_MODEL,
        messages=[
            {"role": "system", "content": _PARSE_SYSTEM},
            {"role": "user", "content": f"Resume text:\n\n{truncated}"},
        ],
        temperature=0,
        response_format={"type": "json_object"},
    )

    raw = response.choices[0].message.content or "{}"
    return json.loads(raw)


# ---------------------------------------------------------------------------
# Profile completeness scoring
# ---------------------------------------------------------------------------


def compute_completeness(profile: Any) -> dict[str, Any]:
    """
    Compute a 0-100 completeness score from a CandidateProfile ORM object.
    Returns score breakdown per section + actionable suggestions.
    """
    sections: dict[str, dict[str, Any]] = {}
    suggestions: list[str] = []

    # Basic info (40% weight of total if all filled)
    basic_fields = {
        "headline": profile.headline,
        "summary": profile.summary,
        "phone": profile.phone,
        "location": profile.location,
        "linkedin_url": profile.linkedin_url,
        "years_of_experience": profile.years_of_experience,
    }
    filled = sum(1 for v in basic_fields.values() if v)
    basic_score = int(filled / len(basic_fields) * 100)
    missing_basic = [k for k, v in basic_fields.items() if not v]
    sections["basic_info"] = {"score": basic_score, "missing": missing_basic}
    if missing_basic:
        suggestions.append(f"Complete your basic info: {', '.join(missing_basic)}")

    # Work experience
    exps = getattr(profile, "work_experiences", []) or []
    if len(exps) >= 2:
        exp_score = 100
    elif len(exps) == 1:
        exp_score = 60
    else:
        exp_score = 0
    exp_missing = [] if exps else ["Add at least one work experience"]
    sections["work_experience"] = {"score": exp_score, "missing": exp_missing}
    if not exps:
        suggestions.append("Add your work experience to improve job matching accuracy.")

    # Education
    edus = getattr(profile, "education", []) or []
    edu_score = 100 if edus else 0
    sections["education"] = {
        "score": edu_score,
        "missing": [] if edus else ["Add your education"],
    }
    if not edus:
        suggestions.append("Add your education history.")

    # Skills
    skills = getattr(profile, "skills", []) or []
    if len(skills) >= 5:
        skill_score = 100
    elif len(skills) >= 2:
        skill_score = 60
    else:
        skill_score = int(len(skills) / 5 * 100)
    skill_missing = [] if len(skills) >= 5 else [f"Add at least {5 - len(skills)} more skills"]
    sections["skills"] = {"score": skill_score, "missing": skill_missing}
    if len(skills) < 5:
        suggestions.append(f"Add at least {max(0, 5 - len(skills))} more skills for better job matching.")

    # Projects (optional but boosts score)
    projects = getattr(profile, "projects", []) or []
    proj_score = 100 if projects else 0
    sections["projects"] = {
        "score": proj_score,
        "missing": [] if projects else ["Add projects to stand out"],
    }

    # Certifications (optional)
    certs = getattr(profile, "certifications", []) or []
    cert_score = 100 if certs else 0
    sections["certifications"] = {
        "score": cert_score,
        "missing": [] if certs else ["Optional: add certifications"],
    }

    # Weighted overall score
    weights = {
        "basic_info": 0.30,
        "work_experience": 0.30,
        "education": 0.20,
        "skills": 0.15,
        "projects": 0.03,
        "certifications": 0.02,
    }
    overall = int(sum(sections[k]["score"] * w for k, w in weights.items()))

    return {
        "score": overall,
        "sections": sections,
        "suggestions": suggestions[:5],  # cap at 5
    }
