// 변환 표 → PDF (8-104 A-4). 브라우저에서 pdf-lib로 그린다 — 한글 글꼴은 지출결의서 PDF와 같은 방식(/api/fonts/kr, 쓰는 글자만)
// A4 세로, 폭에 맞춤. 쪽(시트)마다 새 페이지, 길면 행 단위로 다음 페이지
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb } from "pdf-lib";
import { draw, loadFontSet, widthOf, wrap, type FontSet } from "@/lib/tax/pdf-client";
import type { DocModel, Sheet } from "./model";

const A4 = { w: 595.28, h: 841.89 };
const M = 36;
const W = A4.w - M * 2;
const UNIT = 18; // 보통 줄 높이
const PAD = 3;
const INK = rgb(0.1, 0.1, 0.12);
const LINE = rgb(0.25, 0.25, 0.28);
const SHADE = rgb(0.95, 0.95, 0.96);

function rowHeights(s: Sheet, colX: number[], size: number, reg: FontSet, bold: FontSet): number[] {
  return s.cells.map((row, r) => {
    let h = UNIT * (s.heights[r] ?? 1);
    row.forEach((c, ci) => {
      if (!c.t || s.merges.some((g) => g.r === r && g.c === ci && g.rs > 1)) return; // 세로로 합친 칸은 행 높이에 넣지 않음
      const g = s.merges.find((x) => x.r === r && x.c === ci);
      const w = colX[ci + (g?.cs ?? 1)] - colX[ci] - PAD * 2;
      const lines = c.t.split("\n").flatMap((t) => wrap(t, Math.max(8, w), size, c.b ? bold : reg)).length;
      h = Math.max(h, lines * size * 1.3 + PAD * 2);
    });
    return h;
  });
}

export async function buildDocPdf(doc: DocModel): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const all = doc.sheets.flatMap((s) => s.cells.flatMap((row) => row.map((c) => c.t))).join("");
  const boldText = doc.sheets.flatMap((s) => s.cells.flatMap((row) => row.filter((c) => c.b).map((c) => c.t))).join("");
  const [reg, bold] = await Promise.all([loadFontSet(pdf, all, 400), loadFontSet(pdf, boldText || "0", 700)]);

  for (const s of doc.sheets) {
    const total = s.cols.reduce((a, b) => a + b, 0) || 1;
    const colX = [0];
    for (const w of s.cols) colX.push(colX[colX.length - 1] + (w / total) * W);
    const size = s.cols.length > 12 ? 7 : s.cols.length > 8 ? 8 : 9;
    const hs = rowHeights(s, colX, size, reg, bold);
    // 페이지 나누기(행 단위)
    const ranges: [number, number][] = [];
    let start = 0;
    let acc = 0;
    hs.forEach((h, r) => {
      if (acc + h > A4.h - M * 2 && r > start) {
        ranges.push([start, r]);
        start = r;
        acc = 0;
      }
      acc += h;
    });
    ranges.push([start, hs.length]);

    for (const [a, b] of ranges) {
      const page = pdf.addPage([A4.w, A4.h]);
      const rowY = [A4.h - M];
      for (let r = a; r < b; r++) rowY.push(rowY[rowY.length - 1] - hs[r]);
      const yOf = (r: number) => rowY[r - a];
      const covered = new Set<string>();
      for (const g of s.merges) for (let r = g.r; r < g.r + g.rs; r++) for (let c = g.c; c < g.c + g.cs; c++) if (r !== g.r || c !== g.c) covered.add(`${r}:${c}`);
      for (let r = a; r < b; r++) {
        for (let c = 0; c < s.cols.length; c++) {
          const g = s.merges.find((x) => x.r === r && x.c === c);
          // 페이지 첫 행에서 위 페이지부터 내려온 합친 칸은 여기서 이어 그린다
          const carried = r === a && covered.has(`${r}:${c}`) ? s.merges.find((x) => r > x.r && r < x.r + x.rs && c === x.c) : undefined;
          if (covered.has(`${r}:${c}`) && !carried) continue;
          const span = g ?? carried;
          const cs = span?.cs ?? 1;
          const endR = Math.min(b, span ? span.r + span.rs : r + 1);
          const x0 = M + colX[c];
          const x1 = M + colX[c + cs];
          const y0 = yOf(r);
          const y1 = yOf(endR);
          const cell = s.cells[r][c];
          if (cell.bg) page.drawRectangle({ x: x0, y: y1, width: x1 - x0, height: y0 - y1, color: SHADE });
          page.drawRectangle({ x: x0, y: y1, width: x1 - x0, height: y0 - y1, borderColor: LINE, borderWidth: 0.6 });
          if (carried || !cell.t) continue;
          const set = cell.b ? bold : reg;
          const lines = cell.t.split("\n").flatMap((t) => wrap(t, Math.max(8, x1 - x0 - PAD * 2), size, set));
          const lh = size * 1.3;
          let ty = (y0 + y1) / 2 + (lines.length * lh) / 2 - size;
          for (const line of lines) {
            if (ty < y1) break;
            const lw = widthOf(line, size, set);
            const tx = cell.al === "c" ? (x0 + x1 - lw) / 2 : cell.al === "r" ? x1 - PAD - lw : x0 + PAD;
            draw(page, line, tx, ty, size, set, INK);
            ty -= lh;
          }
        }
      }
    }
  }
  return pdf.save();
}
