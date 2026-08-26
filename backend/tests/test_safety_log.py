"""Tests for the safety_log helper — writes categorical-only SafetyEvent rows."""

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker

import app.db as db_module
from app.models.safety_event import SafetyEvent
from app.services.safety_log import log_safety_event


@pytest.fixture
def _wire_session_factory(db_engine):
    db_module._session_factory = async_sessionmaker(db_engine, expire_on_commit=False)
    db_module._engine = db_engine
    yield
    db_module._session_factory = None
    db_module._engine = None


@pytest.mark.asyncio
async def test_log_safety_event_writes_row(_wire_session_factory, db_session):
    await log_safety_event(
        event_type="safety_gate_triggered",
        source="deterministic_gate",
        category="life_threat",
        profile_id="profile-1",
        session_id="session-1",
        locale_code="en",
        details={"pattern_group": "life_threat"},
    )

    result = await db_session.execute(select(SafetyEvent))
    rows = result.scalars().all()
    assert len(rows) == 1
    row = rows[0]
    assert row.event_type == "safety_gate_triggered"
    assert row.source == "deterministic_gate"
    assert row.category == "life_threat"
    assert row.profile_id == "profile-1"
    assert row.details == {"pattern_group": "life_threat"}


@pytest.mark.asyncio
async def test_log_safety_event_allows_nullable_staff_and_facility(_wire_session_factory, db_session):
    """B2C safety events have no staff/facility — must not fail to insert."""
    await log_safety_event(
        event_type="acute_change_screen",
        source="acute_change_screen",
        category="proceed_to_coaching",
        profile_id="profile-2",
        session_id=None,
        staff_id=None,
        facility_id=None,
    )
    result = await db_session.execute(select(SafetyEvent))
    rows = result.scalars().all()
    assert len(rows) == 1
    assert rows[0].staff_id is None
    assert rows[0].facility_id is None
