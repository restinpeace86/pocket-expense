// 관리자 홈 대시보드 (admin-dashboard.md ①, T11-1). 숫자는 DB 함수 admin_dashboard가 집계한다(관리자만·자기 회사만).
import { CATEGORY_LABEL, TRIP_TYPE_LABEL, type ExpenseCategory, type TripType } from "@/lib/expense/categories";

export type Dashboard = {
  month: string;
  kpi: { spend: number; spend_prev: number; pending_claims: number; pending_oldest_days: number | null; unpaid_payout: number; unpaid_payback: number };
  todo: { pending_members: number; unmapped_items: number; settle_claims: number; failed_notifications: number; overdue_claims?: number };
  checklist: { approved_members: number; departments: number; policy_confirmed: boolean; review_steps: number };
  categories: { category: ExpenseCategory | null; trip_type: TripType | null; amount: number; count: number }[];
  top_members: { name: string; department: string | null; amount: number; count: number }[];
};

// 전월 대비 증감 %. 전월이 0이면 비교하지 않는다(null)
export function changePct(now: number, prev: number): number | null {
  if (prev <= 0) return null;
  return Math.round(((now - prev) / prev) * 1000) / 10;
}

export type CategoryBar = { key: string; label: string; amount: number; share: number; parts: { label: string; amount: number }[] };

// 카테고리별 막대: 출장비는 세부 유형을 쌓아 보여 준다. share = 전체 대비 %
export function categoryBars(rows: Dashboard["categories"]): CategoryBar[] {
  const total = rows.reduce((s, r) => s + r.amount, 0);
  const byCat = new Map<string, CategoryBar>();
  for (const r of rows) {
    const key = r.category ?? "none";
    const bar = byCat.get(key) ?? { key, label: r.category ? CATEGORY_LABEL[r.category] : "분류 없음", amount: 0, share: 0, parts: [] };
    bar.amount += r.amount;
    if (r.category === "trip") bar.parts.push({ label: r.trip_type ? TRIP_TYPE_LABEL[r.trip_type] : "세부 유형 없음", amount: r.amount });
    byCat.set(key, bar);
  }
  return [...byCat.values()]
    .map((b) => ({ ...b, share: total ? Math.round((b.amount / total) * 1000) / 10 : 0, parts: b.parts.sort((x, y) => y.amount - x.amount) }))
    .sort((a, b) => b.amount - a.amount);
}

export type ChecklistItem = { key: string; label: string; done: boolean; optional?: boolean; href: string };

// 초기 설정 체크리스트: 데이터로 끝났는지 알 수 있는 것만. 선택 항목은 남아 있어도 목록을 숨기는 데 영향 없음
export function checklist(c: Dashboard["checklist"]): ChecklistItem[] {
  return [
    { key: "invite", label: "직원 초대", done: c.approved_members > 1, href: "/members" },
    { key: "departments", label: "부서 만들기", done: c.departments > 0, href: "/departments" },
    { key: "policy", label: "정산 정책 확인", done: c.policy_confirmed, href: "/settings" },
    { key: "review", label: "사전 검토 결재라인", done: c.review_steps > 0, optional: true, href: "/approval-lines" },
  ];
}
