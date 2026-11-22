// 최초 1회 설정(설정 마법사, D-300 · U-1 A안): 설정 메뉴를 순서대로 한 번 훑는 단계 목록
// 진행률 = (완료 + 건너뜀) / 전체 단계(사용자 2026-11-22). 근태 정책 단계는 근태를 켠 회사만 뒤에 붙는다
// 요금제·근태 변경 이력은 정하는 화면이 아니라서 뺐다. 기록은 DB setup_wizard_steps(회사 단위)
import type { SettingsGroupKey } from "./settings-groups";

export type SetupStep = { key: string; group: SettingsGroupKey; groupLabel: string; label: string; href: string; minutes: number; why: string; attendanceOnly?: boolean };
export type SetupStatus = "done" | "skipped";
export type SetupState = { legacy: boolean; introAnswered: boolean; finished: boolean; statuses: Record<string, SetupStatus> };

export const SETUP_STEPS: SetupStep[] = [
  { key: "company-info", group: "company", groupLabel: "회사 기본정보", label: "회사정보", href: "/settings", minutes: 1, why: "회사를 구분하는 기본 정보예요. 회사 위치를 넣어 두면 직원 홈 [주변 버스]가 회사 근처 정류장을 보여 줘요." },
  { key: "departments", group: "company", groupLabel: "회사 기본정보", label: "부서", href: "/departments", minutes: 1, why: "직원이 가입할 때 고르는 부서 목록이에요. 부서가 없는 회사는 건너뛰세요." },
  { key: "tax-office", group: "company", groupLabel: "회사 기본정보", label: "세무사무소", href: "/tax-office", minutes: 1, why: "계약한 세무사무소를 지정하면 사무소가 승인된 지출과 세무용 엑셀을 직접 확인해요. 아직 정하지 않았으면 건너뛰세요." },
  { key: "cards", group: "assets", groupLabel: "회사 자산", label: "법인카드", href: "/corporate-cards", minutes: 2, why: "법인카드 앞 6자리와 뒤 4자리를 등록해 두면 영수증에서 법인카드인지 개인카드인지 자동으로 골라 줘요." },
  { key: "vehicles", group: "assets", groupLabel: "회사 자산", label: "회사차량", href: "/vehicles", minutes: 1, why: "회사 명의 차량을 등록해 두면 직원이 결의서에서 어느 차에 쓴 돈인지 골라요. 회사 차량이 없으면 건너뛰세요." },
  { key: "rooms", group: "assets", groupLabel: "회사 자산", label: "회의실", href: "/calendar-settings", minutes: 1, why: "캘린더에서 예약할 회의실을 등록해요. 회의실이 없으면 건너뛰세요." },
  { key: "features", group: "features", groupLabel: "기능 사용", label: "기능 사용", href: "/features", minutes: 1, why: "회사 전체에 켜고 끄는 기능이에요. 출퇴근·연차(근태)도 쓸 거면 여기서 켜 주세요. 켜면 근태 설정 4단계가 뒤에 붙어요." },
  { key: "meal", group: "policy", groupLabel: "경비 정책", label: "식대 한도", href: "/settings/meal", minutes: 1, why: "한 끼 식사에 직원 1명당 회사가 지원하는 금액이에요. 기본값 그대로 써도 돼요." },
  { key: "fuel", group: "policy", groupLabel: "경비 정책", label: "자차 유류비", href: "/settings/fuel", minutes: 1, why: "직원이 자기 차로 출장 갔을 때 주는 기름값 계산 방법이에요. 기본값 그대로 써도 돼요." },
  { key: "per-diem", group: "policy", groupLabel: "경비 정책", label: "출장 일비", href: "/settings/per-diem", minutes: 1, why: "출장 하루마다 영수증 없이 주는 정해진 금액이에요. 일비가 없는 회사는 건너뛰세요." },
  { key: "budget", group: "policy", groupLabel: "경비 정책", label: "예산", href: "/settings/budget", minutes: 1, why: "예산을 정하면 80%·100%를 넘을 때 [알림]방으로 알려 드려요. 결재를 막지는 않아요. 예산을 따로 안 정하면 건너뛰세요." },
  { key: "recurring", group: "policy", groupLabel: "경비 정책", label: "정기 결제", href: "/recurring", minutes: 1, why: "노션·구글 같은 구독료를 등록해 두면 법인카드 내역 대조에서 실제 결제와 맞춰 결의서를 만들어요. 없으면 건너뛰세요." },
  { key: "closing", group: "policy", groupLabel: "경비 정책", label: "마감 일정", href: "/settings/closing", minutes: 1, why: "직원이 언제까지 경비를 올려야 하는지 정해요. 기본 일정 그대로 써도 돼요." },
  { key: "form-template", group: "forms", groupLabel: "양식·결재", label: "지출결의서 양식", href: "/form-template", minutes: 1, why: "결재·보관용 지출결의서 문서 모양을 정해요. 기본 양식 그대로 써도 돼요." },
  { key: "company-forms", group: "forms", groupLabel: "양식·결재", label: "회사 양식", href: "/company-forms", minutes: 1, why: "회사에서 쓰던 휴가신청서·결재 문서를 등록하면 결재가 끝난 문서가 그 모양으로 나와요. 없으면 건너뛰세요." },
  { key: "approval-lines", group: "forms", groupLabel: "양식·결재", label: "사전 검토 결재라인", href: "/approval-lines", minutes: 1, why: "관리자 승인 전에 팀장 같은 사람이 먼저 확인하게 하려면 검토자를 넣어요. 넣지 않으면 관리자에게 바로 가요." },
  { key: "files", group: "files", groupLabel: "파일 보관", label: "파일 보관", href: "/chat-settings", minutes: 1, why: "채팅 사진·파일과 회의 자료의 보관 기간을 정해요. 기본값 그대로 써도 돼요." },
  { key: "att-rules", group: "attendance", groupLabel: "근태 정책", label: "근무 기준", href: "/attendance-settings", minutes: 2, why: "근무하는 요일·시각과 퇴근을 잊었을 때 알릴 시간을 정해요. 이게 있어야 출퇴근 기록이 맞게 보여요.", attendanceOnly: true },
  { key: "att-vtypes", group: "attendance", groupLabel: "근태 정책", label: "휴가 종류", href: "/attendance-settings/vacation-types", minutes: 1, why: "우리 회사에서 쓰는 휴가를 켜고 끄고, 연차가 모자랄 때 어떻게 할지 정해요.", attendanceOnly: true },
  { key: "att-leave", group: "attendance", groupLabel: "근태 정책", label: "직원별 연차", href: "/attendance-settings/leave", minutes: 2, why: "근로기준법 기준으로 직원마다 연차 일수를 계산해 보여 줘요. 회사가 확인하고 확정해요.", attendanceOnly: true },
  { key: "att-terminals", group: "attendance", groupLabel: "근태 정책", label: "출근 단말", href: "/attendance-settings/terminals", minutes: 1, why: "회사 입구 PC·태블릿을 출근 단말로 연결해 QR을 띄워요. 휴대폰으로만 출근을 찍으면 건너뛰세요.", attendanceOnly: true },
];

export function setupSteps(attendanceOn: boolean): SetupStep[] {
  return SETUP_STEPS.filter((s) => !s.attendanceOnly || attendanceOn);
}

// rest = `/workspace/{id}/admin` 뒤 주소. 주소가 정확히 같은 단계(탭 주소는 서로 겹치지 않게 정확히 비교)
export function stepForPath(rest: string, attendanceOn: boolean): SetupStep | null {
  const path = rest.split(/[?#]/)[0].replace(/\/$/, "");
  return setupSteps(attendanceOn).find((s) => s.href === path) ?? null;
}

export function progress(state: Pick<SetupState, "statuses">, attendanceOn: boolean) {
  const steps = setupSteps(attendanceOn);
  const handled = steps.filter((s) => state.statuses[s.key]);
  const skipped = handled.filter((s) => state.statuses[s.key] === "skipped");
  const left = steps.filter((s) => !state.statuses[s.key]);
  return {
    total: steps.length,
    handled: handled.length,
    done: handled.length - skipped.length,
    skipped,
    percent: steps.length ? Math.round((handled.length / steps.length) * 100) : 100,
    minutesLeft: left.reduce((n, s) => n + s.minutes, 0),
    minutesTotal: steps.reduce((n, s) => n + s.minutes, 0),
    allHandled: left.length === 0,
  };
}

// 이어서 할 단계: 아직 안 본 첫 단계 → 없으면 건너뛴 첫 단계 → 없으면 null(다 끝남)
export function resumeStep(state: Pick<SetupState, "statuses">, attendanceOn: boolean): SetupStep | null {
  const steps = setupSteps(attendanceOn);
  return steps.find((s) => !state.statuses[s.key]) ?? steps.find((s) => state.statuses[s.key] === "skipped") ?? null;
}

// [완료하고 다음]·[건너뛰기] 뒤 갈 단계: 지금 단계 뒤에서 아직 완료 안 한(안 봤거나 건너뛴) 첫 단계. 없으면 앞쪽에서 안 본 단계, 그것도 없으면 null
export function nextStep(currentKey: string, statuses: Record<string, SetupStatus>, attendanceOn: boolean): SetupStep | null {
  const steps = setupSteps(attendanceOn);
  const i = steps.findIndex((s) => s.key === currentKey);
  return steps.slice(i + 1).find((s) => statuses[s.key] !== "done") ?? steps.slice(0, Math.max(i, 0)).find((s) => !statuses[s.key]) ?? null;
}

// 메뉴(그룹)별 상태: 단계가 다 처리됐는지, 건너뛴 수
export function groupStatus(group: SettingsGroupKey, statuses: Record<string, SetupStatus>, attendanceOn: boolean) {
  const steps = setupSteps(attendanceOn).filter((s) => s.group === group);
  if (!steps.length) return null;
  const handled = steps.filter((s) => statuses[s.key]).length;
  const skipped = steps.filter((s) => statuses[s.key] === "skipped").length;
  return { total: steps.length, handled, skipped, complete: handled === steps.length };
}

export function minutesLabel(m: number): string {
  if (m <= 0) return "곧 끝나요";
  return `약 ${m >= 10 ? Math.round(m / 5) * 5 : m}분`;
}
