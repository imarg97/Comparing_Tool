#!/usr/bin/env python3
import os
import sys
import re
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether, HRFlowable
)
from reportlab.pdfgen import canvas

class NumberedCanvas(canvas.Canvas):
    def __init__(self, doc_title, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.doc_title = doc_title
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_page_decorations(self, page_count):
        self.saveState()
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#64748b"))
        
        # Header (pages 2+)
        if self._pageNumber > 1:
            self.drawString(54, 755, f"{self.doc_title} • v7.0.0")
            self.drawRightString(612 - 54, 755, "Mavenir Systems • Internal Enterprise Release")
            self.setStrokeColor(colors.HexColor("#cbd5e1"))
            self.setLineWidth(0.5)
            self.line(54, 747, 612 - 54, 747)

        # Footer (all pages)
        self.setStrokeColor(colors.HexColor("#cbd5e1"))
        self.setLineWidth(0.5)
        self.line(54, 45, 612 - 54, 45)
        self.drawString(54, 32, "CONFIDENTIAL • FOR INTERNAL MAVENIR USE ONLY • AIR-GAPPED & OFFLINE")
        self.drawRightString(612 - 54, 32, f"Page {self._pageNumber} of {page_count}")
        self.restoreState()

def build_pdf_from_markdown(md_path, pdf_path, doc_title):
    print(f"Generating {pdf_path}...")
    doc = SimpleDocTemplate(
        pdf_path,
        pagesize=letter,
        leftMargin=54,
        rightMargin=54,
        topMargin=54,
        bottomMargin=54
    )

    styles = getSampleStyleSheet()

    primary_color = colors.HexColor("#0f172a") # Slate 900
    brand_blue = colors.HexColor("#1e40af")    # Blue 800
    accent_blue = colors.HexColor("#2563eb")   # Blue 600
    text_dark = colors.HexColor("#1e293b")     # Slate 800
    bg_light = colors.HexColor("#f8fafc")      # Slate 50
    border_color = colors.HexColor("#e2e8f0")  # Slate 200

    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=20,
        leading=24,
        textColor=primary_color,
        spaceAfter=6
    )

    h1_style = ParagraphStyle(
        'H1',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=13,
        leading=16,
        textColor=brand_blue,
        spaceBefore=12,
        spaceAfter=6,
        keepWithNext=True
    )

    h2_style = ParagraphStyle(
        'H2',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=11,
        leading=14,
        textColor=primary_color,
        spaceBefore=9,
        spaceAfter=4,
        keepWithNext=True
    )

    body_style = ParagraphStyle(
        'Body',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=13,
        textColor=text_dark,
        spaceAfter=5
    )

    bullet_style = ParagraphStyle(
        'Bullet',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=13,
        textColor=text_dark,
        leftIndent=14,
        firstLineIndent=-10,
        spaceAfter=3
    )

    code_style = ParagraphStyle(
        'Code',
        parent=styles['Normal'],
        fontName='Courier',
        fontSize=8,
        leading=11,
        textColor=colors.HexColor("#0f172a")
    )

    table_header_style = ParagraphStyle(
        'TableHeader',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8.5,
        leading=11,
        textColor=colors.white
    )

    table_cell_style = ParagraphStyle(
        'TableCell',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8,
        leading=11,
        textColor=text_dark
    )

    with open(md_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    story = []
    in_table = False
    table_rows = []

    def flush_table():
        nonlocal in_table, table_rows, story
        if table_rows:
            col_count = max(len(row) for row in table_rows)
            col_width = (612 - 108) / col_count
            
            formatted_data = []
            for r_idx, row in enumerate(table_rows):
                formatted_row = []
                for cell in row:
                    style = table_header_style if r_idx == 0 else table_cell_style
                    cell_html = clean_markdown_inline(cell)
                    formatted_row.append(Paragraph(cell_html, style))
                formatted_data.append(formatted_row)

            t = Table(formatted_data, colWidths=[col_width] * col_count)
            t.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), brand_blue),
                ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                ('GRID', (0, 0), (-1, -1), 0.5, border_color),
                ('TOPPADDING', (0, 0), (-1, -1), 4),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, bg_light]),
            ]))
            story.append(t)
            story.append(Spacer(1, 8))
            table_rows = []
        in_table = False

    def clean_markdown_inline(text):
        def code_sub(m):
            code_content = m.group(1).replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
            return f'<font name="Courier">{code_content}</font>'

        # Convert backtick code
        text = re.sub(r'`(.*?)`', code_sub, text)
        # Convert links [text](url) to <u>text</u>
        text = re.sub(r'\[(.*?)\]\(.*?\)', r'<u>\1</u>', text)
        # Convert markdown bold **text** to <b>text</b>
        text = re.sub(r'\*\*(.*?)\*\*', r'<b>\1</b>', text)

        # Safely escape any < and > that are NOT part of allowed tags: <b>, </b>, <u>, </u>, <font...>, </font>
        parts = []
        tokens = re.split(r'(</?(?:b|u|font(?:\s+name="[^"]*")?)>)', text)
        for i, token in enumerate(tokens):
            if i % 2 == 1:
                parts.append(token)
            else:
                # Escape raw HTML characters
                escaped = token.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
                parts.append(escaped)
        return "".join(parts).strip()

    for line in lines:
        stripped = line.strip()
        if not stripped:
            if in_table:
                flush_table()
            continue

        # Table detection
        if stripped.startswith('|') and stripped.endswith('|'):
            if re.match(r'^\|[\s\-:|]+\|$', stripped):
                # Separator line like |---|---|
                continue
            cells = [c.strip() for c in stripped.strip('|').split('|')]
            table_rows.append(cells)
            in_table = True
            continue
        elif in_table:
            flush_table()

        if stripped.startswith('# '):
            title_text = clean_markdown_inline(stripped[2:])
            story.append(Paragraph(title_text, title_style))
            story.append(HRFlowable(width="100%", thickness=1.5, color=brand_blue, spaceBefore=4, spaceAfter=8))
        elif stripped.startswith('## '):
            h1_text = clean_markdown_inline(stripped[3:])
            story.append(Spacer(1, 4))
            story.append(Paragraph(h1_text, h1_style))
            story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#94a3b8"), spaceBefore=2, spaceAfter=6))
        elif stripped.startswith('### '):
            h2_text = clean_markdown_inline(stripped[4:])
            story.append(Paragraph(h2_text, h2_style))
        elif stripped.startswith('- ') or stripped.startswith('* ') or re.match(r'^\d+\.\s', stripped):
            clean_item = clean_markdown_inline(stripped)
            story.append(Paragraph(f"• {clean_item[2:] if not re.match(r'^\d+\.\s', stripped) else clean_item}", bullet_style))
        elif stripped.startswith('---'):
            story.append(HRFlowable(width="100%", thickness=0.5, color=border_color, spaceBefore=6, spaceAfter=6))
        elif stripped.startswith('```'):
            continue
        else:
            p_text = clean_markdown_inline(stripped)
            story.append(Paragraph(p_text, body_style))

    if in_table:
        flush_table()

    def canvas_maker(*args, **kwargs):
        return NumberedCanvas(doc_title, *args, **kwargs)

    doc.build(story, canvasmaker=canvas_maker)
    print(f"Generated {pdf_path} ({os.path.getsize(pdf_path)} bytes)")

def main():
    repo_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    docs_dir = os.path.join(repo_dir, 'docs')

    mappings = [
        ('TEAM-BRIEFING-GUIDE.md', 'mDiff-Executive-Briefing-Guide.pdf', 'mDiff Executive Briefing & Team Walkthrough'),
        ('RELEASE-NOTES-v7.0.md', 'mDiff-Release-Notes-v7.0.pdf', 'mDiff v7.0.0 Release Notes'),
        ('HOW-TO-USE.md', 'mDiff-Complete-User-Guide.pdf', 'mDiff Complete User Guide'),
        ('IT-SECURITY-QA.md', 'mDiff-IT-Security-QA.pdf', 'mDiff IT Security & SecOps Q&A Dossier'),
        ('ENTERPRISE-SECURITY.md', 'mDiff-Enterprise-Security-Compliance.pdf', 'mDiff Enterprise Security & Compliance'),
        ('DEPLOYMENT-GUIDE.md', 'mDiff-Deployment-Guide.pdf', 'mDiff Deployment & Infrastructure Guide'),
    ]

    for md_file, pdf_file, title in mappings:
        md_path = os.path.join(docs_dir, md_file)
        pdf_path = os.path.join(docs_dir, pdf_file)
        if os.path.exists(md_path):
            build_pdf_from_markdown(md_path, pdf_path, title)
        else:
            print(f"Warning: {md_path} not found")

if __name__ == '__main__':
    main()
