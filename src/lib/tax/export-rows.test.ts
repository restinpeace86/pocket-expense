import { describe, expect, it } from "vitest";
import { bizNo, checks, evidenceFile, evidenceNo, fileSafe, settlement, statusLabel, supplyVat, upload적요, type ExportRow } from "./export-rows";

const row = (o: Partial<ExportRow> = {}): ExportRow =>
  ({
    seq: 3, kind: "current", claim_id: "c1", claim_title: "부산 출장", claim_description: "부산 지사 점검", exception_memo: null, is_trip: true,
    trip_destination: "부산", trip_start: "2026-10-14", trip_end: "2026-10-15", trip_purpose: "점검", claim_status: "approved", self_approved: false,
    submitted_at: null, approved_at: null, paid_at: null, approvers: null, header_custom: {}, item_id: "i1", expense_date: "2026-10-15",
    merchant_name: "부산 국밥", merchant_business_number: "1234567890", evidence_type: "card_slip", supply_amount: 15455, vat_amount: 1545, amount: 17000,
    payment_method: "personal_card", card_nickname: null, card_last4: null, account_title_name: "여비교통비", account_title_code: null,
    category: "trip", trip_type: "meal", purchase_type: null, department: "영업팀", member_name: "김직원", position: null, employee_number: null,
    vehicle_number: null, purpose: null, headcount: 1, attendees: null, client_name: null, lodging_in: null, lodging_out: null,
    start_location: null, end_location: null, is_round_trip: null, route_one_way_km: null, distance_km: null, distance_source: null,
    applied_meal_limit_per_person: 10000, applied_fuel_rate_per_km: null, company_supported_amount: 10000, personal_burden_amount: 7000,
    receipt_path: "co/m/c1/i1.jpg", route_card_path: null, item_custom: {},
    ...o,
  }) as ExportRow;

describe("증빙 파일명 (D-052)", () => {
  it("증빙번호는 3자리, 1,000건 이상이면 4자리", () => {
    expect(evidenceNo("2026-10", 3, 50)).toBe("2026-10-003");
    expect(evidenceNo("2026-10", 3, 1200)).toBe("2026-10-0003");
  });
  it("{증빙번호}_{사용일자}_{가맹점}_{금액}.{확장자}, 가맹점은 쓸 수 없는 문자·공백 제거 20자", () => {
    expect(evidenceFile(row(), "2026-10", 50)).toEqual({ name: "2026-10-003_20261015_부산국밥_17000.jpg", path: "co/m/c1/i1.jpg" });
    expect(fileSafe('A/B:C*D?"E<F>G|H 아주 긴 가맹점 이름이 스무 자를 넘는 경우')).toBe("ABCDEFGH아주긴가맹점이름이스무자");
    expect(evidenceFile(row({ receipt_path: "co/m/c1/i1.pdf" }), "2026-10", 50)?.name.endsWith(".pdf")).toBe(true);
  });
  it("자차는 경로 요약 이미지, 영수증 없으면 null", () => {
    const car = row({ category: "trip", trip_type: "own_car", receipt_path: null, route_card_path: "co/route-cards/c1/i1.png", merchant_name: null, amount: 150800 });
    expect(evidenceFile(car, "2026-10", 5)?.name).toBe("2026-10-003_20261015_자차유류비_150800.png");
    expect(evidenceFile(row({ receipt_path: null }), "2026-10", 5)).toBeNull();
  });
});

describe("확인 필요·정산·상태", () => {
  it("확인 필요 표시", () => {
    expect(checks(row({ category: "condolence", amount: 300000, merchant_business_number: null }), true)).toContain("경조사비 20만원 초과");
    expect(checks(row({ category: "condolence", amount: 200000, merchant_business_number: null }), true)).not.toContain("경조사비 20만원 초과");
    expect(checks(row({ category: "condolence", amount: 100000, merchant_business_number: null }), true)).not.toContain("사업자번호 없음");
    expect(checks(row(), true)).toEqual([]);
    expect(checks(row({ merchant_business_number: null, supply_amount: null }), false)).toEqual(["사업자번호 없음", "부가세 미구분", "영수증 파일 없음"]);
    expect(checks(row({ trip_type: "own_car", distance_source: "manual" }), true)).toEqual(["적격증빙 없음(자차·경로 요약 첨부)", "직접 입력 거리"]);
  });
  it("정산: 개인카드 지급(회사지원금), 법인카드 납부(개인부담)", () => {
    expect(settlement(row())).toEqual({ kind: "지급", amount: 10000 });
    expect(settlement(row({ payment_method: "corporate_card" }))).toEqual({ kind: "납부", amount: 7000 });
    expect(settlement(row({ payment_method: "corporate_card", personal_burden_amount: 0 }))).toEqual({ kind: "", amount: 0 });
  });
  it("상태 이름", () => {
    expect(statusLabel(row())).toBe("승인");
    expect(statusLabel(row({ self_approved: true }))).toBe("승인(결재생략)");
    expect(statusLabel(row({ claim_status: "paid" }))).toBe("정산완료");
  });
});

describe("세무 업로드 초안 값", () => {
  it("사업자번호 형식, 부가세 미구분이면 공급가 = 합계", () => {
    expect(bizNo("1234567890")).toBe("123-45-67890");
    expect(supplyVat(row({ supply_amount: null }))).toEqual({ supply: 17000, vat: 0 });
  });
  it("적요: 지출 사유 + 항목 적요, 자차는 계산식", () => {
    expect(upload적요(row({ purpose: "점심" }))).toBe("부산 지사 점검 · 점심");
    expect(upload적요(row({ trip_type: "own_car", start_location: "판교역", end_location: "부산역", is_round_trip: true, route_one_way_km: 377, applied_fuel_rate_per_km: 200 }))).toBe(
      "자차 판교역→부산역 · 편도 377km × 200원 = 75,400원 × 2(왕복) = 150,800원",
    );
  });
});
