// 요금 카드의 혜택 구조(D-198): 플랜마다 다른 것(직원 수·AI 영수증 읽기 장수)과 모든 플랜에 같은 기능.
// 기능 목록은 지금 있는 기능만 — 새 기능을 약속하지 않는다(랜딩 기능 카드와 같은 원칙, D-181)
export type PlanLike = { monthly_price: number; monthly_receipts: number; max_members: number | null };

export const COMMON_FEATURES = [
  "AI 영수증 자동 입력(가맹점·사업자번호·공급가액·부가세)",
  "모바일 결재라인·사전 검토",
  "직원 정산 지급 관리",
  "법인카드 내역 자동 대조",
  "세무 마감 한 번에(엑셀 장부·영수증·지출결의서 PDF)",
  "더존 위하고 일반전표 엑셀",
  "세무사무소 전용 화면 무료 연결",
];

// 직원 1인당 월 가격(제한 없음이면 null)
export const perMember = (p: PlanLike) => (p.max_members ? Math.round(p.monthly_price / p.max_members) : null);

export function planBenefits(p: PlanLike): { label: string; sub?: string }[] {
  const per = perMember(p);
  return [
    p.max_members
      ? { label: `직원 최대 ${p.max_members}명`, sub: per ? `1인당 월 약 ${per.toLocaleString("ko-KR")}원` : undefined }
      : { label: "직원 수 제한 없음", sub: "인원이 늘어도 같은 가격" },
    { label: `AI 영수증 읽기 월 ${p.monthly_receipts.toLocaleString("ko-KR")}장`, sub: `장당 약 ${Math.round(p.monthly_price / p.monthly_receipts).toLocaleString("ko-KR")}원` },
    { label: "모든 기능 포함", sub: "결재·정산·세무 마감·세무사무소 연결" },
  ];
}
