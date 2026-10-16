// 금액은 원 단위 정수로 다룬다(spec/data/schema.md). 화면 표시는 천 단위 콤마 + "원".
export function formatWon(amount: number): string {
  if (!Number.isFinite(amount)) {
    throw new Error(`금액이 올바르지 않습니다: ${amount}`);
  }
  return `${Math.round(amount).toLocaleString("ko-KR")}원`;
}
