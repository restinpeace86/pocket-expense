// 내부 분류(카테고리 + 출장 세부 유형) 이름 — 관리자·직원 화면 공통 (spec/features/account-titles.md §3, trip-expense.md)
export type ExpenseCategory = "meal" | "trip" | "meeting";
export type TripType = "meal" | "public_transport" | "taxi" | "toll_parking" | "lodging" | "own_car" | "other";

export const CATEGORY_LABEL: Record<ExpenseCategory, string> = { meal: "일반 식대", trip: "출장비", meeting: "외부 미팅비" };
export const TRIP_TYPE_LABEL: Record<TripType, string> = {
  meal: "출장 식비",
  public_transport: "대중교통",
  taxi: "택시",
  toll_parking: "통행료·주차",
  lodging: "숙박",
  own_car: "자차 유류비",
  other: "기타",
};

// 계정과목 매핑 표에 보여 줄 순서 (내부 분류 9종)
export const MAPPING_ROWS: { category: ExpenseCategory; tripType: TripType | null }[] = [
  { category: "meal", tripType: null },
  ...(["meal", "public_transport", "taxi", "toll_parking", "lodging", "own_car", "other"] as TripType[]).map((t) => ({ category: "trip" as const, tripType: t })),
  { category: "meeting", tripType: null },
];

export const classificationLabel = (category: ExpenseCategory, tripType: TripType | null) =>
  category === "trip" && tripType ? `${CATEGORY_LABEL.trip} › ${TRIP_TYPE_LABEL[tripType]}` : CATEGORY_LABEL[category];
