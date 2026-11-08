import { kstTime } from "./rules";
import type { AttendanceRequest, RequestBefore } from "./month";

// 정정 신청 · 휴일 근무 상신(spec/features/attendance.md §6, D-239) — 순수 함수
export const REASON_CHIPS = ["퇴근을 못 찍었어요", "퇴근 뒤 더 일했어요", "일찍 잘못 찍었어요", "출근을 못 찍었어요", "외근·출장"] as const;
export const REASON_MAX = 200;

const HM = /^([01]\d|2[0-3]):[0-5]\d$/;
const toMin = (hm: string) => Number(hm.slice(0, 2)) * 60 + Number(hm.slice(3, 5));

export function kstDate(iso: string | Date): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul" }).format(new Date(iso));
}

export function minutesBetween(inHm: string, outHm: string): number {
  return toMin(outHm) - toMin(inHm);
}

export type RequestInput = { date: string; kind: "correction" | "holiday"; newIn: string; newOut: string; reason: string };

// 화면 검사(서버도 같은 규칙으로 다시 검사). before = 지금 그날 기록(없으면 null)
export function validateRequest(input: RequestInput, before: { inTime: string | null; outTime: string | null }, today: string, nowHm: string): string | null {
  if (!HM.test(input.newIn) || !HM.test(input.newOut)) return "출근·퇴근 시각을 넣어 주세요.";
  if (input.newIn >= input.newOut) return "퇴근은 출근보다 늦어야 해요(자정 넘은 시각은 넣을 수 없어요).";
  if (input.date === today && input.newOut > nowHm) return "아직 오지 않은 시각은 넣을 수 없어요.";
  if (input.kind === "correction" && before.inTime === input.newIn && before.outTime === input.newOut) return "바뀐 시각이 없어요.";
  const reason = input.reason.trim();
  if (!reason) return input.kind === "holiday" ? "한 일을 적어 주세요." : "사유를 적어 주세요.";
  if (reason.length > REASON_MAX) return `${REASON_MAX}자까지 적을 수 있어요.`;
  return null;
}

// 빠른 선택: 비어 있거나 다른 빠른 선택이면 바꾸고, 적은 글이 있으면 앞에 붙인다
export function applyChip(reason: string, chip: string): string {
  const r = reason.trim();
  if (!r || (REASON_CHIPS as readonly string[]).includes(r)) return chip;
  const rest = REASON_CHIPS.reduce((acc, c) => (acc.startsWith(`${c} — `) ? acc.slice(c.length + 3) : acc), r);
  return `${chip} — ${rest}`.slice(0, REASON_MAX);
}

// "퇴근 18:00(자동) → 20:30" 같은 바뀐 줄
export type ChangeLine = { label: "출근" | "퇴근" | "시각"; from: string; to: string };
export function changeLines(r: Pick<AttendanceRequest, "before" | "new_in" | "new_out">): ChangeLine[] {
  const b: RequestBefore = r.before ?? {};
  const oldIn = b.in_at ? kstTime(b.in_at) : null;
  const oldOut = b.out_at ? kstTime(b.out_at) : null;
  const lines: ChangeLine[] = [];
  if (oldIn !== r.new_in) lines.push({ label: "출근", from: oldIn ?? "기록 없음", to: r.new_in });
  if (oldOut !== r.new_out) lines.push({ label: "퇴근", from: oldOut ? `${oldOut}${b.out_method === "auto" ? " (자동)" : ""}` : "기록 없음", to: r.new_out });
  if (!lines.length) lines.push({ label: "시각", from: `${oldIn} – ${oldOut}`, to: "그대로" });
  return lines;
}

export function requestErrorText(message: string | undefined): string {
  const m = message ?? "";
  if (m.includes("OUT_OF_RANGE")) return "정정 신청은 이번 달 기록만 할 수 있어요.";
  if (m.includes("INVALID_TIME")) return "퇴근은 출근보다 늦어야 해요(자정 넘은 시각은 넣을 수 없어요).";
  if (m.includes("FUTURE_TIME")) return "아직 오지 않은 시각은 넣을 수 없어요.";
  if (m.includes("REASON_REQUIRED")) return "사유를 적어 주세요.";
  if (m.includes("NO_CHANGE")) return "바뀐 시각이 없어요.";
  if (m.includes("NOT_HOLIDAY")) return "휴일 출근 기록이 있는 날만 상신할 수 있어요.";
  if (m.includes("NOT_DONE")) return "퇴근을 찍은 뒤에 상신할 수 있어요.";
  if (m.includes("ALREADY_APPROVED")) return "이미 휴일 근무로 인정된 날이에요.";
  if (m.includes("NO_RECORD_HOLIDAY")) return "휴일은 QR로 출퇴근을 찍은 날만 근무로 올릴 수 있어요.";
  if (m.includes("PENDING_EXISTS")) return "이 날짜에 승인 대기 중인 신청이 있어요.";
  if (m.includes("ALREADY_DECIDED")) return "이미 처리된 신청이에요. 새로고침해 주세요.";
  if (m.includes("RECORD_CHANGED")) return "신청 뒤 그날 기록이 바뀌었어요. 반려하고 다시 신청받아 주세요.";
  if (m.includes("FEATURE_DISABLED")) return "회사에서 근태를 쓰지 않아요.";
  if (m.includes("NOT_FOUND")) return "없거나 이미 처리된 신청이에요. 새로고침해 주세요.";
  if (m.includes("NOT_ALLOWED") || m.includes("42501")) return "이 신청은 처리할 수 없어요.";
  return "보내지 못했어요. 잠시 뒤 다시 해 주세요.";
}
