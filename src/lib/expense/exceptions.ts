// 예외 사용 표시 (D-084): 주말(토·일)·심야(22:00~05:59 결제) 영수증이 있으면 [예외 소명 사유]를 적도록 안내한다.
// 안내만 하고 상신을 막지 않는다. 공휴일은 따지지 않는다(달력 데이터가 없음).
export type ExceptionFlags = { weekend: number; lateNight: number };

const LATE_FROM = 22;
const LATE_UNTIL = 6;

export function isWeekend(date: string | null): boolean {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return day === 0 || day === 6;
}

export function isLateNight(time: string | null): boolean {
  const m = time?.match(/^(\d{2}):\d{2}/);
  if (!m) return false;
  const h = Number(m[1]);
  return h >= LATE_FROM || h < LATE_UNTIL;
}

export function exceptionFlags(items: { expense_date: string | null; paid_time: string | null }[]): ExceptionFlags {
  return {
    weekend: items.filter((i) => isWeekend(i.expense_date)).length,
    lateNight: items.filter((i) => isLateNight(i.paid_time)).length,
  };
}

// "주말 사용 1건 · 심야(22시~06시) 사용 2건" — 없으면 빈 문자열
export function exceptionSummary(f: ExceptionFlags): string {
  return [f.weekend ? `주말 사용 ${f.weekend}건` : "", f.lateNight ? `심야(22시~06시) 사용 ${f.lateNight}건` : ""].filter(Boolean).join(" · ");
}
