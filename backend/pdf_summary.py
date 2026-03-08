"""Generate a professional PwC-branded meeting summary PDF using ReportLab."""

import os
import subprocess
import tempfile
from datetime import datetime
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, KeepTogether,
)

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "data", "pdf")
LOGO_SVG = os.path.join(os.path.dirname(os.path.dirname(__file__)), "PwC_Company_Logo.svg")
_logo_png_cache = None

# PwC brand colours
PWC_ORANGE = colors.HexColor("#d04a02")
PWC_BLACK = colors.HexColor("#1a1a1a")
PWC_DARK_GREY = colors.HexColor("#2d2d2d")
PWC_MID_GREY = colors.HexColor("#6b6b6b")
PWC_LIGHT_GREY = colors.HexColor("#f2f2f2")
PWC_WHITE = colors.white
PWC_ORANGE_LIGHT = colors.HexColor("#fef3ec")


def _build_styles():
    """Create custom PwC-branded paragraph styles."""
    styles = getSampleStyleSheet()

    styles.add(ParagraphStyle(
        "PwcTitle",
        parent=styles["Title"],
        fontName="Helvetica-Bold",
        fontSize=22,
        textColor=PWC_BLACK,
        spaceAfter=4 * mm,
        leading=26,
    ))
    styles.add(ParagraphStyle(
        "PwcSubtitle",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=11,
        textColor=PWC_MID_GREY,
        spaceAfter=8 * mm,
    ))
    styles.add(ParagraphStyle(
        "PwcSection",
        parent=styles["Heading2"],
        fontName="Helvetica-Bold",
        fontSize=13,
        textColor=PWC_ORANGE,
        spaceBefore=8 * mm,
        spaceAfter=3 * mm,
        borderPadding=(0, 0, 2, 0),
    ))
    styles.add(ParagraphStyle(
        "PwcBody",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=10,
        textColor=PWC_BLACK,
        leading=15,
        spaceAfter=2 * mm,
    ))
    styles.add(ParagraphStyle(
        "PwcBullet",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=10,
        textColor=PWC_BLACK,
        leading=15,
        leftIndent=12,
        spaceAfter=2 * mm,
        bulletIndent=0,
    ))
    styles.add(ParagraphStyle(
        "PwcTopicHeader",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=11,
        textColor=PWC_DARK_GREY,
        spaceBefore=3 * mm,
        spaceAfter=1 * mm,
    ))
    styles.add(ParagraphStyle(
        "PwcNote",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=10,
        textColor=PWC_DARK_GREY,
        leading=14,
        spaceAfter=1.5 * mm,
    ))
    styles.add(ParagraphStyle(
        "PwcFooter",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8,
        textColor=PWC_MID_GREY,
        alignment=1,  # centre
    ))
    return styles


def _get_logo_png():
    """Convert SVG logo to PNG (cached). Returns path or None."""
    global _logo_png_cache
    if _logo_png_cache and os.path.exists(_logo_png_cache):
        return _logo_png_cache
    if not os.path.exists(LOGO_SVG):
        return None
    # Try rsvg-convert
    try:
        tmp = os.path.join(tempfile.gettempdir(), "pwc_logo.png")
        subprocess.run(
            ["rsvg-convert", "-w", "200", "-f", "png", "-o", tmp, LOGO_SVG],
            check=True, capture_output=True,
        )
        _logo_png_cache = tmp
        return tmp
    except (FileNotFoundError, subprocess.CalledProcessError):
        pass
    # Try cairosvg
    try:
        import cairosvg
        tmp = os.path.join(tempfile.gettempdir(), "pwc_logo.png")
        cairosvg.svg2png(url=LOGO_SVG, write_to=tmp, output_width=200)
        _logo_png_cache = tmp
        return tmp
    except Exception:
        pass
    return None


def _header_footer(canvas, doc):
    """Draw header bar and footer on every page."""
    w, h = A4
    # Top orange bar
    canvas.setFillColor(PWC_ORANGE)
    canvas.rect(0, h - 10 * mm, w, 10 * mm, fill=1, stroke=0)

    # PwC logo or text
    logo_path = _get_logo_png()
    if logo_path:
        canvas.drawImage(
            logo_path, 12 * mm, h - 9 * mm, width=22 * mm, height=8 * mm,
            preserveAspectRatio=True, anchor="sw", mask="auto",
        )
    else:
        # Fallback: styled PwC text
        canvas.setFillColor(PWC_WHITE)
        canvas.setFont("Helvetica-Bold", 14)
        canvas.drawString(15 * mm, h - 7.5 * mm, "PwC")

    # "Confidential" right-aligned in header
    canvas.setFillColor(colors.HexColor("#ffffff99"))
    canvas.setFont("Helvetica", 8)
    canvas.drawRightString(w - 15 * mm, h - 7 * mm, "Confidential")

    # Footer line
    canvas.setStrokeColor(colors.HexColor("#e0e0e0"))
    canvas.setLineWidth(0.5)
    canvas.line(15 * mm, 12 * mm, w - 15 * mm, 12 * mm)

    # Footer text
    canvas.setFillColor(PWC_MID_GREY)
    canvas.setFont("Helvetica", 7)
    canvas.drawString(15 * mm, 8 * mm, "PwC")
    canvas.drawRightString(w - 15 * mm, 8 * mm, f"Page {doc.page}")


def _section_divider():
    """Orange horizontal rule to separate sections."""
    return HRFlowable(
        width="100%", thickness=1, color=PWC_ORANGE,
        spaceBefore=2 * mm, spaceAfter=2 * mm,
    )


def generate_summary_pdf(meeting: dict) -> str:
    """Generate a professional PwC-branded meeting summary PDF.

    Returns the file path.
    """
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    meeting_date = datetime.fromisoformat(meeting["created_at"])
    date_str = meeting_date.strftime("%d %B %Y")
    time_str = meeting_date.strftime("%H:%M")
    safe_name = "".join(c if c.isalnum() or c in " -_" else "" for c in meeting.get("name", "meeting"))
    filename = f"Meeting_Summary_{safe_name}_{meeting_date.strftime('%Y%m%d')}.pdf"
    output_path = os.path.join(OUTPUT_DIR, filename)

    doc = SimpleDocTemplate(
        output_path,
        pagesize=A4,
        topMargin=18 * mm,
        bottomMargin=18 * mm,
        leftMargin=15 * mm,
        rightMargin=15 * mm,
    )

    styles = _build_styles()
    story = []

    # --- Title ---
    story.append(Spacer(1, 6 * mm))
    story.append(Paragraph(f"{meeting.get('name', 'Meeting Summary')}", styles["PwcTitle"]))
    story.append(Paragraph(f"{date_str} at {time_str}", styles["PwcSubtitle"]))

    # --- Meeting Details table ---
    summary = meeting.get("summary") or {}
    segments = meeting.get("segments", [])
    notes_raw = meeting.get("notes", "")

    speakers = []
    seen = set()
    for seg in segments:
        spk = seg.get("speaker", "Unknown")
        if spk not in seen:
            seen.add(spk)
            speakers.append(spk)

    duration_secs = max((s.get("end", 0) for s in segments), default=0)
    duration_str = f"{int(duration_secs // 60)} min {int(duration_secs % 60)} sec" if duration_secs else "N/A"

    detail_cell = ParagraphStyle("detailCell", fontName="Helvetica", fontSize=9, leading=12, textColor=PWC_BLACK)
    detail_label = ParagraphStyle("detailLabel", fontName="Helvetica-Bold", fontSize=9, leading=12, textColor=PWC_MID_GREY)
    participants_text = ", ".join(speakers) if speakers else "N/A"
    detail_data = [
        [Paragraph("Date", detail_label), Paragraph(date_str, detail_cell), Paragraph("Time", detail_label), Paragraph(time_str, detail_cell)],
        [Paragraph("Duration", detail_label), Paragraph(duration_str, detail_cell), Paragraph("Segments", detail_label), Paragraph(str(len(segments)), detail_cell)],
        [Paragraph("Participants", detail_label), Paragraph(_esc(participants_text), detail_cell), "", ""],
    ]
    detail_table = Table(detail_data, colWidths=[30 * mm, 55 * mm, 30 * mm, 55 * mm])
    detail_table.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (-1, -1), "Helvetica"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("TEXTCOLOR", (0, 0), (0, -1), PWC_MID_GREY),
        ("TEXTCOLOR", (2, 0), (2, -1), PWC_MID_GREY),
        ("TEXTCOLOR", (1, 0), (1, -1), PWC_BLACK),
        ("TEXTCOLOR", (3, 0), (3, -1), PWC_BLACK),
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("FONTNAME", (2, 0), (2, -1), "Helvetica-Bold"),
        ("BACKGROUND", (0, 0), (-1, -1), PWC_LIGHT_GREY),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e0e0e0")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("SPAN", (1, 2), (3, 2)),  # Participants spans across
    ]))
    story.append(detail_table)

    # --- Agenda ---
    agenda_items = summary.get("agenda", [])
    if agenda_items:
        story.append(Paragraph("Agenda", styles["PwcSection"]))
        story.append(_section_divider())
        for i, item in enumerate(agenda_items, 1):
            story.append(Paragraph(f"{i}. {_esc(item)}", styles["PwcBody"]))

    # --- Summary ---
    summary_text = summary.get("summary", "")
    if summary_text:
        story.append(Paragraph("Meeting Summary", styles["PwcSection"]))
        story.append(_section_divider())
        lines = summary_text.split("\n")
        for line in lines:
            trimmed = line.strip()
            if not trimmed:
                continue
            # Topic header (numbered)
            if _is_topic_header(trimmed):
                clean = trimmed.lstrip("0123456789.").strip().strip("*")
                num = trimmed.split(".")[0].strip()
                story.append(Paragraph(f"{num}. {_esc(clean)}", styles["PwcTopicHeader"]))
            # Bullet point — strip [MM:SS] timestamps for the PDF
            elif trimmed.startswith("-"):
                bullet_text = trimmed.lstrip("- ").strip()
                import re as _re
                bullet_text = _re.sub(r"^\[\d+:\d+\]\s*", "", bullet_text)
                story.append(Paragraph(
                    f'<bullet>&bull;</bullet> {_esc(bullet_text)}',
                    styles["PwcBullet"],
                ))
            else:
                story.append(Paragraph(_esc(trimmed), styles["PwcBody"]))

    # --- Decisions ---
    decisions = summary.get("decisions", [])
    decisions = [d for d in decisions if d.strip().lower() not in ("none", "none.", "-", "")]
    if decisions:
        story.append(Paragraph("Decisions", styles["PwcSection"]))
        story.append(_section_divider())
        cell_style = ParagraphStyle("cell", fontName="Helvetica", fontSize=9, leading=12, textColor=PWC_BLACK)
        header_style = ParagraphStyle("cellH", fontName="Helvetica-Bold", fontSize=9, leading=12, textColor=PWC_WHITE)
        dec_data = [[Paragraph("#", header_style), Paragraph("Decision", header_style), Paragraph("Date", header_style)]]
        for i, d in enumerate(decisions, 1):
            dec_data.append([Paragraph(f"D-{i:03d}", cell_style), Paragraph(_esc(d), cell_style), Paragraph(date_str, cell_style)])
        dec_table = Table(dec_data, colWidths=[18 * mm, 120 * mm, 30 * mm])
        dec_table.setStyle(TableStyle([
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTNAME", (0, 1), (-1, -1), "Helvetica"),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("TEXTCOLOR", (0, 0), (-1, 0), PWC_WHITE),
            ("BACKGROUND", (0, 0), (-1, 0), PWC_ORANGE),
            ("BACKGROUND", (0, 1), (-1, -1), PWC_LIGHT_GREY),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e0e0e0")),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ]))
        story.append(dec_table)

    # --- Action Items ---
    actions = summary.get("action_items", [])
    actions = [a for a in actions if a.strip().lower() not in ("none", "none.", "-", "")]
    if actions:
        story.append(Paragraph("Action Items", styles["PwcSection"]))
        story.append(_section_divider())
        cell_style = ParagraphStyle("cell2", fontName="Helvetica", fontSize=9, leading=12, textColor=PWC_BLACK)
        header_style = ParagraphStyle("cellH2", fontName="Helvetica-Bold", fontSize=9, leading=12, textColor=PWC_WHITE)
        act_data = [[Paragraph("#", header_style), Paragraph("Action Item", header_style), Paragraph("Status", header_style)]]
        for i, a in enumerate(actions, 1):
            act_data.append([Paragraph(f"A-{i:03d}", cell_style), Paragraph(_esc(a), cell_style), Paragraph("Open", cell_style)])
        act_table = Table(act_data, colWidths=[18 * mm, 120 * mm, 30 * mm])
        act_table.setStyle(TableStyle([
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTNAME", (0, 1), (-1, -1), "Helvetica"),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("TEXTCOLOR", (0, 0), (-1, 0), PWC_WHITE),
            ("BACKGROUND", (0, 0), (-1, 0), PWC_ORANGE),
            ("BACKGROUND", (0, 1), (-1, -1), PWC_LIGHT_GREY),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e0e0e0")),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ]))
        story.append(act_table)

    # --- Notes ---
    if notes_raw and notes_raw.strip():
        note_lines = [l.strip() for l in notes_raw.split("\n") if l.strip()]
        if note_lines:
            story.append(Paragraph("Meeting Notes", styles["PwcSection"]))
            story.append(_section_divider())
            for line in note_lines:
                import re
                m = re.match(r"^\[(\d+:\d+)\]\s*(.*)", line)
                if m:
                    ts, text = m.group(1), m.group(2)
                    story.append(Paragraph(
                        f'<font color="#d04a02"><b>[{ts}]</b></font>  {_esc(text)}',
                        styles["PwcNote"],
                    ))
                else:
                    story.append(Paragraph(_esc(line), styles["PwcNote"]))

    # --- Build ---
    doc.build(story, onFirstPage=_header_footer, onLaterPages=_header_footer)
    return output_path


def _esc(text: str) -> str:
    """Escape XML special characters for ReportLab Paragraphs."""
    return (
        text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace("**", "")
    )


def _is_topic_header(line: str) -> bool:
    """Check if a line looks like a numbered topic header (e.g. '1. Topic Name')."""
    import re
    return bool(re.match(r"^\d+\.\s+", line.strip()))
