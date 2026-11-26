// 지난달 지출 리포트(D-319, 사용자 2026-11-26): 매월 1일 아침 관리자 [알림]방 카드 — 대표가 앱을 열지 않아도 한 달 돈 흐름을 안다
// 기준 = 관리자 홈 KPI와 같음(사용일 기준, 결재 올린 것·승인·지급, 금액). 지출이 없는 회사에는 보내지 않는다
export type ReportItem = { ym: string; amount: number; account: string | null; member: string };
export type MonthlyReport = {
  month: string;
  total: number;
  prev: number;
  count: number;
  titles: { name: string; amount: number }[];
  members: { name: string; amount: number }[];
  budget: number | null;
};

export function prevMonthOf(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 7);
}

function top(items: ReportItem[], key: (i: ReportItem) => string, n = 3) {
  const map = new Map<string, number>();
  for (const i of items) map.set(key(i), (map.get(key(i)) ?? 0) + i.amount);
  return [...map.entries()].map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name)).slice(0, n);
}

export function buildMonthlyReport(month: string, items: ReportItem[], budget: number | null): MonthlyReport {
  const cur = items.filter((i) => i.ym === month);
  const prev = items.filter((i) => i.ym === prevMonthOf(month));
  return {
    month,
    total: cur.reduce((s, i) => s + i.amount, 0),
    prev: prev.reduce((s, i) => s + i.amount, 0),
    count: cur.length,
    titles: top(cur, (i) => i.account ?? "미지정"),
    members: top(cur, (i) => i.member),
    budget,
  };
}

// 만 원 단위로 짧게(12,340원 → 1.2만, 520,000 → 52만, 3,450,000 → 345만)
export function manwon(n: number): string {
  if (n < 10000) return `${n.toLocaleString("ko-KR")}원`;
  const v = n / 10000;
  return `${v >= 100 ? Math.round(v).toLocaleString("ko-KR") : Math.round(v * 10) / 10}만`;
}

export function reportCard(r: MonthlyReport): { title: string; lines: string[] } {
  const m = `${Number(r.month.slice(5, 7))}월`;
  const pm = `${Number(prevMonthOf(r.month).slice(5, 7))}월`;
  const change =
    r.prev <= 0
      ? `${pm} 지출은 없었어요`
      : r.total === r.prev
        ? `${pm}과 같아요`
        : `${pm}보다 ${Math.round((Math.abs(r.total - r.prev) / r.prev) * 100)}% ${r.total > r.prev ? "늘었어요" : "줄었어요"}`;
  const lines = [
    `총 ${r.total.toLocaleString("ko-KR")}원(${r.count}건) · ${change}`,
    `많이 쓴 곳: ${r.titles.map((t) => `${t.name} ${manwon(t.amount)}`).join(" · ")}`,
    `많이 쓴 사람: ${r.members.map((t) => `${t.name} ${manwon(t.amount)}`).join(" · ")}`,
  ];
  if (r.budget) lines.push(`회사 예산 ${manwon(r.budget)} 중 ${Math.round((r.total / r.budget) * 100)}% 썼어요`);
  lines.push("결재 올린 것까지 포함, 사용일 기준이에요.");
  return { title: `${m} 지출 리포트`, lines };
}
