import { describe, expect, it } from "vitest";
import { suggestPurpose, templatePurpose } from "./purpose";

const item = (o: Partial<Parameters<typeof templatePurpose>[0]>) => ({ category: null, trip_type: null, purchase_type: null, paid_time: null, aiPurpose: null, ...o });
const normal = { isBusinessTrip: false, tripDestination: null, tripPurpose: null };

describe("지출 사유 초안", () => {
  it("AI 사유가 있으면 그대로", () => {
    expect(suggestPurpose(normal, [item({ category: "meeting", aiPurpose: "팀원 실무 회의 및 다과 진행" })])).toBe("팀원 실무 회의 및 다과 진행");
  });
  it("AI 사유가 없으면 분류별 표준 문구", () => {
    expect(suggestPurpose(normal, [item({ category: "purchase", purchase_type: "office_supplies" })])).toBe("사내 비품 및 소모품 구입");
    expect(suggestPurpose(normal, [item({ category: "meal", paid_time: "12:10" })])).toBe("부서 정기 점심 식사 진행");
    expect(suggestPurpose(normal, [item({ category: "meal", paid_time: "19:30" })])).toBe("부서 업무 연장 저녁 식사 진행");
  });
  it("같은 사유는 한 번, 여러 종류는 두 가지 + 등", () => {
    const a = item({ category: "meal", aiPurpose: "부서 정기 점심 식사 진행" });
    expect(suggestPurpose(normal, [a, a])).toBe("부서 정기 점심 식사 진행");
    expect(suggestPurpose(normal, [a, item({ category: "purchase", purchase_type: "pantry" }), item({ category: "meeting" })])).toBe("부서 정기 점심 식사 진행, 사내 탕비실 다과 및 음료 구입 등");
  });
  it("출장 결의서는 출장 목적 기준", () => {
    expect(suggestPurpose({ isBusinessTrip: true, tripDestination: "부산", tripPurpose: "부산 지사 분기 점검" }, [item({ category: "trip", trip_type: "meal" })])).toBe("부산 지사 분기 점검 관련 출장 경비");
    expect(suggestPurpose({ isBusinessTrip: true, tripDestination: "부산", tripPurpose: "" }, [])).toBe("부산 출장 경비");
  });
  it("영수증도 분류도 없으면 빈 값", () => {
    expect(suggestPurpose(normal, [item({})])).toBe("");
  });
});
