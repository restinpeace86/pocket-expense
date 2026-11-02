// 결제 금액 계산 (7차 개선사항 9, D-134 → D-201) — 서버·화면 공용 순수 함수. PG 연동 때 결제 요청 금액도 이 함수로 만든다.
// - D-201: 모든 회사의 첫 결제 50% 할인은 없앰. 후기를 남긴 회사(companies.review_coupon_at)가 아직 한 번도 결제하지 않았으면
//   첫 결제 월간 정가의 50% 할인(쿠폰). 월간 결제만(연간 선결제는 지금 없음, D-133)
// - 금액은 공급가액 기준, 부가세 10%는 원 단위 내림 없이 정확히(요금이 모두 1,000원 단위라 나누어떨어짐)
export const REVIEW_COUPON_RATE = 0.5;

export type Checkout = { list: number; discount: number; supply: number; vat: number; total: number; coupon: boolean };

// coupon: 후기 쿠폰이 있고 아직 결제한 적 없음
export function checkoutPrice(monthlyPrice: number, coupon: boolean): Checkout {
  const list = Math.max(0, Math.round(monthlyPrice));
  const discount = coupon ? Math.floor(list * REVIEW_COUPON_RATE) : 0;
  const supply = list - discount;
  const vat = Math.floor(supply / 10);
  return { list, discount, supply, vat, total: supply + vat, coupon };
}
