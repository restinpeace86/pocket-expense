// 상신 검증 결과(private.claim_problems) 표시 이름 (expense-lifecycle.md §2)
export type ClaimProblems = { header: string[]; items: { item_id: string; sort_order: number; fields: string[] }[] };

export const HEADER_PROBLEM_LABEL: Record<string, string> = {
  title: "제목",
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
  category: "지출 카테고리",
  corporate_card: "사용한 법인카드",
  evidence_type: "증빙 구분",
  expense_date: "사용일자",
  amount: "합계 금액",
  receipt: "영수증 사진",
  headcount: "인원수",
  purpose: "목적·품목·적요",
  purchase_type: "구매 세부 유형",
  trip_type: "출장비 세부 유형",
  lodging_period: "숙박 기간",
  own_car_route: "출발지·도착지·거리",
};

export function isEmptyProblems(p: ClaimProblems | null | undefined): boolean {
  return !p || (p.header.length === 0 && p.items.length === 0);
}
