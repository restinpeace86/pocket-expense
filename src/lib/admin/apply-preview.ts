// "우리 회사에 적용하면" 한 칸 미리보기(D-304`${workDaysLabel(s.work_days)} ${s.work_start}~${s.work_end} · 하루 ${s.daily_hours}시간(반차 ${Number.isInteger(half) ? half : half.toFixed(1)}시간)`, 벤치마킹 B-3) — 샘플이 아니라 이 회사의 지금 값·입력 중인 값으로 계산. 순수 함수
// 규칙: 설정 하나에 한 칸, 두 줄까지. 계산할 자료가 없으면 줄을 만들지 않는다
import { addMonths, recommend, type LeaveAdminData, type LeaveSettings } from "@/lib/attendance/leave";
import { alertLabel, WEEKDAYS, type AttendanceSettings } from "@/lib/attendance/rules";

const won = (n: number) => `${n.toLocaleString("ko-KR")}원`;
const md = (date: string) => {
  const [, m, d] = date.split("-").map(Number);
  return `${m}월 ${d}일`;
};
const ymdLabel = (date: string) => {
  const [y, m, d] = date.split("-").map(Number);
  return `${y}년 ${m}월 ${d}일`;
};

// ── 예산: 이번 달 쓴 돈(결재 올린 것 포함) 대비 %, 지금 속도로 80%에 닿는 날 ──
export function budgetPreview(spent: number, budget: number | null, today: string): string[] {
  if (!budget || budget <= 0) return spent > 0 ? [`예산을 넣으면 이번 달 쓴 돈 ${won(spent)}이 몇 %인지 바로 보여 드려요.`] : [];
  if (spent <= 0) return ["아직 이번 달 쓴 돈이 없어요. 쓰기 시작하면 몇 %인지 여기에 보여요."];
  const pct = Math.round((spent / budget) * 100);
  const first = `이번 달 지금까지 쓴 돈 ${won(spent)} → 예산의 ${pct}%예요.`;
  if (pct >= 100) return [first, "이미 예산을 넘었어요."];
  if (pct >= 80) return [first, "이미 80%를 넘었어요."];
  const [y, m, d] = today.split("-").map(Number);
  if (d < 3) return [first]; // 월초엔 속도 계산이 크게 틀려서 내다보지 않음
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const reach = Math.ceil((0.8 * budget) / (spent / d));
  return [first, reach <= last ? `지금 속도면 ${m}월 ${reach}일쯤 80%를 넘어요.` : "지금 속도면 이번 달 안에 80%까지는 안 가요."];
}

// ── 파일 보관: 오늘 올린 파일이 지워지는 날(매일 새벽 정리가 "지금 - 기간"보다 오래된 것을 지움 → 기간 + 1일째 새벽) ──
export function retentionPreview(today: string, days: number): string[] {
  const [y, m, d] = today.split("-").map(Number);
  const at = new Date(Date.UTC(y, m - 1, d + days + 1)).toISOString().slice(0, 10);
  return [`오늘 올린 채팅 사진·파일은 ${ymdLabel(at)} 새벽에 지워져요.`, "오늘 끝난 회의의 자료도 같은 날이에요. 글·안건과 영수증은 남아요."];
}

// ── 근무 기준: 요일·시각·반차·누락 알림 ──
export function workDaysLabel(days: number[]): string {
  const s = [...days].sort();
  if (s.join() === "1,2,3,4,5") return "평일(월~금)";
  if (s.join() === "1,2,3,4,5,6") return "월~토";
  if (s.length === 7) return "매일";
  return s.map((d) => WEEKDAYS[d - 1]).join("·") || "근무 요일 없음";
}
export function workRulesPreview(s: AttendanceSettings): string[] {
  const half = s.daily_hours / 2;
  return [
    `${workDaysLabel(s.work_days)} ${s.work_start}~${s.work_end} 근무 · 하루 ${s.daily_hours}시간(반차 ${Number.isInteger(half) ? half : half.toFixed(1)}시간)`,
    `${alertLabel(s.work_end, s.missing_alert_minutes).match(/\((\d{2}:\d{2})\)/)?.[1] ?? s.work_end}까지 퇴근을 안 찍으면 그 직원에게 알림이 가요.`,
  ];
}

// ── 연차 기준·5인 미만을 바꾸면 추천 연차가 달라지는 직원 수(막지 않고 알려만) ──
export function leaveImpact(data: LeaveAdminData, next: Pick<LeaveSettings, "basis" | "under_five" | "daily_hours">): { changed: number; confirmed: number } | null {
  const cur = data.settings;
  if (cur.basis === next.basis && cur.under_five === next.under_five && cur.daily_hours === next.daily_hours) return null;
  const after: LeaveAdminData = { ...data, settings: { ...cur, ...next } };
  let changed = 0;
  for (const m of data.members) {
    const a = recommend(m, data);
    const b = recommend(m, after);
    if (a.days !== b.days || a.periodStart !== b.periodStart) changed++;
  }
  const confirmed = new Set(data.grants.map((g) => g.member_id)).size;
  return { changed, confirmed };
}

// ── 직원별 연차: 입사일을 넣어 보면 올해·내년 연차(추천값) ──
export function hirePreview(hire: string, data: LeaveAdminData): string[] | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(hire) || Number.isNaN(Date.parse(hire)) || addMonths(hire, 0) !== hire) return null;
  if (data.settings.under_five) return ["5인 미만 회사로 되어 있어 법 기준 추천값이 없어요. 회사가 직접 정해요."];
  const member = { id: "preview", name: "미리보기", role: "employee" as const, hire_date: hire };
  const base = { ...data, members: [member], grants: [], days: [], holidays: [] };
  const y = data.year;
  const now = recommend(member, base);
  const next = recommend(member, { ...base, year: y + 1, today: `${y + 1}-12-31` });
  const show = (r: ReturnType<typeof recommend>, label: string) => {
    if (r.why === "not_yet") return `${label}: 아직 입사 전이에요`;
    if (r.days === null) return `${label}: 회사가 직접 정해요`;
    const range = data.settings.basis === "hire" ? ` (${md(r.periodStart)}~)` : "";
    return `${label}${range}: ${r.days}일`;
  };
  const thisLabel = data.today.slice(0, 4) === String(y) ? `${y}년 지금까지` : `${y}년`;
  return [`${show(now, thisLabel)} → ${show(next, `${y + 1}년`)}`, now.nextAccrual ? `다음 1일은 ${md(now.nextAccrual)}에 생겨요. 실제 일수는 회사가 확정해요.` : "추천값이에요. 실제 일수는 회사가 확정해요."];
}

// ── 기능 사용: 켜거나 끄면 우리 회사에서 바뀌는 것 ──
export function featurePreview(feature: "attendance" | "calendar", enabled: boolean, members: number): string[] {
  const who = members > 0 ? `직원 ${members}명` : "직원";
  if (feature === "attendance")
    return enabled
      ? [`끄면: ${who}의 [QR 출퇴근] 버튼과 출근 단말 QR이 멈추고, 설정의 [근태 정책]이 숨어요.`, "지금까지의 출퇴근·연차 기록은 지워지지 않아요."]
      : [`켜면: ${who}의 하단 가운데 버튼이 [QR 출퇴근]으로 바뀌고, 설정에 [근태 정책]이 생겨요.`];
  return enabled
    ? [`끄면: ${who} 화면과 관리자 메뉴에서 캘린더가 숨어요. 일정·회의실은 지워지지 않아요.`]
    : [`켜면: ${who}의 하단 메뉴와 관리자 메뉴에 [캘린더]가 생겨요.`];
}
