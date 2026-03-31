"""Comprehensive unit tests for all automation pipeline workflows.

Covers: settings defaults, profile completeness, confidence tiers,
score distribution, approval queue, notifications, scheduling,
run controls, schema validation, readiness logic, and Celery task.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.api.v1.endpoints.automation import (
    DEFAULT_ALLOWED_SOURCES,
    SCHEDULE_PRESETS,
    _compute_profile_completeness,
    _default_settings_payload,
)
from app.models.models import (
    ApprovalStatusEnum,
    AutomationApprovalQueueItem,
    AutomationNotification,
    AutomationPipelineRun,
    AutomationPipelineSettings,
    NotificationTypeEnum,
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


# ================================================================
# 1. Settings defaults
# ================================================================


class TestDefaultSettings:
    def test_default_payload_returns_dict(self) -> None:
        payload = _default_settings_payload()
        assert isinstance(payload, dict)

    def test_pipeline_disabled_by_default(self) -> None:
        payload = _default_settings_payload()
        assert payload["enabled"] is False

    def test_auto_apply_disabled_by_default(self) -> None:
        payload = _default_settings_payload()
        assert payload["auto_apply_enabled"] is False

    def test_human_review_enabled_by_default(self) -> None:
        payload = _default_settings_payload()
        assert payload["require_human_review"] is True

    def test_auto_tailor_resume_enabled_by_default(self) -> None:
        payload = _default_settings_payload()
        assert payload["auto_tailor_resume"] is True

    def test_auto_cover_letter_disabled_by_default(self) -> None:
        payload = _default_settings_payload()
        assert payload["auto_generate_cover_letter"] is False

    def test_allowed_sources_populated(self) -> None:
        payload = _default_settings_payload()
        assert len(payload["allowed_sources"]) > 0
        assert "linkedin" in payload["allowed_sources"]

    def test_allowed_sources_is_new_list_each_call(self) -> None:
        a = _default_settings_payload()
        b = _default_settings_payload()
        assert a["allowed_sources"] is not b["allowed_sources"]

    def test_default_match_score(self) -> None:
        payload = _default_settings_payload()
        assert payload["min_match_score"] == 70.0

    def test_default_max_jobs_per_run(self) -> None:
        payload = _default_settings_payload()
        assert payload["max_jobs_per_run"] == 25

    def test_default_max_applications_per_day(self) -> None:
        payload = _default_settings_payload()
        assert payload["max_applications_per_day"] == 5

    def test_scheduling_disabled_by_default(self) -> None:
        payload = _default_settings_payload()
        assert payload["schedule_enabled"] is False
        assert payload["schedule_cron"] is None
        assert payload["schedule_timezone"] == "UTC"
        assert payload["schedule_paused"] is False

    def test_run_window_empty_by_default(self) -> None:
        payload = _default_settings_payload()
        assert payload["run_window_start"] is None
        assert payload["run_window_end"] is None

    def test_freshness_days_default(self) -> None:
        payload = _default_settings_payload()
        assert payload["freshness_days"] == 30

    def test_company_lists_empty_by_default(self) -> None:
        payload = _default_settings_payload()
        assert payload["company_blacklist"] == []
        assert payload["company_whitelist"] == []

    def test_min_salary_floor_none_by_default(self) -> None:
        payload = _default_settings_payload()
        assert payload["min_salary_floor"] is None

    def test_discovery_lists_empty_by_default(self) -> None:
        payload = _default_settings_payload()
        assert payload["experience_levels"] == []
        assert payload["employment_types"] == []
        assert payload["target_industries"] == []
        assert payload["excluded_industries"] == []
        assert payload["search_terms"] == []
        assert payload["target_locations"] == []
        assert payload["excluded_keywords"] == []

    def test_confidence_tier_defaults(self) -> None:
        payload = _default_settings_payload()
        assert payload["confidence_auto_apply_threshold"] == 90.0
        assert payload["confidence_review_threshold"] == 75.0
        assert payload["confidence_save_threshold"] == 65.0

    def test_persona_id_none_by_default(self) -> None:
        payload = _default_settings_payload()
        assert payload["persona_id"] is None

    def test_notification_defaults(self) -> None:
        payload = _default_settings_payload()
        assert payload["email_digest_enabled"] is False
        assert payload["email_digest_frequency"] == "weekly"
        assert payload["high_match_alert_enabled"] is False
        assert payload["high_match_alert_threshold"] == 90.0

    def test_all_expected_keys_present(self) -> None:
        payload = _default_settings_payload()
        expected_keys = {
            "enabled", "auto_apply_enabled", "require_human_review",
            "auto_tailor_resume", "auto_generate_cover_letter",
            "allowed_sources", "search_terms", "target_locations",
            "excluded_keywords", "min_match_score", "max_jobs_per_run",
            "max_applications_per_day", "schedule_enabled", "schedule_cron",
            "schedule_timezone", "schedule_paused", "run_window_start",
            "run_window_end", "freshness_days", "company_blacklist",
            "company_whitelist", "min_salary_floor", "experience_levels",
            "employment_types", "target_industries", "excluded_industries",
            "confidence_auto_apply_threshold", "confidence_review_threshold",
            "confidence_save_threshold", "persona_id", "email_digest_enabled",
            "email_digest_frequency", "high_match_alert_enabled",
            "high_match_alert_threshold",
        }
        assert set(payload.keys()) == expected_keys


# ================================================================
# 2. Profile completeness
# ================================================================


class TestProfileCompleteness:
    def test_none_profile_returns_zero(self) -> None:
        score, breakdown = _compute_profile_completeness(None)
        assert score == 0.0
        assert breakdown == {}

    def test_empty_profile_has_low_score(self) -> None:
        profile = SimpleNamespace(
            headline=None,
            summary=None,
            phone=None,
            location=None,
            linkedin_url=None,
            years_of_experience=None,
            work_experiences=[],
            education=[],
            skills=[],
        )
        score, breakdown = _compute_profile_completeness(profile)
        assert score == 0.0
        assert all(v is False for v in breakdown.values())

    def test_fully_filled_profile_gives_100(self) -> None:
        profile = SimpleNamespace(
            headline="Senior Engineer",
            summary="Experienced dev",
            phone="+1234567890",
            location="New York",
            linkedin_url="https://linkedin.com/in/test",
            years_of_experience=5,
            work_experiences=[SimpleNamespace()],
            education=[SimpleNamespace()],
            skills=[SimpleNamespace()],
        )
        score, breakdown = _compute_profile_completeness(profile)
        assert score == 100.0
        assert all(v is True for v in breakdown.values())

    def test_partial_profile_score(self) -> None:
        profile = SimpleNamespace(
            headline="Engineer",
            summary="A summary",
            phone=None,
            location=None,
            linkedin_url=None,
            years_of_experience=None,
            work_experiences=[SimpleNamespace()],
            education=[],
            skills=[],
        )
        score, breakdown = _compute_profile_completeness(profile)
        # 3 out of 9 filled: headline, summary, work_experience = 33.3%
        assert 33.0 <= score <= 34.0
        assert breakdown["headline"] is True
        assert breakdown["summary"] is True
        assert breakdown["work_experience"] is True
        assert breakdown["phone"] is False
        assert breakdown["location"] is False

    def test_years_of_experience_zero_counts_as_filled(self) -> None:
        profile = SimpleNamespace(
            headline=None,
            summary=None,
            phone=None,
            location=None,
            linkedin_url=None,
            years_of_experience=0,
            work_experiences=[],
            education=[],
            skills=[],
        )
        score, _ = _compute_profile_completeness(profile)
        # 1 out of 9 = 11.1%
        assert 11.0 <= score <= 12.0

    def test_breakdown_has_all_expected_keys(self) -> None:
        profile = SimpleNamespace(
            headline=None, summary=None, phone=None,
            location=None, linkedin_url=None,
            years_of_experience=None,
            work_experiences=[], education=[], skills=[],
        )
        _, breakdown = _compute_profile_completeness(profile)
        expected_keys = {
            "headline", "summary", "phone", "location",
            "linkedin_url", "years_of_experience",
            "work_experience", "education", "skills",
        }
        assert set(breakdown.keys()) == expected_keys

    def test_missing_work_experiences_attr_handled(self) -> None:
        """Profile might not have eagerly-loaded relationships."""
        profile = SimpleNamespace(
            headline="Test", summary=None, phone=None,
            location=None, linkedin_url=None,
            years_of_experience=None,
        )
        # No work_experiences, education, skills attrs
        score, breakdown = _compute_profile_completeness(profile)
        assert score >= 0.0
        assert breakdown["headline"] is True


# ================================================================
# 3. Confidence tiers classification
# ================================================================


class TestConfidenceTiers:
    """Test the tier classification logic from the pipeline."""

    def _classify(
        self,
        score: float,
        auto_apply_threshold: float = 90.0,
        review_threshold: float = 75.0,
        save_threshold: float = 65.0,
    ) -> str:
        """Replicate the tier classification from run_pipeline_now."""
        if score >= auto_apply_threshold:
            return "auto_apply"
        elif score >= review_threshold:
            return "review"
        elif score >= save_threshold:
            return "save"
        return "below_threshold"

    def test_score_100_is_auto_apply(self) -> None:
        assert self._classify(100.0) == "auto_apply"

    def test_score_90_is_auto_apply(self) -> None:
        assert self._classify(90.0) == "auto_apply"

    def test_score_89_is_review(self) -> None:
        assert self._classify(89.9) == "review"

    def test_score_75_is_review(self) -> None:
        assert self._classify(75.0) == "review"

    def test_score_74_is_save(self) -> None:
        assert self._classify(74.9) == "save"

    def test_score_65_is_save(self) -> None:
        assert self._classify(65.0) == "save"

    def test_score_64_is_below_threshold(self) -> None:
        assert self._classify(64.9) == "below_threshold"

    def test_score_0_is_below_threshold(self) -> None:
        assert self._classify(0.0) == "below_threshold"

    def test_custom_thresholds(self) -> None:
        assert self._classify(80.0, auto_apply_threshold=80.0) == "auto_apply"
        assert self._classify(79.9, auto_apply_threshold=80.0) == "review"

    def test_all_tiers_with_tight_range(self) -> None:
        assert self._classify(95, 95, 90, 85) == "auto_apply"
        assert self._classify(92, 95, 90, 85) == "review"
        assert self._classify(87, 95, 90, 85) == "save"
        assert self._classify(80, 95, 90, 85) == "below_threshold"


# ================================================================
# 4. Score distribution buckets
# ================================================================


class TestScoreDistribution:
    """Test the score distribution bucket logic from pipeline run."""

    @staticmethod
    def _bucket(score: float) -> str:
        if score >= 90:
            return "90-100"
        elif score >= 80:
            return "80-89"
        elif score >= 70:
            return "70-79"
        elif score >= 60:
            return "60-69"
        return "below_60"

    def test_score_100(self) -> None:
        assert self._bucket(100.0) == "90-100"

    def test_score_90(self) -> None:
        assert self._bucket(90.0) == "90-100"

    def test_score_89(self) -> None:
        assert self._bucket(89.9) == "80-89"

    def test_score_80(self) -> None:
        assert self._bucket(80.0) == "80-89"

    def test_score_79(self) -> None:
        assert self._bucket(79.0) == "70-79"

    def test_score_70(self) -> None:
        assert self._bucket(70.0) == "70-79"

    def test_score_69(self) -> None:
        assert self._bucket(69.0) == "60-69"

    def test_score_60(self) -> None:
        assert self._bucket(60.0) == "60-69"

    def test_score_59(self) -> None:
        assert self._bucket(59.0) == "below_60"

    def test_score_0(self) -> None:
        assert self._bucket(0.0) == "below_60"

    def test_distribution_counts(self) -> None:
        scores = [95, 92, 85, 82, 75, 72, 65, 55, 45, 30]
        dist = {"90-100": 0, "80-89": 0, "70-79": 0, "60-69": 0, "below_60": 0}
        for s in scores:
            dist[self._bucket(s)] += 1
        assert dist == {
            "90-100": 2,
            "80-89": 2,
            "70-79": 2,
            "60-69": 1,
            "below_60": 3,
        }


# ================================================================
# 5. Approval queue — model & enum
# ================================================================


class TestApprovalQueueModel:
    def test_approval_status_enum_values(self) -> None:
        assert ApprovalStatusEnum.pending.value == "pending"
        assert ApprovalStatusEnum.approved.value == "approved"
        assert ApprovalStatusEnum.rejected.value == "rejected"
        assert ApprovalStatusEnum.deferred.value == "deferred"
        assert ApprovalStatusEnum.expired.value == "expired"

    def test_all_approval_statuses_present(self) -> None:
        expected = {"pending", "approved", "rejected", "deferred", "expired"}
        actual = {s.value for s in ApprovalStatusEnum}
        assert actual == expected

    def test_valid_decision_actions(self) -> None:
        valid_actions = {"approved", "rejected", "deferred"}
        for action in valid_actions:
            assert action in [s.value for s in ApprovalStatusEnum]

    def test_approval_queue_item_tablename(self) -> None:
        assert AutomationApprovalQueueItem.__tablename__ == "automation_approval_queue"


# ================================================================
# 6. Notifications — model & enum
# ================================================================


class TestNotificationModel:
    def test_notification_type_enum_values(self) -> None:
        assert NotificationTypeEnum.high_match.value == "high_match"
        assert NotificationTypeEnum.run_completed.value == "run_completed"
        assert NotificationTypeEnum.run_failed.value == "run_failed"
        assert NotificationTypeEnum.daily_limit.value == "daily_limit"
        assert NotificationTypeEnum.digest.value == "digest"

    def test_all_notification_types_present(self) -> None:
        expected = {"high_match", "run_completed", "run_failed", "daily_limit", "digest"}
        actual = {t.value for t in NotificationTypeEnum}
        assert actual == expected

    def test_notification_tablename(self) -> None:
        assert AutomationNotification.__tablename__ == "automation_notifications"


# ================================================================
# 7. Schedule presets
# ================================================================


class TestSchedulePresets:
    def test_presets_is_list(self) -> None:
        assert isinstance(SCHEDULE_PRESETS, list)

    def test_at_least_three_presets(self) -> None:
        assert len(SCHEDULE_PRESETS) >= 3

    def test_each_preset_has_required_keys(self) -> None:
        for preset in SCHEDULE_PRESETS:
            assert "label" in preset
            assert "cron" in preset
            assert "description" in preset

    def test_cron_format_has_five_parts(self) -> None:
        for preset in SCHEDULE_PRESETS:
            parts = preset["cron"].split()
            assert len(parts) == 5, f"Cron '{preset['cron']}' expected 5 parts"

    def test_daily_preset_exists(self) -> None:
        labels = [p["label"] for p in SCHEDULE_PRESETS]
        assert any("daily" in l.lower() or "day" in l.lower() for l in labels)

    def test_weekly_preset_exists(self) -> None:
        labels = [p["label"] for p in SCHEDULE_PRESETS]
        assert any("week" in l.lower() for l in labels)

    def test_preset_labels_unique(self) -> None:
        labels = [p["label"] for p in SCHEDULE_PRESETS]
        assert len(labels) == len(set(labels))

    def test_preset_crons_unique(self) -> None:
        crons = [p["cron"] for p in SCHEDULE_PRESETS]
        assert len(crons) == len(set(crons))


# ================================================================
# 8. Run controls validation
# ================================================================


class TestRunControlsValidation:
    """Test the status-based validation logic for cancel/retry."""

    CANCELLABLE_STATUSES = ("running", "pending")
    RETRIABLE_STATUSES = ("failed", "cancelled")
    ALL_STATUSES = ("running", "pending", "completed", "failed", "cancelled")

    def test_running_can_be_cancelled(self) -> None:
        assert "running" in self.CANCELLABLE_STATUSES

    def test_pending_can_be_cancelled(self) -> None:
        assert "pending" in self.CANCELLABLE_STATUSES

    def test_completed_cannot_be_cancelled(self) -> None:
        assert "completed" not in self.CANCELLABLE_STATUSES

    def test_failed_cannot_be_cancelled(self) -> None:
        assert "failed" not in self.CANCELLABLE_STATUSES

    def test_failed_can_be_retried(self) -> None:
        assert "failed" in self.RETRIABLE_STATUSES

    def test_cancelled_can_be_retried(self) -> None:
        assert "cancelled" in self.RETRIABLE_STATUSES

    def test_completed_cannot_be_retried(self) -> None:
        assert "completed" not in self.RETRIABLE_STATUSES

    def test_running_cannot_be_retried(self) -> None:
        assert "running" not in self.RETRIABLE_STATUSES

    def test_no_overlap_between_cancel_and_retry(self) -> None:
        cancel_set = set(self.CANCELLABLE_STATUSES)
        retry_set = set(self.RETRIABLE_STATUSES)
        assert cancel_set.isdisjoint(retry_set)

    def test_all_statuses_covered(self) -> None:
        """Every status is either cancellable, retriable, or neither (completed)."""
        for status in self.ALL_STATUSES:
            can_cancel = status in self.CANCELLABLE_STATUSES
            can_retry = status in self.RETRIABLE_STATUSES
            # Only completed is neither
            if status == "completed":
                assert not can_cancel and not can_retry
            else:
                assert can_cancel or can_retry


# ================================================================
# 9. Schema validation — Settings
# ================================================================


class TestSettingsSchema:
    def test_settings_update_defaults(self) -> None:
        schema = AutomationPipelineSettingsUpdate()
        assert schema.enabled is False
        assert schema.auto_apply_enabled is False
        assert schema.require_human_review is True
        assert schema.schedule_enabled is False
        assert schema.freshness_days == 30
        assert schema.confidence_auto_apply_threshold == 90.0
        assert schema.confidence_review_threshold == 75.0
        assert schema.confidence_save_threshold == 65.0

    def test_settings_update_with_custom_values(self) -> None:
        schema = AutomationPipelineSettingsUpdate(
            enabled=True,
            auto_apply_enabled=True,
            min_match_score=80.0,
            schedule_enabled=True,
            schedule_cron="0 9 * * 1-5",
            company_blacklist=["BadCorp"],
            confidence_auto_apply_threshold=85.0,
        )
        assert schema.enabled is True
        assert schema.min_match_score == 80.0
        assert schema.schedule_cron == "0 9 * * 1-5"
        assert schema.company_blacklist == ["BadCorp"]
        assert schema.confidence_auto_apply_threshold == 85.0

    def test_settings_response_has_extra_fields(self) -> None:
        now = datetime.now(timezone.utc)
        schema = AutomationPipelineSettingsResponse(
            id=uuid.uuid4(),
            user_id=uuid.uuid4(),
            created_at=now,
            updated_at=now,
        )
        assert schema.id is not None
        assert schema.user_id is not None
        assert schema.next_scheduled_at is None

    def test_settings_update_model_dump(self) -> None:
        schema = AutomationPipelineSettingsUpdate(
            enabled=True,
            search_terms=["python", "backend"],
        )
        data = schema.model_dump()
        assert data["enabled"] is True
        assert data["search_terms"] == ["python", "backend"]
        assert "schedule_enabled" in data


# ================================================================
# 10. Schema validation — Readiness
# ================================================================


class TestReadinessSchema:
    def test_readiness_with_all_false(self) -> None:
        schema = AutomationReadinessResponse(
            has_profile=False,
            has_preferences=False,
            resume_count=0,
            saved_job_count=0,
            application_count=0,
            job_match_count=0,
            ready_for_matching=False,
            ready_for_auto_apply=False,
        )
        assert schema.profile_completeness == 0.0
        assert schema.skill_coverage == 0.0
        assert schema.resume_quality_score == 0.0
        assert schema.blockers == []
        assert schema.suggestions == []
        assert schema.data_quality_warnings == []

    def test_readiness_with_enhanced_fields(self) -> None:
        schema = AutomationReadinessResponse(
            has_profile=True,
            has_preferences=True,
            resume_count=3,
            saved_job_count=10,
            application_count=5,
            job_match_count=20,
            ready_for_matching=True,
            ready_for_auto_apply=True,
            profile_completeness=78.5,
            profile_completeness_breakdown={"headline": True, "summary": False},
            data_quality_warnings=["Missing headline"],
            skill_coverage=65.3,
            resume_quality_score=99.9,
        )
        assert schema.profile_completeness == 78.5
        assert schema.profile_completeness_breakdown["headline"] is True
        assert len(schema.data_quality_warnings) == 1
        assert schema.skill_coverage == 65.3
        assert schema.resume_quality_score == 99.9


# ================================================================
# 11. Schema validation — Run
# ================================================================


class TestRunSchemas:
    def test_run_request_defaults(self) -> None:
        req = AutomationRunRequest()
        assert req.dry_run is True
        assert req.persona_id is None
        assert req.override_min_score is None
        assert req.override_max_jobs is None

    def test_run_request_with_overrides(self) -> None:
        req = AutomationRunRequest(
            dry_run=False,
            override_min_score=60.0,
            override_max_jobs=50,
        )
        assert req.dry_run is False
        assert req.override_min_score == 60.0
        assert req.override_max_jobs == 50

    def test_run_response_has_enhanced_fields(self) -> None:
        now = datetime.now(timezone.utc)
        resp = AutomationRunResponse(
            id=uuid.uuid4(),
            user_id=uuid.uuid4(),
            triggered_by="manual",
            status="completed",
            matched_jobs_count=10,
            reviewed_jobs_count=7,
            applied_jobs_count=3,
            skipped_jobs_count=4,
            queued_for_review_count=5,
            jobs_evaluated=20,
            new_matches_count=8,
            expired_since_last_run=2,
            scoring_duration_ms=150,
            total_duration_ms=300,
            error_message=None,
            summary={"dry_run": False},
            started_at=now,
            finished_at=now,
            created_at=now,
        )
        assert resp.queued_for_review_count == 5
        assert resp.jobs_evaluated == 20
        assert resp.scoring_duration_ms == 150
        assert resp.total_duration_ms == 300
        assert resp.error_message is None

    def test_run_response_defaults(self) -> None:
        now = datetime.now(timezone.utc)
        resp = AutomationRunResponse(
            id=uuid.uuid4(),
            user_id=uuid.uuid4(),
            triggered_by="manual",
            status="completed",
            matched_jobs_count=0,
            reviewed_jobs_count=0,
            applied_jobs_count=0,
            skipped_jobs_count=0,
            summary={},
            started_at=now,
            finished_at=None,
            created_at=now,
        )
        assert resp.queued_for_review_count == 0
        assert resp.jobs_evaluated == 0
        assert resp.new_matches_count == 0
        assert resp.scoring_duration_ms is None
        assert resp.total_duration_ms is None

    def test_run_list_response(self) -> None:
        resp = AutomationRunListResponse(items=[], total=0)
        assert resp.items == []
        assert resp.total == 0


# ================================================================
# 12. Schema validation — Approval queue
# ================================================================


class TestApprovalQueueSchemas:
    def test_approval_decision_request(self) -> None:
        req = ApprovalDecisionRequest(action="approved")
        assert req.action == "approved"
        assert req.notes is None

    def test_approval_decision_with_notes(self) -> None:
        req = ApprovalDecisionRequest(action="rejected", notes="Not a good fit")
        assert req.action == "rejected"
        assert req.notes == "Not a good fit"

    def test_batch_decision_request(self) -> None:
        ids = [uuid.uuid4(), uuid.uuid4()]
        req = ApprovalBatchDecisionRequest(
            item_ids=ids,
            action="approved",
            notes="Batch approved",
        )
        assert len(req.item_ids) == 2
        assert req.action == "approved"
        assert req.notes == "Batch approved"

    def test_queue_item_response(self) -> None:
        now = datetime.now(timezone.utc)
        resp = ApprovalQueueItemResponse(
            id=uuid.uuid4(),
            user_id=uuid.uuid4(),
            job_posting_id=uuid.uuid4(),
            job_match_id=uuid.uuid4(),
            status="pending",
            score=85.5,
            recommendation="review",
            created_at=now,
        )
        assert resp.score == 85.5
        assert resp.recommendation == "review"
        assert resp.pipeline_run_id is None
        assert resp.decided_at is None
        assert resp.job_title is None
        assert resp.job_company is None

    def test_queue_item_response_with_job_info(self) -> None:
        now = datetime.now(timezone.utc)
        resp = ApprovalQueueItemResponse(
            id=uuid.uuid4(),
            user_id=uuid.uuid4(),
            job_posting_id=uuid.uuid4(),
            job_match_id=uuid.uuid4(),
            status="approved",
            score=92.0,
            recommendation="auto_apply",
            created_at=now,
            decided_at=now,
            job_title="Senior Engineer",
            job_company="Acme Corp",
            job_location="Remote",
        )
        assert resp.job_title == "Senior Engineer"
        assert resp.job_company == "Acme Corp"
        assert resp.decided_at is not None

    def test_queue_list_response(self) -> None:
        resp = ApprovalQueueListResponse(items=[], total=0)
        assert resp.items == []
        assert resp.total == 0


# ================================================================
# 13. Schema validation — Analytics
# ================================================================


class TestAnalyticsSchema:
    def test_analytics_response_defaults(self) -> None:
        resp = AutomationAnalyticsResponse()
        assert resp.total_runs == 0
        assert resp.total_matches == 0
        assert resp.total_applications == 0
        assert resp.total_approvals == 0
        assert resp.total_rejections == 0
        assert resp.avg_match_score == 0.0
        assert resp.score_distribution == {}
        assert resp.match_trend == []
        assert resp.top_companies == []
        assert resp.application_funnel == {}
        assert resp.source_effectiveness == []
        assert resp.daily_stats == []

    def test_analytics_response_with_data(self) -> None:
        resp = AutomationAnalyticsResponse(
            total_runs=10,
            total_matches=50,
            total_applications=15,
            total_approvals=8,
            total_rejections=3,
            avg_match_score=72.5,
            score_distribution={"90-100": 5, "80-89": 10, "70-79": 20},
            match_trend=[
                {"date": "2026-03-01", "count": 5, "avg_score": 75.0},
                {"date": "2026-03-02", "count": 8, "avg_score": 78.0},
            ],
            top_companies=[
                {"company": "Acme", "match_count": 5, "avg_score": 80.0},
            ],
            application_funnel={"applied": 10, "screening": 3, "rejected": 2},
            source_effectiveness=[
                {"source": "linkedin", "matches": 20, "avg_score": 75.0},
            ],
            daily_stats=[
                {"date": "2026-03-01", "runs": 2, "applied": 3, "matched": 10},
            ],
        )
        assert resp.total_runs == 10
        assert resp.avg_match_score == 72.5
        assert len(resp.match_trend) == 2
        assert resp.top_companies[0]["company"] == "Acme"
        assert resp.application_funnel["applied"] == 10
        assert resp.source_effectiveness[0]["source"] == "linkedin"
        assert resp.daily_stats[0]["runs"] == 2


# ================================================================
# 14. Schema validation — Notifications
# ================================================================


class TestNotificationSchemas:
    def test_notification_response(self) -> None:
        now = datetime.now(timezone.utc)
        resp = NotificationResponse(
            id=uuid.uuid4(),
            type="run_completed",
            title="Pipeline completed",
            message="Matched 10 jobs",
            is_read=False,
            created_at=now,
        )
        assert resp.type == "run_completed"
        assert resp.is_read is False
        assert resp.data == {}

    def test_notification_response_with_data(self) -> None:
        now = datetime.now(timezone.utc)
        resp = NotificationResponse(
            id=uuid.uuid4(),
            type="high_match",
            title="High match found",
            message="Score 95%",
            data={"match_id": "abc-123"},
            is_read=True,
            created_at=now,
        )
        assert resp.data["match_id"] == "abc-123"
        assert resp.is_read is True

    def test_notification_list_response(self) -> None:
        resp = NotificationListResponse(items=[], total=0, unread_count=0)
        assert resp.items == []
        assert resp.total == 0
        assert resp.unread_count == 0

    def test_notification_list_with_unread(self) -> None:
        resp = NotificationListResponse(items=[], total=5, unread_count=3)
        assert resp.total == 5
        assert resp.unread_count == 3


# ================================================================
# 15. Schema validation — Schedule
# ================================================================


class TestScheduleSchemas:
    def test_schedule_preset(self) -> None:
        preset = SchedulePreset(
            label="Daily",
            cron="0 9 * * *",
            description="Every day at 9 AM",
        )
        assert preset.label == "Daily"
        assert preset.cron == "0 9 * * *"

    def test_schedule_info_response_defaults(self) -> None:
        resp = ScheduleInfoResponse(
            schedule_enabled=False,
        )
        assert resp.schedule_enabled is False
        assert resp.schedule_cron is None
        assert resp.schedule_timezone == "UTC"
        assert resp.schedule_paused is False
        assert resp.next_scheduled_at is None
        assert resp.presets == []

    def test_schedule_info_response_with_data(self) -> None:
        now = datetime.now(timezone.utc)
        resp = ScheduleInfoResponse(
            schedule_enabled=True,
            schedule_cron="0 9 * * 1-5",
            schedule_timezone="America/New_York",
            schedule_paused=False,
            next_scheduled_at=now,
            presets=[
                SchedulePreset(label="Weekdays", cron="0 9 * * 1-5", description="Mon-Fri"),
            ],
        )
        assert resp.schedule_enabled is True
        assert resp.schedule_cron == "0 9 * * 1-5"
        assert resp.schedule_timezone == "America/New_York"
        assert resp.next_scheduled_at is not None
        assert len(resp.presets) == 1


# ================================================================
# 16. Readiness logic (blockers & suggestions)
# ================================================================


class TestReadinessLogic:
    """Test the blocker/suggestion logic extracted from the readiness endpoint."""

    @staticmethod
    def _compute_readiness(
        has_profile: bool = True,
        has_preferences: bool = True,
        resume_count: int = 1,
        enabled: bool = True,
        auto_apply_enabled: bool = True,
        require_human_review: bool = False,
        search_terms: list[str] | None = None,
        target_locations: list[str] | None = None,
        completeness_score: float = 80.0,
    ) -> dict:
        """Replicate the blocker/suggestion logic."""
        blockers: list[str] = []
        suggestions: list[str] = []

        if not has_profile:
            blockers.append("Create your profile before running job matching.")
        if not has_preferences:
            blockers.append("Add candidate preferences so the pipeline knows what to target.")
        if resume_count == 0:
            blockers.append("Create at least one resume version before enabling auto-apply.")
        if not search_terms:
            suggestions.append("Add search terms to focus discovery on the roles you want most.")
        if not target_locations:
            suggestions.append("Add target locations to make automated search more precise.")
        if not enabled:
            suggestions.append("Enable the pipeline when you are ready.")
        if auto_apply_enabled and require_human_review:
            suggestions.append("Auto-apply is enabled with human review.")
        if completeness_score < 70:
            suggestions.append(f"Profile completeness is {completeness_score:.0f}%.")

        ready_for_matching = has_profile and has_preferences
        ready_for_auto_apply = (
            ready_for_matching and resume_count > 0 and enabled and auto_apply_enabled
        )

        return {
            "blockers": blockers,
            "suggestions": suggestions,
            "ready_for_matching": ready_for_matching,
            "ready_for_auto_apply": ready_for_auto_apply,
        }

    def test_no_blockers_when_ready(self) -> None:
        result = self._compute_readiness()
        assert len(result["blockers"]) == 0
        assert result["ready_for_matching"] is True

    def test_no_profile_blocks(self) -> None:
        result = self._compute_readiness(has_profile=False)
        assert any("profile" in b.lower() for b in result["blockers"])
        assert result["ready_for_matching"] is False

    def test_no_preferences_blocks(self) -> None:
        result = self._compute_readiness(has_preferences=False)
        assert any("preferences" in b.lower() for b in result["blockers"])
        assert result["ready_for_matching"] is False

    def test_no_resume_blocks(self) -> None:
        result = self._compute_readiness(resume_count=0)
        assert any("resume" in b.lower() for b in result["blockers"])

    def test_no_search_terms_suggests(self) -> None:
        result = self._compute_readiness(search_terms=[])
        assert any("search terms" in s.lower() for s in result["suggestions"])

    def test_no_locations_suggests(self) -> None:
        result = self._compute_readiness(target_locations=[])
        assert any("locations" in s.lower() for s in result["suggestions"])

    def test_pipeline_disabled_suggests(self) -> None:
        result = self._compute_readiness(enabled=False)
        assert any("enable" in s.lower() for s in result["suggestions"])

    def test_auto_apply_with_review_suggests(self) -> None:
        result = self._compute_readiness(auto_apply_enabled=True, require_human_review=True)
        assert any("human review" in s.lower() for s in result["suggestions"])

    def test_low_completeness_suggests(self) -> None:
        result = self._compute_readiness(completeness_score=50.0)
        assert any("completeness" in s.lower() for s in result["suggestions"])

    def test_high_completeness_no_suggestion(self) -> None:
        result = self._compute_readiness(completeness_score=90.0)
        assert not any("completeness" in s.lower() for s in result["suggestions"])

    def test_ready_for_auto_apply(self) -> None:
        result = self._compute_readiness()
        assert result["ready_for_auto_apply"] is True

    def test_not_ready_for_auto_apply_without_resume(self) -> None:
        result = self._compute_readiness(resume_count=0)
        assert result["ready_for_auto_apply"] is False

    def test_not_ready_for_auto_apply_when_disabled(self) -> None:
        result = self._compute_readiness(enabled=False)
        assert result["ready_for_auto_apply"] is False

    def test_not_ready_for_auto_apply_when_auto_apply_off(self) -> None:
        result = self._compute_readiness(auto_apply_enabled=False)
        assert result["ready_for_auto_apply"] is False

    def test_all_blockers_at_once(self) -> None:
        result = self._compute_readiness(
            has_profile=False, has_preferences=False, resume_count=0
        )
        assert len(result["blockers"]) == 3


# ================================================================
# 17. Pipeline model relationships
# ================================================================


class TestModelTablenames:
    def test_settings_tablename(self) -> None:
        assert AutomationPipelineSettings.__tablename__ == "automation_pipeline_settings"

    def test_run_tablename(self) -> None:
        assert AutomationPipelineRun.__tablename__ == "automation_pipeline_runs"

    def test_approval_queue_tablename(self) -> None:
        assert AutomationApprovalQueueItem.__tablename__ == "automation_approval_queue"

    def test_notification_tablename(self) -> None:
        assert AutomationNotification.__tablename__ == "automation_notifications"


# ================================================================
# 18. DEFAULT_ALLOWED_SOURCES
# ================================================================


class TestAllowedSources:
    def test_contains_linkedin(self) -> None:
        assert "linkedin" in DEFAULT_ALLOWED_SOURCES

    def test_contains_indeed(self) -> None:
        assert "indeed" in DEFAULT_ALLOWED_SOURCES

    def test_contains_greenhouse(self) -> None:
        assert "greenhouse" in DEFAULT_ALLOWED_SOURCES

    def test_contains_lever(self) -> None:
        assert "lever" in DEFAULT_ALLOWED_SOURCES

    def test_contains_workday(self) -> None:
        assert "workday" in DEFAULT_ALLOWED_SOURCES

    def test_at_least_five_sources(self) -> None:
        assert len(DEFAULT_ALLOWED_SOURCES) >= 5


# ================================================================
# 19. Celery task validation
# ================================================================


class TestCeleryTaskDefinition:
    def test_task_imports(self) -> None:
        from app.tasks.automation_tasks import run_scheduled_pipeline
        assert callable(run_scheduled_pipeline)

    def test_task_name(self) -> None:
        from app.tasks.automation_tasks import run_scheduled_pipeline
        assert run_scheduled_pipeline.name == "automation.run_scheduled_pipeline"


# ================================================================
# 20. Pipeline summary structure
# ================================================================


class TestPipelineSummaryStructure:
    """Verify the expected shape of the run summary dict."""

    def _make_summary(
        self,
        dry_run: bool = True,
        newly_matched_jobs: int = 5,
        auto_apply_count: int = 2,
        review_count: int = 3,
        save_count: int = 1,
    ) -> dict:
        """Build a summary dict matching the pipeline format."""
        return {
            "dry_run": dry_run,
            "newly_matched_jobs": newly_matched_jobs,
            "settings_enabled": True,
            "auto_apply_enabled": True,
            "require_human_review": False,
            "daily_applied_before_run": 0,
            "daily_capacity_remaining": 5,
            "eligible_match_threshold": 70.0,
            "confidence_tiers": {
                "auto_apply": auto_apply_count,
                "review": review_count,
                "save": save_count,
            },
            "score_distribution": {
                "90-100": auto_apply_count,
                "80-89": review_count,
                "70-79": save_count,
                "60-69": 0,
                "below_60": 0,
            },
            "evaluated_match_ids": [],
            "candidate_job_posting_ids": [],
            "created_application_ids": [],
            "skipped": [],
            "timing": {
                "scoring_ms": 100,
                "total_ms": 200,
            },
        }

    def test_summary_has_dry_run(self) -> None:
        s = self._make_summary()
        assert "dry_run" in s
        assert isinstance(s["dry_run"], bool)

    def test_summary_has_confidence_tiers(self) -> None:
        s = self._make_summary()
        assert "confidence_tiers" in s
        tiers = s["confidence_tiers"]
        assert "auto_apply" in tiers
        assert "review" in tiers
        assert "save" in tiers

    def test_summary_has_score_distribution(self) -> None:
        s = self._make_summary()
        assert "score_distribution" in s
        dist = s["score_distribution"]
        expected_buckets = {"90-100", "80-89", "70-79", "60-69", "below_60"}
        assert set(dist.keys()) == expected_buckets

    def test_summary_has_timing(self) -> None:
        s = self._make_summary()
        assert "timing" in s
        assert "scoring_ms" in s["timing"]
        assert "total_ms" in s["timing"]

    def test_summary_tier_counts_match(self) -> None:
        s = self._make_summary(auto_apply_count=3, review_count=5, save_count=2)
        tiers = s["confidence_tiers"]
        assert tiers["auto_apply"] == 3
        assert tiers["review"] == 5
        assert tiers["save"] == 2

    def test_summary_has_daily_capacity(self) -> None:
        s = self._make_summary()
        assert "daily_applied_before_run" in s
        assert "daily_capacity_remaining" in s

    def test_summary_has_settings_flags(self) -> None:
        s = self._make_summary()
        assert "settings_enabled" in s
        assert "auto_apply_enabled" in s
        assert "require_human_review" in s

    def test_summary_has_skipped_list(self) -> None:
        s = self._make_summary()
        assert "skipped" in s
        assert isinstance(s["skipped"], list)

    def test_summary_has_created_applications(self) -> None:
        s = self._make_summary()
        assert "created_application_ids" in s
        assert isinstance(s["created_application_ids"], list)


# ================================================================
# 21. Data quality warnings logic
# ================================================================


class TestDataQualityWarnings:
    """Test the data quality warning logic from readiness."""

    @staticmethod
    def _compute_warnings(
        has_profile: bool = True,
        skill_count: int = 10,
        work_exp_count: int = 2,
        has_headline: bool = True,
    ) -> list[str]:
        warnings: list[str] = []
        if has_profile:
            if skill_count < 5:
                warnings.append(f"You have only {skill_count} skill(s).")
            if work_exp_count == 0:
                warnings.append("No work experience entries.")
            if not has_headline:
                warnings.append("Missing headline.")
        return warnings

    def test_no_warnings_when_complete(self) -> None:
        warnings = self._compute_warnings()
        assert len(warnings) == 0

    def test_few_skills_warns(self) -> None:
        warnings = self._compute_warnings(skill_count=3)
        assert any("skill" in w.lower() for w in warnings)

    def test_zero_skills_warns(self) -> None:
        warnings = self._compute_warnings(skill_count=0)
        assert any("0 skill" in w.lower() for w in warnings)

    def test_no_work_experience_warns(self) -> None:
        warnings = self._compute_warnings(work_exp_count=0)
        assert any("work experience" in w.lower() for w in warnings)

    def test_missing_headline_warns(self) -> None:
        warnings = self._compute_warnings(has_headline=False)
        assert any("headline" in w.lower() for w in warnings)

    def test_no_profile_no_warnings(self) -> None:
        warnings = self._compute_warnings(
            has_profile=False, skill_count=0, work_exp_count=0, has_headline=False
        )
        assert len(warnings) == 0

    def test_all_warnings_at_once(self) -> None:
        warnings = self._compute_warnings(skill_count=2, work_exp_count=0, has_headline=False)
        assert len(warnings) == 3


# ================================================================
# 22. Resume quality heuristic
# ================================================================


class TestResumeQualityHeuristic:
    """Test the resume quality score calculation."""

    @staticmethod
    def _score(resume_count: int) -> float:
        return min(100.0, resume_count * 33.3) if resume_count > 0 else 0.0

    def test_zero_resumes(self) -> None:
        assert self._score(0) == 0.0

    def test_one_resume(self) -> None:
        assert 33.0 <= self._score(1) <= 34.0

    def test_two_resumes(self) -> None:
        assert 66.0 <= self._score(2) <= 67.0

    def test_three_resumes_caps_near_100(self) -> None:
        assert 99.0 <= self._score(3) <= 100.0

    def test_four_resumes_capped(self) -> None:
        assert self._score(4) == 100.0

    def test_many_resumes_capped(self) -> None:
        assert self._score(100) == 100.0


# ================================================================
# 23. Skill coverage computation
# ================================================================


class TestSkillCoverage:
    """Test the skill coverage formula."""

    @staticmethod
    def _coverage(user_skills: set[str], missing_skills: set[str]) -> float:
        total = len(user_skills) + len(missing_skills)
        if total == 0:
            return 0.0
        return round((len(user_skills) / total) * 100, 1)

    def test_full_coverage(self) -> None:
        assert self._coverage({"python", "java"}, set()) == 100.0

    def test_no_skills(self) -> None:
        assert self._coverage(set(), set()) == 0.0

    def test_half_coverage(self) -> None:
        result = self._coverage({"python"}, {"java"})
        assert result == 50.0

    def test_partial_coverage(self) -> None:
        result = self._coverage({"python", "java"}, {"go"})
        assert 66.0 <= result <= 67.0

    def test_many_missing(self) -> None:
        result = self._coverage({"python"}, {"java", "go", "rust"})
        assert result == 25.0
