import { describe, expect, it } from "vitest";
import { noEvidenceCheck, noEvidenceNotice } from "./evidence-penalty";

describe("증빙 없음 가산세 안내 (D-153)", () => {
  it("3만 원 이하는 가산세 대상 아님", () => {
    const n = noEvidenceNotice(30_000);
    expect(n.level).toBe("info");
    expect(n.text).toContain("가산세 대상은 아니에요");
  });
  it("3만 원 초과는 2% 금액과 함께 경고", () => {
    const n = noEvidenceNotice(150_000);
    expect(n.level).toBe("warn");
    expect(n.text).toContain("약 3,000원");
    expect(n.basis).toContain("최종 판단은 세무사");
  });
  it("금액이 없으면 일반 안내", () => {
    expect(noEvidenceNotice(null).text).toContain("금액을 넣으면");
    expect(noEvidenceNotice(0).level).toBe("info");
  });
  it("세무 엑셀 확인 표시", () => {
    expect(noEvidenceCheck("receipt", 50_000)).toBeNull();
    expect(noEvidenceCheck("none", 50_000)).toBe("증빙 없음(3만 원 초과·가산세 확인)");
    expect(noEvidenceCheck("none", 20_000)).toBe("증빙 없음(3만 원 이하)");
  });
});
