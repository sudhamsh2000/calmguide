from pydantic import BaseModel


class AuditLogResponse(BaseModel):
    id: int
    timestamp: str
    user_id: str
    user_name: str
    user_role: str
    action: str
    resource_type: str
    resource_id: str | None
    outcome: str
    source_ip: str | None


class AuditLogList(BaseModel):
    logs: list[AuditLogResponse]
    total: int
