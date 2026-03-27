"""Unit tests for job extraction and external job normalization."""

from app.services.external_jobs import ExternalJobSearchService
from app.services.job_ai import JobExtractionService


class TestJobExtractionService:
    def test_heuristic_extraction_pulls_core_fields(self) -> None:
        service = JobExtractionService()
        text = """
Senior Python Engineer
Acme Corp
Location: Remote (US)

We are hiring a full-time backend engineer.

Requirements:
- 5+ years of Python experience
- FastAPI and PostgreSQL
- Docker and AWS

Nice to Have:
- React

Benefits:
- Health insurance
- Home office stipend
"""

        result = service._extract_with_heuristics(text, source_url="https://example.com/job")

        assert result.job["title"] == "Senior Python Engineer"
        assert result.job["company"] == "Acme Corp"
        assert result.job["remote_type"] == "remote"
        assert result.job["employment_type"] == "full_time"
        assert "Python" in result.job["requirements"][0]
        assert "python" in result.parse_result["required_skills"]
        assert result.parse_result["required_experience_years"] == 5
        assert result.parse_result["benefits"]


class TestExternalJobSearchService:
    def test_filter_and_dedupe_prefers_unique_urls(self) -> None:
        service = ExternalJobSearchService()
        items = [
            {
                "provider": "remotive",
                "title": "Backend Engineer",
                "company": "Acme",
                "location": "Remote",
                "remote_type": "remote",
                "employment_type": "full_time",
                "description": "A",
                "source": "other",
                "source_url": "https://jobs.example.com/1",
                "source_job_id": "1",
                "posted_at": "2026-03-08T00:00:00+00:00",
                "requirements": [],
                "nice_to_haves": [],
            },
            {
                "provider": "adzuna",
                "title": "Backend Engineer",
                "company": "Acme",
                "location": "Remote",
                "remote_type": "remote",
                "employment_type": "full_time",
                "description": "B",
                "source": "other",
                "source_url": "https://jobs.example.com/1",
                "source_job_id": "1",
                "posted_at": "2026-03-07T00:00:00+00:00",
                "requirements": [],
                "nice_to_haves": [],
            },
        ]

        filtered = service._filter_and_dedupe(items, location=None, remote_only=False)

        assert len(filtered) == 1
        assert filtered[0]["provider"] == "remotive"
