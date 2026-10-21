import { describe, expect, it } from "vitest";
import { categoryBars, changePct, checklist } from "./dashboard";

describe("관리자 홈 계산", () => {
  it("전월 대비 %: 소수 첫째 자리, 전월 0이면 비교 안 함", () => {
    expect(changePct(118400, 59200)).toBe(100);
    expect(changePct(90000, 100000)).toBe(-10);
    expect(changePct(10000, 0)).toBeNull();
  });
  it("카테고리 막대: 출장비는 세부 유형 쌓기, 비중 %", () => {
    const bars = categoryBars([
      { category: "trip", trip_type: "own_car", amount: 75400, count: 1 },
      { category: "meal", trip_type: null, amount: 23000, count: 2 },
      { category: "trip", trip_type: "lodging", amount: 80000, count: 1 },
      { category: "meeting", trip_type: null, amount: 20000, count: 1 },
    ]);
    expect(bars.map((b) => [b.label, b.amount, b.share])).toEqual([
      ["출장비", 155400, 78.3],
      ["일반 식대", 23000, 11.6],
      ["외부 미팅비", 20000, 10.1],
    ]);
    expect(bars[0].parts).toEqual([
      { label: "숙박", amount: 80000 },
      { label: "자차 유류비", amount: 75400 },
    ]);
  });
  it("체크리스트: 승인 직원 2명 이상이면 초대 끝, 결재라인은 선택", () => {
    const c = checklist({ approved_members: 1, departments: 1, policy_confirmed: false, review_steps: 0 });
    expect(c.filter((x) => !x.done && !x.optional).map((x) => x.key)).toEqual(["invite", "policy"]);
    expect(c.find((x) => x.key === "review")?.optional).toBe(true);
  });
});
