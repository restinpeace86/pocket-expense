// 세무사무소 월말 결산 양식 (D-150): 사무소가 올린 엑셀 양식의 칸(머리글)마다 우리 세무 마감 행의 어떤 값을 넣을지.
// 순수 함수 — 서버(엑셀 만들기)·브라우저(칸 연결 화면) 공용. 행은 관리자 세무 마감과 같은 tax_month_export 행(승인·지급된 지출만).
import { bizNo, classLabels, EVIDENCE_LABEL, evidenceFile, isOwnCar, supplyVat, upload적요, type ExportRow } from "@/lib/tax/export-rows";

export type FieldKey =
  | "empty"
  | "fixed"
  | "seq"
  | "date"
  | "date8"
  | "month"
  | "day"
  | "merchant"
  | "client_code"
  | "biz_no"
  | "biz_no_digits"
  | "account_name"
  | "account_code"
  | "memo"
  | "supply"
  | "vat"
  | "amount"
  | "service_fee"
  | "evidence"
  | "payment"
  | "card_last4"
  | "card_name"
  | "member"
  | "department"
  | "claim_title"
  | "category"
  | "purpose"
  | "evidence_file";

export type TemplateColumn = { index: number; header: string; field: FieldKey; fixed?: string };
export type TemplateTarget = "all" | "corporate_card" | "personal";
export type FieldCtx = { month: string; total: number };
export type CellValue = string | number | Date | null;

type FieldDef = { key: FieldKey; label: string; synonyms: string[]; value: (r: ExportRow, c: FieldCtx) => CellValue };

const day = (v: string) => new Date(`${v.slice(0, 10)}T00:00:00Z`);
const merchant = (r: ExportRow) => (isOwnCar(r) ? `자차 ${r.start_location ?? ""}→${r.end_location ?? ""}` : (r.merchant_name ?? ""));

// 고르는 순서 = 화면 목록 순서. synonyms는 머리글을 공백·기호 없이 소문자로 바꾼 값과 비교한다(앞쪽일수록 우선)
export const FIELDS: FieldDef[] = [
  { key: "empty", label: "비워 두기", synonyms: [], value: () => null },
  { key: "fixed", label: "고정값 넣기", synonyms: [], value: () => null },
  { key: "seq", label: "순번(증빙 순번)", synonyms: ["순번", "번호", "no", "일련번호", "증빙번호"], value: (r) => r.seq },
  { key: "date", label: "거래일자(날짜)", synonyms: ["거래일자", "전표일자", "일자", "사용일자", "결제일자", "날짜", "거래일", "승인일자", "작성일자"], value: (r) => day(r.expense_date) },
  { key: "date8", label: "거래일자(20261015 글자)", synonyms: ["거래일자yyyymmdd", "일자8자리"], value: (r) => r.expense_date.slice(0, 10).replaceAll("-", "") },
  { key: "month", label: "월", synonyms: ["월"], value: (r) => Number(r.expense_date.slice(5, 7)) },
  { key: "day", label: "일", synonyms: ["일"], value: (r) => Number(r.expense_date.slice(8, 10)) },
  { key: "merchant", label: "거래처명(가맹점)", synonyms: ["거래처명", "거래처", "가맹점명", "가맹점", "상호", "상호명", "공급자", "공급자명"], value: merchant },
  // 세무사무소 회계 프로그램의 거래처 코드 — 우리 데이터에 없어 빈칸(D-145)
  { key: "client_code", label: "거래처코드(빈칸)", synonyms: ["거래처코드", "거래처번호", "거래처cd"], value: () => "" },
  { key: "biz_no", label: "사업자등록번호(123-45-67890)", synonyms: ["사업자등록번호", "사업자번호", "등록번호", "거래처사업자번호", "공급자사업자번호", "가맹점사업자번호"], value: (r) => (isOwnCar(r) ? "" : bizNo(r.merchant_business_number)) },
  { key: "biz_no_digits", label: "사업자등록번호(숫자만)", synonyms: [], value: (r) => (isOwnCar(r) ? "" : (r.merchant_business_number ?? "")) },
  { key: "account_name", label: "계정과목명", synonyms: ["계정과목", "계정과목명", "계정명", "계정"], value: (r) => r.account_title_name ?? "" },
  { key: "account_code", label: "계정코드", synonyms: ["계정코드", "계정과목코드", "계정cd", "코드"], value: (r) => r.account_title_code ?? "" },
  { key: "memo", label: "적요(사유·목적)", synonyms: ["적요", "적요명", "적요내용", "내용", "품명", "비고", "거래내용"], value: (r) => upload적요(r) },
  { key: "supply", label: "공급가액", synonyms: ["공급가액", "공급가", "공급금액"], value: (r) => supplyVat(r).supply },
  { key: "vat", label: "부가세", synonyms: ["부가세", "세액", "부가세액", "부가가치세", "vat"], value: (r) => supplyVat(r).vat },
  { key: "amount", label: "합계 금액", synonyms: ["합계", "합계금액", "총액", "총금액", "금액", "결제금액", "거래금액", "이용금액", "승인금액", "차변", "차변금액", "차변출금", "출금", "출금액", "출금금액"], value: (r) => r.amount ?? 0 },
  { key: "service_fee", label: "봉사료(0)", synonyms: ["봉사료"], value: () => 0 },
  { key: "evidence", label: "증빙구분", synonyms: ["증빙", "증빙구분", "증빙유형", "증빙종류"], value: (r) => (r.evidence_type ? (EVIDENCE_LABEL[r.evidence_type] ?? "기타") : "") },
  { key: "payment", label: "결제수단(법인카드/개인)", synonyms: ["결제수단", "결제구분", "지불수단", "결제방법"], value: (r) => (r.payment_method === "corporate_card" ? "법인카드" : "개인(사비)") },
  { key: "card_last4", label: "카드번호 끝 4자리", synonyms: ["카드번호", "카드", "카드끝자리", "카드번호뒤4자리"], value: (r) => (r.payment_method === "corporate_card" ? (r.card_last4 ?? "") : "") },
  { key: "card_name", label: "카드 별칭", synonyms: ["카드명", "카드별칭"], value: (r) => (r.payment_method === "corporate_card" ? (r.card_nickname ?? "") : "") },
  { key: "member", label: "사용자(직원)", synonyms: ["사용자", "사용자명", "성명", "사원명", "직원명", "사용자이름"], value: (r) => r.member_name },
  { key: "department", label: "부서·프로젝트", synonyms: ["부서", "부서명", "프로젝트", "현장", "부서프로젝트"], value: (r) => r.department ?? "" },
  { key: "claim_title", label: "결의서 제목", synonyms: ["결의서", "결의서제목", "제목"], value: (r) => r.claim_title },
  { key: "category", label: "분류(카테고리)", synonyms: ["분류", "카테고리", "구분명"], value: (r) => [classLabels(r).category, classLabels(r).subtype].filter(Boolean).join(" › ") },
  { key: "purpose", label: "지출 목적", synonyms: ["지출목적", "목적", "사용목적", "용도"], value: (r) => r.purpose ?? r.claim_description ?? "" },
  { key: "evidence_file", label: "증빙 파일명(ZIP 매칭)", synonyms: ["증빙파일명", "파일명", "증빙파일"], value: (r, c) => evidenceFile(r, c.month, c.total)?.name ?? "" },
];
const BY_KEY = new Map(FIELDS.map((f) => [f.key, f]));
export const FIELD_KEYS = FIELDS.map((f) => f.key);
export const fieldLabel = (k: FieldKey) => BY_KEY.get(k)?.label ?? k;

const norm = (s: string) => s.toLowerCase().replace(/[\s()[\]{}<>/\\·.,:;\-_*~"'`]/g, "");
// 위하고 일반전표처럼 머리글 앞에 칸 번호를 붙인 양식("1.월", "4.계정과목코드") — 번호는 떼고 본다
const stripNo = (s: string) => s.replace(/^\s*\d{1,2}\s*[.)]\s*/, "");
const isCode = (s: string) => s.includes("코드") || s.endsWith("cd");

// 머리글로 항목 추정: 같은 이름 > 머리글이 동의어로 시작 > 포함. 두 글자 이하 동의어(월·일·코드·금액 등)는 정확히 같을 때만. 이미 쓴 항목은 다시 고르지 않는다.
// "코드"가 든 머리글은 코드 항목끼리만 맞춘다("계정과목코드"가 계정과목명으로, "거래처코드"가 거래처명으로 가지 않게)
export function guessField(header: string, used: Set<FieldKey> = new Set()): FieldKey {
  const h = norm(stripNo(header));
  if (!h) return "empty";
  const code = isCode(h);
  const pick = (test: (syn: string) => boolean) => {
    for (const f of FIELDS) {
      if (used.has(f.key) || f.synonyms.length === 0) continue;
      if (f.synonyms.some((s) => isCode(s) === code && (s.length <= 2 ? h === s : test(s)))) return f.key;
    }
    return null;
  };
  return pick((s) => h === s) ?? pick((s) => h.startsWith(s)) ?? pick((s) => s.length >= 2 && h.includes(s)) ?? "empty";
}

export function autoMap(headers: { index: number; header: string }[]): TemplateColumn[] {
  const used = new Set<FieldKey>();
  return headers.map(({ index, header }) => {
    const field = guessField(header, used);
    if (field !== "empty") used.add(field);
    return { index, header, field };
  });
}

export function cellValue(col: TemplateColumn, r: ExportRow, c: FieldCtx): CellValue {
  if (col.field === "fixed") return col.fixed ?? "";
  if (col.field === "empty") return null;
  return BY_KEY.get(col.field)?.value(r, c) ?? null;
}

export function rowsForTarget(rows: ExportRow[], target: TemplateTarget): ExportRow[] {
  if (target === "corporate_card") return rows.filter((r) => r.payment_method === "corporate_card");
  if (target === "personal") return rows.filter((r) => r.payment_method !== "corporate_card");
  return rows;
}

export const TARGET_LABEL: Record<TemplateTarget, string> = { all: "전체 지출", corporate_card: "법인카드만", personal: "개인(사비)만" };

// 양식 파일이 없을 때 바로 쓸 수 있는 초안(reference.md에서 확인된 항목만). 실제 프로그램 양식과 다를 수 있어 사무소가 확인·수정한다
export type Preset = { id: string; name: string; target: TemplateTarget; note: string; columns: { header: string; field: FieldKey; fixed?: string }[] };
export const PRESETS: Preset[] = [
  {
    id: "wehago_card",
    name: "더존 위하고 신용카드 매입(초안)",
    target: "corporate_card",
    note: "거래일자·적요·사업자등록번호·품명·유형·공급가액·세액·봉사료·합계·공제여부·거래구분. 유형·공제여부·거래구분 코드는 프로그램 기준이라 비워 뒀어요(고정값으로 넣을 수 있어요).",
    columns: [
      { header: "거래일자", field: "date" },
      { header: "카드번호", field: "card_last4" },
      { header: "적요", field: "memo" },
      { header: "사업자등록번호", field: "biz_no" },
      { header: "거래처명", field: "merchant" },
      { header: "품명", field: "account_name" },
      { header: "유형", field: "empty" },
      { header: "공급가액", field: "supply" },
      { header: "세액", field: "vat" },
      { header: "봉사료", field: "service_fee" },
      { header: "합계", field: "amount" },
      { header: "공제여부", field: "empty" },
      { header: "거래구분", field: "empty" },
    ],
  },
  {
    // 실제 위하고 일반전표 [엑셀올리기]용 양식(reference/더존위하고 일반전표입력 엑셀 양식.xlsx)과 같은 9칸
    id: "wehago_journal_cash",
    name: "더존 위하고 일반전표 · 출금 한 줄(초안)",
    target: "all",
    note: "위하고 일반전표 [엑셀올리기]용 9칸이에요. 구분 '출금'은 상대 계정이 현금으로 잡혀요 — 법인카드·사비를 미지급금으로 넣는다면 위하고에서 상대 계정을 바꿔 주세요. 위하고 [엑셀제목설정]에서 칸 번호를 맞추고, 적요가 너무 길면 올라가지 않을 수 있어요.",
    columns: [
      { header: "1.월", field: "month" },
      { header: "2.일", field: "day" },
      { header: "3.구분", field: "fixed", fixed: "출금" },
      { header: "4.계정과목코드", field: "account_code" },
      { header: "5.계정과목명", field: "account_name" },
      { header: "6.거래처코드", field: "client_code" },
      { header: "7.거래처명", field: "merchant" },
      { header: "8.적요명", field: "memo" },
      { header: "9.차변(출금)", field: "amount" },
    ],
  },
  {
    id: "journal_basic",
    name: "일반 지출 목록(월·일 분리, 초안)",
    target: "all",
    note: "위하고 일반전표 필수 항목(월·일·구분·계정과목코드·계정과목명)에 거래처·금액·적요를 붙인 목록이에요. 차변·대변 나누기는 하지 않아요.",
    columns: [
      { header: "월", field: "month" },
      { header: "일", field: "day" },
      { header: "구분", field: "fixed", fixed: "출금" },
      { header: "계정과목코드", field: "account_code" },
      { header: "계정과목명", field: "account_name" },
      { header: "거래처코드", field: "client_code" },
      { header: "거래처명", field: "merchant" },
      { header: "사업자등록번호", field: "biz_no" },
      { header: "적요", field: "memo" },
      { header: "공급가액", field: "supply" },
      { header: "부가세", field: "vat" },
      { header: "금액", field: "amount" },
      { header: "결제수단", field: "payment" },
    ],
  },
];

// 저장 전 검사(서버·DB 함수와 같은 규칙)
export function validColumns(cols: TemplateColumn[]): boolean {
  if (!Array.isArray(cols) || cols.length === 0 || cols.length > 80) return false;
  const seen = new Set<number>();
  return cols.every(
    (c) =>
      Number.isInteger(c.index) && c.index >= 1 && c.index <= 200 && !seen.has(c.index) && seen.add(c.index) &&
      typeof c.header === "string" && c.header.length <= 100 && FIELD_KEYS.includes(c.field) && (c.field !== "fixed" || (typeof c.fixed === "string" && c.fixed.length <= 100)),
  );
}
