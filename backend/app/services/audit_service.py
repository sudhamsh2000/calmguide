from fastapi import Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit_log import AuditLog
from app.models.staff import Staff


async def log_audit(
    staff: Staff,
    action: str,
    resource_type: str,
    resource_id: str | None = None,
    outcome: str = "SUCCESS",
    request: Request | None = None,
    session: AsyncSession | None = None,
    details: dict | None = None,
) -> AuditLog:
    entry = AuditLog(
        user_id=staff.id,
        user_name=staff.name,
        user_role=staff.role,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        outcome=outcome,
        facility_id=staff.facility_id,
        source_ip=request.client.host if request and request.client else None,
        user_agent=request.headers.get("user-agent") if request else None,
        details=details,
    )
    if session:
        session.add(entry)
    return entry
