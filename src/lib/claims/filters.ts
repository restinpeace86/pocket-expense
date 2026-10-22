import { ALL_CATEGORIES, type ExpenseCategory } from "@/lib/expense/categories";

// 공통 필터 (admin-expense-approvals.md §4.A): 월(항목 사용일자 기준), 부서, 직원, 카테고리, 검색(제목·가맹점명)
export type ClaimFilters = { month: string | null; department: string | null; member: string | null; category: ExpenseCategory | null; q: string | null };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CATS: readonly string[] = ALL_CATEGORIES;
export function parseClaimFilters(sp: Record<string, string | string[] | undefined>): ClaimFilters {
  const one = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : null);
  const month = one("month");
  const q = (one("q") ?? "").replace(/[%,()*\.:"]/g, " ").trim().slice(0, 50);
  return {
    month: month && /^\d{4}-(0[1-9]|1[0-2])$/.test(month) ? month : null,
    department: one("department") && UUID.test(one("department")!) ? one("department") : null,
    member: one("member") && UUID.test(one("member")!) ? one("member") : null,
    category: CATS.includes(one("category") ?? "") ? (one("category") as ExpenseCategory) : null,
    q: q || null,
  };
}
// 목록·탭 링크에 필터를 이어 붙인다
export function filterQuery(f: ClaimFilters): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(f)) if (v) p.set(k, v);
  return p.toString();
}

