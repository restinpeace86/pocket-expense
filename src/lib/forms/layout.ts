// 지출결의서 양식 틀(layout) — 출력 문서 모양만 정한다 (D-118, form-template.md, template-configuration.md)
// - 칸은 모두 "우리 데이터로 채울 수 있는 항목"(아래 목록)에서만 고른다. 직원 입력 화면은 바뀌지 않는다.
// - 기본 포맷 5종(PRESETS)과 AI가 종이 양식에서 읽어 만든 맞춤 양식이 같은 틀을 쓴다.
// - buildDocModel: 결의서 데이터 + 틀 → 그릴 문서 모델(PDF·화면 미리보기가 같은 모델을 그린다).
import { CATEGORY_LABEL, PURCHASE_TYPE_LABEL, TRIP_TYPE_LABEL } from "@/lib/expense/categories";
import type { ClaimDoc, ClaimDocItem } from "@/lib/tax/claim-docs";

// ── 채울 수 있는 항목 ─────────────────────────────────────────────
export const FIELD_CATALOG = {
  "doc.number": { label: "문서번호", hint: "결의서 번호(앞 8자리)" },
  "claim.title": { label: "제목", hint: "결의서 제목", wide: true },
  "claim.description": { label: "지출 사유", hint: "지출 사유(특이사항·비고로도 씀)", wide: true },
  "claim.expense_period": { label: "지출일자", hint: "영수증 사용일(첫날~마지막 날)" },
  "claim.submitted_at": { label: "상신일", hint: "결재 올린 날(발의일자·작성일자)" },
  "claim.approved_at": { label: "결재일자", hint: "최종 승인한 날" },
  "member.name": { label: "작성자", hint: "청구한 직원 이름" },
  "member.department": { label: "부서", hint: "청구한 직원 부서" },
  "member.position": { label: "직급", hint: "청구한 직원 직급" },
  "member.dept_name": { label: "부서 / 담당", hint: "부서 / 이름" },
  "member.full": { label: "청구자", hint: "이름 / 부서 / 직급" },
  "member.bank": { label: "입금 정보", hint: "직원이 [내 정보]에 넣은 은행 / 계좌 / 예금주", wide: true },
  "claim.total_amount": { label: "합계", hint: "합계 금액(숫자)" },
  "claim.total_amount_words": { label: "금액", hint: "일금 ○○원정 (₩숫자)", wide: true },
  "claim.totals": { label: "합계", hint: "합계 · 회사 지원 · 개인 부담", wide: true },
  "claim.payout": { label: "정산", hint: "회사→직원 지급 / 직원→회사 납부", wide: true },
  "claim.item_count": { label: "영수증 수", hint: "항목 수" },
  "claim.trip_destination": { label: "출장지", hint: "출장 결의서일 때만", trip: true },
  "claim.trip_period": { label: "출장 기간", hint: "출장 결의서일 때만", trip: true },
  "claim.trip_purpose": { label: "출장 목적", hint: "출장 결의서일 때만", trip: true, wide: true },
  "claim.exception_memo": { label: "예외 소명 사유", hint: "있을 때만", optional: true, wide: true },
} as const satisfies Record<string, { label: string; hint: string; wide?: boolean; trip?: boolean; optional?: boolean }>;
export type FieldKey = keyof typeof FIELD_CATALOG;

export const COLUMN_CATALOG = {
  "item.no": { label: "번호", hint: "1, 2, 3…", w: 0.5 },
  "item.evidence_no": { label: "증빙번호", hint: "세무 마감 증빙 순번(없으면 번호)", w: 1.1 },
  "item.expense_date": { label: "사용일", hint: "영수증 날짜", w: 0.75 },
  "item.merchant_name": { label: "사용처", hint: "가맹점(자차는 출발→도착)", w: 1.8 },
  "item.category": { label: "카테고리", hint: "지출 카테고리", w: 1.2 },
  "item.account_title": { label: "계정과목", hint: "세무 계정과목", w: 1.1 },
  "item.purpose": { label: "적요", hint: "지출 사유 한 줄(품목)", w: 1.9 },
  "item.summary": { label: "적요", hint: "사유 + 인원·참석자·경로", w: 2 },
  "item.note": { label: "비고", hint: "인원·참석자·거래처", w: 1.4 },
  "item.payment_method": { label: "결제", hint: "법인카드 / 개인", w: 0.7 },
  "item.evidence_type": { label: "지출 증빙", hint: "카드·현금영수증·세금계산서 등", w: 0.95 },
  "item.supply_amount": { label: "공급가액", hint: "", w: 0.95, money: true },
  "item.vat_amount": { label: "부가세", hint: "", w: 0.8, money: true },
  "item.amount": { label: "금액", hint: "합계 금액", w: 1, money: true },
  "item.company_supported_amount": { label: "회사지원", hint: "", w: 1, money: true },
  "item.personal_burden_amount": { label: "개인부담", hint: "", w: 0.95, money: true },
} as const satisfies Record<string, { label: string; hint: string; w: number; money?: boolean }>;
export type ColumnKey = keyof typeof COLUMN_CATALOG;

export type LayoutField<K extends string> = { key: K; label: string };
export type PresetId = "standard" | "itemized" | "single" | "monthly" | "detailed";
export type FormLayout = {
  v: 1;
  base: PresetId | "custom";
  title: string;
  header: LayoutField<FieldKey>[]; // 표 위 라벨–값
  columns: LayoutField<ColumnKey>[]; // 항목 표(영수증 1장 = 1행)
  totalLabel: string; // 합계 행 이름
  footer: LayoutField<FieldKey>[]; // 표 아래 라벨–값(특이사항·입금 정보 등)
  statement: string | null; // 맺음말. {기간}은 지출 기간으로 바뀜
  showDate: boolean; // 맺음말 아래 날짜(상신일)
  signerLabel: string | null; // "작성자: 홍길동 (인)"
  showCompany: boolean; // 맨 아래 회사 이름
};

const f = <K extends string>(key: K, label: string): LayoutField<K> => ({ key, label });

// ── 기본 포맷 5종 (reference/ 지출결의서 양식들에서 우리 데이터가 채울 수 있는 칸만) ──────────
export const PRESETS: Record<PresetId, { name: string; desc: string; layout: FormLayout }> = {
  standard: {
    name: "기본 양식",
    desc: "결재란 · 청구자 · 영수증 표(회사 지원·개인 부담) · 정산 요약. 처음 설정 그대로예요.",
    layout: {
      v: 1,
      base: "standard",
      title: "지출결의서",
      header: [
        f("doc.number", "결의서번호"),
        f("claim.title", "제목"),
        f("member.full", "청구자"),
        f("claim.description", "지출 사유"),
        f("claim.trip_destination", "출장지"),
        f("claim.trip_period", "출장 기간"),
        f("claim.trip_purpose", "출장 목적"),
        f("claim.exception_memo", "예외 소명 사유"),
        f("claim.submitted_at", "상신일"),
        f("claim.totals", "합계"),
      ],
      columns: [
        f("item.evidence_no", "증빙번호"),
        f("item.expense_date", "사용일"),
        f("item.merchant_name", "사용처"),
        f("item.category", "카테고리"),
        f("item.payment_method", "결제"),
        f("item.amount", "합계"),
        f("item.company_supported_amount", "회사지원"),
        f("item.personal_burden_amount", "개인부담"),
        f("item.summary", "적요"),
      ],
      totalLabel: "합계",
      footer: [f("claim.payout", "정산")],
      statement: null,
      showDate: false,
      signerLabel: null,
      showCompany: false,
    },
  },
  itemized: {
    name: "품목 표형",
    desc: "문서번호·지출일자·발의일자·결재일자 칸 + 번호·적요·금액·비고 표 + 특이사항.",
    layout: {
      v: 1,
      base: "itemized",
      title: "지 출 결 의 서",
      header: [
        f("doc.number", "문서번호"),
        f("claim.expense_period", "지출일자"),
        f("claim.title", "지출건명"),
        f("claim.submitted_at", "발의일자"),
        f("claim.approved_at", "결재일자"),
        f("member.department", "작성부서"),
        f("member.name", "작성자"),
        f("claim.total_amount_words", "합계 (VAT 포함)"),
      ],
      columns: [
        f("item.no", "번호"),
        f("item.expense_date", "사용일"),
        f("item.merchant_name", "사용처"),
        f("item.summary", "적요"),
        f("item.amount", "금액"),
        f("item.payment_method", "비고"),
      ],
      totalLabel: "합계",
      footer: [f("claim.description", "특이사항")],
      statement: null,
      showDate: false,
      signerLabel: null,
      showCompany: false,
    },
  },
  single: {
    name: "단건 요약형",
    desc: "금액을 크게(일금 ○○원정) + 적요 + 비고 + \"위와 같은 금액을 청구하오니…\" + 작성자 (인).",
    layout: {
      v: 1,
      base: "single",
      title: "지 출 결 의 서",
      header: [
        f("doc.number", "문서번호"),
        f("claim.expense_period", "지출일자"),
        f("claim.title", "지출건명"),
        f("claim.submitted_at", "발의일자"),
        f("claim.approved_at", "결재일자"),
        f("claim.total_amount_words", "금 액"),
      ],
      columns: [f("item.expense_date", "사용일"), f("item.merchant_name", "사용처"), f("item.summary", "적 요"), f("item.amount", "금액")],
      totalLabel: "합계",
      footer: [f("claim.description", "비 고")],
      statement: "위와 같은 금액을 청구하오니, 결재하여 주시기 바랍니다.",
      showDate: true,
      signerLabel: "작성자",
      showCompany: false,
    },
  },
  monthly: {
    name: "월 청구형",
    desc: "일자·계정과목·품목·금액·지출 증빙·비고 표 + 소계 + \"상기와 같이 ○~○ 지출한 경비를 청구합니다\" + 청구인 (인).",
    layout: {
      v: 1,
      base: "monthly",
      title: "지출 (청구) 결의서",
      header: [f("member.department", "부서"), f("member.name", "청구인"), f("claim.title", "건명")],
      columns: [
        f("item.expense_date", "일자"),
        f("item.account_title", "계정 과목"),
        f("item.purpose", "품목"),
        f("item.amount", "금액"),
        f("item.evidence_type", "지출 증빙"),
        f("item.note", "비고"),
      ],
      totalLabel: "소계",
      footer: [],
      statement: "상기와 같이 {기간} 지출한 경비를 청구합니다.",
      showDate: true,
      signerLabel: "청구인",
      showCompany: false,
    },
  },
  detailed: {
    name: "내역·입금형",
    desc: "지출 제목·작성/결재 일자·부서/담당·지출 금액 + 항목·금액·비고 내역 + 입금 정보 + 회사 이름.",
    layout: {
      v: 1,
      base: "detailed",
      title: "지출결의서",
      header: [
        f("claim.title", "지출 제목"),
        f("claim.submitted_at", "작성 일자"),
        f("claim.approved_at", "결재 일자"),
        f("member.dept_name", "부서 / 담당"),
        f("claim.total_amount_words", "지출 금액"),
      ],
      columns: [f("item.expense_date", "사용일"), f("item.summary", "항 목"), f("item.amount", "금액(원)"), f("item.note", "비 고")],
      totalLabel: "합 계",
      footer: [f("member.bank", "입금 정보")],
      statement: "위 금액을 청구하오니 결재해 주시기 바랍니다.",
      showDate: true,
      signerLabel: null,
      showCompany: true,
    },
  },
};
export const PRESET_IDS = Object.keys(PRESETS) as PresetId[];
export const DEFAULT_LAYOUT = PRESETS.standard.layout;

// ── 저장된 값 검사(DB·AI에서 온 값은 믿지 않는다) ─────────────────────
const LIMIT = { title: 30, label: 30, statement: 200, header: 20, columns: 10, footer: 6 };
const str = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");
function fields<K extends string>(v: unknown, catalog: Record<K, { label: string }>, max: number): LayoutField<K>[] {
  if (!Array.isArray(v)) return [];
  const seen = new Set<string>();
  const out: LayoutField<K>[] = [];
  for (const x of v) {
    const key = (x as { key?: unknown })?.key;
    if (typeof key !== "string" || !(key in catalog) || seen.has(key)) continue;
    seen.add(key);
    out.push({ key: key as K, label: str((x as { label?: unknown }).label, LIMIT.label) || catalog[key as K].label });
    if (out.length >= max) break;
  }
  return out;
}

export function normalizeLayout(v: unknown): FormLayout {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const columns = fields(o.columns, COLUMN_CATALOG, LIMIT.columns);
  if (!columns.length) return DEFAULT_LAYOUT; // 표가 없으면 결의서가 안 되므로 기본 양식
  const base = typeof o.base === "string" && (o.base === "custom" || o.base in PRESETS) ? (o.base as FormLayout["base"]) : "custom";
  return {
    v: 1,
    base,
    title: str(o.title, LIMIT.title) || "지출결의서",
    header: fields(o.header, FIELD_CATALOG, LIMIT.header),
    columns,
    totalLabel: str(o.totalLabel, 10) || "합계",
    footer: fields(o.footer, FIELD_CATALOG, LIMIT.footer),
    statement: str(o.statement, LIMIT.statement) || null,
    showDate: o.showDate === true,
    signerLabel: str(o.signerLabel, 10) || null,
    showCompany: o.showCompany === true,
  };
}

// ── 문서 모델 ───────────────────────────────────────────────
export type DocField = { label: string; value: string; wide: boolean };
export type DocModel = {
  title: string;
  company: string;
  approval: { label: string; name: string; status: string }[];
  header: DocField[];
  table: { cols: { label: string; w: number; right: boolean }[]; rows: { cells: string[]; dim: boolean }[]; total: string[] | null };
  footer: DocField[];
  statement: string | null;
  date: string | null;
  signer: string | null;
  companyLine: string | null;
  dimNote: string | null;
};

export const clean = (s: string | null | undefined) => (s ?? "").replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, "").replace(/\s+/g, " ").trim();
export const won = (n: number | null | undefined) => (n == null ? "" : n.toLocaleString("ko-KR"));
const kst = (iso: string | null) => (iso ? new Date(new Date(iso).getTime() + 9 * 3600_000).toISOString() : null);
export const kstDate = (iso: string | null) => kst(iso)?.slice(0, 10) ?? "";
const md = (iso: string | null) => {
  const d = kst(iso);
  return d ? `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}` : "";
};
const koDate = (ymd: string) => (ymd ? `${ymd.slice(0, 4)}년 ${Number(ymd.slice(5, 7))}월 ${Number(ymd.slice(8, 10))}일` : "");

// 금액 한글(수표식): 17800 → "일만칠천팔백", 10000000 → "일천만"
const DIGIT = ["", "일", "이", "삼", "사", "오", "육", "칠", "팔", "구"];
export function amountInWords(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "영";
  const units = ["", "만", "억", "조"];
  let s = "";
  let rest = Math.floor(n);
  for (let u = 0; rest > 0 && u < units.length; u++) {
    const chunk = rest % 10000;
    rest = Math.floor(rest / 10000);
    if (!chunk) continue;
    let c = "";
    [1000, 100, 10, 1].forEach((p, i) => {
      const d = Math.floor(chunk / p) % 10;
      if (d) c += DIGIT[d] + ["천", "백", "십", ""][i];
    });
    s = c + units[u] + s;
  }
  return s;
}

const EVIDENCE_LABEL: Record<string, string> = { card_slip: "카드", cash_receipt: "현금영수증", tax_invoice: "세금계산서", simple_receipt: "간이영수증", other: "기타" };
const isOwnCar = (i: ClaimDocItem) => i.category === "trip" && i.trip_type === "own_car";

function classOf(i: ClaimDocItem): string {
  if (!i.category) return "";
  if (i.category === "trip" && i.trip_type) return `출장·${TRIP_TYPE_LABEL[i.trip_type]}`;
  if (i.category === "purchase" && i.purchase_type) return PURCHASE_TYPE_LABEL[i.purchase_type];
  return CATEGORY_LABEL[i.category];
}
function noteOf(i: ClaimDocItem): string {
  if (i.category === "meeting") return [clean(i.client_name), clean(i.attendees)].filter(Boolean).join(" / ");
  const parts = [clean(i.attendees)];
  if ((i.category === "meal" || i.trip_type === "meal" || i.category === "team_dinner") && (i.headcount ?? 1) > 1) parts.unshift(`${i.headcount}명`);
  if (isOwnCar(i) && i.route_one_way_km != null) parts.push(`${Number(i.route_one_way_km)}km${i.is_round_trip ? " 왕복" : ""}`);
  return parts.filter(Boolean).join(" · ");
}
export function itemSummary(i: ClaimDocItem): string {
  const parts = [clean(i.purpose)];
  if (isOwnCar(i) && i.route_one_way_km != null) parts.push(`${clean(i.start_location)}→${clean(i.end_location)} ${Number(i.route_one_way_km)}km${i.is_round_trip ? " 왕복" : ""}`);
  if ((i.category === "meal" || i.trip_type === "meal") && (i.headcount ?? 1) > 1) parts.push(`${i.headcount}명`);
  if (i.category === "meeting") parts.push([clean(i.client_name), clean(i.attendees)].filter(Boolean).join(" / "));
  return parts.filter(Boolean).join(" · ");
}

function cell(key: ColumnKey, i: ClaimDocItem, index: number, evidenceNo: string | undefined): string {
  switch (key) {
    case "item.no":
      return String(index + 1);
    case "item.evidence_no":
      return evidenceNo ?? String(index + 1);
    case "item.expense_date":
      return i.expense_date ? i.expense_date.slice(5).replace("-", "/") : "";
    case "item.merchant_name":
      return isOwnCar(i) ? `자차 ${clean(i.start_location)}→${clean(i.end_location)}` : clean(i.merchant_name);
    case "item.category":
      return classOf(i);
    case "item.account_title":
      return clean(i.account_title_name);
    case "item.purpose":
      return clean(i.purpose);
    case "item.summary":
      return itemSummary(i);
    case "item.note":
      return noteOf(i);
    case "item.payment_method":
      return i.payment_method === "corporate_card" ? "법인" : "개인";
    case "item.evidence_type":
      return isOwnCar(i) ? "경로 요약" : (EVIDENCE_LABEL[i.evidence_type ?? ""] ?? "");
    case "item.supply_amount":
      return won(i.supply_amount);
    case "item.vat_amount":
      return won(i.vat_amount);
    case "item.amount":
      return won(i.amount);
    case "item.company_supported_amount":
      return won(i.company_supported_amount);
    case "item.personal_burden_amount":
      return won(i.personal_burden_amount);
  }
}
const MONEY_FIELD: Partial<Record<ColumnKey, keyof ClaimDocItem>> = {
  "item.supply_amount": "supply_amount",
  "item.vat_amount": "vat_amount",
  "item.amount": "amount",
  "item.company_supported_amount": "company_supported_amount",
  "item.personal_burden_amount": "personal_burden_amount",
};

export type DocContext = {
  companyName: string;
  evidenceNo?: Map<string, string> | null; // 세무 마감 패키지: 항목 id → 증빙번호(없는 항목은 다른 달 → 회색). null이면 전부 보통 글씨
};

export function buildDocModel(layout: FormLayout, doc: ClaimDoc, ctx: DocContext): DocModel {
  const sum = (k: keyof ClaimDocItem) => doc.items.reduce((s, i) => s + (Number(i[k]) || 0), 0);
  // 합계는 표의 항목을 더해 낸다(표와 항상 일치)
  const total = sum("amount");
  const dates = doc.items.map((i) => i.expense_date).filter((d): d is string => !!d).sort();
  const period = dates.length ? (dates[0] === dates[dates.length - 1] ? dates[0] : `${dates[0]} ~ ${dates[dates.length - 1]}`) : "";
  const pay = doc.items.reduce((s, i) => s + (i.payment_method === "personal_card" ? (i.company_supported_amount ?? 0) : 0), 0);
  const back = doc.items.reduce((s, i) => s + (i.payment_method === "corporate_card" ? (i.personal_burden_amount ?? 0) : 0), 0);
  const m = doc.member;
  const value = (k: FieldKey): string | null => {
    switch (k) {
      case "doc.number":
        return doc.id.slice(0, 8);
      case "claim.title":
        return clean(doc.title);
      case "claim.description":
        return clean(doc.description);
      case "claim.expense_period":
        return period;
      case "claim.submitted_at":
        return kstDate(doc.submitted_at);
      case "claim.approved_at":
        return kstDate(doc.approved_at);
      case "member.name":
        return clean(m.name);
      case "member.department":
        return clean(m.department);
      case "member.position":
        return clean(m.position);
      case "member.dept_name":
        return [clean(m.department), clean(m.name)].filter(Boolean).join(" / ");
      case "member.full":
        return [clean(m.name), clean(m.department), clean(m.position)].filter(Boolean).join(" / ");
      case "member.bank":
        return m.bank ? [clean(m.bank.bank_name), clean(m.bank.account_number), clean(m.bank.account_holder)].filter(Boolean).join(" / ") : "";
      case "claim.total_amount":
        return `${won(total)}원`;
      case "claim.total_amount_words":
        return `일금 ${amountInWords(total)}원정 (₩${won(total)})`;
      case "claim.totals":
        return `${won(total)}원 · 회사 지원 ${won(sum("company_supported_amount"))}원 · 개인 부담 ${won(sum("personal_burden_amount"))}원`;
      case "claim.payout":
        return `회사 → 직원 지급 ${won(pay)}원 / 직원 → 회사 납부 ${won(back)}원`;
      case "claim.item_count":
        return `${doc.items.length}건`;
      case "claim.trip_destination":
        return doc.is_business_trip ? clean(doc.trip_destination) : null;
      case "claim.trip_period":
        return doc.is_business_trip ? `${doc.trip_start_date ?? ""} ~ ${doc.trip_end_date ?? ""}` : null;
      case "claim.trip_purpose":
        return doc.is_business_trip ? clean(doc.trip_purpose) : null;
      case "claim.exception_memo":
        return clean(doc.exception_memo) || null;
    }
  };
  const toFields = (list: LayoutField<FieldKey>[]): DocField[] =>
    list.flatMap((x) => {
      const v = value(x.key);
      return v === null ? [] : [{ label: x.label, value: v, wide: "wide" in FIELD_CATALOG[x.key] }];
    });

  const cols = layout.columns.map((c) => ({ label: c.label, w: COLUMN_CATALOG[c.key].w, right: "money" in COLUMN_CATALOG[c.key] }));
  const ev = ctx.evidenceNo ?? null;
  const rows = doc.items.map((i, idx) => ({ cells: layout.columns.map((c) => cell(c.key, i, idx, ev?.get(i.id) ?? (ev ? "다른 달" : undefined))), dim: ev ? !ev.get(i.id) : false }));
  const moneyCols = layout.columns.map((c) => MONEY_FIELD[c.key]);
  const totalRow = moneyCols.some(Boolean) ? layout.columns.map((c, i) => (moneyCols[i] ? won(sum(moneyCols[i]!)) : i === 0 ? layout.totalLabel : "")) : null;
  if (totalRow && moneyCols[0]) totalRow[0] = `${layout.totalLabel} ${totalRow[0]}`;

  const steps = doc.self_approved ? [{ step_kind: "final" as const, name: "결재 생략", status: "approved", acted_at: doc.approved_at }] : doc.steps;
  return {
    title: clean(layout.title) || "지출결의서",
    company: clean(ctx.companyName),
    approval: steps.map((s) => ({
      label: s.step_kind === "review" ? "검토" : "승인",
      name: clean(s.name ?? "-").slice(0, 8),
      status: s.status === "approved" ? `승인 ${md(s.acted_at)}` : s.status === "rejected" ? "반려" : "대기",
    })),
    header: toFields(layout.header),
    table: { cols, rows, total: totalRow },
    footer: toFields(layout.footer),
    statement: layout.statement ? layout.statement.replace("{기간}", period || "-") : null,
    date: layout.showDate ? koDate(kstDate(doc.submitted_at)) || "      년    월    일" : null,
    signer: layout.signerLabel ? `${layout.signerLabel}: ${clean(m.name)} (인)` : null,
    companyLine: layout.showCompany ? clean(ctx.companyName) : null,
    dimNote: rows.some((r) => r.dim) ? "회색 항목은 다른 달 사용분으로 그 달 패키지에 들어 있어요." : null,
  };
}

// 미리보기용 예시 결의서(회사에 결의서가 하나도 없을 때)
export const SAMPLE_DOC: ClaimDoc = {
  id: "a1b2c3d4-0000-0000-0000-000000000000",
  title: "10월 영업팀 외근 경비",
  description: "거래처 미팅 및 팀 점심",
  exception_memo: null,
  is_business_trip: false,
  trip_destination: null,
  trip_start_date: null,
  trip_end_date: null,
  trip_purpose: null,
  submitted_at: "2026-10-20T01:00:00Z",
  approved_at: "2026-10-21T02:00:00Z",
  self_approved: false,
  total_amount: 103300,
  total_company_supported: 103300,
  total_personal_burden: 0,
  member: { name: "홍길동", department: "영업팀", position: "대리", bank: { bank_name: "가나은행", account_number: "123-456-7890", account_holder: "홍길동" } },
  items: [
    { id: "s1", sort_order: 1, expense_date: "2026-10-14", merchant_name: "한식당 소담", category: "meal", trip_type: null, purchase_type: null, payment_method: "corporate_card", evidence_type: "card_slip", supply_amount: 32545, vat_amount: 3255, amount: 35800, purpose: "부서 정기 점심 식사", headcount: 3, attendees: "홍길동, 김철수, 이영희", client_name: null, start_location: null, end_location: null, is_round_trip: null, route_one_way_km: null, company_supported_amount: 35800, personal_burden_amount: 0, account_title_name: "복리후생비" },
    { id: "s2", sort_order: 2, expense_date: "2026-10-16", merchant_name: "카페 온도", category: "meeting", trip_type: null, purchase_type: null, payment_method: "personal_card", evidence_type: "card_slip", supply_amount: 15000, vat_amount: 1500, amount: 16500, purpose: "거래처 신제품 협의", headcount: 2, attendees: "홍길동", client_name: "가나상사", start_location: null, end_location: null, is_round_trip: null, route_one_way_km: null, company_supported_amount: 16500, personal_burden_amount: 0, account_title_name: "접대비" },
    { id: "s3", sort_order: 3, expense_date: "2026-10-17", merchant_name: "다이소", category: "purchase", trip_type: null, purchase_type: "office_supplies", payment_method: "corporate_card", evidence_type: "cash_receipt", supply_amount: 46364, vat_amount: 4636, amount: 51000, purpose: "사내 비품 및 소모품 구입", headcount: null, attendees: null, client_name: null, start_location: null, end_location: null, is_round_trip: null, route_one_way_km: null, company_supported_amount: 51000, personal_burden_amount: 0, account_title_name: "소모품비" },
  ],
  steps: [
    { step_kind: "review", name: "김팀장", status: "approved", acted_at: "2026-10-20T05:00:00Z" },
    { step_kind: "final", name: "박대표", status: "approved", acted_at: "2026-10-21T02:00:00Z" },
  ],
};
