import type { ExpenseCategory, TripType } from "./categories";

// 항목 하나의 회사 지원금·개인 부담금 — DB의 private.item_amounts(migration 027)와 같은 규칙.
// 화면에서 바로 보여 주기 위한 계산이고, 저장되는 값은 항상 서버(refresh_claim_totals)가 다시 계산한다.
// (expense-lifecycle.md §5.1·§5.2, smart-meal.md §3, D-040·D-041·D-044·D-068)
export type MealPolicy = { enabled: boolean; perPerson: number; mode: "split" | "notify" };

export type ItemAmounts = {
  supported: number | null;
  burden: number;
  appliedLimit: number | null; // 1인 한도(개인 예외 우선)
  appliedMode: MealPolicy["mode"] | null;
  totalLimit: number | null; // 1인 한도 × 인원
  overLimit: number; // 한도를 넘은 금액(알림 모드에서도 계산)
};

export function isMealLike(category: ExpenseCategory | null, tripType: TripType | null): boolean {
  return category === "meal" || (category === "trip" && tripType === "meal");
}

export function itemAmounts(
  item: { category: ExpenseCategory | null; tripType: TripType | null; amount: number | null; headcount: number | null },
  policy: MealPolicy,
  memberOverride: number | null,
): ItemAmounts {
  const out: ItemAmounts = { supported: item.amount, burden: 0, appliedLimit: null, appliedMode: null, totalLimit: null, overLimit: 0 };
  if (item.amount === null) return { ...out, supported: null };
  if (!isMealLike(item.category, item.tripType) || !policy.enabled) return out;
  const perPerson = memberOverride ?? policy.perPerson;
  const totalLimit = perPerson * Math.max(item.headcount ?? 1, 1);
  const overLimit = Math.max(item.amount - totalLimit, 0);
  out.appliedLimit = perPerson;
  out.appliedMode = policy.mode;
  out.totalLimit = totalLimit;
  out.overLimit = overLimit;
  if (policy.mode === "split" && overLimit > 0) {
    out.supported = totalLimit;
    out.burden = overLimit;
  }
  return out;
}
