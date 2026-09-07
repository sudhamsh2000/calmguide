"""Regression tests for the "me" facility-code sentinel.

Admin/owner staff who log in by email/password never learn their facility's
plaintext code (facility codes are stored one-way-hashed, so even the backend
can't recover it for an existing facility). Facility-scoped endpoints accept
the literal path segment "me" in place of a real code, resolving the caller's
own facility straight from their JWT instead. This was the root cause of the
Staff page silently showing "Add your care team" for a facility that actually
had staff: the client fell back to fabricating the code as the literal
string "admin", which pointed every request at a facility that doesn't exist.
"""

from app.models.facility import Facility
from app.models.staff import Staff
from app.services.auth import hash_access_code
from app.services.jwt_service import create_token


async def _mk_facility(db_session, name, code):
    fac = Facility(name=name, facility_code_hash=hash_access_code(code), is_active=True)
    db_session.add(fac)
    await db_session.commit()
    await db_session.refresh(fac)
    return fac


async def _mk_admin(db_session, fac, email):
    staff = Staff(facility_id=fac.id, name="Admin", email=email, role="admin", is_active=True)
    db_session.add(staff)
    await db_session.commit()
    await db_session.refresh(staff)
    return staff


def _auth(staff):
    return {
        "Authorization": f"Bearer {create_token(staff_id=staff.id, facility_id=staff.facility_id, role=staff.role)}"
    }


async def test_list_staff_with_me_sentinel_resolves_own_facility(client, db_session):
    fac = await _mk_facility(db_session, "Facility Me", "MESENT01")
    admin = await _mk_admin(db_session, fac, "admin-me@x.example")
    staff2 = Staff(
        facility_id=fac.id, name="Carol", email=None, role="staff", is_active=True
    )
    db_session.add(staff2)
    await db_session.commit()

    resp = await client.get("/api/facilities/me/staff", headers=_auth(admin))
    assert resp.status_code == 200
    names = {s["name"] for s in resp.json()["staff"]}
    assert "Carol" in names


async def test_get_facility_with_me_sentinel_resolves_own_facility(client, db_session):
    fac = await _mk_facility(db_session, "Facility Me Two", "MESENT02")
    admin = await _mk_admin(db_session, fac, "admin-me2@x.example")

    resp = await client.get("/api/facilities/me", headers=_auth(admin))
    assert resp.status_code == 200
    assert resp.json()["name"] == "Facility Me Two"


async def test_me_sentinel_rejected_without_auth(client, db_session):
    await _mk_facility(db_session, "Facility Me Three", "MESENT03")

    # No auth header — "me" cannot resolve without a JWT, and must not be
    # treated as a valid (hashable) facility code either.
    resp = await client.get("/api/facilities/me/staff/active")
    assert resp.status_code == 404
