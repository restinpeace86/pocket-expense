import { describe, expect, it } from "vitest";
import { suggestTitle } from "./title";

const normal = { isBusinessTrip: false, tripDestination: null, tripStartDate: null };

describe("suggestTitle", () => {
  it("영수증 없으면 빈 제목", () => {
    expect(suggestTitle(normal, [])).toBe("");
  });
  it("1장: {가맹점} 지출", () => {
    expect(suggestTitle(normal, [{ merchant_name: "스타벅스 강남점", expense_date: "2026-10-16" }])).toBe("스타벅스 강남점 지출");
  });
  it("여러 장: 가장 이른 사용일·가맹점 외 n건", () => {
    expect(
      suggestTitle(normal, [
        { merchant_name: "이마트", expense_date: "2026-10-17" },
        { merchant_name: "김밥천국", expense_date: "2026-10-05" },
        { merchant_name: null, expense_date: null },
      ]),
    ).toBe("10/5 김밥천국 외 2건");
  });
  it("가맹점을 아직 못 읽었으면 '영수증'", () => {
    expect(suggestTitle(normal, [{ merchant_name: null, expense_date: null }])).toBe("영수증 지출");
  });
  it("출장: {시작일} {출장지} 출장", () => {
    expect(suggestTitle({ isBusinessTrip: true, tripDestination: " 부산 ", tripStartDate: "2026-10-15" }, [])).toBe("10/15 부산 출장");
    expect(suggestTitle({ isBusinessTrip: true, tripDestination: "부산", tripStartDate: null }, [])).toBe("부산 출장");
  });
  it("출장지를 아직 안 적었으면 영수증 기준", () => {
    expect(suggestTitle({ isBusinessTrip: true, tripDestination: "", tripStartDate: null }, [{ merchant_name: "KTX", expense_date: "2026-10-15" }])).toBe("KTX 지출");
  });
});
