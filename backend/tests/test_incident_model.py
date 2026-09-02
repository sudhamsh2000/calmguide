from datetime import UTC, datetime, timezone

import pytest

from app.models.incident import Incident
from app.services.crypto import decrypt, encrypt


def test_incident_model_fields():
    """Incident model has all required fields with correct types."""
    incident = Incident(
        profile_id="test-profile-id",
        source="manual",
        incident_time=datetime.now(UTC),
        behavior_category="aggression_anger",
        behavior_description=encrypt("Patient hit caregiver during bathing"),
    )
    assert incident.profile_id == "test-profile-id"
    assert incident.source == "manual"
    assert incident.behavior_category == "aggression_anger"
    assert incident.behavior_description.startswith("ENC:")
    assert decrypt(incident.behavior_description) == "Patient hit caregiver during bathing"


def test_incident_encrypted_fields_roundtrip():
    """Encrypted narrative fields survive encrypt/decrypt roundtrip."""
    incident = Incident(
        profile_id="p1",
        source="auto_extracted",
        incident_time=datetime.now(UTC),
        behavior_category="wandering_exit_seeking",
        behavior_description=encrypt("Tried to leave at 2am"),
        antecedent_description=encrypt("Patient woke up confused"),
        intervention_description=encrypt("Played Sinatra, offered warm milk"),
    )
    assert decrypt(incident.behavior_description) == "Tried to leave at 2am"
    assert decrypt(incident.antecedent_description) == "Patient woke up confused"
    assert decrypt(incident.intervention_description) == "Played Sinatra, offered warm milk"


def test_incident_nullable_fields():
    """Optional fields default to None."""
    incident = Incident(
        profile_id="p1",
        source="manual",
        incident_time=datetime.now(UTC),
        behavior_category="other",
        behavior_description=encrypt("Something happened"),
    )
    assert incident.severity is None
    assert incident.antecedent_description is None
    assert incident.intervention_description is None
    assert incident.intervention_outcome is None
    assert incident.caregiver_role is None
    assert incident.extraction_confidence is None
    # verified_by_caregiver and recall_confidence defaults apply at INSERT time
    # In-memory objects before flush may be None
    assert incident.verified_by_caregiver in (False, None)
    assert incident.recall_confidence in ("high", None)


def test_incident_valid_behavior_categories():
    """Behavior category must be one of the defined values."""
    valid_categories = [
        "aggression_anger",
        "confusion_disorientation",
        "wandering_exit_seeking",
        "refusing_care",
        "sleep_problems",
        "hallucinations",
        "repetitive_behavior",
        "other",
    ]
    for cat in valid_categories:
        incident = Incident(
            profile_id="p1",
            source="manual",
            incident_time=datetime.now(UTC),
            behavior_category=cat,
            behavior_description=encrypt("test"),
        )
        assert incident.behavior_category == cat
