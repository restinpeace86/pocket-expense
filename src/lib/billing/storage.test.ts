import { describe, expect, it } from "vitest";
import { addonPrice, monthlyTotal, requestLabel, storageErrorText } from "./storage";

const addons = [
  { code: "gb10", storage_gb: 10, monthly_price: 10000 },
  { code: "gb25", storage_gb: 25, monthly_price: 20000 },
];

describe("저장 공간 추가(D-262)", () => {
  it("요금제 + 추가 공간 = 매월 결제 금액", () => {
    expect(monthlyTotal(29000, addons, 10)).toBe(39000);
    expect(monthlyTotal(29000, addons, 0)).toBe(29000);
    expect(addonPrice(addons, 99)).toBe(0);
  });
  it("신청 버튼: 새로·바꾸기·해지, 같으면 없음", () => {
    expect(requestLabel(0, 10)).toBe("10GB 공간 지금 신청");
    expect(requestLabel(10, 25)).toBe("25GB로 바꾸기 신청");
    expect(requestLabel(10, 0)).toBe("추가 공간 해지 신청");
    expect(requestLabel(10, 10)).toBeNull();
  });
  it("오류 문구", () => {
    expect(storageErrorText("ALREADY_REQUESTED")).toContain("신청 취소");
    expect(storageErrorText(undefined)).toContain("잠시 후");
  });
});
