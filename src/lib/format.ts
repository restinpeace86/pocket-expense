// 금액은 원 단위 정수로 다룬다(spec/data/schema.md). 화면 표시는 천 단위 콤마 + "원".
export function formatWon(amount: number): string {
  if (!Number.isFinite(amount)) {
    throw new Error(`금액이 올바르지 않습니다: ${amount}`);
  }
  return `${Math.round(amount).toLocaleString("ko-KR")}원`;
}

// 휴대폰 번호는 숫자만 저장한다(schema.md members.phone). 화면 표시는 010-1234-5678 형태.
export function formatPhone(phone: string): string {
  return phone.replace(/^(\d{3})(\d{3,4})(\d{4})$/, "$1-$2-$3");
}
