// 관리자 설정 8개 메뉴(D-251, todo_improvement 개선사항 1): 7개 그룹 + 요금제
// 왼쪽 메뉴는 그룹만, 그룹 화면 위 탭이 하위 영역. 탭 주소는 기존 화면 주소를 그대로 쓴다(예전 링크가 맞는 탭으로 열림)
export type SettingsTab = { href: string; label: string };
export type SettingsGroupKey = "company" | "assets" | "features" | "policy" | "attendance" | "forms" | "files" | "billing";
export type SettingsGroup = { key: SettingsGroupKey; label: string; tabs: SettingsTab[]; attendanceOnly?: boolean };

export const SETTINGS_GROUPS: SettingsGroup[] = [
  {
    key: "company",
    label: "회사 기본정보",
    tabs: [
      { href: "/settings", label: "회사정보" },
      { href: "/settings/location", label: "회사 위치" },
      { href: "/departments", label: "부서" },
      { href: "/tax-office", label: "세무사무소" },
    ],
  },
  {
    key: "assets",
    label: "회사 자산",
    tabs: [
      { href: "/corporate-cards", label: "법인카드" },
      { href: "/vehicles", label: "회사차량" },
      { href: "/calendar-settings", label: "회의실" },
    ],
  },
  { key: "features", label: "기능 사용", tabs: [{ href: "/features", label: "기능 사용" }] },
  {
    key: "policy",
    label: "경비 정책",
    tabs: [
      { href: "/settings/meal", label: "식대 한도" },
      { href: "/settings/fuel", label: "자차 유류비" },
      { href: "/settings/per-diem", label: "출장 일비" },
      { href: "/recurring", label: "정기 결제" },
      { href: "/settings/closing", label: "마감 일정" },
    ],
  },
  {
    key: "attendance",
    label: "근태 정책",
    attendanceOnly: true,
    tabs: [
      { href: "/attendance-settings/leave", label: "직원별 연차" },
      { href: "/attendance-settings/vacation-types", label: "휴가 종류" },
      { href: "/attendance-settings", label: "근무 기준" },
      { href: "/attendance-settings/terminals", label: "출근 단말" },
      { href: "/attendance-settings/history", label: "변경 이력" },
    ],
  },
  {
    key: "forms",
    label: "양식·결재",
    tabs: [
      { href: "/form-template", label: "지출결의서 양식" },
      { href: "/company-forms", label: "회사 양식" },
      { href: "/approval-lines", label: "사전 검토 결재라인" },
    ],
  },
  { key: "files", label: "파일 보관", tabs: [{ href: "/chat-settings", label: "파일 보관" }] },
  { key: "billing", label: "요금제", tabs: [{ href: "/billing", label: "요금제" }] },
];

// rest = 관리자 주소에서 `/workspace/{id}/admin` 뒤 부분. 가장 길게 맞는 탭을 고른다(/settings vs /settings/meal)
export function findSettingsTab(rest: string): { group: SettingsGroup; tab: SettingsTab } | null {
  let best: { group: SettingsGroup; tab: SettingsTab } | null = null;
  for (const group of SETTINGS_GROUPS) {
    for (const tab of group.tabs) {
      if ((rest === tab.href || rest.startsWith(`${tab.href}/`)) && (!best || tab.href.length > best.tab.href.length)) best = { group, tab };
    }
  }
  return best;
}

export function visibleGroups(attendanceOn: boolean): SettingsGroup[] {
  return SETTINGS_GROUPS.filter((g) => !g.attendanceOnly || attendanceOn);
}
