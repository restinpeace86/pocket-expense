// 상신 검증 결과(private.claim_problems) 표시 이름 (expense-lifecycle.md §2)
export type ClaimProblems = { header: string[]; items: { item_id: string; sort_order: number; fields: string[] }[] };

export const HEADER_PROBLEM_LABEL: Record<string, string> = {
  title: "제목",
  category: "지출 카테고리(영수증 카테고리가 섞여 있어요)",
  meeting_purpose: "미팅 목적",
  condolence_target: "경조사 대상(내부·임직원 / 외부·거래처)",
  client_name: "거래처명",
  purchase_type: "구매 세부 유형",
  purchase_purpose: "구매 목적",
  vehicle: "차량",
  description: "지출 사유",
  trip_destination: "출장지",
  trip_period: "출장 기간",
  trip_period_order: "출장 기간(끝나는 날이 시작일보다 빠름)",
  trip_purpose: "출장 목적",
  no_items: "영수증이 1장 이상 있어야 해요",
  too_many_items: "영수증은 30장까지",
};

export const ITEM_PROBLEM_LABEL: Record<string, string> = {
  parsing: "AI가 아직 읽는 중",
  per_diem_meal: "출장 일비에 식비가 포함돼요 — 이 식사 영수증은 빼 주세요",
  category_mismatch: "다른 종류로 보이는 영수증(옮기거나 \"이 결의서가 맞아요\")",
  category: "지출 카테고리",
  corporate_card: "사용한 법인카드",
  evidence_type: "증빙 구분",
  expense_date: "사용일자",
  amount: "합계 금액",
  receipt: "증빙 자료(영수증 또는 대신할 자료)",
  no_evidence_reason: "증빙 없는 사유(5자 이상)",
  headcount: "인원수",
  purpose: "목적·품목·적요",
  purchase_type: "구매 세부 유형",
  trip_type: "출장비 세부 유형",
  lodging_period: "숙박 기간",
  own_car_route: "출발지·도착지·거리",
  odometer_photos: "출발·도착 계기판 사진 2장",
};

export function isEmptyProblems(p: ClaimProblems | null | undefined): boolean {
  return !p || (p.header.length === 0 && p.items.length === 0);
}
