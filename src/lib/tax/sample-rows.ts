import type { ExportRow } from "./export-rows";

// 결산 양식 화면 미리보기용 예시 지출 3건(D-186) — 법인카드 1건 + 사비 2건. 실제 회사 데이터가 아님
const base: ExportRow = {
  seq: 1, kind: "current", claim_id: "7c41e2a9-0d3b-4f6e-9a12-5b8c3d7e1f20", claim_title: "10월 영업팀 경비", claim_description: "영업팀 점심 식대", exception_memo: null, is_trip: false,
  trip_destination: null, trip_start: null, trip_end: null, trip_purpose: null, claim_status: "approved", self_approved: false,
  submitted_at: "2026-10-28T01:00:00Z", approved_at: "2026-10-29T02:00:00Z", paid_at: null, approvers: "박팀장 → 김대표", header_custom: {},
  item_id: "a83f1c55-2e9d-4b70-8c16-0f4d2b9e6a31", expense_date: "2026-10-07", merchant_name: "한솥식당 역삼점", merchant_business_number: "2208162517", evidence_type: "card_slip",
  supply_amount: 30000, vat_amount: 3000, amount: 33000, payment_method: "corporate_card", card_nickname: "영업팀 카드", card_last4: "1234",
  account_title_name: "복리후생비", account_title_code: "811", category: "meal", trip_type: null, purchase_type: null, department: "영업팀",
  member_name: "최직원", position: "대리", employee_number: null, vehicle_number: null, purpose: "팀 점심 식대", headcount: 3, attendees: "최직원, 박팀장, 이사원",
  client_name: null, lodging_in: null, lodging_out: null, start_location: null, end_location: null, is_round_trip: null, route_one_way_km: null,
  distance_km: null, distance_source: null, applied_meal_limit_per_person: 12000, applied_fuel_rate_per_km: null, company_supported_amount: 33000,
  personal_burden_amount: 0, receipt_path: "sample/r1.jpg", route_card_path: null, item_custom: {},
};

export const SAMPLE_EXPORT_ROWS: ExportRow[] = [
  base,
  {
    ...base, seq: 2, claim_id: "c2d95b07-6a14-4e38-b5f1-9e7a0c3d4b82", claim_title: "10월 판교 미팅·사무용품", claim_description: "판교 고객사 미팅과 회의 준비", item_id: "5e07b9d2-41c8-4a6f-93e5-2d1b8f0c7a46", expense_date: "2026-10-14", merchant_name: "카카오T 택시", merchant_business_number: "1208800767",
    evidence_type: "cash_receipt", supply_amount: 11364, vat_amount: 1136, amount: 12500, payment_method: "personal_card", card_nickname: null, card_last4: null,
    account_title_name: "여비교통비", account_title_code: "812", category: "trip", trip_type: "taxi", is_trip: true, trip_destination: "판교", trip_start: "2026-10-14", trip_end: "2026-10-14", trip_purpose: "스마일상사 미팅", purpose: "고객사 미팅 이동(역삼→판교)", headcount: 1, attendees: null,
    client_name: "스마일상사", applied_meal_limit_per_person: null, company_supported_amount: 12500, receipt_path: "sample/r2.jpg",
  },
  {
    ...base, seq: 3, claim_id: "c2d95b07-6a14-4e38-b5f1-9e7a0c3d4b82", claim_title: "10월 판교 미팅·사무용품", claim_description: "판교 고객사 미팅과 회의 준비", item_id: "e1b6a4f3-98d2-47c5-a0e8-3c5f7d9b2e14", expense_date: "2026-10-21", merchant_name: "알파문구 선릉점", merchant_business_number: "1231234567",
    evidence_type: "simple_receipt", supply_amount: null, vat_amount: null, amount: 22000, payment_method: "personal_card", card_nickname: null, card_last4: null,
    account_title_name: "소모품비", account_title_code: "830", category: "purchase", purchase_type: "office_supplies", purpose: "회의용 사무용품 구입", headcount: null, attendees: null,
    applied_meal_limit_per_person: null, company_supported_amount: 22000, receipt_path: "sample/r3.jpg",
  },
];
