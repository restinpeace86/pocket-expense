import { describe, expect, it } from "vitest";
import { itemAmounts } from "./amounts";

const split = { enabled: true, perPerson: 10000, mode: "split" as const };
const notify = { enabled: true, perPerson: 10000, mode: "notify" as const };
const off = { enabled: false, perPerson: 10000, mode: "split" as const };

// supabase/tests/013_claim_drafting.sql의 private.item_amounts 검사와 같은 사례
describe("itemAmounts (DB private.item_amounts와 같은 규칙)", () => {
  it("식대 한도 절사: 1인 10,000원 × 2명, 25,000원 → 지원 20,000 / 부담 5,000", () => {
    const r = itemAmounts({ category: "meal", tripType: null, amount: 25000, headcount: 2 }, split, null);
    expect(r).toMatchObject({ supported: 20000, burden: 5000, appliedLimit: 10000, appliedMode: "split", totalLimit: 20000, overLimit: 5000 });
  });
  it("한도 안이면 전액 지원", () => {
    expect(itemAmounts({ category: "meal", tripType: null, amount: 9000, headcount: 1 }, split, null)).toMatchObject({ supported: 9000, burden: 0 });
  });
  it("알림 모드는 전액 지원하고 초과분만 알려 준다", () => {
    expect(itemAmounts({ category: "meal", tripType: null, amount: 15000, headcount: 1 }, notify, null)).toMatchObject({ supported: 15000, burden: 0, overLimit: 5000 });
  });
  it("개인 예외 한도가 회사 한도보다 우선", () => {
    expect(itemAmounts({ category: "meal", tripType: null, amount: 15000, headcount: 1 }, split, 12000)).toMatchObject({ supported: 12000, burden: 3000, appliedLimit: 12000 });
  });
  it("출장 식비도 같은 한도, 다른 출장비는 전액", () => {
    expect(itemAmounts({ category: "trip", tripType: "meal", amount: 15000, headcount: 1 }, split, null).burden).toBe(5000);
    expect(itemAmounts({ category: "trip", tripType: "taxi", amount: 15000, headcount: 1 }, split, null)).toMatchObject({ supported: 15000, burden: 0, appliedLimit: null });
  });
  it("한도를 쓰지 않으면 전액, 인원이 없거나 0이면 1명으로", () => {
    expect(itemAmounts({ category: "meal", tripType: null, amount: 50000, headcount: 3 }, off, null)).toMatchObject({ supported: 50000, burden: 0, appliedLimit: null });
    expect(itemAmounts({ category: "meal", tripType: null, amount: 15000, headcount: 0 }, split, null).totalLimit).toBe(10000);
    expect(itemAmounts({ category: "meal", tripType: null, amount: 15000, headcount: null }, split, null).totalLimit).toBe(10000);
  });
  it("금액이 없으면 계산하지 않는다", () => {
    expect(itemAmounts({ category: "meal", tripType: null, amount: null, headcount: 1 }, split, null)).toMatchObject({ supported: null, burden: 0 });
  });
});
