// 결제 금액 계산 (7차 개선사항 9, D-134) — 서버·화면 공용 순수 함수. PG 연동 때 결제 요청 금액도 이 함수로 만든다.
// - 생애 첫 결제(companies.first_purchase_at 없음)면 월간 정가의 50% 할인. 월간 결제만(연간 선결제는 지금 없음, D-133)
// - 금액은 공급가액 기준, 부가세 10%는 원 단위 내림 없이 정확히(요금이 모두 1,000원 단위라 나누어떨어짐)
export const FIRST_PURCHASE_DISCOUNT_RATE = 0.5;

export type Checkout = { list: number; discount: number; supply: number; vat: number; total: number; firstPurchase: boolean };

export function checkoutPrice(monthlyPrice: number, firstPurchase: boolean): Checkout {
  const list = Math.max(0, Math.round(monthlyPrice));
  const discount = firstPurchase ? Math.floor(list * FIRST_PURCHASE_DISCOUNT_RATE) : 0;
  const supply = list - discount;
  const vat = Math.floor(supply / 10);
  return { list, discount, supply, vat, total: supply + vat, firstPurchase };
}
