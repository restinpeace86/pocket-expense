// 세무사무소 고객사 현황판(D-268, 9-18) — 화면에서 쓰는 순수 계산
export type ClientStatus = {
  company_id: string;
  closed: boolean;
  closed_at: string | null;
  requests_open: number;
  requests_answered: number;
  requests_acked?: number;
  unread: number;
  missing_receipts?: number;
  pending_claims?: number;
  hometax_missing?: boolean;
  last_upload_at?: string | null;
  office_checked_at?: string | null;
  office_checked_by?: string | null;
};
export type ClientRow = { company_id: string; company_name: string; business_number: string | null; assigned_member_id: string | null; assigned_name: string | null; status: ClientStatus | null };

export type Tone = "done" | "wait" | "alert";
// 색: 빨강 = 사무소가 볼 것(새 확인 요청·영수증 없는 지출), 초록 = 마감 완료, 주황 = 마감 전.
// 사무소가 보내고 회사 답을 기다리는 요청은 빨강이 아니다(확인할 것 칸에 "답변 대기"로)
export function rowTone(s: ClientStatus | null): Tone {
  if (!s) return "wait";
  if ((s.unread ?? 0) > 0 || (s.missing_receipts ?? 0) > 0) return "alert";
  return s.closed ? "done" : "wait";
}

// 확인할 것(짧은 글자 목록)
export function todoItems(s: ClientStatus | null): string[] {
  if (!s) return [];
  const out: string[] = [];
  if (s.unread > 0) out.push(`새 확인 요청 ${s.unread}`);
  if ((s.missing_receipts ?? 0) > 0) out.push(`영수증 없는 지출 ${s.missing_receipts}`);
  if ((s.pending_claims ?? 0) > 0) out.push(`승인 대기 ${s.pending_claims}`);
  if (s.hometax_missing) out.push("홈택스 안 올림");
  if (s.requests_open > 0) out.push(`답변 대기 ${s.requests_open}${s.requests_acked ? `(확인함 ${s.requests_acked})` : ""}`);
  if (s.requests_answered > 0) out.push(`답변 옴 ${s.requests_answered}`);
  return out;
}

// 할 일 점수(많을수록 위): 새 요청·영수증 없음이 가장 급하고, 그다음 마감 전
export function todoScore(s: ClientStatus | null): number {
  if (!s) return 0;
  return s.unread * 100 + (s.missing_receipts ?? 0) * 10 + s.requests_open * 10 + (s.pending_claims ?? 0) * 5 + s.requests_answered * 5 + (s.hometax_missing ? 3 : 0) + (s.closed ? 0 : 2);
}

export type Filter = "all" | "open" | "closed" | "todo" | "unchecked";
export type Sort = "todo" | "name" | "upload";
export const FILTER_LABEL: Record<Filter, string> = { all: "전체", open: "마감 전", closed: "마감 완료", todo: "확인할 것 있음", unchecked: "사무소 확인 안 함" };

export function matchFilter(r: ClientRow, f: Filter): boolean {
  const s = r.status;
  if (f === "open") return !s?.closed;
  if (f === "closed") return !!s?.closed;
  if (f === "todo") return todoItems(s).length > 0;
  if (f === "unchecked") return !s?.office_checked_at;
  return true;
}

export function sortRows(rows: ClientRow[], sort: Sort): ClientRow[] {
  const byName = (a: ClientRow, b: ClientRow) => a.company_name.localeCompare(b.company_name, "ko");
  return [...rows].sort((a, b) => {
    if (sort === "name") return byName(a, b);
    if (sort === "upload") return (b.status?.last_upload_at ?? "").localeCompare(a.status?.last_upload_at ?? "") || byName(a, b);
    return todoScore(b.status) - todoScore(a.status) || byName(a, b);
  });
}

// 지난달(세무 마감하는 달)
export function prevMonth(now: string): string {
  const [y, m] = now.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 2, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

// 자료 요청 문구 예시(D-268)
export const REQUEST_PRESETS = ["영수증 누락분 올려 주세요", "홈택스 자료 올려 주세요", "법인카드 내역 올려 주세요"];
