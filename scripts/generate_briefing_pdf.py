import os
import sys
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether, HRFlowable
)
from reportlab.pdfgen import canvas

class NumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
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
            self.drawString(54, 755, "mDiff v5.1.0 — Executive Briefing & Team Walkthrough Guide")
            self.drawRightString(612 - 54, 755, "Mavenir Systems • Internal")
            self.setStrokeColor(colors.HexColor("#cbd5e1"))
            self.setLineWidth(0.5)
            self.line(54, 747, 612 - 54, 747)

        # Footer (all pages)
        self.setStrokeColor(colors.HexColor("#cbd5e1"))
        self.setLineWidth(0.5)
        self.line(54, 45, 612 - 54, 45)
        self.drawString(54, 32, "CONFIDENTIAL • FOR INTERNAL MAVENIR TEAM USE ONLY • 100% PERMISSIVE OPEN SOURCE")
        self.drawRightString(612 - 54, 32, f"Page {self._pageNumber} of {page_count}")
        self.restoreState()

def build_pdf(output_path):
    doc = SimpleDocTemplate(
        output_path,
        pagesize=letter,
        leftMargin=54,
        rightMargin=54,
        topMargin=54,
        bottomMargin=54
    )

    styles = getSampleStyleSheet()

    # Custom styles
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
        fontSize=22,
        leading=26,
        textColor=primary_color,
        spaceAfter=4
    )

    subtitle_style = ParagraphStyle(
        'DocSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=11,
        leading=15,
        textColor=accent_blue,
        spaceAfter=12
    )

    h1_style = ParagraphStyle(
        'Heading1_Custom',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=14,
        leading=18,
        textColor=brand_blue,
        spaceBefore=14,
        spaceAfter=6,
        keepWithNext=True
    )

    h2_style = ParagraphStyle(
        'Heading2_Custom',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=11,
        leading=15,
        textColor=primary_color,
        spaceBefore=10,
        spaceAfter=4,
        keepWithNext=True
    )

    body_style = ParagraphStyle(
        'Body_Custom',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9.5,
        leading=13.5,
        textColor=text_dark,
        spaceAfter=6
    )

    bullet_style = ParagraphStyle(
        'Bullet_Custom',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=13,
        textColor=text_dark,
        leftIndent=14,
        firstLineIndent=-10,
        spaceAfter=3
    )

    callout_style = ParagraphStyle(
        'CalloutText',
        parent=styles['Normal'],
        fontName='Helvetica-Oblique',
        fontSize=9,
        leading=13,
        textColor=colors.HexColor("#1e3a8a")
    )

    code_style = ParagraphStyle(
        'CodeStyle',
        parent=styles['Normal'],
        fontName='Courier',
        fontSize=8,
        leading=10,
        textColor=colors.HexColor("#0f172a")
    )

    table_header = ParagraphStyle(
        'TableHeader',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8.5,
        leading=11,
        textColor=colors.white
    )

    table_cell = ParagraphStyle(
        'TableCell',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8,
        leading=10.5,
        textColor=text_dark
    )

    table_cell_bold = ParagraphStyle(
        'TableCellBold',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8,
        leading=10.5,
        textColor=primary_color
    )

    story = []

    # Title Banner Box
    meta_table_data = [
        [
            Paragraph("<b>mDiff (Mavenir Diff) Comparison Suite</b>", title_style),
            Paragraph("<b>Version:</b> 5.1.0<br/><b>Date:</b> November 24, 2026<br/><b>Classification:</b> Mavenir Internal", table_cell_bold)
        ],
        [
            Paragraph("Team Briefing & Executive Walkthrough Guide", subtitle_style),
            Paragraph("<b>Distribution:</b> Windows Setup, Portable, Web", table_cell)
        ]
    ]
    meta_table = Table(meta_table_data, colWidths=[360, 144])
    meta_table.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 0),
        ('TOPPADDING', (0,0), (-1,-1), 0),
        ('LEFTPADDING', (0,0), (-1,-1), 0),
        ('RIGHTPADDING', (0,0), (-1,-1), 0),
    ]))
    story.append(meta_table)
    story.append(Spacer(1, 6))
    story.append(HRFlowable(width="100%", thickness=1.5, color=brand_blue, spaceBefore=2, spaceAfter=8))

    # SECTION 1
    story.append(Paragraph("1. Executive Summary & Layman's Explanation", h1_style))
    story.append(Paragraph(
        "<b>What is mDiff?</b> In plain terms, <b>mDiff</b> is a powerful comparison tool built specifically for telecom engineers, "
        "cloud platform specialists, and developers. Whenever you need to know <i>'What changed between yesterday's configuration and today's?'</i> "
        "or <i>'Why is Site A behaving differently from Site B?'</i>, mDiff pinpoints the exact differences in seconds.",
        body_style
    ))
    story.append(Paragraph(
        "Instead of reading through thousands of lines of code or complex configuration files manually, you point mDiff to two folders, two files, "
        "or two network dumps. It instantly highlights what was <b>added</b>, what was <b>deleted</b>, and what was <b>modified</b>, while ignoring "
        "meaningless noise like timestamps or whitespace.",
        body_style
    ))

    # Value Props Box
    summary_box_data = [[
        Paragraph(
            "<b>Key Highlights for Today's Meeting:</b><br/>"
            "• <b>100% Free & Open-Source:</b> No licenses, no subscriptions, zero expiration, zero cost to Mavenir.<br/>"
            "• <b>Beyond Compare Fidelity:</b> Identical look, feel, color palette, and keyboard shortcuts (F7, Alt+Right, Alt+Left).<br/>"
            "• <b>Dual Delivery:</b> Available as a standard Windows Program Files installer (`mDiff-Setup-5.1.0.exe` for Microsoft Intune / Company Portal) AND as an internal web portal (`http://10.10.84.22:8097`) accessible from any laptop over Mavenir VPN.<br/>"
            "• <b>Telecom Intelligence:</b> Built-in semantic filtering for Kubernetes/OpenShift YAML manifests and cellular XML parameter dumps.",
            callout_style
        )
    ]]
    summary_box = Table(summary_box_data, colWidths=[504])
    summary_box.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#eff6ff")),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor("#bfdbfe")),
        ('TOPPADDING', (0,0), (-1,-1), 8),
        ('BOTTOMPADDING', (0,0), (-1,-1), 8),
        ('LEFTPADDING', (0,0), (-1,-1), 10),
        ('RIGHTPADDING', (0,0), (-1,-1), 10),
    ]))
    story.append(summary_box)
    story.append(Spacer(1, 10))

    # SECTION 2
    story.append(Paragraph("2. Visual Deep-Dive: Explanation of Sync Features", h1_style))
    story.append(Paragraph(
        "On the mDiff Home screen, you see comparison tiles including <b>Folder Sync</b> and <b>Table & Data</b>. "
        "Here is an intuitive, diagrammatic explanation of what each feature does and when your team should use them:",
        body_style
    ))

    story.append(Paragraph("A. Folder Sync vs. Folder Compare", h2_style))
    story.append(Paragraph(
        "• <b>Folder Compare (Inspection Tool):</b> Used when you want to <i>explore and inspect</i>. It scans two directory trees, shows an expand/collapse tree, and lets you double-click individual files to view side-by-side diffs.<br/>"
        "• <b>Folder Sync (Action & Replication Tool):</b> Used when your goal is to <i>reconcile and align</i>. It automates copying newer files, removing decommissioned files, and creating exact replicas based on predefined synchronization rules.",
        body_style
    ))

    # Visual Table: Folder Sync Rules
    fsync_table_data = [
        [Paragraph("Sync Rule", table_header), Paragraph("How It Works (Visual Direction)", table_header), Paragraph("Telecom / Engineering Use Case", table_header)],
        [
            Paragraph("<b>Update Right</b>", table_cell_bold),
            Paragraph("Left (Source) ──[ Newer / Missing ]──► Right<br/><i>(Leaves unique files on Right untouched)</i>", table_cell),
            Paragraph("Deploying patch files to a lab test server without overwriting existing lab-specific logs or local debug scripts.", table_cell)
        ],
        [
            Paragraph("<b>Mirror to Right</b>", table_cell_bold),
            Paragraph("Left (Master) ════[ Exact Clone ]════► Right<br/><i>(Copies additions/changes; deletes Right orphans)</i>", table_cell),
            Paragraph("Ensuring a backup disaster-recovery directory exactly mirrors the production Helm chart release repository.", table_cell)
        ],
        [
            Paragraph("<b>Two-Way Sync</b>", table_cell_bold),
            Paragraph("Left ◄──[ Bi-directional Sync ]──► Right<br/><i>(Copies latest timestamp from either side)</i>", table_cell),
            Paragraph("Synchronizing shared workspace folders between a development laptop and a remote lab virtual machine.", table_cell)
        ]
    ]
    fsync_table = Table(fsync_table_data, colWidths=[90, 204, 210])
    fsync_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), brand_blue),
        ('GRID', (0,0), (-1,-1), 0.5, border_color),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, bg_light]),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('RIGHTPADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(fsync_table)
    story.append(Spacer(1, 8))

    story.append(Paragraph("B. Table & Data Compare vs. Text Compare", h2_style))
    story.append(Paragraph(
        "• <b>Text Compare (Line-by-Line):</b> Compares sequential text characters. If row 10 in a CSV file was moved to row 50, Text Compare flags 40 lines as completely mismatched.<br/>"
        "• <b>Table & Data Compare (Database Grid):</b> Treats the file as a 2D structured database table. It matches rows by a <b>Key Column</b> (such as `IMSI`, `subscriber_id`, or `cell_id`), regardless of row order, and highlights only the specific modified cell values.",
        body_style
    ))

    # Visual Table: Table Compare
    tcomp_table_data = [
        [Paragraph("Aspect", table_header), Paragraph("Standard Text Compare", table_header), Paragraph("Table & Data Compare (mDiff)", table_header)],
        [
            Paragraph("<b>Data Structure</b>", table_cell_bold),
            Paragraph("Sequential lines of raw text.", table_cell),
            Paragraph("Columns and rows with type awareness (numeric, text, date).", table_cell)
        ],
        [
            Paragraph("<b>Reordered Rows</b>", table_cell_bold),
            Paragraph("Shows mass deletions and additions across the entire file.", table_cell),
            Paragraph("Recognizes rows as identical; aligns them automatically by Primary Key.", table_cell)
        ],
        [
            Paragraph("<b>Difference Scope</b>", table_cell_bold),
            Paragraph("Highlights the full line width.", table_cell),
            Paragraph("Highlights the exact cell (e.g. `Port: 8080 -> 8097`).", table_cell)
        ],
        [
            Paragraph("<b>Telecom Example</b>", table_cell_bold),
            Paragraph("Comparing raw script logs (`.sh`, `.log`).", table_cell),
            Paragraph("Comparing Call Detail Records (CDRs), subscriber database dumps, IP routing tables, or 5G gNodeB parameter sheets (`.csv`, `.tsv`).", table_cell)
        ]
    ]
    tcomp_table = Table(tcomp_table_data, colWidths=[90, 204, 210])
    tcomp_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#4338ca")), # Indigo 700
        ('GRID', (0,0), (-1,-1), 0.5, border_color),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, bg_light]),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('RIGHTPADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(tcomp_table)
    story.append(Spacer(1, 10))

    story.append(PageBreak())

    # SECTION 3
    story.append(Paragraph("3. Addressing Core Meeting Questions", h1_style))
    story.append(Paragraph(
        "Here are clear, definitive answers to the three core questions your team and manager will ask:",
        body_style
    ))

    story.append(Paragraph("(a) How does mDiff compare to Beyond Compare?", h2_style))
    story.append(Paragraph(
        "mDiff was purposefully designed to maintain <b>complete visual and muscle-memory parity</b> with Beyond Compare. "
        "Any engineer accustomed to Beyond Compare can switch immediately with zero learning curve:",
        body_style
    ))
    story.append(Paragraph("• <b>Visual Theme & Color Palette:</b> Differences appear in bold red (`#c51b1b`) on the left with soft pastel rose striping (`#fdecec`). The right side displays crisp, readable black font. Unique orphan files render in distinctive purple (`#7e22ce`), and identical files display clean `=` signs.", bullet_style))
    story.append(Paragraph("• <b>Monospace Typography:</b> Standard corporate monospace font stack (`Consolas`, `Lucida Console`, `DejaVu Sans Mono`) with `13px` sizing and clean `20px` line spacing.", bullet_style))
    story.append(Paragraph("• <b>Standard Keyboard Shortcuts:</b> `F7` (Next Diff), `Shift+F7` (Previous Diff), `Alt+Right` / `Alt+Left` (Transfer changes), and `Ctrl+1` through `Ctrl+5` for session modes.", bullet_style))
    story.append(Paragraph("• <b>Line Detail Inspector:</b> The docked character-by-character inspector bar at the bottom provides an enlarged view of the active line pair with instant transfer buttons.", bullet_style))
    story.append(Paragraph("• <b>Initial Collapsed View:</b> Folders start in a clean collapsed view upon opening, allowing engineers to view top-level module summaries without being overwhelmed by thousands of files.", bullet_style))

    story.append(Spacer(1, 4))
    story.append(Paragraph("(b) What extra features have we added that Beyond Compare lacks?", h2_style))
    story.append(Paragraph("• <b>Dual Architecture (Desktop + Web over VPN):</b> Beyond Compare is desktop-only. mDiff runs as a native desktop application AND as an internal web portal (`http://10.10.84.22:8097`). Anyone on the Mavenir VPN can perform comparisons in Chrome or Edge without installing software.", bullet_style))
    story.append(Paragraph("• <b>Intelligent Kubernetes & Cloud Noise Filter:</b> Beyond Compare treats dynamic runtime metadata as real differences. mDiff's Config & XML mode automatically suppresses dynamic Kubernetes noise (`resourceVersion`, `managedFields`, `creationTimestamp`, `uid`, `status`), saving hours of manual review.", bullet_style))
    story.append(Paragraph("• <b>Interactive Zoom (70% - 200%):</b> Engineers can dynamically scale the UI, editor font, and folder tree using `Ctrl` + Mouse Wheel or toolbar zoom controls.", bullet_style))
    story.append(Paragraph("• <b>Zero-Latency Session Caching:</b> Switching from active text editing back to Folder Compare takes 0ms. Folder comparisons remain persistently cached in RAM.", bullet_style))
    story.append(Paragraph("• <b>Automated Enterprise Setup:</b> Pre-compiled NSIS installer (`mDiff-Setup-5.1.0.exe`) installs directly to `C:\\Program Files\\mDiff\\` with an uninstaller and silent `/S` support for Microsoft Intune / Company Portal deployment.", bullet_style))

    story.append(Spacer(1, 4))
    story.append(Paragraph("(c) What issues have we sorted out compared to Beyond Compare?", h2_style))
    story.append(Paragraph("• <b>License Expiration & Procurement Roadblocks:</b> Beyond Compare is commercial paid software. When trial licenses expire or license keys are limited, engineers are blocked. mDiff is 100% free, MIT/ISC permissive, and requires zero license keys.", bullet_style))
    story.append(Paragraph("• <b>Air-Gapped & Zero Data Egress:</b> All diff calculations run locally in client RAM/CPU. No source code, cellular configs, or diff outputs leave your laptop.", bullet_style))
    story.append(Paragraph("• <b>Non-Snapping Minimap Scrolling:</b> Fixed the common comparison bug where clicking non-differential areas forcefully jumped the cursor into nearby diffs. In mDiff, the overview minimap allows fluid, freeform sliding.", bullet_style))
    story.append(Paragraph("• <b>Eliminated False Diff Warnings in Line Details:</b> Precision aligned mapping (`getAlignedLineNumbers`) matches lines across gap insertions, eliminating false diff warnings in non-differential code.", bullet_style))

    story.append(Spacer(1, 10))

    # SECTION 4
    story.append(Paragraph("4. Enterprise Distribution & Installation Packages", h1_style))
    story.append(Paragraph(
        "To ensure every engineer at Mavenir can access mDiff regardless of laptop permissions, three distribution channels are provided:",
        body_style
    ))

    dist_table_data = [
        [Paragraph("Deployment Channel", table_header), Paragraph("Package File", table_header), Paragraph("Target Environment & Usage", table_header)],
        [
            Paragraph("<b>Company Portal / Intune Setup</b>", table_cell_bold),
            Paragraph("`mDiff-Setup-5.1.0.exe`<br/>`mDiff-Setup-x64.exe`<br/><i>(95.5 MB)</i>", code_style),
            Paragraph("<b>Official Enterprise Setup.</b> Installs to `C:\\Program Files\\mDiff\\`. Creates `Uninstall mDiff.exe`, Desktop/Start Menu shortcuts, and registers in Windows Registry. Supports silent install (`/S`).", table_cell)
        ],
        [
            Paragraph("<b>Portable Windows Package</b>", table_cell_bold),
            Paragraph("`mDiff-windows-x64.zip`<br/><i>(405 MB)</i>", code_style),
            Paragraph("<b>Zero Admin Rights Required.</b> Simply extract anywhere and double-click `mDiff.exe`. Ideal for locked-down corporate laptops without admin privileges.", table_cell)
        ],
        [
            Paragraph("<b>Internal Web Portal</b>", table_cell_bold),
            Paragraph("`mDiff-internal-web-deployment.tar.gz`<br/><i>(2.5 MB)</i>", code_style),
            Paragraph("<b>Browser Access over Mavenir VPN.</b> Deployed on `bglocp-installer` (`http://10.10.84.22:8097`). Zero installation on client laptops; open directly in Edge or Chrome.", table_cell)
        ],
        [
            Paragraph("<b>macOS Package</b>", table_cell_bold),
            Paragraph("`mDiff-macOS-arm64.zip`<br/><i>(514 MB)</i>", code_style),
            Paragraph("<b>Apple Silicon Standalone App.</b> Drag `mDiff.app` to Applications on macOS.", table_cell)
        ]
    ]
    dist_table = Table(dist_table_data, colWidths=[120, 150, 234])
    dist_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), primary_color),
        ('GRID', (0,0), (-1,-1), 0.5, border_color),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, bg_light]),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('RIGHTPADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(dist_table)
    story.append(Spacer(1, 10))

    # SECTION 5
    story.append(Paragraph("5. Anticipated Team Questions & Quick Answers (FAQ)", h1_style))
    faq_box_data = [
        [Paragraph("<b>Q: Is mDiff approved for sensitive telecom configuration files?</b><br/>"
                   "<b>A:</b> Yes. mDiff operates under an air-gapped, local-first security architecture. All file parsing and diff algorithms execute strictly within client memory. Nothing is sent to external servers or cloud services.", body_style)],
        [Paragraph("<b>Q: Why do we have both an installer and a portable zip?</b><br/>"
                   "<b>A:</b> Enterprise flexibility. The setup installer (`mDiff-Setup-5.1.0.exe`) provides standard `Program Files` integration and uninstallation for corporate IT (Microsoft Intune). The portable zip lets contractors or engineers without local admin rights start working instantly.", body_style)],
        [Paragraph("<b>Q: Does mDiff support dark mode?</b><br/>"
                   "<b>A:</b> Yes. mDiff includes a dedicated high-contrast dark theme optimized for long debugging sessions, accessible via the top-right toolbar switch.", body_style)],
        [Paragraph("<b>Q: What should I download to test it right now?</b><br/>"
                   "<b>A:</b> For a full Windows installation, run `mDiff-Setup-5.1.0.exe`. For instant zero-install testing, unzip `mDiff-windows-x64.zip` and run `mDiff.exe`. Or open `http://10.10.84.22:8097` in your browser if connected to Mavenir VPN.", body_style)]
    ]
    faq_table = Table(faq_box_data, colWidths=[504])
    faq_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#f1f5f9")),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#cbd5e1")),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
        ('RIGHTPADDING', (0,0), (-1,-1), 8),
    ]))
    story.append(faq_table)

    doc.build(story, canvasmaker=NumberedCanvas)
    print(f"PDF built successfully: {output_path} ({os.path.getsize(output_path)} bytes)")

if __name__ == '__main__':
    repo_dir = '/Users/anuabhi/.gemini/antigravity/scratch/diffx'
    doc_pdf = os.path.join(repo_dir, 'docs', 'mDiff-Executive-Briefing-Guide.pdf')
    build_pdf(doc_pdf)
    
    # Also write to artifacts directory
    artifact_dir = '/Users/anuabhi/.gemini/antigravity/brain/351256c4-2c4a-4c84-b166-e171829454f8'
    if os.path.exists(artifact_dir):
        artifact_pdf = os.path.join(artifact_dir, 'mDiff-Executive-Briefing-Guide.pdf')
        build_pdf(artifact_pdf)
