// 지출결의서 제목 자동 제안 (worker-tax-processing.md §3-1, trip-expense.md §2)
// 영수증 1장: "{가맹점} 지출" / 여러 장: "{첫 사용일 M/D} {첫 가맹점} 외 n건" / 출장: "{시작일 M/D} {출장지} 출장"
export function monthDay(date: string): string {
  const [, m, d] = date.split("-");
  return `${Number(m)}/${Number(d)}`;
}

export function suggestTitle(
  claim: { isBusinessTrip: boolean; tripDestination: string | null; tripStartDate: string | null },
  items: readonly { merchant_name: string | null; expense_date: string | null }[],
): string {
  const dest = claim.tripDestination?.trim();
  if (claim.isBusinessTrip && dest) return claim.tripStartDate ? `${monthDay(claim.tripStartDate)} ${dest} 출장` : `${dest} 출장`;
  if (items.length === 0) return "";
  // 사용일이 가장 빠른 항목을 "첫 항목"으로 (날짜가 없으면 올린 순서)
  const first = [...items].sort((a, b) => (a.expense_date ?? "9999").localeCompare(b.expense_date ?? "9999"))[0];
  const merchant = first.merchant_name?.trim() || "영수증";
  if (items.length === 1) return `${merchant} 지출`;
  const prefix = first.expense_date ? `${monthDay(first.expense_date)} ` : "";
  return `${prefix}${merchant} 외 ${items.length - 1}건`;
}
