// Trade Formulation Playbook — DOCX builder
// R2 cover (Double-Rule Frame) + IG-1 Ink Gold palette, 3-section architecture.
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, PageNumber, NumberFormat, AlignmentType, HeadingLevel,
  WidthType, BorderStyle, ShadingType, SectionType, TableOfContents,
  TableLayoutType, PageBreak, LevelFormat,
} = require("docx");
const fs = require("fs");

const contentA = require("./playbook-content-a.js");
const contentB = require("./playbook-content-b.js");
const CONTENT = [...contentA, ...contentB];

// ---------------------------------------------------------------- palette IG-1
const P = {
  bg: "1A1A1A", accent: "C9A84C",
  cover: { titleColor: "FFFFFF", subtitleColor: "B0B8C0", metaColor: "90989F", footerColor: "687078" },
  heading: "1A1A1A", body: "1F1F1F", secondary: "5A5A5A",
  tbl: { headerBg: "C9A84C", headerText: "1A1A1A", accentLine: "C9A84C", innerLine: "DDD5C0", surface: "F5F2E8" },
};
const F = { head: { ascii: "Arial", eastAsia: "SimHei" }, body: { ascii: "Times New Roman", eastAsia: "SimSun" } };
const FMONO = { ascii: "Courier New", eastAsia: "SimSun" };

const noBorders = {
  top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE },
  left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE },
};
const allNoBorders = {
  ...noBorders,
  insideHorizontal: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE },
};

// ---------------------------------------------------------------- cover helpers
function splitTitleLines(title, charsPerLine) {
  if (title.length <= charsPerLine) return [title];
  const breakAfter = new Set([..."，。、；：！？", ..."的与和及之在于为", ..."-_—–·/", ..." \t"]);
  const lines = [];
  let remaining = title;
  while (remaining.length > charsPerLine) {
    let breakAt = -1;
    for (let i = charsPerLine; i >= Math.floor(charsPerLine * 0.6); i--) {
      if (i < remaining.length && breakAfter.has(remaining[i - 1])) { breakAt = i; break; }
    }
    if (breakAt === -1) {
      const limit = Math.min(remaining.length, Math.ceil(charsPerLine * 1.3));
      for (let i = charsPerLine + 1; i < limit; i++) {
        if (breakAfter.has(remaining[i - 1])) { breakAt = i; break; }
      }
    }
    if (breakAt === -1) breakAt = charsPerLine;
    lines.push(remaining.slice(0, breakAt).trim());
    remaining = remaining.slice(breakAt).trim();
  }
  if (remaining) lines.push(remaining);
  if (lines.length > 1 && lines[lines.length - 1].length <= 2) {
    const last = lines.pop();
    lines[lines.length - 1] += last;
  }
  return lines;
}
function calcTitleLayout(title, maxWidthTwips, preferredPt = 40, minPt = 24) {
  // English title: average glyph is ~half CJK width; use pt*11 twips per char.
  const charWidth = (pt) => pt * 11;
  const charsPerLine = (pt) => Math.floor(maxWidthTwips / charWidth(pt));
  let titlePt = preferredPt, lines;
  while (titlePt >= minPt) {
    const cpl = charsPerLine(titlePt);
    if (cpl < 2) { titlePt -= 2; continue; }
    lines = splitTitleLines(title, cpl);
    if (lines.length <= 3) break;
    titlePt -= 2;
  }
  if (!lines || lines.length > 3) { lines = splitTitleLines(title, charsPerLine(minPt)); titlePt = minPt; }
  return { titlePt, titleLines: lines };
}

// R2 — Double-Rule Frame (centered), IG-1 dark bg + gold rules
function buildCoverR2(config) {
  const C = config.palette;
  const padL = 1400, padR = 1400;
  const { titlePt, titleLines } = calcTitleLayout(config.title, 11906 - padL - padR, 40, 24);
  const titleSize = titlePt * 2;
  const thickBorder = { style: BorderStyle.SINGLE, size: 18, color: C.accent, space: 20 };
  const children = [];

  children.push(new Paragraph({
    indent: { left: padL - 400, right: padR - 400 }, spacing: { before: 1200, after: 200 },
    border: { top: thickBorder }, children: [],
  }));
  children.push(new Paragraph({ spacing: { before: 1800 } }));
  if (config.englishLabel) {
    children.push(new Paragraph({
      alignment: AlignmentType.CENTER, spacing: { after: 500 },
      children: [new TextRun({ text: config.englishLabel.split("").join("  "), size: 18, color: C.accent, font: { ascii: "Calibri" }, characterSpacing: 40 })],
    }));
  }
  for (let i = 0; i < titleLines.length; i++) {
    children.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: i < titleLines.length - 1 ? 80 : 300, line: Math.ceil(titlePt * 23), lineRule: "atLeast" },
      children: [new TextRun({ text: titleLines[i], size: titleSize, bold: true, color: C.cover.titleColor, font: { eastAsia: "SimHei", ascii: "Arial" } })],
    }));
  }
  if (config.subtitle) {
    children.push(new Paragraph({
      alignment: AlignmentType.CENTER, spacing: { after: 400, line: 340, lineRule: "atLeast" },
      children: [new TextRun({ text: config.subtitle, size: 24, color: C.cover.subtitleColor, font: { eastAsia: "Microsoft YaHei", ascii: "Arial" } })],
    }));
  }
  children.push(new Paragraph({ spacing: { before: 1200 } }));
  for (const line of (config.metaLines || [])) {
    children.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 100, line: Math.ceil(18 * 23), lineRule: "atLeast" },
      children: [new TextRun({ text: line, size: 36, color: C.cover.metaColor, font: { eastAsia: "Microsoft YaHei", ascii: "Arial" } })],
    }));
  }
  children.push(new Paragraph({ spacing: { before: 2000 } }));
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    indent: { left: padL - 400, right: padR - 400 }, spacing: { before: 200 },
    border: { bottom: thickBorder },
    children: [new TextRun({ text: config.footerRight || "", size: 18, color: C.cover.footerColor, font: { ascii: "Arial" } })],
  }));

  return [new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: allNoBorders,
    rows: [new TableRow({
      height: { value: 16838, rule: "exact" },
      children: [new TableCell({ shading: { type: ShadingType.CLEAR, fill: C.bg }, borders: noBorders, children })],
    })],
  })];
}

// ---------------------------------------------------------------- body builders
function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 400, after: 180, line: 380, lineRule: "atLeast" },
    children: [new TextRun({ text, bold: true, size: 32, color: P.heading, font: F.head })],
  });
}
function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 280, after: 130, line: 330, lineRule: "atLeast" },
    children: [new TextRun({ text, bold: true, size: 27, color: P.heading, font: F.head })],
  });
}
function h3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 220, after: 100 },
    children: [new TextRun({ text, bold: true, size: 24, color: P.heading, font: F.head })],
  });
}
function bodyP(text) {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { after: 140, line: 312 },
    children: [new TextRun({ text, size: 22, color: P.body, font: F.body })],
  });
}
function noteP(text) {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { before: 60, after: 200, line: 300 },
    indent: { left: 240 },
    border: { left: { style: BorderStyle.SINGLE, size: 10, color: P.accent, space: 10 } },
    children: [new TextRun({ text, italics: true, size: 19, color: P.secondary, font: F.body })],
  });
}
let tableCounter = 0;
function tableTitle(text, breakBefore) {
  return new Paragraph({
    keepNext: true, pageBreakBefore: !!breakBefore, spacing: { before: 160, after: 90 },
    children: [new TextRun({ text, bold: true, size: 20, color: P.heading, font: F.head })],
  });
}
function cellP(text, opts = {}) {
  return new Paragraph({
    alignment: AlignmentType.LEFT,
    spacing: { line: 276, after: 20 },
    children: [new TextRun({
      text: String(text), size: opts.size || 18, bold: !!opts.bold,
      color: opts.color || P.body, font: opts.font || F.body,
    })],
  });
}
function dataTable(headers, widths, rows) {
  const headerRow = new TableRow({
    tableHeader: true, cantSplit: true,
    children: headers.map((text, i) => new TableCell({
      children: [cellP(text, { bold: true, color: P.tbl.headerText, font: F.head })],
      shading: { type: ShadingType.CLEAR, fill: P.tbl.headerBg },
      margins: { top: 70, bottom: 70, left: 110, right: 110 },
      width: { size: widths[i], type: WidthType.PERCENTAGE },
    })),
  });
  const dataRows = rows.map((r, ri) => new TableRow({
    cantSplit: true,
    children: r.map((text, i) => new TableCell({
      children: [cellP(text)],
      shading: ri % 2 === 1 ? { type: ShadingType.CLEAR, fill: P.tbl.surface } : undefined,
      margins: { top: 60, bottom: 60, left: 110, right: 110 },
      width: { size: widths[i], type: WidthType.PERCENTAGE },
    })),
  }));
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 6, color: P.tbl.accentLine },
      bottom: { style: BorderStyle.SINGLE, size: 6, color: P.tbl.accentLine },
      left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: P.tbl.innerLine },
      insideVertical: { style: BorderStyle.NONE },
    },
    rows: [headerRow, ...dataRows],
  });
}
function codeBlock(lines) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: P.tbl.innerLine },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: P.tbl.innerLine },
      left: { style: BorderStyle.SINGLE, size: 4, color: P.tbl.innerLine },
      right: { style: BorderStyle.SINGLE, size: 4, color: P.tbl.innerLine },
      insideHorizontal: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE },
    },
    rows: [new TableRow({
      cantSplit: true,
      children: [new TableCell({
        shading: { type: ShadingType.CLEAR, fill: P.tbl.surface },
        margins: { top: 110, bottom: 110, left: 200, right: 160 },
        width: { size: 100, type: WidthType.PERCENTAGE },
        children: lines.map((line) => new Paragraph({
          spacing: { line: 260, after: 20 },
          children: [new TextRun({ text: line, size: 17, color: "333333", font: FMONO })],
        })),
      })],
    })],
  });
}
const numberingConfigs = [];
function numberedList(ref, items) {
  numberingConfigs.push({
    reference: ref,
    levels: [{
      level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
      style: { paragraph: { indent: { left: 620, hanging: 360 } } },
    }],
  });
  return items.map((text) => new Paragraph({
    numbering: { reference: ref, level: 0 },
    alignment: AlignmentType.JUSTIFIED,
    spacing: { after: 90, line: 300 },
    children: [new TextRun({ text, size: 21, color: P.body, font: F.body })],
  }));
}

// render content blocks -> docx children
function render(blocks) {
  const out = [];
  for (const b of blocks) {
    if (b.t === "h1") out.push(h1(b.text));
    else if (b.t === "h2") out.push(h2(b.text));
    else if (b.t === "h3") out.push(h3(b.text));
    else if (b.t === "p") out.push(bodyP(b.text));
    else if (b.t === "note") out.push(noteP(b.text));
    else if (b.t === "table") {
      if (b.title) { tableCounter += 1; out.push(tableTitle(b.title, b.break)); }
      out.push(dataTable(b.headers, b.widths, b.rows));
      out.push(new Paragraph({ spacing: { after: 120 }, children: [] }));
    }
    else if (b.t === "code") {
      out.push(codeBlock(b.lines));
      out.push(new Paragraph({ spacing: { after: 120 }, children: [] }));
    }
    else if (b.t === "num") out.push(...numberedList(b.ref, b.items));
  }
  return out;
}

const bodyChildren = render(CONTENT);

// ---------------------------------------------------------------- footers/headers
function pageFooter() {
  return new Footer({
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ children: [PageNumber.CURRENT], size: 18, color: "888888", font: { ascii: "Arial" } })],
    })],
  });
}
function pageHeader() {
  return new Header({
    children: [new Paragraph({
      alignment: AlignmentType.RIGHT,
      border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: P.tbl.innerLine, space: 4 } },
      children: [new TextRun({ text: "CG Order-Flow Terminal — Trade Formulation Playbook", size: 15, color: "999999", font: { ascii: "Arial" } })],
    })],
  });
}

// ---------------------------------------------------------------- TOC section children
const tocChildren = [
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 480, after: 360 },
    children: [new TextRun({ text: "Table of Contents", bold: true, size: 32, color: P.heading, font: F.head })],
  }),
  new TableOfContents("Table of Contents", { hyperlink: true, headingStyleRange: "1-2" }),
  new Paragraph({
    spacing: { before: 200 },
    children: [new TextRun({
      text: "Note: This Table of Contents is generated via field codes. To refresh page numbers after editing, right-click the TOC and select Update Field.",
      italics: true, size: 18, color: "888888", font: F.body,
    })],
  }),
];

// ---------------------------------------------------------------- document
const pgSize = { width: 11906, height: 16838 };
const pgMargin = { top: 1440, bottom: 1440, left: 1701, right: 1417 };

const doc = new Document({
  creator: "CG Order-Flow Terminal",
  title: "Trade Formulation Playbook",
  styles: {
    default: {
      document: {
        run: { font: F.body, size: 22, color: P.body },
        paragraph: { spacing: { line: 312 } },
      },
      heading1: {
        run: { font: F.head, size: 32, bold: true, color: P.heading },
        paragraph: { spacing: { before: 400, after: 180 }, outlineLevel: 0 },
      },
      heading2: {
        run: { font: F.head, size: 27, bold: true, color: P.heading },
        paragraph: { spacing: { before: 280, after: 130 }, outlineLevel: 1 },
      },
      heading3: {
        run: { font: F.head, size: 24, bold: true, color: P.heading },
        paragraph: { spacing: { before: 220, after: 100 }, outlineLevel: 2 },
      },
    },
  },
  numbering: { config: numberingConfigs },
  sections: [
    { // Section 1: cover — margin 0, no footer
      properties: { page: { size: pgSize, margin: { top: 0, bottom: 0, left: 0, right: 0 } } },
      children: buildCoverR2({
        palette: P,
        title: "Trade Formulation Playbook",
        subtitle: "From twelve-asset order-flow data to executable setups — CG Order-Flow Terminal",
        englishLabel: "ORDER FLOW TRADING",
        metaLines: [
          "Scope · BTC ETH SOL BNB XRP ADA AVAX DOGE LINK LTC XAU XAG",
          "Data · Coinglass-exact footprint, walls, liquidations, CVD, whales",
          "Version 1.0 · 10 November 2026",
        ],
        footerRight: "CG Order-Flow Terminal · Internal Methodology · 2026",
      }),
    },
    { // Section 2: TOC — roman numerals
      properties: {
        type: SectionType.NEXT_PAGE,
        page: { size: pgSize, margin: pgMargin, pageNumbers: { start: 1, formatType: NumberFormat.UPPER_ROMAN } },
      },
      footers: { default: pageFooter() },
      children: tocChildren,
    },
    { // Section 3: body — arabic from 1
      properties: {
        type: SectionType.NEXT_PAGE,
        page: { size: pgSize, margin: pgMargin, pageNumbers: { start: 1, formatType: NumberFormat.DECIMAL } },
      },
      headers: { default: pageHeader() },
      footers: { default: pageFooter() },
      children: bodyChildren,
    },
  ],
});

Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync("/home/z/my-project/download/Trade-Formulation-Playbook.docx", buf);
  console.log("WROTE download/Trade-Formulation-Playbook.docx", buf.length, "bytes,", tableCounter, "tables");
});
