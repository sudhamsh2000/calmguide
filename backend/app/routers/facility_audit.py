from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.models.audit_log import AuditLog
from app.models.staff import Staff
from app.schemas.audit import AuditLogList, AuditLogResponse
from app.services.rbac import require_role

router = APIRouter(prefix="/facility", tags=["facility-audit"])


@router.get("/audit-logs")
async def get_audit_logs(
    user_id: str | None = None,
    resource_type: str | None = None,
    since: str | None = None,
    until: str | None = None,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    staff: Staff = Depends(require_role("admin", "owner")),
    session: AsyncSession = Depends(get_session),
):
    query = select(AuditLog).where(
        AuditLog.facility_id == staff.facility_id,
    )

    if user_id:
        query = query.where(AuditLog.user_id == user_id)
    if resource_type:
        query = query.where(AuditLog.resource_type == resource_type)
    if since:
        query = query.where(AuditLog.timestamp >= since)
    if until:
        query = query.where(AuditLog.timestamp <= until)

    count_query = select(func.count()).select_from(query.subquery())
    total_result = await session.execute(count_query)
    total = total_result.scalar() or 0

    query = query.order_by(AuditLog.timestamp.desc()).offset(offset).limit(limit)
    result = await session.execute(query)

    logs = [
        AuditLogResponse(
            id=log.id,
            timestamp=log.timestamp.isoformat() if log.timestamp else "",
            user_id=log.user_id,
            user_name=log.user_name,
            user_role=log.user_role,
            action=log.action,
            resource_type=log.resource_type,
            resource_id=log.resource_id,
            outcome=log.outcome,
            source_ip=log.source_ip,
        )
        for log in result.scalars().all()
    ]

    return AuditLogList(logs=logs, total=total)
