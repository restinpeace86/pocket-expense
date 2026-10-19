import "server-only";

// 크레딧 이벤트(소진 시 자동 추가 지급, D-054). 환경변수가 없으면 켜짐(pricing-policy.md §4).
export function creditEventEnabled(): boolean {
  return (process.env.CREDIT_EVENT_BONUS_ENABLED ?? "true").toLowerCase() !== "false";
}

export function creditEventAmount(): number {
  const n = Number(process.env.CREDIT_EVENT_BONUS_AMOUNT ?? 100);
  return Number.isInteger(n) && n > 0 ? n : 100;
}
