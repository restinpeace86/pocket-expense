import { describe, expect, it } from "vitest";
import { COMMON_FEATURES, perMember, planBenefits } from "./plan-benefits";

// 요금 카드 혜택 구조(D-198)
describe("플랜 혜택", () => {
  it("직원 수가 있으면 1인당 가격, 없으면 제한 없음", () => {
    expect(perMember({ monthly_price: 29000, monthly_receipts: 150, max_members: 10 })).toBe(2900);
    expect(perMember({ monthly_price: 49000, monthly_receipts: 400, max_members: 20 })).toBe(2450);
    expect(perMember({ monthly_price: 89000, monthly_receipts: 800, max_members: null })).toBeNull();
  });
  it("혜택 3줄: 직원 · AI 영수증 읽기 · 모든 기능", () => {
    const pro = planBenefits({ monthly_price: 49000, monthly_receipts: 400, max_members: 20 });
    expect(pro.map((b) => b.label)).toEqual(["직원 최대 20명", "AI 영수증 읽기 월 400장", "모든 기능 포함"]);
    expect(pro[0].sub).toBe("1인당 월 약 2,450원");
    expect(pro[1].sub).toBe("장당 약 123원");
    expect(planBenefits({ monthly_price: 89000, monthly_receipts: 800, max_members: null })[0]).toEqual({ label: "직원 수 제한 없음", sub: "인원이 늘어도 같은 가격" });
  });
  it("공통 기능은 지금 있는 기능만(7개)", () => {
    expect(COMMON_FEATURES).toHaveLength(7);
  });
});
