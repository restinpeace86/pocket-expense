// 나의 신청함(D-251 개선사항 6): 내가 낸 신청 중 "지금" 볼 것만 모은다
// - 대기중: 결재·승인을 기다리는 것(휴가 취소 신청 대기 포함)
// - 승인: 최근 7일 안에 승인된 것
// - 반려: 지출결의서는 다시 내지 않은 반려 건 전부(다시 내면 대기로 바뀜), 휴가·정정 신청은 최근 7일 안 반려
// 오늘 출근·오늘 회의실 예약은 화면에서 따로(늘 "오늘")
export type RequestStatus = "wait" | "ok" | "bad";
export type RequestKind = "leave" | "fix" | "claim";
export type RequestItem = { key: string; kind: RequestKind; title: string; sub: string; status: RequestStatus; label: string; href: string; at: string };

export const RECENT_DAYS = 7;

export type LeaveRow = { id: string; type_name: string; start_date: string; end_date: string; unit: string; hours: number | null; status: string; decided_at: string | null; created_at: string; cancel_status: string | null; cancel_requested_at: string | null };
export type FixRow = { id: string; work_date: string; kind: string; status: string; decided_at: string | null; created_at: string };
export type ClaimRow = { id: string; title: string; total_amount: number; status: string; submitted_at: string | null; approved_at: string | null; rejected_at: string | null; paid_at: string | null };

const md = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`;
const won = (n: number) => `${n.toLocaleString("ko-KR")}원`;

export function buildRequests(ws: string, rows: { leaves: LeaveRow[]; fixes: FixRow[]; claims: ClaimRow[] }, now: Date): RequestItem[] {
  const since = now.getTime() - RECENT_DAYS * 86_400_000;
  const recent = (iso: string | null) => !!iso && Date.parse(iso) >= since;
  const out: RequestItem[] = [];

  for (const l of rows.leaves) {
    const when = l.start_date === l.end_date ? md(l.start_date) : `${md(l.start_date)}~${md(l.end_date)}`;
    const title = `${when} ${l.type_name}${l.unit === "hour" && l.hours ? ` ${l.hours}시간` : ""}`;
    const base = { key: `leave-${l.id}`, kind: "leave" as const, title, href: `${ws}/employee/vacation` };
    if (l.status === "pending") out.push({ ...base, sub: "휴가 신청", status: "wait", label: "승인 대기", at: l.created_at });
    else if (l.status === "approved" && l.cancel_status === "pending") out.push({ ...base, sub: "휴가 취소 신청", status: "wait", label: "취소 승인 대기", at: l.cancel_requested_at ?? l.created_at });
    else if (l.status === "approved" && recent(l.decided_at)) out.push({ ...base, sub: "휴가 신청", status: "ok", label: "승인", at: l.decided_at! });
    else if (l.status === "rejected" && recent(l.decided_at)) out.push({ ...base, sub: "휴가 신청", status: "bad", label: "반려", at: l.decided_at! });
  }

  for (const f of rows.fixes) {
    const title = `${md(f.work_date)} ${f.kind === "holiday" ? "휴일 근무" : "출퇴근 정정"}`;
    const base = { key: `fix-${f.id}`, kind: "fix" as const, title, sub: "근태 신청", href: `${ws}/employee/attendance?month=${f.work_date.slice(0, 7)}` };
    if (f.status === "pending") out.push({ ...base, status: "wait", label: "승인 대기", at: f.created_at });
    else if (f.status === "approved" && recent(f.decided_at)) out.push({ ...base, status: "ok", label: "승인", at: f.decided_at! });
    else if (f.status === "rejected" && recent(f.decided_at)) out.push({ ...base, status: "bad", label: "반려", at: f.decided_at! });
  }

  for (const c of rows.claims) {
    const title = `${c.title || "지출결의서"} ${won(c.total_amount)}`;
    const base = { key: `claim-${c.id}`, kind: "claim" as const, title, sub: "지출결의서", href: `${ws}/employee/claims/${c.id}` };
    if (c.status === "submitted") out.push({ ...base, status: "wait", label: "결재 중", at: c.submitted_at ?? "" });
    else if (c.status === "rejected") out.push({ ...base, status: "bad", label: "반려", at: c.rejected_at ?? "" });
    else if (c.status === "paid" && recent(c.paid_at ?? c.approved_at)) out.push({ ...base, status: "ok", label: "지급 완료", at: (c.paid_at ?? c.approved_at)! });
    else if (c.status === "approved" && recent(c.approved_at)) out.push({ ...base, status: "ok", label: "승인", at: c.approved_at! });
  }

  // 반려 → 대기 → 승인, 같은 상태 안에서는 최근 것부터
  const order: Record<RequestStatus, number> = { bad: 0, wait: 1, ok: 2 };
  return out.sort((a, b) => order[a.status] - order[b.status] || (b.at > a.at ? 1 : b.at < a.at ? -1 : 0));
}
