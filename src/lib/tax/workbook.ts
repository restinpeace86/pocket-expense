import "server-only";
import { EVIDENCE_KIND_LABEL, type EvidenceKind } from "@/lib/receipts/evidence-kind";
import ExcelJS from "exceljs";
import { bizNo, checks, classLabels, EVIDENCE_LABEL, evidenceFile, evidenceNo, isOwnCar, settlement, statusLabel, supplyVat, upload적요, type ExportRow } from "./export-rows";

// 세무 마감 엑셀 (tax-export.md §3.2~3.4): 시트1 지출내역(전체 데이터) / 시트2 요약 / 시트3·4 세무 업로드 — 법인카드·개인(사비) 따로(세무사무소 답변 2026-10-27, D-136)
type Col = { header: string; width?: number; kind?: "won" | "date" | "datetime" | "num"; value: (r: ExportRow, ctx: Ctx) => unknown };
type Ctx = { month: string; total: number; files: Map<string, string | null> };

const d = (v: string | null) => (v ? new Date(`${v.slice(0, 10)}T00:00:00Z`) : null);
// 엑셀 날짜는 시간대가 없어 한국 시간으로 옮겨 적는다
const dt = (v: string | null) => (v ? new Date(new Date(v).getTime() + 9 * 3600_000) : null);
const short = (id: string) => id.slice(0, 8);
const payLabel = (r: ExportRow) => (r.payment_method === "corporate_card" ? "법인카드" : "개인(사비)");

const SHEET1: Col[] = [
  { header: "증빙번호", width: 13, value: (r, c) => evidenceNo(c.month, r.seq, c.total) },
  { header: "마감구분", width: 10, value: (r) => (r.kind === "carryover" ? "전월 추가분" : "당월") },
  { header: "결의서번호", width: 11, value: (r) => short(r.claim_id) },
  { header: "결의서 제목", width: 24, value: (r) => r.claim_title },
  { header: "지출 사유", width: 28, value: (r) => r.claim_description ?? "" },
  { header: "예외 소명 사유", width: 20, value: (r) => r.exception_memo ?? "" },
  { header: "출장여부", width: 8, value: (r) => (r.is_trip ? "출장" : "") },
  { header: "출장지", width: 12, value: (r) => r.trip_destination ?? "" },
  { header: "출장기간", width: 22, value: (r) => (r.trip_start ? `${r.trip_start} ~ ${r.trip_end ?? ""}` : "") },
  { header: "출장목적", width: 20, value: (r) => r.trip_purpose ?? "" },
  { header: "항목번호", width: 11, value: (r) => short(r.item_id) },
  { header: "결제일자", width: 11, kind: "date", value: (r) => d(r.expense_date) },
  { header: "가맹점명", width: 22, value: (r) => (isOwnCar(r) ? `자차 ${r.start_location ?? ""}→${r.end_location ?? ""}` : (r.merchant_name ?? "")) },
  { header: "사업자등록번호", width: 14, value: (r) => bizNo(r.merchant_business_number) },
  { header: "증빙구분", width: 12, value: (r) => (r.evidence_type ? (EVIDENCE_LABEL[r.evidence_type] ?? r.evidence_type) : "") },
  // 영수증 대신 자료·증빙 없음 사유(D-108)
  { header: "증빙 자료", width: 18, value: (r) => (r.evidence_kind === "none" ? `증빙 없음: ${r.no_evidence_reason ?? ""}` : r.evidence_kind ? (EVIDENCE_KIND_LABEL[r.evidence_kind as EvidenceKind] ?? "") : "") },
  { header: "공급가액", width: 12, kind: "won", value: (r) => r.supply_amount },
  { header: "부가세", width: 10, kind: "won", value: (r) => r.vat_amount },
  { header: "합계금액", width: 12, kind: "won", value: (r) => r.amount },
  { header: "결제수단", width: 10, value: payLabel },
  { header: "법인카드(끝 4자리)", width: 18, value: (r) => (r.payment_method === "corporate_card" && r.card_last4 ? `${r.card_nickname ?? ""} ${r.card_last4}`.trim() : "") },
  { header: "계정과목", width: 14, value: (r) => r.account_title_name ?? "" },
  { header: "계정코드", width: 10, value: (r) => r.account_title_code ?? "" },
  { header: "카테고리", width: 12, value: (r) => classLabels(r).category },
  { header: "세부유형", width: 14, value: (r) => classLabels(r).subtype },
  { header: "부서", width: 10, value: (r) => r.department ?? "" },
  { header: "사용자", width: 10, value: (r) => r.member_name },
  { header: "직급", width: 8, value: (r) => r.position ?? "" },
  { header: "사번", width: 10, value: (r) => r.employee_number ?? "" },
  { header: "지출목적(적요)", width: 22, value: (r) => r.purpose ?? "" },
  { header: "인원수", width: 7, kind: "num", value: (r) => r.headcount },
  { header: "참석자", width: 18, value: (r) => r.attendees ?? "" },
  { header: "거래처", width: 14, value: (r) => r.client_name ?? "" },
  { header: "숙박 체크인", width: 11, kind: "date", value: (r) => (r.trip_type === "lodging" ? d(r.lodging_in) : null) },
  { header: "숙박 체크아웃", width: 11, kind: "date", value: (r) => (r.trip_type === "lodging" ? d(r.lodging_out) : null) },
  { header: "출발지", width: 16, value: (r) => (isOwnCar(r) ? (r.start_location ?? "") : "") },
  { header: "도착지", width: 16, value: (r) => (isOwnCar(r) ? (r.end_location ?? "") : "") },
  { header: "왕복여부", width: 8, value: (r) => (isOwnCar(r) ? (r.is_round_trip ? "왕복" : "편도") : "") },
  { header: "편도거리(km)", width: 11, kind: "num", value: (r) => (isOwnCar(r) ? r.route_one_way_km : null) },
  { header: "주행거리(km)", width: 11, kind: "num", value: (r) => (isOwnCar(r) ? r.distance_km : null) },
  { header: "거리입력방식", width: 10, value: (r) => (isOwnCar(r) ? (r.distance_source === "api" ? "자동(길찾기)" : r.distance_source === "manual" ? "직접 입력" : "") : "") },
  { header: "차량번호", width: 10, value: (r) => (isOwnCar(r) ? (r.vehicle_number ?? "") : "") },
  { header: "적용 1인 식대한도", width: 12, kind: "won", value: (r) => r.applied_meal_limit_per_person },
  { header: "적용 km당 유류비 단가", width: 12, kind: "won", value: (r) => (isOwnCar(r) ? r.applied_fuel_rate_per_km : null) },
  { header: "회사지원금", width: 12, kind: "won", value: (r) => r.company_supported_amount },
  { header: "개인부담금", width: 12, kind: "won", value: (r) => r.personal_burden_amount },
  { header: "정산구분", width: 8, value: (r) => settlement(r).kind },
  { header: "정산금액", width: 12, kind: "won", value: (r) => settlement(r).amount || null },
  { header: "상태", width: 12, value: statusLabel },
  { header: "상신일", width: 16, kind: "datetime", value: (r) => dt(r.submitted_at) },
  { header: "최종승인일", width: 16, kind: "datetime", value: (r) => dt(r.approved_at) },
  { header: "정산완료일", width: 16, kind: "datetime", value: (r) => dt(r.paid_at) },
  { header: "결재자", width: 24, value: (r) => (r.self_approved ? "결재 생략" : (r.approvers ?? "")) },
  { header: "증빙 파일명", width: 40, value: (r, c) => c.files.get(r.item_id) ?? "" },
  { header: "확인 필요", width: 26, value: (r, c) => checks(r, !!c.files.get(r.item_id)).join(", ") },
];

const SHEET3: Col[] = [
  { header: "전표일자", width: 11, kind: "date", value: (r) => d(r.expense_date) },
  { header: "구분", width: 6, value: () => "매입" },
  { header: "증빙구분", width: 12, value: (r) => (r.evidence_type ? (EVIDENCE_LABEL[r.evidence_type] ?? "기타") : "기타") },
  { header: "결제수단", width: 10, value: payLabel },
  { header: "카드 끝 4자리", width: 10, value: (r) => (r.payment_method === "corporate_card" ? (r.card_last4 ?? "") : "") },
  { header: "계정과목", width: 14, value: (r) => r.account_title_name ?? "" },
  { header: "계정코드", width: 10, value: (r) => r.account_title_code ?? "" },
  // 거래처 코드는 세무사무소 회계 프로그램(더존 등)의 거래처 코드 — 사업자등록번호와 함께 적는다(D-136). 우리 데이터에 없어 빈칸으로 둔다
  { header: "거래처코드", width: 10, value: () => "" },
  { header: "거래처명", width: 20, value: (r) => (isOwnCar(r) ? `자차 ${r.start_location ?? ""}→${r.end_location ?? ""}` : (r.merchant_name ?? "")) },
  { header: "사업자등록번호", width: 14, value: (r) => (isOwnCar(r) ? "" : bizNo(r.merchant_business_number)) },
  { header: "공급가액", width: 12, kind: "won", value: (r) => supplyVat(r).supply },
  { header: "부가세액", width: 10, kind: "won", value: (r) => supplyVat(r).vat },
  { header: "합계 금액", width: 12, kind: "won", value: (r) => r.amount },
  { header: "적요", width: 36, value: upload적요 },
  { header: "부서 / 프로젝트", width: 12, value: (r) => r.department ?? "" },
  { header: "사용자", width: 10, value: (r) => r.member_name },
  { header: "증빙파일명 (매칭키)", width: 40, value: (r, c) => c.files.get(r.item_id) ?? "" },
];

const WON = "#,##0";

function addTable(ws: ExcelJS.Worksheet, cols: Col[], rows: ExportRow[], ctx: Ctx, totals: string[]) {
  ws.columns = cols.map((c) => ({ header: c.header, width: c.width ?? 12 }));
  for (const r of rows) ws.addRow(cols.map((c) => c.value(r, ctx) ?? null));
  cols.forEach((c, i) => {
    const col = ws.getColumn(i + 1);
    if (c.kind === "won") col.numFmt = WON;
    if (c.kind === "date") col.numFmt = "yyyy-mm-dd";
    if (c.kind === "datetime") col.numFmt = "yyyy-mm-dd hh:mm";
  });
  const head = ws.getRow(1);
  head.font = { bold: true };
  head.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEEF2FF" } };
  ws.views = [{ state: "frozen", ySplit: 1 }];
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: cols.length } };
  if (rows.length && totals.length) {
    const sum = ws.addRow(cols.map((c, i) => (i === 0 ? "합계" : totals.includes(c.header) ? rows.reduce((s, r) => s + (Number(c.value(r, ctx)) || 0), 0) : null)));
    sum.font = { bold: true };
  }
}

type Group = { label: string; count: number; amount: number };
function group(rows: ExportRow[], key: (r: ExportRow) => string): Group[] {
  const m = new Map<string, Group>();
  for (const r of rows) {
    const k = key(r) || "(없음)";
    const g = m.get(k) ?? { label: k, count: 0, amount: 0 };
    g.count++;
    g.amount += r.amount ?? 0;
    m.set(k, g);
  }
  return [...m.values()].sort((a, b) => b.amount - a.amount);
}

function addSummary(ws: ExcelJS.Worksheet, rows: ExportRow[], title: string) {
  ws.columns = [{ width: 30 }, { width: 10 }, { width: 16 }, { width: 30 }];
  ws.addRow([title]).font = { bold: true, size: 14 };
  const pay = rows.reduce((s, r) => s + (settlement(r).kind === "지급" ? settlement(r).amount : 0), 0);
  const back = rows.reduce((s, r) => s + (settlement(r).kind === "납부" ? settlement(r).amount : 0), 0);
  ws.addRow([]);
  for (const [k, v] of [
    ["세무 증빙 총액(합계금액)", rows.reduce((s, r) => s + (r.amount ?? 0), 0)],
    ["항목 수", rows.length],
    ["직원 지급액(개인카드 회사지원금)", pay],
    ["직원 납부액(법인카드 개인부담)", back],
  ] as const) {
    const row = ws.addRow([k, null, v]);
    row.getCell(3).numFmt = WON;
  }
  const section = (name: string, groups: Group[]) => {
    ws.addRow([]);
    const h = ws.addRow([name, "건수", "합계금액"]);
    h.font = { bold: true };
    h.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEEF2FF" } };
    for (const g of groups) ws.addRow([g.label, g.count, g.amount]).getCell(3).numFmt = WON;
  };
  // 계정과목별 + 안의 내부 분류별 소계
  ws.addRow([]);
  const h = ws.addRow(["계정과목 / 내부 분류", "건수", "합계금액"]);
  h.font = { bold: true };
  h.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEEF2FF" } };
  for (const g of group(rows, (r) => r.account_title_name ?? "")) {
    const row = ws.addRow([g.label, g.count, g.amount]);
    row.font = { bold: true };
    row.getCell(3).numFmt = WON;
    const inside = rows.filter((r) => (r.account_title_name || "(없음)") === g.label);
    for (const s of group(inside, (r) => [classLabels(r).category, classLabels(r).subtype].filter(Boolean).join(" · "))) ws.addRow([`   ${s.label}`, s.count, s.amount]).getCell(3).numFmt = WON;
  }
  // 부서별 = 현장·프로젝트별 묶음(우리 데이터에서 현장에 가장 가까운 단위, 세무 업로드 시트의 "부서 / 프로젝트" 칸과 같음). 부서 없음(대표·임원, D-058)은 따로 묶는다
  section("부서별", group(rows, (r) => r.department ?? "부서 없음"));
  section("사용자별", group(rows, (r) => [r.member_name, r.department].filter(Boolean).join(" · ")));
  section("카테고리별", group(rows, (r) => classLabels(r).category));
  section("결제수단별", group(rows, (r) => (r.payment_method === "corporate_card" ? "법인카드" : "개인(사비)")));
  ws.addRow([]);
  const ch = ws.addRow(["결의서별", "건수", "합계금액", "상태"]);
  ch.font = { bold: true };
  ch.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEEF2FF" } };
  const byClaim = new Map<string, { title: string; count: number; amount: number; status: string }>();
  for (const r of rows) {
    const c = byClaim.get(r.claim_id) ?? { title: `${r.claim_id.slice(0, 8)} ${r.claim_title}`, count: 0, amount: 0, status: statusLabel(r) };
    c.count++;
    c.amount += r.amount ?? 0;
    byClaim.set(r.claim_id, c);
  }
  for (const c of byClaim.values()) ws.addRow([c.title, c.count, c.amount, c.status]).getCell(3).numFmt = WON;
}

export async function buildTaxWorkbook(opts: { month: string; companyName: string; rows: ExportRow[]; preview: boolean }): Promise<ArrayBuffer> {
  const { month, rows } = opts;
  const total = rows.length;
  const files = new Map(rows.map((r) => [r.item_id, evidenceFile(r, month, total)?.name ?? null]));
  const ctx: Ctx = { month, total, files };
  const wb = new ExcelJS.Workbook();
  wb.creator = "PocketExpense";
  wb.created = new Date();
  addTable(wb.addWorksheet("지출내역"), SHEET1, rows, ctx, ["공급가액", "부가세", "합계금액", "회사지원금", "개인부담금", "정산금액"]);
  const [y, m] = month.split("-");
  addSummary(wb.addWorksheet("요약"), rows, `${opts.companyName} ${y}년 ${Number(m)}월 지출 요약${opts.preview ? " (미리보기 — 마감 전)" : ""}`);
  // 법인카드와 개인(사비)는 카드번호도 다르고 입력도 따로 해서 시트를 나눈다(D-136). 사비 시트에는 카드 끝 4자리 칸이 없다. 자차 유류비는 사비 쪽
  const corporate = rows.filter((r) => r.payment_method === "corporate_card");
  const personal = rows.filter((r) => r.payment_method !== "corporate_card");
  addTable(wb.addWorksheet("세무 업로드(법인카드)"), SHEET3, corporate, ctx, []);
  addTable(wb.addWorksheet("세무 업로드(개인 사비)"), SHEET3.filter((c) => c.header !== "카드 끝 4자리"), personal, ctx, []);
  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}
