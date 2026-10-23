// 지출결의서 PDF (form-template.md §5, tax-export.md §3.5, T10-3b, D-092) — 회사 양식 틀(D-118)의 문서 모델을 그린다
// 관리자 브라우저에서 pdf-lib로 만든다(서버 응답 크기 제한). 결의서마다 1) 결의서 문서(결재란·헤더 칸·항목 표·표 아래 칸·맺음말)
// 2) 이 달 패키지에 든 항목의 영수증(자차는 경로 요약) 페이지. 다른 달 항목은 표에서 회색.
// 한글 글꼴은 /api/fonts/kr 에서 쓰는 글자만 400자씩 받아(Google Fonts 제한) 여러 글꼴로 나눠 그린다.
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { buildDocModel, clean, DEFAULT_LAYOUT, type DocField, type DocModel, type FormLayout } from "@/lib/forms/layout";
import type { ClaimDoc } from "./claim-docs";

const A4 = { w: 595.28, h: 841.89 };
const M = 40;
const W = A4.w - M * 2;
const GRAY = rgb(0.45, 0.45, 0.48);
const LIGHT = rgb(0.6, 0.6, 0.63);
const LINE = rgb(0.82, 0.82, 0.85);
const INK = rgb(0.1, 0.1, 0.12);
const HEAD_BG = rgb(0.94, 0.95, 1);
const LABEL_BG = rgb(0.95, 0.95, 0.96);
const BORDER = rgb(0.7, 0.7, 0.73);
type Color = ReturnType<typeof rgb>;

type FontSet = { fonts: PDFFont[]; index: Map<string, number> };
export type PdfImage = { kind: "jpg" | "png" | "pdf"; data: Uint8Array };

async function fetchFont(chars: string, weight: 400 | 700): Promise<Uint8Array> {
  const res = await fetch("/api/fonts/kr", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chars, weight }) });
  if (!res.ok) throw new Error("FONT_UNAVAILABLE");
  return new Uint8Array(await res.arrayBuffer());
}

async function loadFontSet(pdf: PDFDocument, text: string, weight: 400 | 700): Promise<FontSet> {
  const chars = [...new Set([...text].filter((c) => c.trim()))];
  const chunks: string[][] = [];
  for (let i = 0; i < chars.length; i += 400) chunks.push(chars.slice(i, i + 400));
  if (!chunks.length) chunks.push(["0"]);
  const bytes = await Promise.all(chunks.map((c) => fetchFont(c.join(""), weight)));
  const fonts = await Promise.all(bytes.map((b) => pdf.embedFont(b, { subset: true })));
  const index = new Map<string, number>();
  chunks.forEach((c, i) => c.forEach((ch) => index.set(ch, i)));
  return { fonts, index };
}

// 같은 글꼴이 이어지는 글자끼리 묶기(공백은 앞 글꼴)
function runs(text: string, set: FontSet): { font: PDFFont; text: string }[] {
  const out: { font: PDFFont; text: string }[] = [];
  let cur = -1;
  for (const ch of text) {
    const i = ch.trim() ? (set.index.get(ch) ?? 0) : cur < 0 ? 0 : cur;
    if (i !== cur || !out.length) out.push({ font: set.fonts[i], text: ch });
    else out[out.length - 1].text += ch;
    cur = i;
  }
  return out;
}
const widthOf = (text: string, size: number, set: FontSet) => runs(text, set).reduce((s, r) => s + r.font.widthOfTextAtSize(r.text, size), 0);

function draw(page: PDFPage, text: string, x: number, y: number, size: number, set: FontSet, color = INK) {
  let cx = x;
  for (const r of runs(text, set)) {
    page.drawText(r.text, { x: cx, y, size, font: r.font, color });
    cx += r.font.widthOfTextAtSize(r.text, size);
  }
}

// 글자 단위로 줄바꿈(한글은 띄어쓰기가 없어도 끊는다)
function wrap(text: string, maxW: number, size: number, set: FontSet): string[] {
  const lines: string[] = [];
  let line = "";
  for (const ch of text) {
    if (line && widthOf(line + ch, size, set) > maxW) {
      lines.push(line.trimEnd());
      line = ch.trim() ? ch : "";
    } else line += ch;
  }
  if (line || !lines.length) lines.push(line);
  return lines;
}

type Ctx = { pdf: PDFDocument; reg: FontSet; bold: FontSet; page: PDFPage; y: number };
function newPage(c: Ctx) {
  c.page = c.pdf.addPage([A4.w, A4.h]);
  c.y = A4.h - M;
}
function ensure(c: Ctx, h: number) {
  if (c.y - h < M + 20) newPage(c);
}

// 라벨–값 칸(양식처럼 회색 라벨 칸 + 값 칸). 넓은 칸은 한 줄 전체, 나머지는 두 개씩 한 줄
const LABEL_W = 78;
function drawFields(c: Ctx, fields: DocField[]) {
  const rows: DocField[][] = [];
  for (const f of fields) {
    const last = rows[rows.length - 1];
    if (!f.wide && last && last.length === 1 && !last[0].wide) last.push(f);
    else rows.push([f]);
  }
  for (const row of rows) {
    const cellW = row.length === 1 && row[0].wide ? W : W / 2;
    const values = row.map((f) => wrap(f.value || "-", cellW - LABEL_W - 10, 9, c.reg));
    const labels = row.map((f) => wrap(f.label, LABEL_W - 8, 8.5, c.reg));
    const h = Math.max(...values.map((l) => l.length), ...labels.map((l) => l.length)) * 13 + 8;
    ensure(c, h);
    row.forEach((f, k) => {
      const x = M + k * cellW;
      c.page.drawRectangle({ x, y: c.y - h, width: LABEL_W, height: h, color: LABEL_BG });
      c.page.drawRectangle({ x, y: c.y - h, width: cellW, height: h, borderColor: BORDER, borderWidth: 0.6 });
      c.page.drawLine({ start: { x: x + LABEL_W, y: c.y }, end: { x: x + LABEL_W, y: c.y - h }, color: BORDER, thickness: 0.6 });
      labels[k].forEach((l, i) => draw(c.page, l, x + (LABEL_W - widthOf(l, 8.5, c.reg)) / 2, c.y - 14 - i * 13, 8.5, c.reg, GRAY));
      values[k].forEach((l, i) => draw(c.page, l, x + LABEL_W + 5, c.y - 14 - i * 13, 9, c.reg));
    });
    c.y -= h;
  }
}

function drawTable(c: Ctx, t: DocModel["table"]) {
  const sumW = t.cols.reduce((s, col) => s + col.w, 0);
  const ws = t.cols.map((col) => (col.w / sumW) * W);
  const measure = (cells: string[], set: FontSet) => Math.max(...cells.map((v, i) => wrap(v, ws[i] - 6, 7.5, set).length)) * 10 + 7;
  const line = (cells: string[], set: FontSet, color: Color, head = false) => {
    const wrapped = cells.map((v, i) => wrap(v, ws[i] - 6, 7.5, set));
    const h = Math.max(...wrapped.map((l) => l.length)) * 10 + 7;
    if (head) c.page.drawRectangle({ x: M, y: c.y - h, width: W, height: h, color: HEAD_BG });
    let x = M;
    wrapped.forEach((lines, i) => {
      lines.forEach((l, j) => {
        const tw = widthOf(l, 7.5, set);
        const tx = head ? x + (ws[i] - tw) / 2 : t.cols[i].right ? x + ws[i] - tw - 3 : x + 3;
        draw(c.page, l, tx, c.y - 11 - j * 10, 7.5, set, color);
      });
      x += ws[i];
    });
    c.page.drawLine({ start: { x: M, y: c.y - h }, end: { x: M + W, y: c.y - h }, color: LINE, thickness: 0.4 });
    c.y -= h;
  };
  const head = () => {
    ensure(c, measure(t.cols.map((col) => col.label), c.bold) + 18);
    line(
      t.cols.map((col) => col.label),
      c.bold,
      INK,
      true,
    );
  };
  head();
  for (const r of t.rows) {
    if (c.y - measure(r.cells, c.reg) < M + 20) {
      newPage(c);
      head();
    }
    line(r.cells, c.reg, r.dim ? LIGHT : INK);
  }
  if (t.total) {
    ensure(c, measure(t.total, c.bold));
    line(t.total, c.bold, INK);
  }
}

function drawClaim(c: Ctx, m: DocModel) {
  newPage(c);
  const { page } = c;
  // 1) 제목·회사 + 결재란(결재라인에서 자동, form-template.md §5)
  draw(page, m.title, M, c.y - 20, 20, c.bold);
  draw(page, m.company, M, c.y - 36, 9, c.reg, GRAY);
  const boxW = 64;
  let bx = A4.w - M - boxW * Math.max(1, m.approval.length);
  for (const s of m.approval) {
    page.drawRectangle({ x: bx, y: c.y - 52, width: boxW, height: 52, borderColor: BORDER, borderWidth: 0.8 });
    page.drawLine({ start: { x: bx, y: c.y - 14 }, end: { x: bx + boxW, y: c.y - 14 }, color: BORDER, thickness: 0.8 });
    draw(page, s.label, bx + (boxW - widthOf(s.label, 7, c.reg)) / 2, c.y - 10, 7, c.reg, GRAY);
    draw(page, s.name, bx + 4, c.y - 30, 8.5, c.bold);
    draw(page, s.status, bx + 4, c.y - 46, 7, c.reg, s.status.startsWith("승인") ? INK : GRAY);
    bx += boxW;
  }
  c.y -= 66;
  // 2) 헤더 칸 → 3) 항목 표 → 4) 표 아래 칸
  drawFields(c, m.header);
  c.y -= 12;
  drawTable(c, m.table);
  if (m.footer.length) {
    c.y -= 10;
    drawFields(c, m.footer);
  }
  if (m.dimNote) {
    ensure(c, 18);
    draw(c.page, m.dimNote, M, c.y - 12, 7.5, c.reg, GRAY);
    c.y -= 18;
  }
  // 5) 맺음말·날짜·작성자(인)·회사 이름 — 가운데
  const tail: { text: string; size: number; set: FontSet }[] = [
    ...(m.statement ? [{ text: m.statement, size: 10, set: c.reg }] : []),
    ...(m.date ? [{ text: m.date, size: 10, set: c.reg }] : []),
    ...(m.signer ? [{ text: m.signer, size: 10, set: c.reg }] : []),
    ...(m.companyLine ? [{ text: m.companyLine, size: 13, set: c.bold }] : []),
  ];
  if (tail.length) {
    ensure(c, tail.length * 24 + 24);
    c.y -= 20;
    for (const t of tail) {
      for (const l of wrap(t.text, W, t.size, t.set)) {
        draw(c.page, l, M + (W - widthOf(l, t.size, t.set)) / 2, c.y - t.size, t.size, t.set);
        c.y -= t.size + 12;
      }
    }
  }
}

async function drawEvidence(c: Ctx, label: string, img: PdfImage) {
  newPage(c);
  const lines = wrap(label, W, 10, c.bold);
  lines.forEach((l, i) => draw(c.page, l, M, c.y - 14 - i * 14, 10, c.bold));
  const top = c.y - 14 - lines.length * 14 - 6;
  const boxH = top - M - 20;
  try {
    if (img.kind === "pdf") {
      const [emb] = await c.pdf.embedPdf(img.data, [0]);
      const s = Math.min(W / emb.width, boxH / emb.height);
      c.page.drawPage(emb, { x: M, y: top - emb.height * s, width: emb.width * s, height: emb.height * s });
    } else {
      const emb = img.kind === "png" ? await c.pdf.embedPng(img.data) : await c.pdf.embedJpg(img.data);
      const s = Math.min(W / emb.width, boxH / emb.height, 1.5);
      c.page.drawImage(emb, { x: M, y: top - emb.height * s, width: emb.width * s, height: emb.height * s });
    }
  } catch {
    draw(c.page, "(이 영수증 파일은 PDF에 넣지 못했어요. ZIP의 영수증 폴더에서 원본을 확인해 주세요.)", M, top - 14, 9, c.reg, GRAY);
  }
}

export async function buildClaimsPdf(opts: {
  docs: ClaimDoc[];
  companyName: string;
  month?: string; // 세무 마감 월(없으면 결의서 한 건 내려받기)
  layout?: FormLayout | null; // 회사 양식(없으면 기본 양식, D-118)
  evidence?: Map<string, { no: string; label: string; image: PdfImage | null }> | null; // 항목 id → 이 달 패키지의 증빙번호·제목·파일
}): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  pdf.setTitle(opts.month ? `지출결의서 ${opts.month}` : `지출결의서 ${opts.docs[0]?.title ?? ""}`);
  pdf.setProducer("PocketExpense");
  const layout = opts.layout ?? DEFAULT_LAYOUT;
  const evidence = opts.evidence ?? null;
  const evidenceNo = evidence ? new Map([...evidence].map(([id, e]) => [id, e.no])) : null;
  const models = opts.docs.map((d) => buildDocModel(layout, d, { companyName: opts.companyName, evidenceNo }));
  const footerText = (i: number, n: number) => `${clean(opts.companyName)} · 지출결의서${opts.month ? ` · ${opts.month} 세무 마감` : ""} · ${i}/${n}쪽`;
  // 쓰는 글자만 글꼴로 받는다
  const allText = [
    "(이 영수증 파일은 PDF에 넣지 못했어요. ZIP의 영수증 폴더에서 원본을 확인해 주세요.)-0123456789",
    JSON.stringify(models),
    ...[...(evidence?.values() ?? [])].map((e) => e.label + e.no),
    footerText(0, 0),
  ]
    .map(clean)
    .join("");
  const [reg, bold] = await Promise.all([loadFontSet(pdf, allText, 400), loadFontSet(pdf, allText, 700)]);
  const c: Ctx = { pdf, reg, bold, page: pdf.addPage([A4.w, A4.h]), y: 0 };
  pdf.removePage(0);
  for (const [k, doc] of opts.docs.entries()) {
    drawClaim(c, models[k]);
    for (const it of doc.items) {
      const e = evidence?.get(it.id);
      if (e?.image) await drawEvidence(c, clean(e.label), e.image);
    }
  }
  const pages = pdf.getPages();
  pages.forEach((p, i) => draw(p, footerText(i + 1, pages.length), M, 22, 7, reg, LIGHT));
  return pdf.save();
}
