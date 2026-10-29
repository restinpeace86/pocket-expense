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

// 청구 마감은 모든 회사 같은 규칙(D-161) — 회사 설정 값은 쓰지 않는다
export function describeDeadline(): string {
  return "사용한 다음 달 2일까지(쉬는 날이면 앞 영업일)";
}

export function describePolicy(p: PolicySnapshot): string[] {
  return [
    p.meal_limit_enabled ? `식대 1인 ${formatWon(p.meal_limit_per_person)}` : "식대 한도 없이 전액 지원",
    p.fuel_enabled ? `자차 km당 ${formatWon(p.fuel_rate_per_km)}` : "자차 유류비 사용 안 함",
    `청구 마감 ${describeDeadline()}`,
  ];
}
