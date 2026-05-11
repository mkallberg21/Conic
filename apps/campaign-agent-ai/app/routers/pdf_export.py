"""
PDF export for campaign debriefs.
Uses reportlab to render a branded PDF from debrief markdown / structured data.
Returns a base64-encoded PDF string that clients can stream or download.
"""
import io
import base64
import re
from datetime import datetime
from typing import Optional, Dict, Any, List

from fastapi import APIRouter
from pydantic import BaseModel
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
from reportlab.lib.enums import TA_CENTER, TA_LEFT

router = APIRouter()

# Brand palette
CONIC_PURPLE = colors.HexColor("#7C3AED")
CONIC_LIGHT  = colors.HexColor("#EDE9FE")
DARK         = colors.HexColor("#1E1B4B")
GRAY         = colors.HexColor("#6B7280")


def _styles():
    ss = getSampleStyleSheet()
    return {
        "title": ParagraphStyle("title", parent=ss["Title"],
                                fontSize=26, textColor=DARK,
                                fontName="Helvetica-Bold", spaceAfter=4),
        "subtitle": ParagraphStyle("subtitle", parent=ss["Normal"],
                                   fontSize=12, textColor=GRAY,
                                   fontName="Helvetica", spaceAfter=12),
        "h2": ParagraphStyle("h2", parent=ss["Heading2"],
                             fontSize=14, textColor=CONIC_PURPLE,
                             fontName="Helvetica-Bold", spaceBefore=14, spaceAfter=4),
        "body": ParagraphStyle("body", parent=ss["Normal"],
                               fontSize=10, textColor=DARK,
                               fontName="Helvetica", leading=16, spaceAfter=6),
        "metric_label": ParagraphStyle("metric_label", parent=ss["Normal"],
                                       fontSize=9, textColor=GRAY, fontName="Helvetica"),
        "metric_value": ParagraphStyle("metric_value", parent=ss["Normal"],
                                       fontSize=18, textColor=CONIC_PURPLE,
                                       fontName="Helvetica-Bold", alignment=TA_CENTER),
    }


def _metric_table(metrics: Dict[str, Any], sty) -> Table:
    """Render a horizontal KPI strip."""
    items = list(metrics.items())[:6]
    headers = [Paragraph(str(k), sty["metric_label"]) for k, _ in items]
    values  = [Paragraph(str(v), sty["metric_value"]) for _, v in items]

    data = [headers, values]
    col_w = (A4[0] - 40*mm) / max(len(items), 1)
    t = Table(data, colWidths=[col_w] * len(items), rowHeights=[14, 28])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), CONIC_LIGHT),
        ("GRID",       (0, 0), (-1, -1), 0.5, colors.white),
        ("ALIGN",      (0, 0), (-1, -1), "CENTER"),
        ("VALIGN",     (0, 0), (-1, -1), "MIDDLE"),
        ("ROUNDEDCORNERS", [4]),
    ]))
    return t


def _md_to_paragraphs(md: str, sty) -> List:
    """Strip Markdown and emit Paragraphs/Spacers."""
    elements = []
    for line in md.splitlines():
        stripped = line.strip()
        if stripped.startswith("## "):
            elements.append(Paragraph(stripped[3:], sty["h2"]))
        elif stripped.startswith("# "):
            elements.append(Paragraph(stripped[2:], sty["title"]))
        elif stripped.startswith("- ") or stripped.startswith("* "):
            elements.append(Paragraph(f"• {stripped[2:]}", sty["body"]))
        elif stripped:
            # Remove bold/italic markers
            clean = re.sub(r"\*{1,3}(.+?)\*{1,3}", r"\1", stripped)
            elements.append(Paragraph(clean, sty["body"]))
        else:
            elements.append(Spacer(1, 4))
    return elements


def _build_pdf(req) -> bytes:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        leftMargin=20*mm, rightMargin=20*mm, topMargin=20*mm, bottomMargin=20*mm,
    )
    sty = _styles()
    story = []

    # Header
    story.append(Paragraph("CONIC", ParagraphStyle("brand", fontSize=11,
                                                    textColor=CONIC_PURPLE,
                                                    fontName="Helvetica-Bold")))
    story.append(Spacer(1, 4))
    story.append(Paragraph(req.title, sty["title"]))
    story.append(Paragraph(
        f"Campaign ID: {req.campaign_id}  •  Generated {datetime.utcnow().strftime('%B %d, %Y')}",
        sty["subtitle"],
    ))
    story.append(HRFlowable(width="100%", thickness=2, color=CONIC_PURPLE, spaceAfter=10))

    # KPI strip
    if req.metrics:
        story.append(_metric_table(req.metrics, sty))
        story.append(Spacer(1, 12))

    # Debrief body
    if req.markdown:
        story.extend(_md_to_paragraphs(req.markdown, sty))

    # Recommendations table
    if req.recommendations:
        story.append(Paragraph("Recommendations", sty["h2"]))
        data = [["#", "Recommendation"]]
        for i, r in enumerate(req.recommendations, 1):
            data.append([str(i), r])
        t = Table(data, colWidths=[10*mm, A4[0] - 50*mm])
        t.setStyle(TableStyle([
            ("BACKGROUND",  (0, 0), (-1, 0),  CONIC_PURPLE),
            ("TEXTCOLOR",   (0, 0), (-1, 0),  colors.white),
            ("FONTNAME",    (0, 0), (-1, 0),  "Helvetica-Bold"),
            ("FONTSIZE",    (0, 0), (-1, 0),  9),
            ("BACKGROUND",  (0, 1), (-1, -1), colors.white),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, CONIC_LIGHT]),
            ("FONTSIZE",    (0, 1), (-1, -1), 9),
            ("GRID",        (0, 0), (-1, -1), 0.5, GRAY),
            ("ALIGN",       (0, 0), (0, -1),  "CENTER"),
            ("VALIGN",      (0, 0), (-1, -1), "MIDDLE"),
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
            ("RIGHTPADDING",(0, 0), (-1, -1), 6),
            ("TOPPADDING",  (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING",(0, 0), (-1, -1), 4),
        ]))
        story.append(t)

    # Footer note
    story.append(Spacer(1, 20))
    story.append(HRFlowable(width="100%", thickness=0.5, color=GRAY))
    story.append(Paragraph(
        "This report was generated by Conic AI. Confidential.",
        ParagraphStyle("footer", fontSize=8, textColor=GRAY, alignment=TA_CENTER),
    ))

    doc.build(story)
    return buf.getvalue()


class PdfExportRequest(BaseModel):
    campaign_id: str
    title: str
    markdown: Optional[str] = None
    metrics: Optional[Dict[str, Any]] = None
    recommendations: Optional[List[str]] = None


class PdfExportResponse(BaseModel):
    pdf_base64: str
    size_bytes: int
    filename: str


@router.post("/debrief", response_model=PdfExportResponse)
def export_debrief_pdf(req: PdfExportRequest):
    pdf_bytes = _build_pdf(req)
    slug = re.sub(r"[^a-z0-9]+", "-", req.title.lower()).strip("-")
    filename = f"conic-debrief-{slug}-{req.campaign_id[:8]}.pdf"
    return PdfExportResponse(
        pdf_base64=base64.b64encode(pdf_bytes).decode(),
        size_bytes=len(pdf_bytes),
        filename=filename,
    )
