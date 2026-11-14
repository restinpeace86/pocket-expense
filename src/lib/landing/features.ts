// 모든 플랜 공통 기능(D-273) — 랜딩 [기능] 벽과 요금표 아래 [모든 플랜 기본 기능]이 같이 쓴다.
// 지금 있는 기능만(D-200·D-181 원칙). sim = [기능 미리 보기] 탭 키, accent = 구역 보조색(D-263)
export type FeatureGroup = { key: string; title: string; one: string; sim: string; accent: "expense" | "attend" | "collab" | "docs" | "tax"; items: string[] };

export const FEATURE_GROUPS: FeatureGroup[] = [
  {
    key: "expense",
    title: "경비·결재",
    one: "찍으면 결의서, 누르면 결재",
    sim: "receipt",
    accent: "expense",
    items: ["AI 영수증 자동 입력", "휴대폰 결재·사전 검토", "직원 정산 지급", "법인카드 내역 대조", "예산 한도·초과 알림", "출장 일비·자차 유류비"],
  },
  {
    key: "attend",
    title: "근태·휴가",
    one: "QR 한 번이면 출근",
    sim: "qr",
    accent: "attend",
    items: ["QR 출퇴근", "휴가 신청·남은 연차", "정정 신청", "월 근태 한눈에", "오늘 출근 현황"],
  },
  {
    key: "collab",
    title: "협업",
    one: "카톡처럼 편하게, 섞이지 않게",
    sim: "threads",
    accent: "collab",
    items: ["사내 채팅", "주제별 서브 대화", "파일 보관함", "일정 공유 캘린더", "회의실 예약", "공지", "AI 도우미"],
  },
  {
    key: "docs",
    title: "문서·양식",
    one: "쓰던 양식 그대로",
    sim: "convert",
    accent: "docs",
    items: ["종이·PDF → 엑셀", "회사 양식 지출결의서·휴가신청서", "PDF·엑셀로 바로 받기"],
  },
  {
    key: "tax",
    title: "세무 연계",
    one: "월말 자료가 알아서 넘어가요",
    sim: "closing",
    accent: "tax",
    items: ["월말 마감 파일 한 번에", "세무사무소 무료 전용 화면", "더존 위하고 일반전표 엑셀", "홈택스 자료 함께 넘기기"],
  },
];
