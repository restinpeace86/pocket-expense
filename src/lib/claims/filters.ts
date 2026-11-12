import { monthRange } from "@/lib/dates";
import { ALL_CATEGORIES, type ExpenseCategory } from "@/lib/expense/categories";

// 공통 필터 (admin-expense-approvals.md §4.A): 월(항목 사용일자 기준), 부서, 직원, 카테고리, 검색(제목·가맹점명)
// 9-14c ⑦: 월 자리에 "recent3"(최근 3개월 = 이번 달 포함 세 달)도 받는다
export type ClaimFilters = { month: string | null; department: string | null; member: string | null; category: ExpenseCategory | null; q: string | null };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CATS: readonly string[] = ALL_CATEGORIES;
export function parseClaimFilters(sp: Record<string, string | string[] | undefined>): ClaimFilters {
  const one = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : null);
  const month = one("month");
  const q = (one("q") ?? "").replace(/[%,()*\.:"]/g, " ").trim().slice(0, 50);
  return {
    month: month && (month === RECENT3 || /^\d{4}-(0[1-9]|1[0-2])$/.test(month)) ? month : null,
    department: one("department") && UUID.test(one("department")!) ? one("department") : null,
    member: one("member") && UUID.test(one("member")!) ? one("member") : null,
    category: CATS.includes(one("category") ?? "") ? (one("category") as ExpenseCategory) : null,
    q: q || null,
  };
}
export const RECENT3 = "recent3";
const shift = (month: string, n: number) => {
  const d = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1 + n, 1));
  return d.toISOString().slice(0, 7);
};
// 필터의 월 → 사용일자 범위(end는 포함하지 않음). current = 이번 달("YYYY-MM")
export function filterDateRange(month: string, current: string): { start: string; end: string } {
  if (month === RECENT3) return { start: monthRange(shift(current, -2)).start, end: monthRange(current).end };
  return monthRange(month);
}
// [이번 달]·[지난달]·[최근 3개월] 빠른 선택 값
export function quickMonths(current: string): { key: string; label: string; value: string }[] {
  return [
    { key: "this", label: "이번 달", value: current },
    { key: "last", label: "지난달", value: shift(current, -1) },
    { key: "recent3", label: "최근 3개월", value: RECENT3 },
  ];
}

// 목록·탭 링크에 필터를 이어 붙인다
export function filterQuery(f: ClaimFilters): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(f)) if (v) p.set(k, v);
  return p.toString();
}

