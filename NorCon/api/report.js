import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, HeadingLevel, BorderStyle, WidthType,
  ShadingType, VerticalAlign, PageNumber, PageBreak, LevelFormat,
} from "docx";

const BRAND_GREEN  = "0D2B1B";
const BRAND_SAGE   = "E5F0E8";
const BRAND_ACCENT = "2E7D52";
const BRAND_MID    = "3a9962";
const BLACK        = "1A1A1A";
const GREY         = "666666";
const LIGHT_GREY   = "F5F5F5";
const RED          = "C0392B";
const AMBER        = "E67E22";
const GREEN_RAG    = "27AE60";

const PAGE_WIDTH   = 11906; // A4 in DXA
const MARGINS      = { top:1134, right:1134, bottom:1134, left:1134 }; // 2cm
const CONTENT_W    = PAGE_WIDTH - MARGINS.left - MARGINS.right; // 9638 DXA

function h(text, level) {
  const sizes   = [36, 28, 24];
  const colors  = [BRAND_GREEN, BRAND_ACCENT, BLACK];
  const spacing = [{ before:360, after:200 }, { before:280, after:160 }, { before:200, after:120 }];
  return new Paragraph({
    heading: [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3][level],
    spacing: spacing[level],
    border: level === 0 ? { bottom:{ style:BorderStyle.SINGLE, size:6, color:BRAND_ACCENT, space:4 } } : undefined,
    children: [new TextRun({ text, bold:true, size:sizes[level], color:colors[level], font:"Calibri" })],
  });
}

function p(text, opts={}) {
  return new Paragraph({
    spacing: { before:80, after:120, line:276 },
    children: [new TextRun({ text: String(text||""), size:22, color:opts.grey?GREY:BLACK, font:"Calibri", italics:!!opts.italic })],
  });
}

function bullet(text) {
  return new Paragraph({
    numbering: { reference:"bullets", level:0 },
    spacing: { before:40, after:40 },
    children: [new TextRun({ text: String(text||""), size:22, color:BLACK, font:"Calibri" })],
  });
}

function kv(key, value) {
  return new Paragraph({
    spacing: { before:40, after:40 },
    children: [
      new TextRun({ text: key + ": ", bold:true, size:22, color:BLACK, font:"Calibri" }),
      new TextRun({ text: String(value||"—"), size:22, color:GREY, font:"Calibri" }),
    ],
  });
}

function ragPill(text, rag) {
  const colors = { red:RED, amber:AMBER, green:GREEN_RAG };
  const col = colors[rag] || GREY;
  return new TextRun({ text: ` ${text} `, bold:true, size:18, color:col, font:"Calibri" });
}

function tblRow(cells, isHeader=false) {
  const shading = isHeader ? { fill:BRAND_GREEN, type:ShadingType.CLEAR } : undefined;
  return new TableRow({
    tableHeader: isHeader,
    children: cells.map((cell, ci) => new TableCell({
      shading: isHeader ? { fill:BRAND_GREEN, type:ShadingType.CLEAR } : (ci%2===0 ? { fill:"FAFAFA", type:ShadingType.CLEAR } : undefined),
      margins: { top:80, bottom:80, left:120, right:120 },
      children: [new Paragraph({
        spacing: { before:40, after:40 },
        children: [new TextRun({ text:String(cell||"—"), size:isHeader?20:20, bold:isHeader, color:isHeader?BRAND_SAGE:BLACK, font:"Calibri" })],
      })],
    })),
  });
}

function space() {
  return new Paragraph({ spacing:{ before:80, after:80 }, children:[new TextRun("")] });
}

function divider() {
  return new Paragraph({
    spacing: { before:120, after:120 },
    border: { bottom:{ style:BorderStyle.SINGLE, size:4, color:"CCCCCC", space:2 } },
    children: [new TextRun("")],
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error:"Method not allowed" });

  const { reportText, ctx } = req.body;
  if (!reportText || !ctx) return res.status(400).json({ error:"Missing reportText or ctx" });

  try {
    // Parse the AI narrative into sections
    const sections_raw = reportText.split(/\n##\s+/);
    const sectionMap   = {};
    sections_raw.forEach(block => {
      const lines = block.trim().split("\n");
      const title = lines[0].replace(/^\d+\.\s*/, "").trim();
      const body  = lines.slice(1).join("\n").trim();
      sectionMap[title] = body;
    });

    const children = [];

    // ── Cover page ────────────────────────────────────────────────────────────
    const coverTable = new Table({
      width: { size: CONTENT_W, type: WidthType.DXA },
      columnWidths: [CONTENT_W],
      rows: [
        new TableRow({ children: [
          new TableCell({
            shading: { fill:BRAND_GREEN, type:ShadingType.CLEAR },
            margins: { top:720, bottom:720, left:720, right:720 },
            children: [
              new Paragraph({ alignment:AlignmentType.LEFT, spacing:{ before:0, after:200 }, children:[
                new TextRun({ text: ctx.project.name || "Project Report", bold:true, size:52, color:BRAND_SAGE, font:"Calibri" }),
              ]}),
              new Paragraph({ spacing:{ before:0, after:160 }, children:[
                new TextRun({ text: `Project Code: ${ctx.project.code||"—"}  |  Date: ${new Date().toLocaleDateString("en-GB",{day:"2-digit",month:"long",year:"numeric"})}`, size:22, color:"8aac96", font:"Calibri" }),
              ]}),
              new Paragraph({ spacing:{ before:0, after:160 }, children:[
                new TextRun({ text: `Project Manager: ${ctx.project.manager||"—"}  |  Sponsor: ${ctx.project.sponsor||"—"}`, size:22, color:"8aac96", font:"Calibri" }),
              ]}),
              new Paragraph({ spacing:{ before:200, after:0 }, children:[
                new TextRun({ text: `Progress: ${ctx.progress.pct}%  `, size:24, color:BRAND_SAGE, bold:true, font:"Calibri" }),
                ragPill(`${ctx.risks.red} RED`, "red"),
                new TextRun({ text: "  ", size:22, font:"Calibri" }),
                ragPill(`${ctx.risks.amber} AMBER`, "amber"),
                new TextRun({ text: "  ", size:22, font:"Calibri" }),
                ragPill(`${ctx.risks.green} GREEN`, "green"),
              ]}),
            ],
          }),
        ]}),
      ],
    });

    children.push(coverTable);
    children.push(new Paragraph({ children:[new PageBreak()] }));

    // ── Render each section from AI text ─────────────────────────────────────
    const sectionOrder = [
      "Executive Summary",
      "Project Overview",
      "Progress Against Baseline",
      "Benefits Realisation",
      "Risks and Issues",
      "Change History",
      "Sustainability Performance",
      "Lessons Learned",
      "Recommendations and Next Steps",
    ];

    sectionOrder.forEach((title, idx) => {
      children.push(h(title, 0));

      const body = sectionMap[title] || sectionMap[Object.keys(sectionMap).find(k => k.includes(title.split(" ")[0])) || ""] || "";

      if (!body) {
        children.push(p("No data recorded for this section.", { grey:true, italic:true }));
      } else {
        body.split("\n").forEach(line => {
          const trimmed = line.trim();
          if (!trimmed) { children.push(space()); return; }
          if (trimmed.startsWith("### "))  { children.push(h(trimmed.replace("### ",""), 2)); return; }
          if (trimmed.startsWith("## "))   { children.push(h(trimmed.replace("## ",""), 1)); return; }
          if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
            children.push(bullet(trimmed.replace(/^[-*]\s+/, ""))); return;
          }
          if (/^\d+\.\s/.test(trimmed)) { children.push(bullet(trimmed.replace(/^\d+\.\s+/, ""))); return; }
          children.push(p(trimmed));
        });
      }

      if (idx < sectionOrder.length - 1) {
        children.push(divider());
        children.push(space());
      }
    });

    // ── Build document ────────────────────────────────────────────────────────
    const doc = new Document({
      numbering: {
        config: [{
          reference: "bullets",
          levels: [{ level:0, format:LevelFormat.BULLET, text:"•", alignment:AlignmentType.LEFT,
            style:{ paragraph:{ indent:{ left:720, hanging:360 } } } }],
        }],
      },
      styles: {
        default: { document:{ run:{ font:"Calibri", size:22 } } },
        paragraphStyles: [
          { id:"Heading1", name:"Heading 1", basedOn:"Normal", next:"Normal", quickFormat:true,
            run:{ size:36, bold:true, font:"Calibri", color:BRAND_GREEN },
            paragraph:{ spacing:{ before:360, after:200 }, outlineLevel:0,
              border:{ bottom:{ style:BorderStyle.SINGLE, size:6, color:BRAND_ACCENT, space:4 } } } },
          { id:"Heading2", name:"Heading 2", basedOn:"Normal", next:"Normal", quickFormat:true,
            run:{ size:28, bold:true, font:"Calibri", color:BRAND_ACCENT },
            paragraph:{ spacing:{ before:280, after:160 }, outlineLevel:1 } },
          { id:"Heading3", name:"Heading 3", basedOn:"Normal", next:"Normal", quickFormat:true,
            run:{ size:24, bold:true, font:"Calibri", color:BLACK },
            paragraph:{ spacing:{ before:200, after:120 }, outlineLevel:2 } },
        ],
      },
      sections: [{
        properties: {
          page: { size:{ width:11906, height:16838 }, margin:MARGINS },
        },
        headers: {
          default: new Header({ children:[
            new Paragraph({
              border:{ bottom:{ style:BorderStyle.SINGLE, size:4, color:BRAND_ACCENT, space:2 } },
              spacing:{ before:0, after:80 },
              tabStops:[{ type:"right", position:9638 }],
              children:[
                new TextRun({ text: ctx.project.name||"Project Report", size:18, color:GREY, font:"Calibri" }),
                new TextRun({ text:"\t", font:"Calibri" }),
                new TextRun({ text: `Progress: ${ctx.progress.pct}%`, size:18, color:GREY, font:"Calibri" }),
              ],
            }),
          ]}),
        },
        footers: {
          default: new Footer({ children:[
            new Paragraph({
              border:{ top:{ style:BorderStyle.SINGLE, size:4, color:"CCCCCC", space:2 } },
              spacing:{ before:80, after:0 },
              tabStops:[{ type:"right", position:9638 }],
              alignment:AlignmentType.LEFT,
              children:[
                new TextRun({ text: `NorCon Projects Intelligence  |  ${new Date().toLocaleDateString("en-GB",{day:"2-digit",month:"long",year:"numeric"})}`, size:16, color:GREY, font:"Calibri" }),
                new TextRun({ text:"\t", font:"Calibri" }),
                new TextRun({ text:"Page ", size:16, color:GREY, font:"Calibri" }),
                new TextRun({ children:[PageNumber.CURRENT], size:16, color:GREY, font:"Calibri" }),
              ],
            }),
          ]}),
        },
        children,
      }],
    });

    const buffer = await Packer.toBuffer(doc);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    res.setHeader("Content-Disposition", `attachment; filename="NorCon_${(ctx.project.code||"PROJECT")}_Report_${new Date().toISOString().split("T")[0]}.docx"`);
    res.setHeader("Content-Length", buffer.length);
    res.status(200).send(buffer);

  } catch (err) {
    console.error("Report generation error:", err);
    res.status(500).json({ error: err.message });
  }
}
