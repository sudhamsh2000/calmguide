from datetime import UTC, date, datetime, timezone

import pytest
from pydantic import ValidationError

from app.schemas.care_change import CareChangeCreate, CareChangeResponse
from app.schemas.incident import IncidentCreate, IncidentResponse, IncidentUpdate


class TestIncidentCreate:
    def test_minimal(self):
        data = IncidentCreate(
            behavior_category="aggression_anger",
            behavior_description="Patient hit caregiver",
            incident_time=datetime.now(UTC),
        )
        assert data.behavior_category == "aggression_anger"
        assert data.source == "manual"

    def test_rejects_invalid_category(self):
        with pytest.raises(ValidationError):
            IncidentCreate(
                behavior_category="invalid_category",
                behavior_description="test",
                incident_time=datetime.now(UTC),
            )

    def test_rejects_empty_description(self):
        with pytest.raises(ValidationError):
            IncidentCreate(
                behavior_category="other",
                behavior_description="",
                incident_time=datetime.now(UTC),
            )

    def test_full(self):
        data = IncidentCreate(
            behavior_category="wandering_exit_seeking",
            behavior_description="Tried to leave through front door",
            incident_time=datetime.now(UTC),
            severity="moderate",
            duration_category="minutes",
            antecedent_description="Patient woke up confused",
            antecedent_category="physical_state",
            intervention_description="Played music, offered warm milk",
            intervention_outcome="resolved",
            location="front_door",
            caregiver_role="spouse",
            is_recurring=True,
        )
        assert data.severity == "moderate"
        assert data.intervention_outcome == "resolved"
        assert data.caregiver_role == "spouse"

    def test_rejects_invalid_severity(self):
        with pytest.raises(ValidationError):
            IncidentCreate(
                behavior_category="other",
                behavior_description="test",
                incident_time=datetime.now(UTC),
                severity="critical",
            )

    def test_rejects_invalid_outcome(self):
        with pytest.raises(ValidationError):
            IncidentCreate(
                behavior_category="other",
                behavior_description="test",
                incident_time=datetime.now(UTC),
                intervention_outcome="fixed",
            )

    def test_rejects_invalid_caregiver_role(self):
        with pytest.raises(ValidationError):
            IncidentCreate(
                behavior_category="other",
                behavior_description="test",
                incident_time=datetime.now(UTC),
                caregiver_role="doctor",
            )

    def test_all_behavior_categories_valid(self):
        categories = [
            "aggression_anger",
            "confusion_disorientation",
            "wandering_exit_seeking",
            "refusing_care",
            "sleep_problems",
            "hallucinations",
            "repetitive_behavior",
            "other",
        ]
        for cat in categories:
            data = IncidentCreate(
                behavior_category=cat,
                behavior_description="test",
                incident_time=datetime.now(UTC),
            )
            assert data.behavior_category == cat


class TestIncidentUpdate:
    def test_all_fields_optional(self):
        data = IncidentUpdate()
        assert data.behavior_category is None
        assert data.behavior_description is None

    def test_partial_update(self):
        data = IncidentUpdate(severity="severe", intervention_outcome="escalated")
        assert data.severity == "severe"
        assert data.behavior_category is None


class TestCareChangeCreate:
    def test_minimal(self):
        data = CareChangeCreate(
            change_date=date(2026, 4, 29),
            description="Started new medication",
        )
        assert data.observation_window_days == 28

    def test_custom_window(self):
        data = CareChangeCreate(
            change_date=date(2026, 4, 29),
            description="Dosage increase",
            observation_window_days=14,
        )
        assert data.observation_window_days == 14

    def test_rejects_short_window(self):
        with pytest.raises(ValidationError):
            CareChangeCreate(
                change_date=date(2026, 4, 29),
                description="test",
                observation_window_days=3,
            )

    def test_rejects_long_window(self):
        with pytest.raises(ValidationError):
            CareChangeCreate(
                change_date=date(2026, 4, 29),
                description="test",
                observation_window_days=100,
            )

    def test_rejects_empty_description(self):
        with pytest.raises(ValidationError):
            CareChangeCreate(
                change_date=date(2026, 4, 29),
                description="",
            )
