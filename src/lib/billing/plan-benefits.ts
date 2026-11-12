// 요금 카드의 혜택 구조(D-198): 플랜마다 다른 것(직원 수·AI 영수증 읽기 장수)과 모든 플랜에 같은 기능.
// 기능 목록은 지금 있는 기능만 — 새 기능을 약속하지 않는다(랜딩 기능 카드와 같은 원칙, D-181)
// D-199: 직원 수 = 그 달 영수증을 1장 이상 올린 사람. 1인당 가격은 "최대 인원 기준" 보조 정보로만
export type PlanLike = { monthly_price: number; monthly_receipts: number; max_members: number | null; chat_storage_mb?: number | null; vault_storage_mb?: number | null };

// 사내 채팅 사진·파일 저장 한도(D-204): 1024 → "1GB"
export const storageLabel = (mb: number) => (mb >= 1024 ? `${Math.round((mb / 1024) * 10) / 10}GB` : `${mb}MB`);

export const COMMON_FEATURES = [
  "AI 영수증 자동 입력(가맹점·사업자번호·공급가액·부가세)",
  "모바일 결재라인·사전 검토",
  "직원 정산 지급 관리",
  "법인카드 내역 자동 대조",
  "세무 마감 한 번에(엑셀 장부·영수증·지출결의서 PDF)",
  "더존 위하고 일반전표 엑셀",
  "세무사무소 전용 화면 무료 연결",
];

// 요금 기준 — 요금제 화면·랜딩 카드 아래와 FAQ에 같은 문장(D-199). 약관 제9조(구독 해지: 데이터 유지)·제17조(계약 해지: 30일 뒤 파기)와 맞춤
export const PRICING_RULES = [
  "무료 이용은 가입한 달과 다음 달 세무 마감일(5일)까지예요. 25일 이후에 가입하면 한 달을 더 드려요. 후기를 남기면 첫 결제 50% 할인 쿠폰을 드려요.",
  "직원 수는 그 달에 영수증을 1장 이상 올린 사람만 세요. 대표·경리도 영수증을 올린 달만 세고, 결재·정산·마감만 하면 세지 않아요.",
  "세무사무소 계정은 직원 수에 들어가지 않아요(세무사무소는 무료).",
  "직원 수가 플랜을 넘어도 영수증 올리기는 막지 않아요. 직원을 초대할 때 플랜 올리기를 안내해 드려요.",
  "AI 영수증 읽기 장수는 매월 1일 새로 채워지고, 남은 장수는 다음 달로 넘어가지 않아요.",
  "홈택스 자료 올리기·법인카드 내역 대조는 영수증 장수에서 빠지지 않아요.",
  "장수를 다 쓰거나 유료 구독을 해지해도 지난 지출·영수증은 언제든 보고 내려받을 수 있어요(서비스 탈퇴 시에는 30일 뒤 파기돼요).",
];

// 직원 1인당 월 가격(최대 인원을 다 채웠을 때, 제한 없음이면 null)
export const perMember = (p: PlanLike) => (p.max_members ? Math.round(p.monthly_price / p.max_members) : null);

export function planBenefits(p: PlanLike): { label: string; sub?: string }[] {
  const per = perMember(p);
  return [
    p.max_members
      ? { label: `영수증 올리는 직원 최대 ${p.max_members}명`, sub: `그 안에서는 인원이 늘어도 같은 가격${per ? ` · 최대 인원 기준 1인당 약 ${per.toLocaleString("ko-KR")}원` : ""}` }
      : { label: "직원 수 제한 없음", sub: "인원이 늘어도 같은 가격" },
    // D-261: 장당 가격은 빼고 "월 최대 n장 지원" — 1인당 가격과 같은 월 요금을 두 번 나눠 보여 주면 따로 내는 것처럼 보여서
    { label: `AI 영수증 읽기 월 최대 ${p.monthly_receipts.toLocaleString("ko-KR")}장 지원`, sub: "같은 가격에 포함 · 매월 1일 새로 채워져요" },
    ...(p.chat_storage_mb ? [{ label: `사내 채팅 사진·파일 저장 ${storageLabel(p.chat_storage_mb)}`, sub: "사진·파일 보관 30·60·90일 중 선택" }] : []),
    ...(p.vault_storage_mb ? [{ label: `파일 영구 보관 ${storageLabel(p.vault_storage_mb)}`, sub: "채팅 파일 중 [영구 보관]한 것은 지울 때까지" }] : []),
    { label: "모든 기능 포함", sub: "결재·정산·세무 마감·세무사무소 연결" },
  ];
}
