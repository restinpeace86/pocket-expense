// 지출결의서 PDF (form-template.md §5, template-configuration.md §2 기본 양식, tax-export.md §3.5, T10-3b, D-092)
// 관리자 브라우저에서 pdf-lib로 만든다(서버 응답 크기 제한). 결의서마다 1) 결의서 문서(결재란·헤더·항목 표·정산 요약)
// 2) 이 달 패키지에 든 항목의 영수증(자차는 경로 요약) 페이지. 다른 달 항목은 표에서 회색.
// 한글 글꼴은 /api/fonts/kr 에서 쓰는 글자만 400자씩 받아(Google Fonts 제한) 여러 글꼴로 나눠 그린다.
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { CATEGORY_LABEL, PURCHASE_TYPE_LABEL, TRIP_TYPE_LABEL } from "@/lib/expense/categories";
import type { ClaimDoc, ClaimDocItem } from "./claim-docs";

const A4 = { w: 595.28, h: 841.89 };
const M = 40;
const W = A4.w - M * 2;
const GRAY = rgb(0.45, 0.45, 0.48);
const LIGHT = rgb(0.6, 0.6, 0.63);
const LINE = rgb(0.82, 0.82, 0.85);
const INK = rgb(0.1, 0.1, 0.12);
const HEAD_BG = rgb(0.94, 0.95, 1);

// 그림 문자(이모지 등)는 글꼴에 없어 뺀다
const clean = (s: string | null | undefined) => (s ?? "").replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, "").replace(/\s+/g, " ").trim();
const won = (n: number | null | undefined) => (n == null ? "" : `${n.toLocaleString("ko-KR")}`);
const kst = (iso: string | null) => (iso ? new Date(new Date(iso).getTime() + 9 * 3600_000).toISOString().slice(0, 16).replace("T", " ") : "-");
const md = (iso: string | null) => (iso ? `${Number(kst(iso).slice(5, 7))}/${Number(kst(iso).slice(8, 10))}` : "");

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

function itemSummary(i: ClaimDocItem): string {
  const parts = [clean(i.purpose)];
  if (i.category === "trip" && i.trip_type === "own_car" && i.route_one_way_km != null)
    parts.push(`${clean(i.start_location)}→${clean(i.end_location)} ${Number(i.route_one_way_km)}km${i.is_round_trip ? " 왕복" : ""}`);
  if ((i.category === "meal" || i.trip_type === "meal") && (i.headcount ?? 1) > 1) parts.push(`${i.headcount}명`);
  if (i.category === "meeting") parts.push([clean(i.client_name), clean(i.attendees)].filter(Boolean).join(" / "));
  return parts.filter(Boolean).join(" · ");
}

function classOf(i: ClaimDocItem): string {
  if (!i.category) return "";
  if (i.category === "trip" && i.trip_type) return `출장·${TRIP_TYPE_LABEL[i.trip_type]}`;
  if (i.category === "purchase" && i.purchase_type) return PURCHASE_TYPE_LABEL[i.purchase_type];
  return CATEGORY_LABEL[i.category];
}

type Ctx = { pdf: PDFDocument; reg: FontSet; bold: FontSet; page: PDFPage; y: number };
function newPage(c: Ctx) {
  c.page = c.pdf.addPage([A4.w, A4.h]);
  c.y = A4.h - M;
}
function ensure(c: Ctx, h: number) {
  if (c.y - h < M + 20) newPage(c);
}

const COLS: { label: string; w: number; right?: boolean }[] = [
  { label: "증빙번호", w: 56 },
  { label: "사용일", w: 34 },
  { label: "사용처", w: 92 },
  { label: "카테고리", w: 60 },
  { label: "결제", w: 30 },
  { label: "합계", w: 50, right: true },
  { label: "회사지원", w: 50, right: true },
  { label: "개인부담", w: 46, right: true },
  { label: "적요", w: 97 },
];

function drawClaim(c: Ctx, doc: ClaimDoc, companyName: string, evidenceNo: Map<string, string>) {
  newPage(c);
  // 합계는 표의 항목을 더해 낸다(표와 항상 일치)
  const sum = (k: "amount" | "company_supported_amount" | "personal_burden_amount") => doc.items.reduce((s, i) => s + (i[k] ?? 0), 0);
  const totals = [sum("amount"), sum("company_supported_amount"), sum("personal_burden_amount")];
  const { page } = c;
  // 1) 제목·회사 + 결재란
  draw(page, "지출결의서", M, c.y - 20, 20, c.bold);
  draw(page, clean(companyName), M, c.y - 36, 9, c.reg, GRAY);
  const steps = doc.self_approved ? [{ step_kind: "final" as const, name: "결재 생략", status: "approved", acted_at: doc.approved_at }] : doc.steps;
  const boxW = 64;
  let bx = A4.w - M - boxW * Math.max(1, steps.length);
  for (const s of steps) {
    page.drawRectangle({ x: bx, y: c.y - 52, width: boxW, height: 52, borderColor: LINE, borderWidth: 0.8 });
    page.drawLine({ start: { x: bx, y: c.y - 14 }, end: { x: bx + boxW, y: c.y - 14 }, color: LINE, thickness: 0.8 });
    draw(page, s.step_kind === "review" ? "검토" : "승인", bx + 4, c.y - 10, 7, c.reg, GRAY);
    draw(page, clean(s.name ?? "-").slice(0, 8), bx + 4, c.y - 30, 8.5, c.bold);
    const st = s.status === "approved" ? `승인 ${md(s.acted_at)}` : s.status === "rejected" ? "반려" : "대기";
    draw(page, st, bx + 4, c.y - 46, 7, c.reg, s.status === "approved" ? INK : GRAY);
    bx += boxW;
  }
  c.y -= 66;

  // 2) 헤더(라벨–값)
  const header: [string, string][] = [
    ["결의서번호", doc.id.slice(0, 8)],
    ["제목", clean(doc.title)],
    ["청구자", [clean(doc.member.name), clean(doc.member.department), clean(doc.member.position)].filter(Boolean).join(" / ")],
    ["지출 사유", clean(doc.description)],
    ...(doc.is_business_trip
      ? ([
          ["출장지", clean(doc.trip_destination)],
          ["출장 기간", `${doc.trip_start_date ?? ""} ~ ${doc.trip_end_date ?? ""}`],
          ["출장 목적", clean(doc.trip_purpose)],
        ] as [string, string][])
      : []),
    ...(doc.exception_memo ? ([["예외 소명 사유", clean(doc.exception_memo)]] as [string, string][]) : []),
    ["상신일", kst(doc.submitted_at)],
    ["합계", `${won(totals[0])}원 · 회사 지원 ${won(totals[1])}원 · 개인 부담 ${won(totals[2])}원`],
  ];
  for (const [k, v] of header) {
    const lines = wrap(v || "-", W - 90, 9, c.reg);
    const h = lines.length * 13 + 6;
    ensure(c, h);
    c.page.drawLine({ start: { x: M, y: c.y }, end: { x: M + W, y: c.y }, color: LINE, thickness: 0.5 });
    draw(c.page, k, M + 2, c.y - 12, 8.5, c.reg, GRAY);
    lines.forEach((l, i) => draw(c.page, l, M + 90, c.y - 12 - i * 13, 9, k === "합계" ? c.bold : c.reg));
    c.y -= h;
  }
  c.page.drawLine({ start: { x: M, y: c.y }, end: { x: M + W, y: c.y }, color: LINE, thickness: 0.5 });
  c.y -= 18;

  // 3) 항목 표
  const headRow = () => {
    ensure(c, 18);
    c.page.drawRectangle({ x: M, y: c.y - 15, width: W, height: 15, color: HEAD_BG });
    let x = M;
    for (const col of COLS) {
      const tw = widthOf(col.label, 7.5, c.bold);
      draw(c.page, col.label, col.right ? x + col.w - tw - 3 : x + 3, c.y - 11, 7.5, c.bold);
      x += col.w;
    }
    c.y -= 15;
  };
  headRow();
  for (const it of doc.items) {
    const inPkg = evidenceNo.get(it.id);
    const color = inPkg ? INK : LIGHT;
    const cells = [
      inPkg ?? "다른 달",
      it.expense_date ? it.expense_date.slice(5).replace("-", "/") : "",
      it.category === "trip" && it.trip_type === "own_car" ? `자차 ${clean(it.start_location)}→${clean(it.end_location)}` : clean(it.merchant_name),
      classOf(it),
      it.payment_method === "corporate_card" ? "법인" : "개인",
      won(it.amount),
      won(it.company_supported_amount),
      won(it.personal_burden_amount),
      itemSummary(it),
    ];
    const wrapped = cells.map((t, i) => wrap(t, COLS[i].w - 6, 7.5, c.reg));
    const h = Math.max(...wrapped.map((l) => l.length)) * 10 + 6;
    if (c.y - h < M + 20) {
      newPage(c);
      headRow();
    }
    let x = M;
    wrapped.forEach((lines, i) => {
      lines.forEach((l, j) => {
        const tw = widthOf(l, 7.5, c.reg);
        draw(c.page, l, COLS[i].right ? x + COLS[i].w - tw - 3 : x + 3, c.y - 10 - j * 10, 7.5, c.reg, color);
      });
      x += COLS[i].w;
    });
    c.y -= h;
    c.page.drawLine({ start: { x: M, y: c.y }, end: { x: M + W, y: c.y }, color: LINE, thickness: 0.4 });
  }
  // 합계 행
  ensure(c, 16);
  const sumX = M + COLS.slice(0, 5).reduce((s, col) => s + col.w, 0);
  draw(c.page, "합계", M + 3, c.y - 11, 7.5, c.bold);
  totals.forEach((v, i) => {
    const t = won(v);
    const colX = sumX + COLS.slice(5, 5 + i).reduce((s, col) => s + col.w, 0);
    draw(c.page, t, colX + COLS[5 + i].w - widthOf(t, 7.5, c.bold) - 3, c.y - 11, 7.5, c.bold);
  });
  c.y -= 22;

  // 4) 정산 요약 (지급·납부는 상계하지 않는다, expense-lifecycle.md §5.5)
  const pay = doc.items.reduce((s, i) => s + (i.payment_method === "personal_card" ? (i.company_supported_amount ?? 0) : 0), 0);
  const back = doc.items.reduce((s, i) => s + (i.payment_method === "corporate_card" ? (i.personal_burden_amount ?? 0) : 0), 0);
  ensure(c, 16);
  draw(c.page, `정산: 회사 → 직원 지급 ${won(pay)}원 / 직원 → 회사 납부 ${won(back)}원`, M, c.y - 10, 9, c.bold);
  c.y -= 20;
  if (doc.items.some((i) => !evidenceNo.get(i.id))) {
    draw(c.page, "회색 항목은 다른 달 사용분으로 그 달 패키지에 들어 있어요.", M, c.y - 8, 7.5, c.reg, GRAY);
    c.y -= 14;
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
  month: string;
  evidence: Map<string, { no: string; label: string; image: PdfImage | null }>; // 항목 id → 이 달 패키지의 증빙번호·제목·파일
}): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  pdf.setTitle(`지출결의서 ${opts.month}`);
  pdf.setProducer("PocketExpense");
  const allText = [
    "지출결의서검토승인반려대기결재 생략결의서번호제목청구자지출 사유출장지출장 기간출장 목적예외 소명 사유상신일합계회사 지원개인 부담원정산: 회사 → 직원 지급 / 직원 → 회사 납부다른 달회색 항목은 다른 달 사용분으로 그 달 패키지에 들어 있어요.(이 영수증 파일은 PDF에 넣지 못했어요. ZIP의 영수증 폴더에서 원본을 확인해 주세요.)법인개인자차→·~ 0123456789/:-,.()%",
    opts.companyName,
    ...COLS.map((c) => c.label),
    ...Object.values(CATEGORY_LABEL),
    ...Object.values(TRIP_TYPE_LABEL).map((t) => `출장·${t}`),
    ...Object.values(PURCHASE_TYPE_LABEL),
    ...opts.docs.flatMap((d) => [d.id.slice(0, 8), d.title, d.description, d.exception_memo, d.trip_destination, d.trip_purpose, d.member.name, d.member.department, d.member.position, ...d.steps.map((s) => s.name), ...d.items.flatMap((i) => [i.merchant_name, i.purpose, i.attendees, i.client_name, i.start_location, i.end_location, String(i.headcount ?? "")])]),
    ...[...opts.evidence.values()].map((e) => e.label + e.no),
    `${opts.month} 세무 마감 · 쪽`,
  ]
    .map(clean)
    .join("");
  const [reg, bold] = await Promise.all([loadFontSet(pdf, allText, 400), loadFontSet(pdf, allText, 700)]);
  const c: Ctx = { pdf, reg, bold, page: pdf.addPage([A4.w, A4.h]), y: 0 };
  pdf.removePage(0);
  const evidenceNo = new Map([...opts.evidence].map(([id, e]) => [id, e.no]));
  for (const doc of opts.docs) {
    drawClaim(c, doc, opts.companyName, evidenceNo);
    for (const it of doc.items) {
      const e = opts.evidence.get(it.id);
      if (e?.image) await drawEvidence(c, clean(e.label), e.image);
    }
  }
  const pages = pdf.getPages();
  pages.forEach((p, i) => draw(p, `${clean(opts.companyName)} · 지출결의서 · ${opts.month} 세무 마감 · ${i + 1}/${pages.length}쪽`, M, 22, 7, reg, LIGHT));
  return pdf.save();
}
