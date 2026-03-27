"""External public job API aggregation."""
from __future__ import annotations

import asyncio
import re
from datetime import datetime
from typing import Any

import httpx

from app.core.config import settings


class ExternalJobSearchService:
    async def search_jobs(
        self,
        role: str,
        location: str | None = None,
        remote_only: bool = False,
        limit: int = 20,
    ) -> list[dict[str, Any]]:
        items: list[dict[str, Any]] = []

        async with httpx.AsyncClient(timeout=20.0, follow_redirects=True) as client:
            results = await asyncio.gather(
                self._safe_fetch(self._fetch_remotive(client, role=role, limit=limit)),
                self._safe_fetch(
                    self._fetch_adzuna(
                        client,
                        role=role,
                        location=location,
                        remote_only=remote_only,
                        limit=limit,
                    )
                )
                if settings.ADZUNA_APP_ID and settings.ADZUNA_APP_KEY
                else self._safe_fetch_empty(),
                self._safe_fetch(
                    self._fetch_reed(
                        client,
                        role=role,
                        location=location,
                        remote_only=remote_only,
                        limit=limit,
                    )
                )
                if settings.REED_API_KEY
                else self._safe_fetch_empty(),
            )

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
            items.append(
                {
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
                }
            )
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

        for item in items:
            if remote_only and item.get("remote_type") != "remote":
                continue
            item_location = str(item.get("location") or "")
            if location_lower and location_lower not in item_location.lower() and item.get("remote_type") != "remote":
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
