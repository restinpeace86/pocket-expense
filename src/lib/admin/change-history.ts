// 설정 › 변경 이력(D-303, 벤치마킹 B-2): settings_history(근태 밖 설정) + attendance_history(근태)를 시간순으로 합쳐 보여 준다
// 두 표는 그대로 두고 화면에서만 합친다(데이터를 옮기거나 겹쳐 쓰지 않음 — migration 172 머리말)
import { SETTINGS_GROUPS, type SettingsGroupKey } from "./settings-groups";

export type HistoryChange = { label: string; from: string | null; to: string | null; reason?: string | null };
export type HistoryArea = Exclude<SettingsGroupKey, "billing" | "history">;
export type HistoryItem = { key: string; at: string; who: string; area: HistoryArea; menu: string; action: "add" | "change" | "remove"; target: string | null; changes: HistoryChange[] };

export type SettingsHistoryRow = { id: number; at: string; member_name: string | null; area: string; menu: string; action: string; target: string | null; changes: unknown };
export type AttendanceHistoryRaw = { id: number; at: string; member_name: string | null; action: string; changes: unknown };

export const HISTORY_AREAS: HistoryArea[] = ["company", "assets", "features", "policy", "attendance", "forms", "files"];
export const HISTORY_LIMIT = 100;

export function areaLabel(a: HistoryArea): string {
  return SETTINGS_GROUPS.find((g) => g.key === a)?.label ?? a;
}
export function parseArea(v: string | string[] | undefined): HistoryArea | null {
  const s = Array.isArray(v) ? v[0] : v;
  return HISTORY_AREAS.includes(s as HistoryArea) ? (s as HistoryArea) : null;
}

// 근태 이력의 action → 근태 정책 탭 이름(attendance-admin ACTION_LABEL과 같은 말)
const ATT_MENU: Record<string, string> = { enabled: "근태 켜기·끄기", settings: "근무 기준", terminal_add: "출근 단말", terminal_rename: "출근 단말", terminal_revoke: "출근 단말", hire_date: "직원별 연차", leave_grant: "직원별 연차", leave_type: "휴가 종류" };
// 연차 연도 기준·5인 미만 회사만 바꾼 근무 설정 저장은 [직원별 연차] 탭에서 한 것(D-308 U-14)
const LEAVE_LABELS = new Set(["연차 연도 기준", "5인 미만 회사"]);
export function attendanceMenu(action: string, changes: HistoryChange[]): string {
  if (action === "settings" && changes.length > 0 && changes.every((c) => LEAVE_LABELS.has(c.label))) return "직원별 연차";
  return ATT_MENU[action] ?? "근태 정책";
}
const ATT_ACTION: Record<string, HistoryItem["action"]> = { terminal_add: "add", terminal_revoke: "remove" };

function changesOf(v: unknown): HistoryChange[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((c): c is Record<string, unknown> => !!c && typeof c === "object")
    .map((c) => ({ label: String(c.label ?? ""), from: c.from == null ? null : String(c.from), to: c.to == null ? null : String(c.to), reason: c.reason == null ? null : String(c.reason) }));
}

export function mergeHistory(settings: SettingsHistoryRow[], attendance: AttendanceHistoryRaw[], limit = HISTORY_LIMIT): HistoryItem[] {
  const a: HistoryItem[] = settings
    .filter((r) => HISTORY_AREAS.includes(r.area as HistoryArea) && r.area !== "attendance")
    .map((r) => ({
      key: `s${r.id}`,
      at: r.at,
      who: r.member_name ?? "알 수 없음",
      area: r.area as HistoryArea,
      menu: r.menu,
      action: r.action === "add" || r.action === "remove" ? r.action : "change",
      target: r.target,
      changes: changesOf(r.changes),
    }));
  const b: HistoryItem[] = attendance.map((r) => ({
    key: `a${r.id}`,
    at: r.at,
    who: r.member_name ?? "시스템",
    area: "attendance",
    menu: attendanceMenu(r.action, changesOf(r.changes)),
    action: ATT_ACTION[r.action] ?? "change",
    target: null,
    changes: changesOf(r.changes),
  }));
  return [...a, ...b].sort((x, y) => Date.parse(y.at) - Date.parse(x.at) || y.key.localeCompare(x.key)).slice(0, limit);
}

export const ACTION_WORD: Record<HistoryItem["action"], string> = { add: "추가", change: "변경", remove: "삭제" };
