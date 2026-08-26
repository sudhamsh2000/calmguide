"""Facility PDF report generation."""

from datetime import datetime, timedelta, timezone
from io import BytesIO

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.incident import Incident
from app.models.facility_patient_link import FacilityPatientLink
from app.models.staff import Staff
from app.models.facility import Facility
from app.services.rbac import require_role
from app.db import get_session

router = APIRouter(prefix="/facility/report", tags=["facility-report"])


def _build_pdf(
    facility_name: str,
    generated_at: str,
    days: int,
    total_incidents: int,
    severe_count: int,
    mild_count: int,
    staff_total: int,
    staff_active: int,
    resident_count: int,
    category_counts: dict[str, int],
    time_distribution: dict[str, int],
) -> bytes:
    try:
        from reportlab.lib import colors
        from reportlab.lib.pagesizes import letter
        from reportlab.lib.units import inch
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    except ModuleNotFoundError as exc:
        raise RuntimeError("PDF export dependency is not installed") from exc

    buf = BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=letter, topMargin=0.75 * inch, bottomMargin=0.5 * inch)
    styles = getSampleStyleSheet()
    content_width = doc.width

    title_style = ParagraphStyle(
        "FacilityTitle",
        parent=styles["Title"],
        fontSize=20,
        leading=24,
        alignment=0,
        spaceAfter=6,
    )
    subtitle_style = ParagraphStyle(
        "Subtitle",
        parent=styles["Normal"],
        fontSize=10,
        leading=13,
        textColor=colors.grey,
        alignment=0,
    )
    heading_style = ParagraphStyle(
        "SectionHeading",
        parent=styles["Heading2"],
        fontSize=13,
        leading=16,
        spaceBefore=18,
        spaceAfter=10,
        alignment=0,
    )
    body_style = styles["Normal"]

    elements = []

    # Header
    elements.append(Paragraph("CalmGuide — Facility Report", title_style))
    elements.append(Paragraph(facility_name, subtitle_style))
    elements.append(Paragraph(f"Generated {generated_at} · Last {days} days", subtitle_style))
    elements.append(Spacer(1, 18))

    # KPI Summary
    elements.append(Paragraph("Summary", heading_style))
    kpi_data = [
        ["Total Incidents", "Severe", "Mild", "Staff Active", "Residents"],
        [str(total_incidents), str(severe_count), str(mild_count), f"{staff_active}/{staff_total}", str(resident_count)],
    ]
    kpi_table = Table(kpi_data, colWidths=[content_width / 5] * 5)
    kpi_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#2B7A78")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E0E0E0")),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))
    elements.append(kpi_table)
    elements.append(Spacer(1, 16))

    # Incident Categories
    if category_counts:
        elements.append(Paragraph("Incidents by Category", heading_style))
        cat_data = [["Category", "Count"]]
        for cat, count in sorted(category_counts.items(), key=lambda x: -x[1]):
            label = cat.replace("_", " ").title()
            cat_data.append([label, str(count)])
        cat_table = Table(cat_data, colWidths=[content_width * 0.72, content_width * 0.28])
        cat_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#F5F5F5")),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 10),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E0E0E0")),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ]))
        elements.append(cat_table)
        elements.append(Spacer(1, 16))

    # Time Distribution
    if time_distribution:
        elements.append(Paragraph("Time of Day Distribution", heading_style))
        total = sum(time_distribution.values()) or 1
        time_data = [["Time of Day", "Count", "Percentage"]]
        for slot in ["overnight", "morning", "afternoon", "evening"]:
            count = time_distribution.get(slot, 0)
            pct = round((count / total) * 100)
            time_data.append([slot.title(), str(count), f"{pct}%"])
        time_table = Table(
            time_data,
            colWidths=[content_width * 0.46, content_width * 0.27, content_width * 0.27],
        )
        time_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#F5F5F5")),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 10),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E0E0E0")),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ]))
        elements.append(time_table)

    # Footer
    elements.append(Spacer(1, 30))
    elements.append(Paragraph(
        "This report is generated by CalmGuide and contains aggregated facility data. "
        "All patient information is de-identified. For internal use only.",
        ParagraphStyle("Footer", parent=body_style, fontSize=8, leading=11, textColor=colors.grey, alignment=0),
    ))

    doc.build(elements)
    return buf.getvalue()


@router.get("/pdf")
async def export_pdf(
    days: int = 30,
    staff: Staff = Depends(require_role("admin", "owner")),
    session: AsyncSession = Depends(get_session),
):
    facility = await session.get(Facility, staff.facility_id)
    facility_name = facility.name if facility else "Facility"

    since = datetime.now(timezone.utc) - timedelta(days=days)

    # Get facility's profile IDs
    links = await session.execute(
        select(FacilityPatientLink.profile_id)
        .where(FacilityPatientLink.facility_id == staff.facility_id)
        .where(FacilityPatientLink.is_active.is_(True))
    )
    profile_ids = [r[0] for r in links.all()]
    resident_count = len(profile_ids)

    # Incident stats
    total_incidents = 0
    severe_count = 0
    mild_count = 0
    category_counts: dict[str, int] = {}
    time_distribution = {"overnight": 0, "morning": 0, "afternoon": 0, "evening": 0}

    if profile_ids:
        incidents_q = await session.execute(
            select(Incident).where(
                Incident.profile_id.in_(profile_ids),
                Incident.incident_time >= since,
            )
        )
        incidents = incidents_q.scalars().all()
        total_incidents = len(incidents)

        for inc in incidents:
            if inc.severity == "severe":
                severe_count += 1
            elif inc.severity == "mild":
                mild_count += 1

            cat = inc.behavior_category or "other"
            category_counts[cat] = category_counts.get(cat, 0) + 1

            hour = inc.incident_time.hour if inc.incident_time else 12
            if hour < 6:
                time_distribution["overnight"] += 1
            elif hour < 12:
                time_distribution["morning"] += 1
            elif hour < 18:
                time_distribution["afternoon"] += 1
            else:
                time_distribution["evening"] += 1

    # Staff stats
    staff_total_q = await session.execute(
        select(func.count()).select_from(Staff)
        .where(Staff.facility_id == staff.facility_id, Staff.is_active.is_(True))
    )
    staff_total = staff_total_q.scalar() or 0

    staff_active_q = await session.execute(
        select(func.count()).select_from(Staff)
        .where(
            Staff.facility_id == staff.facility_id,
            Staff.is_active.is_(True),
            Staff.last_login_at >= since,
        )
    )
    staff_active = staff_active_q.scalar() or 0

    now = datetime.now(timezone.utc)
    generated_at = now.strftime("%B %d, %Y at %I:%M %p UTC")

    try:
        pdf_bytes = _build_pdf(
            facility_name=facility_name,
            generated_at=generated_at,
            days=days,
            total_incidents=total_incidents,
            severe_count=severe_count,
            mild_count=mild_count,
            staff_total=staff_total,
            staff_active=staff_active,
            resident_count=resident_count,
            category_counts=category_counts,
            time_distribution=time_distribution,
        )
    except RuntimeError as exc:
        raise HTTPException(
            status_code=503,
            detail={
                "error": "PDF export is temporarily unavailable on this server.",
                "code": "PDF_EXPORT_UNAVAILABLE",
            },
        ) from exc

    filename = f"calmguide-report-{now.strftime('%Y-%m-%d')}.pdf"
    return StreamingResponse(
        BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
