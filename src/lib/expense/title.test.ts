import { describe, expect, it } from "vitest";
import { isAutoTitle, suggestTitle } from "./title";

const normal = { isBusinessTrip: false, tripDestination: null, tripStartDate: null };

describe("suggestTitle", () => {
  it("영수증 없으면 빈 제목", () => {
    expect(suggestTitle(normal, [])).toBe("");
  });
  it("1장: [카테고리] 가맹점 — 카테고리를 아직 안 골랐으면 가맹점만", () => {
    expect(suggestTitle(normal, [{ merchant_name: "메가커피 판교점", expense_date: "2026-10-16", category: "meeting" }])).toBe("[외부 미팅비] 메가커피 판교점");
    expect(suggestTitle(normal, [{ merchant_name: "메가커피 판교점", expense_date: "2026-10-16", category: null }])).toBe("메가커피 판교점");
  });
  it("여러 장: [대표 카테고리] 대표 가맹점 외 n건 (대표 = 가장 이른 사용일)", () => {
    expect(
      suggestTitle(normal, [
        { merchant_name: "이마트", expense_date: "2026-10-17", category: "purchase" },
        { merchant_name: "메가커피 판교점", expense_date: "2026-10-05", category: "meeting" },
      ]),
    ).toBe("[외부 미팅비] 메가커피 판교점 외 1건");
  });
  it("가맹점을 아직 못 읽었으면 '영수증', 자차는 '자차 이동'", () => {
    expect(suggestTitle(normal, [{ merchant_name: null, expense_date: null }])).toBe("영수증");
    expect(suggestTitle(normal, [{ merchant_name: null, expense_date: "2026-10-14", category: "trip", trip_type: "own_car" }])).toBe("[출장비] 자차 이동");
  });
  it("출장: {시작일} {출장지} 출장", () => {
    expect(suggestTitle({ isBusinessTrip: true, tripDestination: " 부산 ", tripStartDate: "2026-10-15" }, [])).toBe("10/15 부산 출장");
    expect(suggestTitle({ isBusinessTrip: true, tripDestination: "부산", tripStartDate: null }, [])).toBe("부산 출장");
  });
});

describe("isAutoTitle — 자동 제목이면 카테고리를 고를 때 따라 바뀐다", () => {
  const items = [{ merchant_name: "메가커피 판교점", expense_date: "2026-10-16", category: "meeting" as const }];
  it("자동 모양(카테고리 붙기 전·후, 예전 모양)은 자동", () => {
    expect(isAutoTitle("메가커피 판교점", normal, items)).toBe(true);
    expect(isAutoTitle("[일반 식대] 메가커피 판교점", normal, items)).toBe(true);
    expect(isAutoTitle("메가커피 판교점 지출", normal, items)).toBe(true);
    expect(isAutoTitle("", normal, items)).toBe(true);
  });
  it("영수증이 늘거나 대표가 바뀌기 전에 저장된 자동 제목도 자동", () => {
    const two = [...items, { merchant_name: "이마트", expense_date: "2026-10-01", category: "purchase" as const }];
    expect(isAutoTitle("메가커피 판교점", normal, two)).toBe(true);
    expect(isAutoTitle("[외부 미팅비] 메가커피 판교점 외 2건", normal, two)).toBe(true);
    expect(isAutoTitle("10/5 메가커피 판교점 외 1건", normal, two)).toBe(true);
  });
  it("직원이 쓴 제목은 그대로 둔다", () => {
    expect(isAutoTitle("A사 미팅 커피", normal, items)).toBe(false);
    expect(isAutoTitle("[긴급] 메가커피 판교점", normal, items)).toBe(false);
  });
  it("출장 자동 제목", () => {
    expect(isAutoTitle("10/14 부산 출장", { isBusinessTrip: true, tripDestination: "부산", tripStartDate: "2026-10-15" }, [])).toBe(true);
  });
});

describe("suggestTitle — 결의서 대표 카테고리 (D-098)", () => {
  const items = [
    { merchant_name: "메가커피 판교점", expense_date: "2026-10-16", category: "meal" as const },
    { merchant_name: "스타벅스", expense_date: "2026-10-17", category: "meal" as const },
  ];
  it("결의서 카테고리가 영수증 카테고리보다 먼저", () => {
    expect(suggestTitle({ ...normal, category: "meeting" }, items)).toBe("[외부 미팅비] 메가커피 판교점 외 1건");
    expect(suggestTitle({ ...normal, category: "purchase" }, items.slice(0, 1))).toBe("[회사 물품 구매] 메가커피 판교점");
  });
  it("출장: 영수증이 있으면 [출장비] 가맹점, 없으면 날짜·출장지", () => {
    const trip = { isBusinessTrip: true, tripDestination: "부산", tripStartDate: "2026-10-15", category: "trip" as const };
    expect(suggestTitle(trip, items)).toBe("[출장비] 메가커피 판교점 외 1건");
    expect(suggestTitle(trip, [])).toBe("10/15 부산 출장");
  });
  it("예전 자동 제목(출장·다른 카테고리)은 계속 자동", () => {
    expect(isAutoTitle("10/15 부산 출장", { isBusinessTrip: true, tripDestination: "부산", tripStartDate: "2026-10-15", category: "trip" }, items)).toBe(true);
    expect(isAutoTitle("[일반 식대] 메가커피 판교점 외 1건", { ...normal, category: "meeting" }, items)).toBe(true);
  });
});
