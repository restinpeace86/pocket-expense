// 월 마감 도우미(D-315, 사용자 2026-11-26 "마감일 할 일을 설정 마법사처럼 순서대로"):
// 지난달 세무 마감을 4단계로 — ① 결재 대기 정리 → ② 법인카드 내역 대조(법인카드가 있는 회사만) → ③ 홈택스 자료 올리기 → ④ 세무사무소에 넘기기
// 단계 상태는 따로 저장하지 않고 실제 데이터로 판단한다(승인 대기 0건 · 대조 저장·모두 처리 · 홈택스 파일 1개 이상 · 마감 완료).
// 막지 않는다 — 앞 단계가 남아 있어도 다음 단계로 갈 수 있다(회사가 결정, 알려 주기만)

export type ClosingInput = {
  month: string; // 마감할 달 YYYY-MM
  pendingClaims: number; // 이 달까지 쓴 영수증이 든 승인 대기 결의서(D-166)
  hasCards: boolean; // 사용 중 법인카드
  card: { kind: "none" } | { kind: "open"; open: number; total: number } | { kind: "done"; total: number };
  hometaxFiles: number; // 이 달 올린 홈택스 자료
  closed: boolean; // 세무 마감 완료
  officeName: string | null; // 연결된 세무사무소
};

export type ClosingStepKey = "approvals" | "cards" | "hometax" | "handoff";
export type ClosingStep = { key: ClosingStepKey; title: string; done: boolean; status: string };

export function closingSteps(i: ClosingInput): ClosingStep[] {
  const m = `${Number(i.month.slice(5, 7))}월`;
  const steps: ClosingStep[] = [
    {
      key: "approvals",
      title: "결재 대기 정리",
      done: i.pendingClaims === 0,
      status: i.pendingClaims === 0 ? "승인 대기 없음" : `승인 대기 ${i.pendingClaims}건`,
    },
  ];
  if (i.hasCards) {
    steps.push({
      key: "cards",
      title: "법인카드 내역 대조",
      done: i.card.kind === "done",
      status: i.card.kind === "none" ? "아직 안 함" : i.card.kind === "open" ? `처리 안 된 ${i.card.open}건` : i.card.total ? `맞지 않는 ${i.card.total}건 모두 처리` : "모두 맞음",
    });
  }
  steps.push(
    { key: "hometax", title: "홈택스 자료 올리기", done: i.hometaxFiles > 0, status: i.hometaxFiles > 0 ? `${i.hometaxFiles}개 올림` : `${m} 자료 아직 없음` },
    {
      key: "handoff",
      title: i.officeName ? "마감하고 세무사무소에 알리기" : "마감하고 자료 받기",
      done: i.closed,
      status: i.closed ? "마감 완료" : "마감 전",
    },
  );
  return steps;
}

export function closingProgress(steps: ClosingStep[]) {
  const done = steps.filter((s) => s.done).length;
  return { total: steps.length, done, percent: steps.length ? Math.round((done / steps.length) * 100) : 100, current: steps.find((s) => !s.done) ?? null };
}

// 관리자 홈 카드를 보일 때: 오늘이 마감할 달의 다음 달이고(1일~말일), 아직 마감 전이고, 마감할 거리가 있을 때(승인 지출 또는 승인 대기)
export function showClosingHomeCard(p: { month: string; today: string; closed: boolean; hasWork: boolean }): boolean {
  if (p.closed || !p.hasWork) return false;
  const [y, m] = p.month.split("-").map(Number);
  const next = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 7);
  return p.today.slice(0, 7) === next;
}
