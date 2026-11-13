// 요금 카드의 혜택 구조(D-198): 플랜마다 다른 것(직원 수·AI 영수증 읽기 장수)과 모든 플랜에 같은 기능.
// 기능 목록은 지금 있는 기능만 — 새 기능을 약속하지 않는다(랜딩 기능 카드와 같은 원칙, D-181)
// D-199: 직원 수 = 그 달 영수증을 1장 이상 올린 사람. 1인당 가격은 "최대 인원 기준" 보조 정보로만
export type PlanLike = {
  monthly_price: number;
  monthly_receipts: number;
  max_members: number | null;
  chat_storage_mb?: number | null;
  vault_storage_mb?: number | null;
  monthly_doc_converts?: number | null;
  doc_converts_unlimited?: boolean | null;
  trash_days?: number | null;
  storage_mb?: number | null; // D-271 회사 공용 저장 공간(누적 합산)
  is_unlimited?: boolean | null; // AI 영수증 무제한*(monthly_receipts = 공정 사용 기준)
  form_slots?: number | null;
  form_slots_unlimited?: boolean | null;
  budget_alerts?: boolean | null;
  support_label?: string | null;
};

// 서류 → 엑셀 변환 월 무료 횟수(D-265): 비즈니스는 무제한*(공정 사용 기준 월 n건)
export function docConvertLabel(p: PlanLike): { label: string; sub: string } | null {
  if (p.monthly_doc_converts == null) return null;
  if (p.doc_converts_unlimited) return { label: "서류 → 엑셀 변환 무제한*", sub: `*공정 사용 기준 월 ${p.monthly_doc_converts.toLocaleString("ko-KR")}건 · 넘어도 바로 막지 않아요` };
  return { label: `서류 → 엑셀 변환 월 ${p.monthly_doc_converts.toLocaleString("ko-KR")}건`, sub: "매월 1일 새로 채워져요" };
}

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
  "모든 플랜 인원 제한이 없어요. 직원이 늘어도 요금은 그대로이고, 세무사무소 계정은 무료예요.",
  "AI 영수증 읽기 장수는 매월 1일 새로 채워지고, 남은 장수는 다음 달로 넘어가지 않아요.",
  "파일 용량은 회사 전체 누적 합산 한도예요(채팅 사진·파일·파일 보관함·휴지통 포함). 모자라면 [저장 공간 추가]를 골라요(요금제와 함께 매월 결제).",
  "홈택스 자료 올리기·법인카드 내역 대조는 영수증 장수에서 빠지지 않아요.",
  "서류 → 엑셀 변환은 플랜별 월 무료 횟수 안에서는 영수증 장수에서 빠지지 않아요. 넘으면 1쪽에 1장씩 빠지고, 표를 못 찾으면 돌려드려요.",
  "장수를 다 쓰거나 유료 구독을 해지해도 지난 지출·영수증은 언제든 보고 내려받을 수 있어요(서비스 탈퇴 시에는 30일 뒤 파기돼요).",
];


export function planBenefits(p: PlanLike): { label: string; sub?: string }[] {
  return [
    // D-272: 인원 제한 없음은 요금표 위 한 줄로만(카드마다 같은 줄이라 뺌)
    // D-261: 장당 가격은 빼고 "월 최대 n장 지원" — 1인당 가격과 같은 월 요금을 두 번 나눠 보여 주면 따로 내는 것처럼 보여서
    p.is_unlimited
      ? { label: "AI 영수증 읽기 무제한*", sub: `*공정 사용 기준 월 ${p.monthly_receipts.toLocaleString("ko-KR")}장 · 넘어도 바로 막지 않아요` }
      : { label: `AI 영수증 읽기 월 최대 ${p.monthly_receipts.toLocaleString("ko-KR")}장 지원`, sub: "같은 가격에 포함 · 매월 1일 새로 채워져요" },
    ...(docConvertLabel(p) ? [docConvertLabel(p)!] : []),
    // D-271: 채팅 사진·파일 + 파일 보관함 = 회사 저장 공간 하나
    ...(p.storage_mb
      ? [{ label: `회사 공용 파일 용량 ${storageLabel(p.storage_mb)}`, sub: "채팅 사진·파일 등 회사가 앱에 저장하는 파일 전체(누적 합산)" }]
      : [
          ...(p.chat_storage_mb ? [{ label: `사내 채팅 사진·파일 저장 ${storageLabel(p.chat_storage_mb)}`, sub: "사진·파일 보관 30·60·90일 중 선택" }] : []),
          ...(p.vault_storage_mb ? [{ label: `파일 영구 보관 ${storageLabel(p.vault_storage_mb)}`, sub: "채팅 파일 중 [영구 보관]한 것은 지울 때까지" }] : []),
        ]),
    // D-266 휴지통: 지운 보관 파일 복구 기간
    ...(p.trash_days ? [{ label: `지운 파일 복구 ${p.trash_days >= 365 ? `${Math.round(p.trash_days / 365)}년` : `${p.trash_days}일`}`, sub: "파일 보관함 휴지통에서 되돌리기" }] : []),
    // D-271 비교표: 회사 양식 · 예산 알림 · 고객 지원
    ...(p.form_slots_unlimited
      ? [{ label: "AI 양식 변환 무제한", sub: "회사 양식을 앱 양식으로 · 도입 시 지원" }]
      : p.form_slots
        ? [{ label: `AI 양식 변환 최대 ${p.form_slots}개`, sub: "회사 양식을 앱 양식으로 · 도입 시 지원" }]
        : p.form_slots === 0
          ? [{ label: "회사 양식: 지출결의서", sub: "기본 지출결의서 양식" }]
          : []),
    ...(p.budget_alerts ? [{ label: "예산 한도·초과 알림", sub: "80%·100%를 넘으면 관리자에게" }] : []),
    ...(p.support_label ? [{ label: `고객 지원: ${p.support_label}` }] : []),
    { label: "모든 기능 포함", sub: "결재·정산·세무 마감·세무사무소 연결" },
  ];
}
