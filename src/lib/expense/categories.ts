// 내부 분류(카테고리 + 세부 유형) 이름 — 관리자·직원 화면 공통 (spec/features/account-titles.md §3, trip-expense.md, D-076)
// 4대 카테고리 + 추가 카테고리(D-102: 회식비·경조사비·세미나·도서·교육·회사차량·SaaS)
export type ExpenseCategory = "meal" | "trip" | "meeting" | "purchase" | "team_dinner" | "condolence" | "seminar" | "books" | "training" | "company_car" | "saas";
// car_fuel·car_toll: 회사차량으로 간 출장의 주유·통행료·주차(차량유지비, D-106)
export type TripType = "meal" | "public_transport" | "taxi" | "toll_parking" | "lodging" | "own_car" | "other" | "car_fuel" | "car_toll";
export type PurchaseType = "pantry" | "office_supplies" | "small_equipment";

export const CATEGORY_LABEL: Record<ExpenseCategory, string> = {
  meal: "일반 식대",
  trip: "출장비",
  meeting: "외부 미팅비",
  purchase: "회사 물품 구매",
  team_dinner: "회식비",
  condolence: "경조사비",
  seminar: "세미나·컨퍼런스 참가",
  books: "업무용 도서 구입",
  training: "교육·훈련",
  company_car: "회사차량",
  saas: "온라인 SaaS 구독료",
};
// 결의서 맨 위 4대 카테고리 / 그 밖의 경비 (D-098, D-102)
export const MAIN_CATEGORIES: ExpenseCategory[] = ["meal", "meeting", "purchase", "trip"];
export const EXTRA_CATEGORIES: ExpenseCategory[] = ["team_dinner", "condolence", "seminar", "books", "training", "company_car", "saas"];
export const ALL_CATEGORIES: ExpenseCategory[] = [...MAIN_CATEGORIES, ...EXTRA_CATEGORIES];
export const TRIP_TYPE_LABEL: Record<TripType, string> = {
  meal: "출장 식비",
  public_transport: "대중교통",
  taxi: "택시",
  toll_parking: "통행료·주차",
  lodging: "숙박",
  own_car: "자차 유류비",
  other: "기타",
  car_fuel: "회사차량 주유",
  car_toll: "회사차량 통행료·주차",
};
export const PURCHASE_TYPE_LABEL: Record<PurchaseType, string> = {
  pantry: "탕비실·간식",
  office_supplies: "사무용품·소모품",
  small_equipment: "소액 비품",
};

export type Classification = { category: ExpenseCategory; tripType: TripType | null; purchaseType: PurchaseType | null };

// 계정과목 매핑 표에 보여 줄 순서 (내부 분류 21종)
export const MAPPING_ROWS: Classification[] = [
  { category: "meal", tripType: null, purchaseType: null },
  ...(Object.keys(TRIP_TYPE_LABEL) as TripType[]).map((t) => ({ category: "trip" as const, tripType: t, purchaseType: null })),
  { category: "meeting", tripType: null, purchaseType: null },
  ...(Object.keys(PURCHASE_TYPE_LABEL) as PurchaseType[]).map((p) => ({ category: "purchase" as const, tripType: null, purchaseType: p })),
  ...EXTRA_CATEGORIES.map((c) => ({ category: c, tripType: null, purchaseType: null })),
];

export function classificationLabel(c: Classification): string {
  if (c.category === "trip" && c.tripType) return `${CATEGORY_LABEL.trip} › ${TRIP_TYPE_LABEL[c.tripType]}`;
  if (c.category === "purchase" && c.purchaseType) return `${CATEGORY_LABEL.purchase} › ${PURCHASE_TYPE_LABEL[c.purchaseType]}`;
  return CATEGORY_LABEL[c.category];
}
