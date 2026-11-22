import { describe, expect, it } from "vitest";
import { findSettingsTab } from "./settings-groups";
import { areaLabel, attendanceMenu, mergeHistory, parseArea } from "./change-history";

describe("설정 › 변경 이력(D-303)", () => {
  it("두 표를 시간순(최신 먼저)으로 합치고 개수를 자른다", () => {
    const s = [
      { id: 1, at: "2026-11-22T01:00:00+00:00", member_name: "대표", area: "policy", menu: "식대 한도", action: "change", target: null, changes: [{ label: "1식 1인당 한도", from: "11,000원", to: "12,000원" }] },
      { id: 2, at: "2026-11-22T03:00:00+00:00", member_name: null, area: "company", menu: "부서", action: "add", target: "영업팀", changes: [] },
    ];
    const a = [{ id: 9, at: "2026-11-22T02:00:00.5+00:00", member_name: "대표", action: "terminal_add", changes: [{ label: "단말", from: null, to: "1층" }] }];
    const m = mergeHistory(s, a);
    expect(m.map((x) => x.key)).toEqual(["s2", "a9", "s1"]);
    expect(m[0].who).toBe("알 수 없음");
    expect(m[1]).toMatchObject({ area: "attendance", menu: "출근 단말", action: "add", who: "대표" });
    expect(m[2].changes[0]).toEqual({ label: "1식 1인당 한도", from: "11,000원", to: "12,000원", reason: null });
    expect(mergeHistory(s, a, 2)).toHaveLength(2);
  });
  it("모르는 값·깨진 changes는 안전하게", () => {
    const m = mergeHistory([{ id: 1, at: "2026-11-22T01:00:00Z", member_name: "x", area: "billing", menu: "?", action: "add", target: null, changes: null }], [{ id: 2, at: "2026-11-22T01:00:00Z", member_name: null, action: "weird", changes: "x" }]);
    expect(m).toHaveLength(1);
    expect(m[0]).toMatchObject({ menu: "근태 정책", action: "change", who: "시스템", changes: [] });
  });
  it("근태 설정 저장: 연차 기준만 바꿨으면 직원별 연차", () => {
    expect(attendanceMenu("settings", [{ label: "연차 연도 기준", from: "a", to: "b" }])).toBe("직원별 연차");
    expect(attendanceMenu("settings", [{ label: "정규 출근", from: "a", to: "b" }, { label: "5인 미만 회사", from: "a", to: "b" }])).toBe("근무 기준");
    expect(attendanceMenu("leave_type", [])).toBe("휴가 종류");
  });
  it("메뉴 거르기 값과 이름", () => {
    expect(parseArea("policy")).toBe("policy");
    expect(parseArea(["forms"])).toBe("forms");
    expect(parseArea("billing")).toBeNull();
    expect(parseArea(undefined)).toBeNull();
    expect(areaLabel("policy")).toBe("경비 정책");
    expect(findSettingsTab("/change-history")?.group.key).toBe("history");
  });
});
