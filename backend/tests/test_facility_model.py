"""Unit tests for B2B identity models — no database required."""

from app.models.audit_log import AuditLog
from app.models.facility import Facility
from app.models.facility_patient_link import FacilityPatientLink
from app.models.staff import Staff
from app.models.staff_patient_assignment import StaffPatientAssignment
from app.services.auth import hash_access_code


def test_facility_model_fields():
    facility = Facility(
        name="Sunrise Memory Care",
        facility_code_hash=hash_access_code("SRMC4K7P"),
        is_active=True,
    )
    assert facility.name == "Sunrise Memory Care"
    assert facility.is_active is True


def test_facility_code_hash():
    code = "SRMC4K7P"
    facility = Facility(
        name="Test Facility",
        facility_code_hash=hash_access_code(code),
    )
    assert facility.facility_code_hash == hash_access_code(code)
    assert facility.facility_code_hash != code


def test_staff_model_fields():
    staff = Staff(
        facility_id="fac-123",
        name="Aisha Johnson",
        role="staff",
        is_active=True,
        failed_login_count=0,
    )
    assert staff.name == "Aisha Johnson"
    assert staff.role == "staff"
    assert staff.is_active is True
    assert staff.failed_login_count == 0
    assert staff.email is None
    assert staff.pin_hash is None
    assert staff.password_hash is None


def test_staff_admin_with_email():
    staff = Staff(
        facility_id="fac-123",
        name="Dr. Williams",
        email="williams@sunrise.com",
        role="admin",
        password_hash="$2b$12$fakehash",
    )
    assert staff.email == "williams@sunrise.com"
    assert staff.role == "admin"
    assert staff.password_hash is not None


def test_assignment_fields():
    assignment = StaffPatientAssignment(
        staff_id="staff-1",
        profile_id="profile-1",
        facility_id="fac-1",
        is_primary=False,
    )
    assert assignment.is_primary is False
    assert assignment.shift_pattern is None
    assert assignment.ended_at is None


def test_facility_patient_link_fields():
    link = FacilityPatientLink(
        facility_id="fac-1",
        profile_id="profile-1",
        is_active=True,
    )
    assert link.is_active is True
    assert link.room is None
    assert link.linked_by is None


def test_audit_log_fields():
    log = AuditLog(
        user_id="staff-1",
        user_name="Aisha Johnson",
        user_role="staff",
        action="READ",
        resource_type="patient_profile",
        resource_id="profile-1",
        facility_id="fac-1",
        outcome="SUCCESS",
    )
    assert log.action == "READ"
    assert log.outcome == "SUCCESS"
    assert log.source_ip is None


def test_staff_language_preference():
    staff = Staff(
        facility_id="fac-1",
        name="Maria Rodriguez",
        role="staff",
        language_preference="es-ES",
    )
    assert staff.language_preference == "es-ES"


def test_assignment_with_shift():
    assignment = StaffPatientAssignment(
        staff_id="staff-1",
        profile_id="profile-1",
        facility_id="fac-1",
        shift_pattern="night",
        is_primary=True,
    )
    assert assignment.shift_pattern == "night"
    assert assignment.is_primary is True


def test_facility_patient_link_with_room():
    link = FacilityPatientLink(
        facility_id="fac-1",
        profile_id="profile-1",
        linked_by="staff-1",
        room="208",
        is_active=True,
    )
    assert link.room == "208"
    assert link.linked_by == "staff-1"
