"""External public job API aggregation."""
from __future__ import annotations

import asyncio
import re
from datetime import datetime
from typing import Any

import httpx

from app.core.config import settings

# ISO country code → full name (for location matching)
_COUNTRY_NAMES: dict[str, str] = {
    "GB": "United Kingdom", "US": "United States", "CA": "Canada",
    "AU": "Australia", "DE": "Germany", "FR": "France", "NL": "Netherlands",
    "IN": "India", "SG": "Singapore", "IE": "Ireland", "SE": "Sweden",
    "CH": "Switzerland", "ES": "Spain", "IT": "Italy", "PL": "Poland",
    "PT": "Portugal", "BE": "Belgium", "DK": "Denmark", "NO": "Norway",
    "FI": "Finland", "AT": "Austria", "NZ": "New Zealand", "ZA": "South Africa",
    "BR": "Brazil", "MX": "Mexico", "AE": "United Arab Emirates", "JP": "Japan",
}

# The Muse uses fixed category names — map common role keywords
_MUSE_CATEGORY_MAP: dict[str, str] = {
    "data scientist": "Data Science",
    "data science": "Data Science",
    "data analyst": "Data Science",
    "data engineer": "Data Science",
    "machine learning": "Data Science",
    "software engineer": "Software Engineer",
    "software developer": "Software Engineer",
    "frontend": "Software Engineer",
    "backend": "Software Engineer",
    "fullstack": "Software Engineer",
    "full stack": "Software Engineer",
    "product manager": "Product",
    "product management": "Product",
    "designer": "Design & UX",
    "ux": "Design & UX",
    "ui": "Design & UX",
    "devops": "DevOps & Sysadmin",
    "cloud": "DevOps & Sysadmin",
    "marketing": "Marketing & PR",
    "sales": "Sales",
    "finance": "Finance",
    "hr": "HR & Recruiting",
    "recruiter": "HR & Recruiting",
    "legal": "Legal",
    "operations": "Operations",
    "analyst": "Data Science",
}


class ExternalJobSearchService:
    async def search_jobs(
        self,
        role: str,
        location: str | None = None,
        remote_only: bool = False,
        limit: int = 20,
    ) -> list[dict[str, Any]]:
        async with httpx.AsyncClient(timeout=20.0, follow_redirects=True) as client:
            tasks = [
                # Always-on free sources
                self._safe_fetch(self._fetch_remotive(client, role=role, limit=limit)),
                self._safe_fetch(self._fetch_muse(client, role=role, location=location, remote_only=remote_only, limit=limit)),
                self._safe_fetch(self._fetch_arbeitnow(client, role=role, remote_only=remote_only, limit=limit)),
                # Key-gated sources
                self._safe_fetch(
                    self._fetch_adzuna(client, role=role, location=location, remote_only=remote_only, limit=limit)
                ) if settings.ADZUNA_APP_ID and settings.ADZUNA_APP_KEY else self._safe_fetch_empty(),
                self._safe_fetch(
                    self._fetch_reed(client, role=role, location=location, remote_only=remote_only, limit=limit)
                ) if settings.REED_API_KEY else self._safe_fetch_empty(),
                # JSearch — covers Indeed, LinkedIn, Glassdoor, Greenhouse
                self._safe_fetch(
                    self._fetch_jsearch(client, role=role, location=location, remote_only=remote_only, limit=limit)
                ) if settings.RAPIDAPI_KEY else self._safe_fetch_empty(),
            ]

            results = await asyncio.gather(*tasks)

        items: list[dict[str, Any]] = []
        for provider_items in results:
            items.extend(provider_items)

        filtered = self._filter_and_dedupe(items, location=location, remote_only=remote_only)
        return filtered[:limit]

    async def _safe_fetch(self, coroutine: Any) -> list[dict[str, Any]]:
        try:
            return await coroutine
        except Exception:
            return []

    async def _safe_fetch_empty(self) -> list[dict[str, Any]]:
        return []

    # ------------------------------------------------------------------
    # Remotive — free, remote-only jobs
    # ------------------------------------------------------------------
    async def _fetch_remotive(
        self, client: httpx.AsyncClient, role: str, limit: int
    ) -> list[dict[str, Any]]:
        response = await client.get(
            settings.REMOTIVE_API_URL,
            params={"search": role, "limit": limit},
            headers={"Accept": "application/json"},
        )
        response.raise_for_status()
        payload = response.json()

        items: list[dict[str, Any]] = []
        for job in payload.get("jobs", [])[:limit]:
            job_type = str(job.get("job_type") or "").lower()
            items.append({
                "provider": "remotive",
                "title": job.get("title") or "Untitled role",
                "company": job.get("company_name") or "Unknown company",
                "location": job.get("candidate_required_location"),
                "remote_type": "remote",
                "employment_type": self._map_employment_type(job_type),
                "description": self._strip_html(job.get("description") or ""),
                "source": "other",
                "source_url": job.get("url"),
                "source_job_id": str(job.get("id") or "") or None,
                "posted_at": self._parse_datetime(job.get("publication_date")),
                "requirements": [],
                "nice_to_haves": [],
            })
        return items

    # ------------------------------------------------------------------
    # The Muse — free, no key, US-focused quality companies
    # ------------------------------------------------------------------
    async def _fetch_muse(
        self,
        client: httpx.AsyncClient,
        role: str,
        location: str | None,
        remote_only: bool,
        limit: int,
    ) -> list[dict[str, Any]]:
        # Map role to Muse's fixed category taxonomy
        role_lower = role.lower()
        muse_category = next(
            (cat for keyword, cat in _MUSE_CATEGORY_MAP.items() if keyword in role_lower),
            role,  # fall back to raw role string
        )

        params: dict[str, Any] = {"page": 0, "descending": "true", "category": muse_category}
        if remote_only:
            params["location"] = "Flexible / Remote"
        # The Muse has limited non-US locations; don't filter by location server-side
        # (filter client-side via _filter_and_dedupe)

        response = await client.get(
            settings.MUSE_API_URL,
            params=params,
            headers={"Accept": "application/json"},
        )
        response.raise_for_status()
        payload = response.json()

        items: list[dict[str, Any]] = []
        for job in payload.get("results", [])[:limit]:
            company = (job.get("company") or {}).get("name") or "Unknown company"
            locations = job.get("locations") or []
            loc_name = locations[0].get("name") if locations else None
            is_remote = any("remote" in str(l.get("name", "")).lower() for l in locations)
            levels = job.get("levels") or []
            level_names = [l.get("name", "") for l in levels]
            contents = self._strip_html(job.get("contents") or "")
            items.append({
                "provider": "themuse",
                "title": job.get("name") or "Untitled role",
                "company": company,
                "location": loc_name,
                "remote_type": "remote" if is_remote else None,
                "employment_type": "full_time",
                "description": contents,
                "source": "other",
                "source_url": job.get("refs", {}).get("landing_page"),
                "source_job_id": str(job.get("id") or "") or None,
                "posted_at": self._parse_datetime(job.get("publication_date")),
                "requirements": level_names,
                "nice_to_haves": [],
            })
        return items

    # ------------------------------------------------------------------
    # Arbeit Now — free, no key, global remote-friendly jobs
    # ------------------------------------------------------------------
    async def _fetch_arbeitnow(
        self,
        client: httpx.AsyncClient,
        role: str,
        remote_only: bool,
        limit: int,
    ) -> list[dict[str, Any]]:
        response = await client.get(
            settings.ARBEITNOW_API_URL,
            headers={"Accept": "application/json"},
        )
        response.raise_for_status()
        if not response.text.strip():
            return []
        payload = response.json()

        role_lower = role.lower()
        items: list[dict[str, Any]] = []
        for job in payload.get("data", []):
            title = str(job.get("title") or "")
            if role_lower not in title.lower() and role_lower not in str(job.get("description") or "").lower():
                continue
            is_remote = bool(job.get("remote"))
            if remote_only and not is_remote:
                continue
            items.append({
                "provider": "arbeitnow",
                "title": title or "Untitled role",
                "company": job.get("company_name") or "Unknown company",
                "location": job.get("location"),
                "remote_type": "remote" if is_remote else None,
                "employment_type": None,
                "description": self._strip_html(job.get("description") or ""),
                "source": "other",
                "source_url": job.get("url"),
                "source_job_id": job.get("slug"),
                "posted_at": self._parse_datetime(
                    datetime.utcfromtimestamp(job["created_at"]).isoformat()
                    if job.get("created_at") else None
                ),
                "requirements": job.get("tags") or [],
                "nice_to_haves": [],
            })
            if len(items) >= limit:
                break
        return items

    # ------------------------------------------------------------------
    # JSearch (RapidAPI) — aggregates Indeed, LinkedIn, Glassdoor, Greenhouse
    # ------------------------------------------------------------------
    async def _fetch_jsearch(
        self,
        client: httpx.AsyncClient,
        role: str,
        location: str | None,
        remote_only: bool,
        limit: int,
    ) -> list[dict[str, Any]]:
        query = role
        if location:
            query += f" in {location}"
        if remote_only:
            query += " remote"

        response = await client.get(
            f"https://{settings.RAPIDAPI_JSEARCH_HOST}/search",
            params={"query": query, "page": "1", "num_pages": "1", "per_page": str(limit)},
            headers={
                "X-RapidAPI-Key": settings.RAPIDAPI_KEY,
                "X-RapidAPI-Host": settings.RAPIDAPI_JSEARCH_HOST,
            },
        )
        response.raise_for_status()
        payload = response.json()

        items: list[dict[str, Any]] = []
        for job in payload.get("data", [])[:limit]:
            is_remote = bool(job.get("job_is_remote"))
            if remote_only and not is_remote:
                continue
            # Map publisher to source enum
            publisher = str(job.get("job_publisher") or "").lower()
            source = "indeed" if "indeed" in publisher else \
                     "linkedin" if "linkedin" in publisher else \
                     "glassdoor" if "glassdoor" in publisher else \
                     "greenhouse" if "greenhouse" in publisher else "other"
            items.append({
                "provider": f"jsearch/{job.get('job_publisher', 'unknown')}",
                "title": job.get("job_title") or "Untitled role",
                "company": job.get("employer_name") or "Unknown company",
                # Build full location: "London, United Kingdom" so filter can match
                "location": ", ".join(filter(None, [
                    job.get("job_city"),
                    job.get("job_state"),
                    _COUNTRY_NAMES.get(job.get("job_country") or "", job.get("job_country")),
                ])) or None,
                "remote_type": "remote" if is_remote else None,
                "employment_type": self._map_employment_type(
                    str(job.get("job_employment_type") or "").lower().replace(" ", "_")
                ),
                "description": self._strip_html(job.get("job_description") or ""),
                "source": source,
                "source_url": job.get("job_apply_link") or job.get("job_google_link"),
                "source_job_id": job.get("job_id"),
                "posted_at": self._parse_datetime(
                    job.get("job_posted_at_datetime_utc")
                ),
                "requirements": job.get("job_highlights", {}).get("Qualifications") or [],
                "nice_to_haves": job.get("job_highlights", {}).get("Responsibilities") or [],
            })
        return items

    async def _fetch_adzuna(
        self,
        client: httpx.AsyncClient,
        role: str,
        location: str | None,
        remote_only: bool,
        limit: int,
    ) -> list[dict[str, Any]]:
        response = await client.get(
            (
                f"{settings.ADZUNA_API_URL}/jobs/"
                f"{settings.ADZUNA_COUNTRY}/search/1"
            ),
            params={
                "app_id": settings.ADZUNA_APP_ID,
                "app_key": settings.ADZUNA_APP_KEY,
                "results_per_page": limit,
                "what": role,
                "where": location or "",
            },
            headers={"Accept": "application/json"},
        )
        response.raise_for_status()
        payload = response.json()

        items: list[dict[str, Any]] = []
        for job in payload.get("results", [])[:limit]:
            description = self._strip_html(job.get("description") or "")
            location_name = ((job.get("location") or {}).get("display_name") if isinstance(job.get("location"), dict) else None)
            remote_type = "remote" if "remote" in description.lower() else None
            if remote_only and remote_type != "remote":
                continue
            items.append(
                {
                    "provider": "adzuna",
                    "title": job.get("title") or "Untitled role",
                    "company": ((job.get("company") or {}).get("display_name") if isinstance(job.get("company"), dict) else None) or "Unknown company",
                    "location": location_name,
                    "remote_type": remote_type,
                    "employment_type": None,
                    "description": description,
                    "source": "other",
                    "source_url": job.get("redirect_url"),
                    "source_job_id": job.get("id"),
                    "posted_at": self._parse_datetime(job.get("created")),
                    "requirements": [],
                    "nice_to_haves": [],
                }
            )
        return items

    async def _fetch_reed(
        self,
        client: httpx.AsyncClient,
        role: str,
        location: str | None,
        remote_only: bool,
        limit: int,
    ) -> list[dict[str, Any]]:
        response = await client.get(
            settings.REED_API_URL,
            params={
                "keywords": role,
                "locationName": location or "",
                "resultsToTake": limit,
            },
            auth=(settings.REED_API_KEY, ""),
            headers={"Accept": "application/json"},
        )
        response.raise_for_status()
        payload = response.json()

        items: list[dict[str, Any]] = []
        for job in payload.get("results", [])[:limit]:
            description = self._strip_html(job.get("jobDescription") or "")
            remote_type = "remote" if "remote" in description.lower() else None
            if remote_only and remote_type != "remote":
                continue
            items.append(
                {
                    "provider": "reed",
                    "title": job.get("jobTitle") or "Untitled role",
                    "company": job.get("employerName") or "Unknown company",
                    "location": job.get("locationName"),
                    "remote_type": remote_type,
                    "employment_type": None,
                    "description": description,
                    "source": "other",
                    "source_url": job.get("jobUrl"),
                    "source_job_id": str(job.get("jobId") or "") or None,
                    "posted_at": self._parse_datetime(job.get("date")),
                    "requirements": [],
                    "nice_to_haves": [],
                }
            )
        return items

    def _filter_and_dedupe(
        self,
        items: list[dict[str, Any]],
        location: str | None,
        remote_only: bool,
    ) -> list[dict[str, Any]]:
        filtered: list[dict[str, Any]] = []
        seen: set[str] = set()
        location_lower = location.lower() if location else None
        # Build a set of tokens from location for partial matching
        # e.g. "United Kingdom" → {"united", "kingdom", "uk", "gb"}
        location_tokens: set[str] = set()
        if location_lower:
            location_tokens = set(location_lower.split())
            # Add reverse alias: if searching "united kingdom", also match "gb"
            for code, name in _COUNTRY_NAMES.items():
                if name.lower() == location_lower:
                    location_tokens.add(code.lower())
                    break

        for item in items:
            if remote_only and item.get("remote_type") != "remote":
                continue

            if location_tokens:
                item_location = str(item.get("location") or "").lower()
                is_remote = item.get("remote_type") == "remote"
                # Pass if: remote, OR any location token found in item's location string
                location_match = any(tok in item_location for tok in location_tokens)
                if not is_remote and not location_match:
                    continue

            key = str(item.get("source_url") or f"{item.get('title')}::{item.get('company')}").lower()
            if key in seen:
                continue
            seen.add(key)
            filtered.append(item)

        filtered.sort(key=lambda item: item.get("posted_at") or "", reverse=True)
        return filtered

    def _map_employment_type(self, job_type: str) -> str | None:
        mapping = {
            "full_time": "full_time",
            "full-time": "full_time",
            "contract": "contract",
            "part_time": "part_time",
            "part-time": "part_time",
            "internship": "internship",
            "freelance": "freelance",
        }
        return mapping.get(job_type)

    def _strip_html(self, value: str) -> str:
        text = re.sub(r"<[^>]+>", " ", value)
        text = re.sub(r"\s+", " ", text)
        return text.strip()

    def _parse_datetime(self, value: Any) -> str | None:
        if not value:
            return None
        text = str(value).strip()
        try:
            return datetime.fromisoformat(text.replace("Z", "+00:00")).isoformat()
        except ValueError:
            return None
