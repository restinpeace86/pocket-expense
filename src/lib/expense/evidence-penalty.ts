// 증빙 없음 가산세 안내 (D-153): 세무 판단은 하지 않고, 적용 기준을 함께 보여 주며 최종 판단은 세무사에게 맡긴다.
// 기준: 건당 3만 원(부가세 포함)을 넘는 거래에 적격증빙(신용카드 매출전표·현금영수증·세금계산서·계산서)이 없으면
// 증빙불비 가산세 = 지출액의 2%. 신규·소규모 사업자 등은 예외일 수 있다.
export const PENALTY_THRESHOLD = 30_000;
export const PENALTY_RATE = 0.02;

export type PenaltyNotice = { level: "info" | "warn"; text: string; basis: string };

const BASIS = "적용 기준: 건당 3만 원 초과 거래에 적격증빙이 없으면 증빙불비 가산세 지출액의 2%. 신규·소규모 사업자 등 예외가 있을 수 있어 최종 판단은 세무사가 해요.";

export function noEvidenceNotice(amount: number | null | undefined): PenaltyNotice {
  if (amount == null || !Number.isFinite(amount) || amount <= 0) {
    return { level: "info", text: "금액을 넣으면 가산세 대상인지 알려 드려요. 3만 원이 넘는 지출은 적격증빙이 없으면 회사가 가산세를 낼 수 있어요.", basis: BASIS };
  }
  if (amount <= PENALTY_THRESHOLD) {
    return { level: "info", text: "3만 원 이하 지출이라 증빙이 없어도 증빙불비 가산세 대상은 아니에요. 비용으로 인정받을 수 있게 사유를 정확히 적어 주세요.", basis: BASIS };
  }
  const fee = Math.floor(amount * PENALTY_RATE);
  return {
    level: "warn",
    text: `3만 원이 넘는 지출이에요. 적격증빙(카드 매출전표·현금영수증·세금계산서)이 없으면 회사가 지출액의 2%(약 ${fee.toLocaleString("ko-KR")}원)를 증빙불비 가산세로 낼 수 있어요.`,
    basis: BASIS,
  };
}

// 세무 엑셀 '확인 필요' 칸용: 증빙 없음 + 3만 원 초과면 표시
export function noEvidenceCheck(evidenceKind: string | null | undefined, amount: number | null | undefined): string | null {
  if (evidenceKind !== "none") return null;
  return (amount ?? 0) > PENALTY_THRESHOLD ? "증빙 없음(3만 원 초과·가산세 확인)" : "증빙 없음(3만 원 이하)";
}
