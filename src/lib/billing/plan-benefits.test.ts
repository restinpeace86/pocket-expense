import { describe, expect, it } from "vitest";
import { COMMON_FEATURES, planBenefits, PRICING_RULES, storageLabel } from "./plan-benefits";

// 요금 카드 혜택 구조(D-198)
describe("플랜 혜택", () => {
  it("혜택: 인원 제한 없음(D-270) · AI 영수증 읽기 · 모든 기능", () => {
    const pro = planBenefits({ monthly_price: 49000, monthly_receipts: 400, max_members: 20 });
    expect(pro.map((b) => b.label)).toEqual(["직원 수 제한 없음", "AI 영수증 읽기 월 최대 400장 지원", "모든 기능 포함"]);
    expect(pro[0].sub).toBe("직원이 늘어도 요금 그대로");
    // D-261: 장당 가격 없음
    expect(pro[1].sub).toBe("같은 가격에 포함 · 매월 1일 새로 채워져요");
    expect(pro.some((b) => /1인당|최대 \d+명/.test(`${b.label} ${b.sub ?? ""}`))).toBe(false);
  });
  it("서류 변환 줄은 짧게(D-270)", () => {
    const s = planBenefits({ monthly_price: 29000, monthly_receipts: 150, max_members: null, monthly_doc_converts: 20 });
    expect(s.find((b) => b.label.startsWith("서류"))).toEqual({ label: "서류 → 엑셀 변환 월 20건", sub: "매월 1일 새로 채워져요" });
  });
  it("채팅 첨부 저장 한도가 있으면 3번째 줄(D-204): 1GB / 3GB / 10GB", () => {
    expect(storageLabel(1024)).toBe("1GB");
    expect(storageLabel(3072)).toBe("3GB");
    expect(storageLabel(10240)).toBe("10GB");
    const starter = planBenefits({ monthly_price: 29000, monthly_receipts: 150, max_members: 10, chat_storage_mb: 1024 });
    expect(starter.map((b) => b.label)).toEqual(["직원 수 제한 없음", "AI 영수증 읽기 월 최대 150장 지원", "사내 채팅 사진·파일 저장 1GB", "모든 기능 포함"]);
    expect(starter[2].sub).toBe("사진·파일 보관 30·60·90일 중 선택");
  });
  it("영구 보관 한도가 있으면 채팅 줄 다음(D-245)", () => {
    const starter = planBenefits({ monthly_price: 29000, monthly_receipts: 150, max_members: 10, chat_storage_mb: 1024, vault_storage_mb: 1024 });
    expect(starter[3]).toEqual({ label: "파일 영구 보관 1GB", sub: "채팅 파일 중 [영구 보관]한 것은 지울 때까지" });
  });
  it("공통 기능은 지금 있는 기능만(7개), 요금 기준 7줄(D-199·D-201)", () => {
    expect(COMMON_FEATURES).toHaveLength(7);
    expect(PRICING_RULES).toHaveLength(7); // D-270 인원 3줄 → 1줄
    expect(PRICING_RULES.join(" ")).toContain("인원 제한이 없어요");
  });
});
