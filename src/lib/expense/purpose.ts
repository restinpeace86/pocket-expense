// 지출 사유(적요) 초안 (D-086, todo_improvement [개선사항 7])
// AI가 영수증마다 읽어 준 한 줄 사유(suggested_purpose)를 모아 결의서 [지출 사유] 초안을 만든다. AI 사유가 없으면 분류별 표준 문구.
// 초안일 뿐 — 직원이 고쳐 쓰면 그 값이 최종값이다. 사실(가맹점 종류·분류·출장 정보)에 없는 내용은 만들지 않는다.
import type { ExpenseCategory, PurchaseType, TripType } from "./categories";

export type PurposeItem = {
  category: ExpenseCategory | null;
  trip_type: TripType | null;
  purchase_type: PurchaseType | null;
  paid_time: string | null;
  aiPurpose: string | null;
};

// 분류별 표준 문구 (회계 장부·관리자 검토용, 명사형)
export function templatePurpose(i: PurposeItem): string | null {
  const hour = i.paid_time ? Number(i.paid_time.slice(0, 2)) : null;
  switch (i.category) {
    case "meal":
      return hour !== null && hour >= 17 ? "부서 업무 연장 저녁 식사 진행" : "부서 정기 점심 식사 진행";
    case "meeting":
      return "거래처 업무 미팅 및 다과 진행";
    case "purchase":
      return i.purchase_type === "pantry" ? "사내 탕비실 다과 및 음료 구입" : "사내 비품 및 소모품 구입";
    case "trip":
      if (i.trip_type === "meal") return "출장 중 식사";
      if (i.trip_type === "lodging") return "출장 숙박";
      if (i.trip_type === "own_car") return "출장 자차 이동 유류비";
      if (i.trip_type === "car_fuel" || i.trip_type === "car_toll") return "출장 회사차량 운행비";
      return i.trip_type ? "출장 교통비" : "출장 경비";
    case "team_dinner":
      return "부서 회식 진행";
    case "condolence":
      return "임직원·거래처 경조사 지출";
    case "seminar":
      return "업무 관련 세미나·컨퍼런스 참가";
    case "books":
      return "업무용 도서 구입";
    case "training":
      return "직무 교육·훈련 참가";
    case "company_car":
      return "회사 차량 유지 관리";
    case "saas":
      return "업무용 온라인 서비스 구독";
    default:
      return null;
  }
}

export function suggestPurpose(
  claim: { isBusinessTrip: boolean; tripDestination: string | null; tripPurpose: string | null },
  items: readonly PurposeItem[],
): string {
  if (claim.isBusinessTrip) {
    const purpose = claim.tripPurpose?.trim();
    const dest = claim.tripDestination?.trim();
    if (purpose) return `${purpose} 관련 출장 경비`;
    if (dest) return `${dest} 출장 경비`;
  }
  const phrases: string[] = [];
  for (const i of items) {
    const p = i.aiPurpose?.trim() || templatePurpose(i);
    if (p && !phrases.includes(p)) phrases.push(p);
  }
  if (phrases.length === 0) return "";
  if (phrases.length === 1) return phrases[0];
  // 여러 종류면 앞의 두 가지만 묶고 나머지는 "등"
  return `${phrases.slice(0, 2).join(", ")}${phrases.length > 2 ? " 등" : ""}`;
}
