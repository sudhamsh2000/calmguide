"""Request-scoped correlation id for log tracing.

A per-request id is stored in a ContextVar and injected into every log record so
a single caregiver's failing request can be traced across all log lines.
"""

import contextvars
import logging

request_id_var: contextvars.ContextVar[str] = contextvars.ContextVar(
    "request_id", default="-"
)


class RequestIdFilter(logging.Filter):
    """Attaches the current request id to each log record."""

    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = request_id_var.get()
        return True
