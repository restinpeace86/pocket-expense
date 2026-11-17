// [결재 문서](9-33e, D-284 · spec/features/company-forms.md §G-3) — 화면·서버가 같이 쓰는 모양·글자
import type { Field, InputType } from "@/lib/company-forms/model";

export type DocStatus = "draft" | "submitted" | "approved" | "rejected";
export const STATUS_LABEL: Record<DocStatus, string> = { draft: "작성 중", submitted: "결재 중", approved: "승인", rejected: "반려" };
export const STATUS_TONE: Record<DocStatus, string> = {
  draft: "bg-zinc-100 text-zinc-700",
  submitted: "bg-amber-50 text-amber-800",
  approved: "bg-green-50 text-green-800",
  rejected: "bg-red-50 text-red-700",
};

export type DocStep = {
  id: string;
  round: number;
  step_order: number;
  step_kind: "review" | "final";
  approver_member_id: string | null;
  approver_name: string | null; // 검토자 이름(최종은 null = 관리자)
  acted_by_name: string | null;
  status: "waiting" | "pending" | "approved" | "rejected" | "skipped" | "canceled";
  comment: string | null;
  acted_at: string | null;
};
export type DocFile = { id: string; name: string; mime: string; size: number; path: string };
export type DocRow = {
  id: string;
  member_id: string;
  member_name: string;
  form_id: string;
  doc_type: string;
  title: string;
  status: DocStatus;
  current_round: number;
  self_approved: boolean;
  rejection_reason: string | null;
  submitted_at: string | null;
  decided_at: string | null;
  updated_at: string;
  form_name: string;
  form_group: string; // 양식 묶음(버전이 바뀌어도 같은 탭)
  amount: number | null; // 표준 칸 금액(있을 때 목록에 보임)
  progress: string; // 목록 한 줄: "팀장 검토 중" · "관리자 승인 대기" …
};
export type Payload = Record<string, string | string[] | string[][]>;

// 입력 칸(양식 위→아래, 왼→오)
export function inputFields(fields: Field[]): Field[] {
  return fields.filter((f) => f.b.k === "input").sort((a, b) => a.s - b.s || a.r - b.r || a.c - b.c);
}

const dot = (d: string) => d.replaceAll("-", ".");
export const won = (n: number) => `${n.toLocaleString("ko-KR")}원`;
// 저장 값 → 양식·화면에 쓰는 글: 금액 2200000 → 2,200,000원, 기간 a~b → 2026.11.20 ~ 2026.12.15(26일), 시각 a~b → 09:00 ~ 11:00
export function displayValue(type: InputType, raw: string | string[] | string[][] | undefined): string {
  if (raw === undefined || raw === null) return "";
  if (type === "table") return Array.isArray(raw) ? `${raw.length}줄` : "";
  if (Array.isArray(raw)) return raw.map((x) => (Array.isArray(x) ? x.join(" ") : x)).join(", ");
  if (type === "check") return raw === "Y" ? "V" : "";
  const v = raw.trim();
  if (!v) return "";
  switch (type) {
    case "money": {
      const n = Number(v.replace(/[^0-9-]/g, ""));
      return Number.isFinite(n) && v.replace(/[^0-9]/g, "") ? won(n) : v;
    }
    case "date":
      return /^\d{4}-\d{2}-\d{2}$/.test(v) ? dot(v) : v;
    case "period": {
      const [a, b] = v.split("~").map((x) => x.trim());
      if (!/^\d{4}-\d{2}-\d{2}$/.test(a ?? "")) return v;
      if (!b || b === a) return dot(a);
      const days = Math.round((Date.parse(b) - Date.parse(a)) / 86400_000) + 1;
      return `${dot(a)} ~ ${dot(b)}${days > 0 ? ` (${days}일)` : ""}`;
    }
    case "time_range": {
      const [a, b] = v.split("~").map((x) => x.trim());
      return a && b ? `${a} ~ ${b}` : v;
    }
    default:
      return v;
  }
}

// 비었나(필수 확인 — DB의 approval_doc_missing과 같은 기준)
export function isEmpty(v: string | string[] | string[][] | undefined): boolean {
  if (v === undefined) return true;
  if (Array.isArray(v)) return v.length === 0;
  if (v === "N") return true; // 체크 안 함
  if (v.includes("~")) return v.split("~").some((x) => !x.trim()); // 기간·시각: 둘 다 있어야
  return !v.trim();
}
export function missingFields(fields: Field[], payload: Payload): Field[] {
  return inputFields(fields).filter((f) => f.b.k === "input" && f.b.required && isEmpty(payload[f.key]));
}

// 진행 한 줄
export function progressLine(status: DocStatus, steps: Pick<DocStep, "round" | "step_kind" | "status" | "approver_name" | "acted_by_name">[], round: number, selfApproved: boolean): string {
  if (status === "draft") return "올리기 전";
  if (status === "approved") return selfApproved ? "대표 본인 승인" : `승인 · ${steps.filter((s) => s.round === round && s.status === "approved").at(-1)?.acted_by_name ?? ""}`;
  if (status === "rejected") return `반려 · ${steps.find((s) => s.round === round && s.status === "rejected")?.acted_by_name ?? ""}`;
  const now = steps.find((s) => s.round === round && s.status === "pending");
  if (!now) return "결재 중";
  return now.step_kind === "review" ? `${now.approver_name ?? "검토자"} 검토 중` : "관리자 승인 대기";
}

const ERRORS: Record<string, string> = {
  FORM_NOT_FOUND: "이 양식은 지금 쓸 수 없어요. 화면을 새로 고쳐 주세요.",
  TOO_MANY_DRAFTS: "작성 중인 문서가 너무 많아요. 안 쓰는 문서를 지우고 다시 해 주세요.",
  INVALID_TITLE: "제목을 1~100자로 적어 주세요.",
  INVALID_PAYLOAD: "내용이 너무 길어요. 조금 줄여 주세요.",
  INVALID_STATUS: "이미 올렸거나 처리된 문서예요. 화면을 새로 고쳐 주세요.",
  REQUIRED_MISSING: "꼭 적어야 하는 칸이 비어 있어요.",
  INACTIVE_REVIEWER: "결재라인의 검토자 중 지금 회사에 없는 사람이 있어요. 관리자에게 결재라인을 고쳐 달라고 해 주세요.",
  ALREADY_PROCESSED: "이미 처리된 문서예요. 화면을 새로 고쳐 볼게요.",
  NOT_ALLOWED: "지금 이 문서를 처리할 차례가 아니에요.",
  NOT_FOUND: "문서를 찾을 수 없어요.",
  REASON_REQUIRED: "반려 사유를 적어 주세요.",
  INVALID_FILE: "파일을 올리지 못했어요. 다시 해 주세요.",
  FILE_LIMIT: "첨부는 5개까지예요.",
};
export function docErrorText(message: string | undefined | null): string {
  const code = (message ?? "").trim();
  return ERRORS[code] ?? "처리하지 못했어요. 잠시 뒤 다시 해 주세요.";
}
