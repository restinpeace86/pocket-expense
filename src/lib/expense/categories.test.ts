import { describe, expect, it } from "vitest";
import { classificationLabel, MAPPING_ROWS } from "./categories";

describe("내부 분류", () => {
  it("매핑 표는 21개 (식대 1 + 출장 9 + 미팅 1 + 물품 구매 3 + 추가 7, D-102·D-106)", () => {
    expect(MAPPING_ROWS).toHaveLength(23); // 경조사비 내부·외부(D-123) + 출장 일비(D-124)
    expect(MAPPING_ROWS.filter((r) => r.category === "purchase").map((r) => r.purchaseType)).toEqual(["pantry", "office_supplies", "small_equipment"]);
  });
  it("이름", () => {
    expect(classificationLabel({ category: "trip", tripType: "taxi", purchaseType: null })).toBe("출장비 › 택시");
    expect(classificationLabel({ category: "purchase", tripType: null, purchaseType: "pantry" })).toBe("회사 물품 구매 › 탕비실·간식");
    expect(classificationLabel({ category: "meeting", tripType: null, purchaseType: null })).toBe("외부 미팅비");
  });
});
