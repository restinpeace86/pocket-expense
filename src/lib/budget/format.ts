// 예산(D-267, 9-23) — 화면에서 쓰는 순수 계산. 관리자만 보는 정보(직원 화면에는 쓰지 않는다)
export type BudgetTitle = { account_title_id: string; name: string; spent: number; budget: number | null };
export type BudgetStatus = {
  month: string;
  enabled: boolean; // 지금 플랜에서 예산 알림을 쓸 수 있나(프로부터)
  plan: string;
  total_spent: number;
  total_budget: number | null;
  titles: BudgetTitle[];
  unmapped_spent: number;
};
export type BudgetImpact = { month: string; name: string; budget: number; spent: number; pct: number };

// 예산 대비 비율(정수 %). 예산이 없으면 null
export function budgetPct(spent: number, budget: number | null | undefined): number | null {
  if (!budget || budget <= 0) return null;
  return Math.round((spent / budget) * 100);
}

// 막대 색 단계: 80% 주의, 100% 넘음
export function budgetTone(pct: number | null): "none" | "ok" | "warn" | "over" {
  if (pct == null) return "none";
  return pct >= 100 ? "over" : pct >= 80 ? "warn" : "ok";
}

// 입력 칸 글자 → 원(콤마·"원"·공백 허용). 빈 칸 = null(예산 없음), 숫자가 아니거나 0 이하·20억 넘으면 "invalid"
export function parseBudgetInput(text: string): number | null | "invalid" {
  const t = text.replace(/[,\s원]/g, "");
  if (!t) return null;
  if (!/^\d+$/.test(t)) return "invalid";
  const n = Number(t);
  return n >= 1 && n <= 2_000_000_000 ? n : "invalid";
}

export const BUDGET_ERROR: Record<string, string> = {
  PLAN_REQUIRED: "예산 알림은 프로 플랜부터 쓸 수 있어요.",
  INVALID_AMOUNT: "금액은 1원에서 20억 원 사이로 적어 주세요.",
  NOT_FOUND: "계정과목을 찾지 못했어요. 새로 고침 뒤 다시 해 주세요.",
  NOT_ALLOWED: "관리자만 예산을 바꿀 수 있어요.",
};
export function budgetErrorMessage(message: string): string {
  for (const [code, text] of Object.entries(BUDGET_ERROR)) if (message.includes(code)) return text;
  return "저장하지 못했어요. 잠시 뒤 다시 해 주세요.";
}
