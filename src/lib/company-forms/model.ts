// 회사 양식 등록의 칸 모델 (8-104 B, spec/features/company-forms.md §B)
// 표 모양은 서류 → 엑셀과 같은 DocModel. 값이 들어갈 칸마다 Field 하나: 어느 칸(s 쪽·r 행·c 열)인지 + 어떻게 채우는지(b)
// - data: 우리 데이터(B-3) / input: 신청할 때 직원이 입력 / fixed: 고정 값 / blank: 비워 두기(수기) / drop: 빼기(등록할 때 양식에서 지움) / pending: 정해 주세요
import { BRAND } from "@/lib/brand";
import { guessDocType, guessInputType, isDocType, stdField, type DocTypeCode } from "./doc-types";
import { detectTable, MAX_TABLE_COLS, MAX_TABLE_ROWS, TABLE_COL_LABEL, tableCells, type TableCol } from "./table";
import { anchorOf, sheetFromAi, type AiCell, type AiPage, type DocModel, type Sheet, MAX_CELL, MAX_PAGES } from "@/lib/doc-convert/model";

export type FormKind = "leave" | "correction" | "holiday" | "general";
export const KIND_LABEL: Record<FormKind, string> = { leave: "휴가신청서", correction: "근태 정정 신청서", holiday: "휴일·연장근무 신청서", general: "일반 결재 문서" };
// 근태 양식(9-33c, D-279): 직원은 앱 신청 화면 그대로, 회사 양식은 결재 끝난 문서 모양 + [회사 추가 항목]. 회사에 종류마다 하나
export const ATTENDANCE_KINDS = ["leave", "correction", "holiday"] as const;
export const isAttendanceKind = (k: FormKind | null | undefined): k is "leave" | "correction" | "holiday" => !!k && (ATTENDANCE_KINDS as readonly string[]).includes(k);
export const isFormKind = (k: unknown): k is FormKind => typeof k === "string" && k in KIND_LABEL;

// 우리 데이터(B-3). 결재란은 결재라인 순서대로 이름·직급·날짜(서명 이미지는 이번 범위 아님)
export const COMMON_DATA = {
  "company.name": "회사명",
  "member.name": "신청자 이름",
  "member.department": "신청자 부서",
  "member.position": "신청자 직급",
  "member.employee_number": "신청자 사번",
  "doc.date": "신청일",
  "doc.number": "문서 번호",
  "approval.1": "결재란 1번째(이름·직급·날짜)",
  "approval.2": "결재란 2번째(이름·직급·날짜)",
  "approval.3": "결재란 3번째(이름·직급·날짜)",
  "approval.4": "결재란 4번째(이름·직급·날짜)",
  "approval.5": "결재란 5번째(이름·직급·날짜)",
} as const;
export const LEAVE_DATA = {
  "leave.type": "휴가 종류",
  "leave.period": "휴가 기간(시작일 ~ 종료일)",
  "leave.start": "휴가 시작일",
  "leave.end": "휴가 종료일",
  "leave.days": "휴가 일수·시간",
  "leave.half": "반차 구분(오전·오후)",
  "leave.reason": "휴가 사유",
  "leave.remaining": "남은 연차(신청할 때)",
  "leave.proof": "증빙 첨부 여부",
} as const;
export const CORRECTION_DATA = {
  "correction.date": "정정 날짜",
  "correction.before": "변경 전 출퇴근(09:00 ~ 18:00)",
  "correction.after": "변경 후 출퇴근(09:00 ~ 18:00)",
  "correction.before_in": "변경 전 출근",
  "correction.before_out": "변경 전 퇴근",
  "correction.after_in": "변경 후 출근",
  "correction.after_out": "변경 후 퇴근",
  "correction.reason": "정정 사유",
  "correction.stay": "정정 후 머문 시간",
} as const;
export const HOLIDAY_DATA = {
  "holiday.date": "근무 날짜",
  "holiday.time": "근무 시간대(09:00 ~ 18:00)",
  "holiday.in": "출근 시각",
  "holiday.out": "퇴근 시각",
  "holiday.hours": "근무 시간(합계)",
  "holiday.work": "한 일",
} as const;
export type DataKey = keyof typeof COMMON_DATA | keyof typeof LEAVE_DATA | keyof typeof CORRECTION_DATA | keyof typeof HOLIDAY_DATA;
export const DATA_LABEL: Record<DataKey, string> = { ...COMMON_DATA, ...LEAVE_DATA, ...CORRECTION_DATA, ...HOLIDAY_DATA };
const KIND_DATA: Record<FormKind, readonly DataKey[]> = {
  leave: Object.keys(LEAVE_DATA) as DataKey[],
  correction: Object.keys(CORRECTION_DATA) as DataKey[],
  holiday: Object.keys(HOLIDAY_DATA) as DataKey[],
  general: [],
};
export function dataKeysFor(kind: FormKind): DataKey[] {
  return [...(Object.keys(COMMON_DATA) as DataKey[]), ...KIND_DATA[kind]];
}
export const isDataKey = (k: unknown, kind: FormKind): k is DataKey => typeof k === "string" && (dataKeysFor(kind) as string[]).includes(k);

export type InputType = "text" | "long" | "date" | "number" | "choice" | "member" | "money" | "period" | "time_range" | "check" | "table" | "attach";
export const INPUT_LABEL: Record<InputType, string> = { text: "글", long: "긴 글", date: "날짜", number: "숫자", choice: "선택지", member: "직원 고르기", money: "금액", period: "기간", time_range: "시각(부터~까지)", check: "체크", table: "표(줄 추가)", attach: "첨부 파일 이름" };
// 금액·기간·시각 범위(9-33d)·체크·표·첨부(9-33e7)는 결재 문서에서만 — 근태 양식의 [회사 추가 항목]은 기존 6가지
export const GENERAL_ONLY_TYPES: InputType[] = ["money", "period", "time_range", "check", "table", "attach"];
export const inputTypesFor = (kind: FormKind) => (Object.keys(INPUT_LABEL) as InputType[]).filter((t) => kind === "general" || !GENERAL_ONLY_TYPES.includes(t));
export const MAX_INPUTS: Record<FormKind, number> = { leave: 5, correction: 5, holiday: 5, general: 15 };
export const MAX_OPTIONS = 10;

export type Binding =
  | { k: "pending" }
  | { k: "data"; src: DataKey }
  | { k: "input"; type: InputType; required: boolean; options?: string[]; std?: string; cols?: TableCol[]; rows?: number } // std: 결재 문서 표준 칸 키(9-33d) · cols·rows: 표 칸(9-33e7, 이 칸 = 표 첫 빈 칸)
  | { k: "fixed"; value: string }
  | { k: "blank" }
  | { k: "drop" };
// lr·lc: 같은 쪽의 라벨 칸(빼기 할 때 함께 지움)
export type Field = { key: string; label: string; s: number; r: number; c: number; lr?: number; lc?: number; b: Binding };

export const MAX_FIELDS = 200;
export const MAX_LABEL = 40;
export const MAX_READS = 3; // 처음 1번 + 다시 읽기 2번

export const isResolved = (f: Field) => f.b.k !== "pending";
export const pendingCount = (fields: Field[]) => fields.filter((f) => !isResolved(f)).length;
export const inputCount = (fields: Field[]) => fields.filter((f) => f.b.k === "input").length;

export function newKey(fields: Field[]): string {
  let n = fields.length + 1;
  const used = new Set(fields.map((f) => f.key));
  while (used.has(`f${n}`)) n++;
  return `f${n}`;
}

// 칸에 무엇이 들어가는지 한 줄로(목록·미리보기)
export function bindingSummary(b: Binding): string {
  switch (b.k) {
    case "data":
      return DATA_LABEL[b.src] ?? "우리 데이터";
    case "input":
      if (b.type === "table") return `직원 입력 · 표(${(b.cols ?? []).map((k) => k.label).join("·")} · 양식 ${b.rows ?? 0}줄)${b.required ? " · 필수" : ""}`;
      return `${b.std ? `${BRAND.name} 칸` : "직원 입력"} · ${INPUT_LABEL[b.type]}${b.required ? " · 필수" : ""}`;
    case "fixed":
      return `고정 값 · ${b.value || "(빈 글)"}`;
    case "blank":
      return "비워 두기(출력 뒤 손으로 써요)";
    case "drop":
      return "빼기(양식에서 지워요)";
    default:
      return "우리 데이터에 없어요 — 어떻게 할까요?";
  }
}
// 표 미리보기 칸 안 표시
export function cellHint(b: Binding, label: string): string {
  switch (b.k) {
    case "data":
      return `{${DATA_LABEL[b.src] ?? label}}`;
    case "input":
      return `[직원 입력: ${label}]`;
    case "fixed":
      return b.value;
    case "blank":
      return "(수기)";
    case "drop":
      return "(빼기)";
    default:
      return `{${label}?}`;
  }
}

// ── AI 결과 → 표 + 칸 ─────────────────────────────────────────────────────
export type AiFormCell = AiCell & { slot_label?: string | null; slot_data?: string | null };
export type AiFormPage = Omit<AiPage, "rows"> & { doc_type?: string | null; rows?: { height?: number | null; cells?: AiFormCell[] | null }[] | null };

// 같은 행에서 왼쪽으로 가장 가까운 글자 있는 칸(라벨)
function labelLeft(sheet: Sheet, r: number, c: number): { r: number; c: number } | null {
  for (let x = c - 1; x >= 0; x--) {
    const a = anchorOf(sheet, r, x);
    if (sheet.cells[a.r]?.[a.c]?.t.trim()) return a;
  }
  return null;
}
const cleanLabel = (s: string) => s.replace(/\s+/g, " ").replace(/[:：]\s*$/, "").trim().slice(0, MAX_LABEL);

export function formFromAi(pages: AiFormPage[], kind: FormKind): { doc: DocModel; fields: Field[]; title: string | null; docType: DocTypeCode | null } | null {
  // 결재 문서(9-33d): AI가 고른 종류(없으면 제목으로 짐작) — 그 종류의 표준 칸만 짝짓고, 짝 없는 칸은 직원 입력(방식 짐작)
  const aiType = pages.find((p) => isDocType(p.doc_type))?.doc_type as DocTypeCode | undefined;
  const firstTitle = pages.find((p) => p.title?.trim())?.title ?? null;
  const docType: DocTypeCode | null = kind === "general" ? (aiType ?? guessDocType(firstTitle)) : null;
  const sheets: Sheet[] = [];
  const fields: Field[] = [];
  let title: string | null = null;
  for (const page of pages.slice(0, MAX_PAGES)) {
    const slots: { r: number; c: number; label: string; data: string | null }[] = [];
    const sheet = sheetFromAi(page as AiPage, `${sheets.length + 1}쪽`, (r, c, ac) => {
      const f = ac as AiFormCell;
      if (f.slot_label && f.slot_label.trim()) slots.push({ r, c, label: f.slot_label, data: f.slot_data ?? null });
    });
    if (!sheet) continue;
    const s = sheets.length;
    sheets.push(sheet);
    title ??= page.title?.replace(/\s+/g, " ").trim() || null;
    for (const slot of slots) {
      if (fields.length >= MAX_FIELDS) break;
      if (fields.some((f) => f.s === s && f.r === slot.r && f.c === slot.c)) continue;
      const lab = labelLeft(sheet, slot.r, slot.c);
      const label = cleanLabel(slot.label) || (lab ? cleanLabel(sheet.cells[lab.r][lab.c].t) : "") || "칸";
      const std = docType && slot.data?.startsWith(`${docType}.`) ? stdField(docType, slot.data.slice(docType.length + 1)) : null;
      const b: Binding = isDataKey(slot.data, kind)
        ? { k: "data", src: slot.data }
        : std
          ? { k: "input", type: std.type, required: std.required, ...(std.options ? { options: std.options } : {}), std: std.key }
          : kind === "general" && !sheet.cells[slot.r]?.[slot.c]?.t.trim() // 글자가 있는 칸(라벨·결재란 머리)은 직원 입력으로 짐작하지 않음
            ? { k: "input", type: guessInputType(label), required: false }
            : { k: "pending" };
      fields.push({ key: newKey(fields), label, s, r: slot.r, c: slot.c, ...(lab ? { lr: lab.r, lc: lab.c } : {}), b });
    }
  }
  if (!sheets.length) return null;
  // 같은 데이터·표준 칸이 여러 칸이면 처음 것만 자동 연결(나머지는 정해 주세요) — 결재란은 번호가 달라 겹치지 않음
  const seen = new Set<string>();
  for (const f of fields) {
    const id = f.b.k === "data" ? f.b.src : f.b.k === "input" && f.b.std ? `std:${f.b.std}` : null;
    if (!id) continue;
    if (seen.has(id)) f.b = { k: "pending" };
    else seen.add(id);
  }
  const out = kind === "general" ? autoTables(sheets, fields) : fields;
  return { doc: { v: 1, sheets }, fields: out, title: title ? title.slice(0, 60) : null, docType };
}

// 결재 문서: 머리글 아래 빈 줄이 2줄 이상·2열 이상인 표 안에 AI가 값 칸을 3개 이상 찍었으면(예: 품목 표) 표 칸 하나로 바꾼다(9-33e7)
export function autoTables(sheets: Sheet[], fields: Field[]): Field[] {
  let list = [...fields];
  const sorted = [...fields].sort((a, b) => a.s - b.s || a.r - b.r || a.c - b.c);
  for (const f of sorted) {
    if (!list.includes(f) || f.b.k === "data") continue;
    const sh = sheets[f.s];
    const t = sh ? detectTable(sh, f.r, f.c) : null;
    if (!t || t.rows < 2 || t.cols.length < 2) continue;
    const inside = new Set(tableCells(f.r, t.cols, t.rows).map((x) => `${x.r}:${x.c}`));
    const hits = list.filter((x) => x.s === f.s && inside.has(`${x.r}:${x.c}`) && x.b.k !== "data");
    if (hits.length < 3) continue;
    const head = sh.cells[f.r - 1]?.map((x) => x.t.trim()).filter(Boolean).slice(0, 2).join("·") || "표";
    const table: Field = { ...f, label: (f.label || head).slice(0, MAX_LABEL), b: { k: "input", type: "table", required: true, cols: t.cols, rows: t.rows } };
    list = list.filter((x) => !hits.includes(x)).concat(table);
  }
  return list;
}

// ── 레이아웃을 고칠 때 칸 위치 따라가기 ───────────────────────────────────
export function shiftFieldsAddRow(fields: Field[], s: number, at: number): Field[] {
  // at 행 아래에 새 행: at보다 아래 행의 칸은 한 행 내려감
  return fields.map((f) =>
    f.s !== s ? f : { ...f, r: f.r > at ? f.r + 1 : f.r, ...(f.lr !== undefined ? { lr: f.lr > at ? f.lr + 1 : f.lr } : {}) },
  );
}
// r 행을 지움: 그 행의 칸은 빠짐(여러 행에 걸친 합친 칸이면 그대로 남음 — keep), 아래 행은 한 행 올라감
export function shiftFieldsDeleteRow(fields: Field[], s: number, r: number, keep: (f: Field) => boolean): Field[] {
  return fields
    .filter((f) => f.s !== s || f.r !== r || keep(f))
    .map((f) => {
      if (f.s !== s) return f;
      const nf: Field = { ...f, r: f.r > r ? f.r - 1 : f.r };
      if (f.lr !== undefined) {
        if (f.lr === r) {
          delete nf.lr;
          delete nf.lc;
        } else nf.lr = f.lr > r ? f.lr - 1 : f.lr;
      }
      return nf;
    });
}

// 등록할 때: 빼기 칸은 값 칸·라벨 칸 글자를 지우고 칸 목록에서 뺀다
export function applyDrops(doc: DocModel, fields: Field[]): { doc: DocModel; fields: Field[] } {
  const drops = fields.filter((f) => f.b.k === "drop");
  if (!drops.length) return { doc, fields };
  const sheets = doc.sheets.map((sh, s) => {
    const mine = drops.filter((f) => f.s === s);
    if (!mine.length) return sh;
    const cells = sh.cells.map((row) => row.map((c) => ({ ...c })));
    for (const f of mine) {
      if (cells[f.r]?.[f.c]) cells[f.r][f.c].t = "";
      if (f.lr !== undefined && f.lc !== undefined && cells[f.lr]?.[f.lc]) cells[f.lr][f.lc].t = "";
    }
    return { ...sh, cells };
  });
  return { doc: { ...doc, sheets }, fields: fields.filter((f) => f.b.k !== "drop") };
}

// 표 칸(9-33e7): 열 1~8개(같은 쪽 안 · 겹치지 않음), 양식 줄 1~50줄(시트 안)
function validTable(cols: unknown, rows: unknown, r: number, sh: Sheet): boolean {
  if (!Array.isArray(cols) || cols.length < 1 || cols.length > MAX_TABLE_COLS) return false;
  if (!Number.isInteger(rows) || (rows as number) < 1 || (rows as number) > MAX_TABLE_ROWS || r + (rows as number) > sh.cells.length) return false;
  const seen = new Set<number>();
  return cols.every((k: TableCol) => k && typeof k.label === "string" && k.label.trim().length > 0 && k.label.length <= 20 && Number.isInteger(k.c) && k.c >= 0 && k.c < sh.cols.length && !seen.has(k.c) && seen.add(k.c) && k.type in TABLE_COL_LABEL);
}

// 서버 저장 전 모양 확인
export function validFields(x: unknown, doc: DocModel, kind: FormKind | null): x is Field[] {
  if (!Array.isArray(x) || x.length > MAX_FIELDS) return false;
  const keys = new Set<string>();
  return x.every((f: Field) => {
    if (!f || typeof f.key !== "string" || !/^[a-z0-9_]{1,20}$/i.test(f.key) || keys.has(f.key)) return false;
    keys.add(f.key);
    if (typeof f.label !== "string" || !f.label.trim() || f.label.length > MAX_LABEL) return false;
    const sh = doc.sheets[f.s];
    if (!sh || !Number.isInteger(f.r) || !Number.isInteger(f.c) || !sh.cells[f.r]?.[f.c]) return false;
    if (f.lr !== undefined && !sh.cells[f.lr]?.[f.lc ?? -1]) return false;
    const b = f.b;
    if (!b || typeof b !== "object") return false;
    switch (b.k) {
      case "pending":
      case "blank":
      case "drop":
        return true;
      case "data":
        return kind ? isDataKey(b.src, kind) : typeof b.src === "string";
      case "fixed":
        return typeof b.value === "string" && b.value.length <= MAX_CELL;
      case "input":
        return (
          b.type in INPUT_LABEL &&
          typeof b.required === "boolean" &&
          (b.options === undefined || (Array.isArray(b.options) && b.options.length <= MAX_OPTIONS && b.options.every((o) => typeof o === "string" && o.trim().length > 0 && o.length <= 40))) &&
          (b.type !== "choice" || (b.options?.length ?? 0) >= 2) &&
          (b.std === undefined || (typeof b.std === "string" && /^[a-z_]{1,20}$/.test(b.std))) &&
          (b.type !== "table" || validTable(b.cols, b.rows, f.r, sh))
        );
      default:
        return false;
    }
  });
}

export function formErrorMessage(message: string): string {
  if (message.includes("SLOTS_FULL")) return "회사 양식 등록 횟수를 다 썼어요. 양식을 더 등록하려면 추가 결제가 필요해요.";
  if (message.includes("READS_USED")) return "AI 다시 읽기를 모두 썼어요(1장당 2번). 표를 직접 고쳐 주세요.";
  if (message.includes("FIELDS_PENDING")) return "'정해 주세요' 칸을 모두 정해야 등록할 수 있어요.";
  if (message.includes("TOO_MANY_INPUTS")) return "직원 입력 칸이 너무 많아요(휴가신청서 5개, 일반 결재 문서 15개까지).";
  if (message.includes("DRAFTS_FULL")) return "등록 대기 중인 양식이 많아요. 대기 중인 양식을 먼저 등록하거나 지워 주세요.";
  if (message.includes("LEAVE_EXISTS")) return "근태 양식(휴가·근태 정정·휴일근무)은 종류마다 하나만 둘 수 있어요. 이미 있는 양식의 새 버전으로 올려 주세요.";
  if (message.includes("KIND_MISMATCH")) return "다른 종류의 문서로 바꿀 수 없어요. 새 양식으로 추가해 주세요.";
  if (message.includes("NOT_READ")) return "아직 AI가 양식을 읽지 않았어요.";
  if (message.includes("INVALID_NAME")) return "양식 이름을 1~60자로 적어 주세요.";
  if (message.includes("NOT_CONVERTIBLE")) return "사진(JPG·PNG)이나 PDF만 양식으로 등록할 수 있어요.";
  if (message.includes("EXPIRED")) return "보관 기간이 지났거나 지워진 파일이에요.";
  if (message.includes("TOO_LARGE")) return "20MB보다 작은 파일만 올릴 수 있어요.";
  if (message.includes("TOO_MANY_PAGES")) return `한 번에 ${MAX_PAGES}쪽까지 읽을 수 있어요. 양식 쪽만 올려 주세요.`;
  if (message.includes("NO_TABLE")) return "양식에서 표를 찾지 못했어요. 표가 잘 보이게 다시 찍어 주세요.";
  if (message.includes("NOT_ALLOWED") || message.includes("42501")) return "관리자만 회사 양식을 등록할 수 있어요.";
  if (message.includes("NOT_FOUND")) return "양식을 찾을 수 없어요. 새로고침해 주세요.";
  return "잠시 후 다시 시도해 주세요.";
}
