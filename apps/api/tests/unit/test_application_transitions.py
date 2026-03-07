"""Unit tests for application status transition logic."""
import pytest

from app.api.v1.endpoints.applications import VALID_TRANSITIONS


class TestStatusTransitions:
    def test_saved_can_transition_to_applied(self) -> None:
        assert "applied" in VALID_TRANSITIONS["saved"]

    def test_saved_can_transition_to_withdrawn(self) -> None:
        assert "withdrawn" in VALID_TRANSITIONS["saved"]

    def test_rejected_has_no_transitions(self) -> None:
        assert VALID_TRANSITIONS["rejected"] == []

    def test_accepted_has_no_transitions(self) -> None:
        assert VALID_TRANSITIONS["accepted"] == []

    def test_withdrawn_has_no_transitions(self) -> None:
        assert VALID_TRANSITIONS["withdrawn"] == []

    def test_offer_can_be_accepted_or_rejected(self) -> None:
        transitions = VALID_TRANSITIONS["offer"]
        assert "accepted" in transitions
        assert "rejected" in transitions

    def test_all_terminal_states_have_empty_transitions(self) -> None:
        terminal = ["rejected", "withdrawn", "accepted"]
        for state in terminal:
            assert VALID_TRANSITIONS[state] == [], f"{state} should be terminal"

    def test_no_invalid_status_values(self) -> None:
        valid_statuses = set(VALID_TRANSITIONS.keys())
        all_targets = {t for targets in VALID_TRANSITIONS.values() for t in targets}
        assert all_targets.issubset(valid_statuses), "All transition targets must be valid statuses"
