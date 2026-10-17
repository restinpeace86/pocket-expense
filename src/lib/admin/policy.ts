import { formatWon } from "@/lib/format";

// 관리자 홈 "정산 정책 확인" 카드에 보여 줄 현재 정책 요약 (D-068)
export type PolicySnapshot = {
  meal_limit_enabled: boolean;
  meal_limit_per_person: number;
  fuel_enabled: boolean;
  fuel_rate_per_km: number;
  claim_deadline_type: "none" | "end_of_month" | "days_after" | "next_month_day";
  claim_deadline_days: number | null;
};

export function describeDeadline(type: PolicySnapshot["claim_deadline_type"], days: number | null): string {
  if (type === "next_month_day") return `결제한 다음 달 ${days ?? 5}일까지`;
  if (type === "days_after") return `결제일로부터 ${days ?? 30}일 이내`;
  if (type === "end_of_month") return "결제한 달 말일까지";
  return "청구 기한 없음";
}

export function describePolicy(p: PolicySnapshot): string[] {
  return [
    p.meal_limit_enabled ? `식대 1인 ${formatWon(p.meal_limit_per_person)}` : "식대 한도 없이 전액 지원",
    p.fuel_enabled ? `자차 km당 ${formatWon(p.fuel_rate_per_km)}` : "자차 유류비 사용 안 함",
    p.claim_deadline_type === "none" ? "청구 기한 없음" : `청구 기한 ${describeDeadline(p.claim_deadline_type, p.claim_deadline_days)}`,
  ];
}
