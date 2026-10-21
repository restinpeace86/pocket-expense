// 지출결의서 제목 자동 제안 (worker-tax-processing.md §3-1, trip-expense.md §2, D-087)
// 영수증 1장: "[카테고리] {가맹점}" / 여러 장: "[카테고리] {대표 가맹점} 외 n건" / 출장: "{시작일 M/D} {출장지} 출장"
// 대표 = 사용일이 가장 빠른 영수증, 카테고리 = 대표 영수증의 지출 카테고리(아직 없으면 대괄호 없이).
import { CATEGORY_LABEL, type ExpenseCategory, type TripType } from "./categories";

export function monthDay(date: string): string {
  const [, m, d] = date.split("-");
  return `${Number(m)}/${Number(d)}`;
}

type TitleClaim = { isBusinessTrip: boolean; tripDestination: string | null; tripStartDate: string | null };
type TitleItem = { merchant_name: string | null; expense_date: string | null; category?: ExpenseCategory | null; trip_type?: TripType | null };

function representative<T extends TitleItem>(items: readonly T[]): T {
  // 사용일이 가장 빠른 항목 (날짜가 없으면 올린 순서)
  return [...items].sort((a, b) => (a.expense_date ?? "9999").localeCompare(b.expense_date ?? "9999"))[0];
}

const merchantOf = (i: TitleItem) => i.merchant_name?.trim() || (i.category === "trip" && i.trip_type === "own_car" ? "자차 이동" : "영수증");
const body = (merchant: string, count: number) => (count > 1 ? `${merchant} 외 ${count - 1}건` : merchant);

export function suggestTitle(claim: TitleClaim, items: readonly TitleItem[]): string {
  const dest = claim.tripDestination?.trim();
  if (claim.isBusinessTrip && dest) return claim.tripStartDate ? `${monthDay(claim.tripStartDate)} ${dest} 출장` : `${dest} 출장`;
  if (items.length === 0) return "";
  const first = representative(items);
  const text = body(merchantOf(first), items.length);
  return first.category ? `[${CATEGORY_LABEL[first.category]}] ${text}` : text;
}

// 저장된 제목이 자동 제안 모양이면(직원이 직접 쓴 게 아니면) 계속 자동으로 바꾼다 — 카테고리를 고르면 앞에 붙도록.
// 예전 모양("{가맹점} 지출", "{M/D} {가맹점} 외 n건")과 다른 카테고리가 붙은 모양도 자동 제목으로 본다.
export function isAutoTitle(title: string, claim: TitleClaim, items: readonly TitleItem[]): boolean {
  const t = title.trim();
  if (!t) return true;
  if (t === suggestTitle(claim, items)) return true;
  const dest = claim.tripDestination?.trim();
  if (dest && (t === `${dest} 출장` || (/^\d{1,2}\/\d{1,2} /.test(t) && t.endsWith(` ${dest} 출장`)))) return true;
  if (items.length === 0) return false;
  const labels = Object.values(CATEGORY_LABEL);
  const prefix = labels.find((l) => t.startsWith(`[${l}] `));
  const stripped = prefix ? t.slice(prefix.length + 3) : t;
  // 영수증 수나 대표 영수증이 바뀌기 전에 저장된 자동 제목도 자동으로 본다(어느 영수증 가맹점이든, 건수는 상관없이)
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return items.some((i) => new RegExp(`^(\\d{1,2}/\\d{1,2} )?${esc(merchantOf(i))}( 외 \\d+건| 지출)?$`).test(stripped));
}
