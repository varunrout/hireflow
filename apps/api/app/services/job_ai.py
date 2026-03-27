"""AI-assisted and heuristic job extraction helpers."""
from __future__ import annotations

import json
import re
from dataclasses import dataclass
from typing import Any

from openai import AsyncOpenAI

from app.core.config import settings

COMMON_SKILLS = [
    "python",
    "java",
    "javascript",
    "typescript",
    "react",
    "next.js",
    "node.js",
    "fastapi",
    "django",
    "flask",
    "sql",
    "postgresql",
    "mysql",
    "mongodb",
    "redis",
    "docker",
    "kubernetes",
    "aws",
    "azure",
    "gcp",
    "graphql",
    "rest",
    "microservices",
    "git",
    "ci/cd",
    "terraform",
    "airflow",
    "spark",
    "pandas",
    "machine learning",
    "data science",
    "nlp",
    "llm",
    "product management",
    "figma",
    "ui/ux",
]

SECTION_STOP_WORDS = {
    "benefits",
    "perks",
    "about us",
    "about the role",
    "compensation",
    "salary",
    "equal opportunity",
    "how to apply",
    "about company",
}


@dataclass(slots=True)
class ExtractionResult:
    job: dict[str, Any]
    parse_result: dict[str, Any]
    extraction_method: str
    confidence_notes: list[str]


class JobExtractionService:
    def __init__(self) -> None:
        self._client: AsyncOpenAI | None = None
        if settings.OPENAI_API_KEY:
            self._client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

    async def extract_job(self, text: str, source_url: str | None = None) -> ExtractionResult:
        cleaned_text = self._clean_text(text)

        if self._client is not None:
            try:
                return await self._extract_with_openai(cleaned_text, source_url)
            except Exception:
                pass

        return self._extract_with_heuristics(cleaned_text, source_url)

    async def _extract_with_openai(
        self, text: str, source_url: str | None = None
    ) -> ExtractionResult:
        assert self._client is not None

        completion = await self._client.chat.completions.create(
            model=settings.OPENAI_FAST_MODEL,
            temperature=0.2,
            response_format={"type": "json_object"},
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You extract structured job posting data from raw job descriptions. "
                        "Return strict JSON with keys: job, parse_result, confidence_notes. "
                        "job must include title, company, location, remote_type, employment_type, "
                        "description, requirements, nice_to_haves, salary_min, salary_max, "
                        "salary_currency, source, source_url, source_job_id. "
                        "parse_result must include required_skills, preferred_skills, "
                        "required_experience_years, required_education, keywords, "
                        "responsibilities, benefits. Use null for unknown scalar values and [] "
                        "for unknown arrays. Source must be 'manual'."
                    ),
                },
                {
                    "role": "user",
                    "content": (
                        f"Source URL: {source_url or 'N/A'}\n\n"
                        f"Job description:\n{text}"
                    ),
                },
            ],
        )
        content = completion.choices[0].message.content or "{}"
        payload = json.loads(content)

        job = payload.get("job", {})
        parse_result = payload.get("parse_result", {})
        confidence_notes = payload.get("confidence_notes") or []

        job.setdefault("source", "manual")
        job.setdefault("source_url", source_url)
        job.setdefault("requirements", [])
        job.setdefault("nice_to_haves", [])
        job["description"] = job.get("description") or text

        parse_result.setdefault("required_skills", [])
        parse_result.setdefault("preferred_skills", [])
        parse_result.setdefault("keywords", [])
        parse_result.setdefault("responsibilities", [])
        parse_result.setdefault("benefits", [])

        return ExtractionResult(
            job=self._normalize_job_payload(job),
            parse_result=self._normalize_parse_result(parse_result),
            extraction_method="openai",
            confidence_notes=[str(item) for item in confidence_notes][:5],
        )

    def _extract_with_heuristics(
        self, text: str, source_url: str | None = None
    ) -> ExtractionResult:
        lines = [line.strip() for line in text.splitlines() if line.strip()]
        lowered = text.lower()

        title = self._extract_title(lines)
        company = self._extract_company(lines, text)
        location = self._extract_labeled_value(text, ["location", "based in", "office"]) or None
        remote_type = self._extract_remote_type(lowered)
        employment_type = self._extract_employment_type(lowered)
        requirements = self._extract_section_items(lines, ["requirements", "qualifications", "what you'll need"])
        nice_to_haves = self._extract_section_items(lines, ["preferred", "nice to have", "bonus"])
        responsibilities = self._extract_section_items(lines, ["responsibilities", "what you'll do", "what you will do"])
        benefits = self._extract_section_items(lines, ["benefits", "perks", "what we offer"])
        required_skills = self._extract_skills(text, requirements or lines)
        preferred_skills = self._extract_skills("\n".join(nice_to_haves), nice_to_haves)
        salary_min, salary_max, salary_currency = self._extract_salary(text)
        required_experience_years = self._extract_years(lowered)
        required_education = self._extract_education(lowered)
        keywords = self._extract_keywords(title, company, remote_type, employment_type, required_skills)

        notes: list[str] = ["Used heuristic extraction because AI output was unavailable."]
        if not company:
            notes.append("Company name could not be determined confidently.")
        if not requirements:
            notes.append("Requirements section was inferred from the raw description.")

        return ExtractionResult(
            job=self._normalize_job_payload(
                {
                    "title": title,
                    "company": company or "Unknown company",
                    "location": location,
                    "remote_type": remote_type,
                    "employment_type": employment_type,
                    "description": text,
                    "requirements": requirements,
                    "nice_to_haves": nice_to_haves,
                    "salary_min": salary_min,
                    "salary_max": salary_max,
                    "salary_currency": salary_currency,
                    "source": "manual",
                    "source_url": source_url,
                    "source_job_id": None,
                }
            ),
            parse_result=self._normalize_parse_result(
                {
                    "required_skills": required_skills,
                    "preferred_skills": preferred_skills,
                    "required_experience_years": required_experience_years,
                    "required_education": required_education,
                    "keywords": keywords,
                    "responsibilities": responsibilities,
                    "benefits": benefits,
                }
            ),
            extraction_method="heuristic",
            confidence_notes=notes,
        )

    def _normalize_job_payload(self, payload: dict[str, Any]) -> dict[str, Any]:
        return {
            "title": str(payload.get("title") or "Untitled role")[:300],
            "company": str(payload.get("company") or "Unknown company")[:200],
            "location": self._clean_nullable_string(payload.get("location"), 200),
            "remote_type": self._clean_enum(payload.get("remote_type"), {"remote", "hybrid", "onsite"}),
            "employment_type": self._clean_enum(
                payload.get("employment_type"),
                {"full_time", "part_time", "contract", "internship", "freelance"},
            ),
            "description": str(payload.get("description") or "")[:50000],
            "requirements": self._clean_string_list(payload.get("requirements")),
            "nice_to_haves": self._clean_string_list(payload.get("nice_to_haves")),
            "salary_min": self._clean_int(payload.get("salary_min")),
            "salary_max": self._clean_int(payload.get("salary_max")),
            "salary_currency": str(payload.get("salary_currency") or "USD")[:3].upper(),
            "source": "manual",
            "source_url": self._clean_nullable_string(payload.get("source_url"), 2048),
            "source_job_id": self._clean_nullable_string(payload.get("source_job_id"), 500),
        }

    def _normalize_parse_result(self, payload: dict[str, Any]) -> dict[str, Any]:
        return {
            "required_skills": self._clean_string_list(payload.get("required_skills")),
            "preferred_skills": self._clean_string_list(payload.get("preferred_skills")),
            "required_experience_years": self._clean_int(payload.get("required_experience_years")),
            "required_education": self._clean_nullable_string(payload.get("required_education"), 200),
            "keywords": self._clean_string_list(payload.get("keywords")),
            "responsibilities": self._clean_string_list(payload.get("responsibilities")),
            "benefits": self._clean_string_list(payload.get("benefits")),
        }

    def _extract_title(self, lines: list[str]) -> str:
        for line in lines[:5]:
            if 3 <= len(line) <= 120 and not line.endswith(":"):
                return line
        return "Untitled role"

    def _extract_company(self, lines: list[str], text: str) -> str | None:
        labeled = self._extract_labeled_value(text, ["company", "organization", "employer"])
        if labeled:
            return labeled

        title_line = lines[0] if lines else ""
        if " at " in title_line.lower():
            parts = re.split(r"\bat\b", title_line, flags=re.IGNORECASE)
            if len(parts) > 1:
                return parts[-1].strip(" -|")

        if len(lines) > 1 and len(lines[1]) <= 120 and not lines[1].endswith(":"):
            return lines[1]
        return None

    def _extract_labeled_value(self, text: str, labels: list[str]) -> str | None:
        for label in labels:
            match = re.search(rf"{label}\s*[:\-]\s*(.+)", text, flags=re.IGNORECASE)
            if match:
                return match.group(1).splitlines()[0].strip()
        return None

    def _extract_remote_type(self, lowered: str) -> str | None:
        if "hybrid" in lowered:
            return "hybrid"
        if "onsite" in lowered or "on-site" in lowered or "on site" in lowered:
            return "onsite"
        if "remote" in lowered or "work from home" in lowered:
            return "remote"
        return None

    def _extract_employment_type(self, lowered: str) -> str | None:
        mapping = {
            "full-time": "full_time",
            "full time": "full_time",
            "part-time": "part_time",
            "part time": "part_time",
            "contract": "contract",
            "internship": "internship",
            "freelance": "freelance",
        }
        for needle, value in mapping.items():
            if needle in lowered:
                return value
        return None

    def _extract_section_items(self, lines: list[str], headings: list[str], limit: int = 8) -> list[str]:
        results: list[str] = []
        active = False
        for line in lines:
            normalized = line.lower().strip()
            if any(heading in normalized for heading in headings):
                active = True
                continue

            if active and any(stop in normalized for stop in SECTION_STOP_WORDS):
                break

            if active:
                bullet = re.sub(r"^(?:[\-•*]\s*|\d+[\.)]\s*)", "", line).strip()
                if bullet:
                    results.append(bullet[:1000])
                if len(results) >= limit:
                    break
        return results

    def _extract_skills(self, text: str, hints: list[str]) -> list[str]:
        haystack = f"{text}\n" + "\n".join(hints)
        lowered = haystack.lower()
        found = [skill for skill in COMMON_SKILLS if skill in lowered]
        return found[:12]

    def _extract_salary(self, text: str) -> tuple[int | None, int | None, str]:
        currency = "USD"
        if "£" in text:
            currency = "GBP"
        elif "€" in text:
            currency = "EUR"

        matches = re.findall(r"[$£€]\s?([0-9]{2,3}(?:,[0-9]{3})*)", text)
        values = [int(value.replace(",", "")) for value in matches]
        if not values:
            return None, None, currency
        if len(values) == 1:
            return values[0], None, currency
        return min(values), max(values), currency

    def _extract_years(self, lowered: str) -> int | None:
        match = re.search(r"(\d+)\+?\s+years", lowered)
        return int(match.group(1)) if match else None

    def _extract_education(self, lowered: str) -> str | None:
        if "phd" in lowered or "doctorate" in lowered:
            return "PhD"
        if "master" in lowered:
            return "Master's degree"
        if "bachelor" in lowered or "undergraduate" in lowered:
            return "Bachelor's degree"
        return None

    def _extract_keywords(
        self,
        title: str,
        company: str | None,
        remote_type: str | None,
        employment_type: str | None,
        skills: list[str],
    ) -> list[str]:
        keywords: list[str] = []
        for value in [title, company, remote_type, employment_type, *skills]:
            if value:
                cleaned = str(value).strip()
                if cleaned and cleaned.lower() not in {item.lower() for item in keywords}:
                    keywords.append(cleaned)
        return keywords[:12]

    def _clean_text(self, value: str) -> str:
        value = value.replace("\r\n", "\n")
        value = re.sub(r"\n{3,}", "\n\n", value)
        return value.strip()

    def _clean_string_list(self, value: Any) -> list[str]:
        if not isinstance(value, list):
            return []
        cleaned: list[str] = []
        seen: set[str] = set()
        for item in value:
            text = str(item).strip()
            key = text.lower()
            if text and key not in seen:
                cleaned.append(text[:1000])
                seen.add(key)
        return cleaned[:20]

    def _clean_nullable_string(self, value: Any, limit: int) -> str | None:
        if value is None:
            return None
        text = str(value).strip()
        return text[:limit] if text else None

    def _clean_int(self, value: Any) -> int | None:
        if value is None or value == "":
            return None
        try:
            return int(value)
        except (TypeError, ValueError):
            return None

    def _clean_enum(self, value: Any, allowed: set[str]) -> str | None:
        if value is None:
            return None
        normalized = str(value).strip().lower().replace("-", "_").replace(" ", "_")
        return normalized if normalized in allowed else None
