import { describe, expect, it } from "vitest";
import { findSettingsTab } from "./settings-groups";
import { groupStatus, minutesLabel, nextStep, progress, resumeStep, SETUP_STEPS, setupSteps, stepForPath, type SetupStatus } from "./setup-wizard";

describe("최초 1회 설정 단계(D-300)", () => {
  it("근태 끄면 17단계, 켜면 21단계(근태는 뒤에)", () => {
    expect(setupSteps(false)).toHaveLength(17);
    const on = setupSteps(true);
    expect(on).toHaveLength(21);
    expect(on.slice(-4).every((s) => s.group === "attendance")).toBe(true);
  });
  it("모든 단계 주소는 설정 탭이고 같은 그룹에 속한다", () => {
    for (const s of SETUP_STEPS) {
      const hit = findSettingsTab(s.href);
      expect(hit?.tab.href, s.key).toBe(s.href);
      expect(hit?.group.key, s.key).toBe(s.group);
    }
    expect(new Set(SETUP_STEPS.map((s) => s.key)).size).toBe(SETUP_STEPS.length);
    for (const s of SETUP_STEPS) expect(s.key).toMatch(/^[a-z][a-z0-9-]{1,39}$/);
  });
  it("주소로 단계 찾기: 정확히 같은 주소만, 쿼리·끝 / 무시", () => {
    expect(stepForPath("/settings", false)?.key).toBe("company-info");
    expect(stepForPath("/settings/meal?x=1", false)?.key).toBe("meal");
    expect(stepForPath("/vehicles/", false)?.key).toBe("vehicles");
    expect(stepForPath("/billing", false)).toBeNull();
    expect(stepForPath("/attendance-settings", false)).toBeNull();
    expect(stepForPath("/attendance-settings", true)?.key).toBe("att-rules");
    expect(stepForPath("/attendance-settings/history", true)).toBeNull();
  });
  it("진행률 = (완료 + 건너뜀) / 전체", () => {
    const statuses: Record<string, SetupStatus> = { "company-info": "done", departments: "done", "tax-office": "skipped", cards: "done", vehicles: "skipped", rooms: "done", features: "done" };
    const p = progress({ statuses }, false);
    expect(p.handled).toBe(7);
    expect(p.done).toBe(5);
    expect(p.skipped.map((s) => s.key)).toEqual(["tax-office", "vehicles"]);
    expect(p.percent).toBe(41);
    expect(p.allHandled).toBe(false);
    const all = Object.fromEntries(setupSteps(false).map((s) => [s.key, "skipped" as const]));
    expect(progress({ statuses: all }, false).percent).toBe(100);
    expect(progress({ statuses: all }, true).percent).toBe(81); // 근태 켜면 4단계가 더 남음
  });
  it("이어서 하기: 안 본 첫 단계 → 없으면 건너뛴 첫 단계 → 없으면 null", () => {
    expect(resumeStep({ statuses: {} }, false)?.key).toBe("company-info");
    expect(resumeStep({ statuses: { "company-info": "done", departments: "skipped" } }, false)?.key).toBe("tax-office");
    const all = Object.fromEntries(setupSteps(false).map((s) => [s.key, "done" as SetupStatus]));
    expect(resumeStep({ statuses: all }, false)).toBeNull();
    expect(resumeStep({ statuses: { ...all, budget: "skipped" } }, false)?.key).toBe("budget");
  });
  it("다음 단계: 뒤에서 완료 안 한 첫 단계 → 없으면 앞쪽 안 본 단계 → null", () => {
    expect(nextStep("cards", { cards: "done" }, false)?.key).toBe("vehicles");
    expect(nextStep("cards", { cards: "done", vehicles: "done" }, false)?.key).toBe("rooms");
    const allButFirst = Object.fromEntries(setupSteps(false).slice(1).map((s) => [s.key, "done" as SetupStatus]));
    expect(nextStep("files", allButFirst, false)?.key).toBe("company-info");
    const all = Object.fromEntries(setupSteps(false).map((s) => [s.key, "done" as SetupStatus]));
    expect(nextStep("files", all, false)).toBeNull();
    expect(nextStep("files", { ...all, files: "done" }, true)?.key).toBe("att-rules");
  });
  it("메뉴 상태: ✓ / 건너뜀 수", () => {
    expect(groupStatus("assets", { cards: "done", vehicles: "skipped", rooms: "done" }, false)).toEqual({ total: 3, handled: 3, skipped: 1, complete: true });
    expect(groupStatus("billing", {}, false)).toBeNull();
    expect(groupStatus("attendance", {}, false)).toBeNull();
  });
  it("시간 표시", () => {
    expect(minutesLabel(0)).toBe("곧 끝나요");
    expect(minutesLabel(3)).toBe("약 3분");
    expect(minutesLabel(18)).toBe("약 20분");
    expect(minutesLabel(progress({ statuses: {} }, false).minutesTotal)).toBe("약 20분");
  });
});
