// 도움말 글 처음 데이터(D-255). DB(help_articles·help_steps)에 없는 글만 넣는다(운영자가 고친 글은 그대로) — scripts/help-seed.mjs
// 단계 글은 해요체, 버튼 이름은 [ ]. shot = 화면 그림 캡처 키(.responsive/live/help-shots.mjs), sim = 시뮬레이션 키
import type { HelpCategory, HelpFeature } from "./guides";
import { BRAND } from "@/lib/brand";

export type SeedStep = { body: string; shot?: string };
export type SeedArticle = {
  id: string;
  cat: HelpCategory;
  audience?: "all" | "admin";
  needs?: HelpFeature;
  title: string;
  summary: string;
  keywords: string[];
  path?: string;
  adminPath?: string;
  pathLabel?: string;
  sim?: "receipt" | "qr" | "leave" | "convert" | "rooms" | "chat" | "closing";
  steps: SeedStep[];
};

export const HELP_SEED: SeedArticle[] = [
  // ── 기본 설정 ──
  {
    id: "settings-map", cat: "basic", audience: "admin", title: "관리자 설정은 어디에 뭐가 있나요", summary: "왼쪽 [설정] 아래 8개 메뉴, 화면 위 탭에서 세부 항목을 골라요.",
    keywords: ["설정 메뉴", "설정 어디", "메뉴 구성"], path: "/admin/settings", pathLabel: "설정 열기",
    steps: [
      { body: "왼쪽 메뉴 [설정]을 누르면 회사 기본정보 · 회사 자산 · 기능 사용 · 경비 정책 · 근태 정책 · 양식·결재 · 파일 보관 · 요금제가 나와요.", shot: "admin-settings-nav" },
      { body: "메뉴를 누르면 화면 위에 탭이 있어요. 예: 경비 정책 = 식대 한도 | 자차 유류비 | 출장 일비 | 정기 결제 | 마감 일정.", shot: "admin-policy-tabs" },
      { body: "근태 정책은 [기능 사용]에서 근태를 켜야 나타나요." },
      { body: "이 휴대폰·PC에서 알림을 받을지는 회사 설정이 아니라 메뉴 맨 아래 [이 기기 알림]에서 정해요." },
    ],
  },
  {
    id: "company-info", cat: "basic", audience: "admin", title: "회사 이름·사업자등록번호 바꾸기", summary: "설정 › 회사 기본정보 › 회사정보에서 바꿔요.",
    keywords: ["회사명", "회사 이름", "사업자", "사업자등록번호", "상호"], path: "/admin/settings", pathLabel: "회사정보로 이동",
    steps: [
      { body: "설정 › 회사 기본정보 › [회사정보] 탭을 열어요." },
      { body: "회사명·사업자등록번호를 고치고 [저장]을 눌러요. 하이픈(-)은 넣어도 되고 빼도 돼요." },
      { body: "사업자등록번호를 바꾸면 회사 등록 때와 같은 확인을 다시 거쳐요." },
    ],
  },
  {
    id: "company-location", cat: "basic", audience: "admin", title: "회사 위치(주소) 넣기", summary: "[주소 검색]에서 도로명·지번·건물명으로 찾아 고르면 바로 저장돼요.",
    keywords: ["주소", "위치", "우편번호", "지번", "회사 주소", "정류장"], path: "/admin/settings/location", pathLabel: "회사 위치로 이동",
    steps: [
      { body: "설정 › 회사 기본정보 › [회사 위치] 탭에서 [주소 검색]을 눌러요." },
      { body: "도로명(판교원로 3)·지번(삼평동 670)·건물명 아무거나로 찾아 목록에서 골라요. 도로명·지번·우편번호가 함께 저장되고 위치(좌표)는 자동으로 찾아요.", shot: "admin-location" },
      { body: "회사 200m 안 버스 정류장이 지도에 보여요. 정류장이 있으면 직원 홈에 [주변 버스]가 생겨요(전국 시내버스)." },
    ],
  },
  {
    id: "departments", cat: "basic", audience: "admin", title: "부서 만들기와 직원 부서 정하기", summary: "설정 › 회사 기본정보 › 부서에서 만들고, [멤버 관리]에서 직원에게 정해요.",
    keywords: ["부서", "조직도", "팀"], path: "/admin/departments", pathLabel: "부서로 이동",
    steps: [
      { body: "설정 › 회사 기본정보 › [부서] 탭에서 부서를 만들어요." },
      { body: "왼쪽 [멤버 관리]에서 직원을 눌러 부서를 정해요." },
      { body: "부서는 월별 지출 현황·사전 검토 결재라인·회사 양식(신청자 부서)에 쓰여요." },
    ],
  },
  {
    id: "invite", cat: "basic", audience: "admin", title: "직원 초대하고 가입 승인하기", summary: "초대 링크를 보내고, 가입한 직원을 [멤버 관리]에서 승인해요.",
    keywords: ["초대", "가입", "직원 추가", "승인", "멤버", "링크", "카카오톡 초대"], path: "/admin/members", pathLabel: "멤버 관리로 이동",
    steps: [
      { body: "관리자 홈이나 [멤버 관리]의 초대 링크를 카카오톡으로 보내요. 직원은 링크로 카카오·구글 계정으로 가입해요." },
      { body: "가입한 직원은 [멤버 관리]에서 승인해야 쓸 수 있어요.", shot: "admin-members" },
      { body: "관리자 역할도 [멤버 관리]에서 직원을 눌러 바꿔요." },
    ],
  },
  {
    id: "features", cat: "basic", audience: "admin", title: "근태·사내 캘린더 켜고 끄기", summary: "설정 › 기능 사용에서 켜고 꺼요. 꺼도 기록은 남아요.",
    keywords: ["근태 켜기", "캘린더 켜기", "끄기", "기능", "스위치"], path: "/admin/features", pathLabel: "기능 사용으로 이동",
    steps: [
      { body: "설정 › [기능 사용]을 열어요.", shot: "admin-features" },
      { body: "근태를 켜면 직원 아래 가운데 버튼이 [QR 출퇴근]으로 바뀌고, 설정에 [근태 정책] 메뉴가 생겨요." },
      { body: "사내 캘린더는 처음부터 켜져 있어요. 쓰지 않으면 꺼서 직원 화면에서 숨길 수 있어요. 꺼도 일정·기록은 지워지지 않아요." },
    ],
  },
  {
    id: "device-alerts", cat: "basic", title: "휴대폰·PC에서 알림 받기", summary: "알림은 기기마다 따로 켜요. 직원은 [내 정보], 관리자는 [이 기기 알림].",
    keywords: ["알림", "푸시", "알람", "안 와요", "소리", "진동", "아이폰"], path: "/employee/profile", adminPath: "/admin/device-alerts", pathLabel: "알림 설정으로 이동",
    steps: [
      { body: "직원은 [내 정보], 관리자는 왼쪽 메뉴 맨 아래 [이 기기 알림]에서 [알림 켜기]를 눌러요." },
      { body: "아이폰은 Safari [공유 › 홈 화면에 추가]로 만든 아이콘으로 열어야 켤 수 있어요." },
      { body: `알림이 막혀 있으면 휴대폰(또는 브라우저) 설정 › 알림에서 허용해 주세요. 안드로이드 앱은 설정 › 애플리케이션 › ${BRAND.name} › 알림이에요.` },
    ],
  },
  {
    id: "install-app", cat: "basic", title: "휴대폰에 앱처럼 설치하기", summary: "안드로이드는 앱을 받고, 아이폰은 홈 화면에 추가해요.",
    keywords: ["설치", "앱", "다운로드", "홈 화면", "apk", "안드로이드", "아이폰"], path: "/download", pathLabel: "앱 받기 화면",
    steps: [
      { body: "안드로이드는 [앱 받기] 화면에서 설치 파일을 받아 설치해요. 알림이 더 잘 와요." },
      { body: "아이폰은 Safari로 열고 [공유 › 홈 화면에 추가]를 눌러요. 홈 화면 아이콘으로 열어야 알림을 받을 수 있어요." },
    ],
  },
  {
    id: "profile", cat: "basic", title: "내 정보(계좌·차량·유종) 넣기", summary: "[내 정보]에 정산 계좌·차량 번호·유종을 넣어 두면 정산·자차 청구에 쓰여요.",
    keywords: ["내 정보", "계좌", "정산 계좌", "차량 번호", "유종", "전화번호"], path: "/employee/profile", pathLabel: "내 정보로 이동",
    steps: [
      { body: "아래 메뉴 [내 정보]를 열어요." },
      { body: "정산 계좌(은행·계좌번호·예금주)를 넣어 두면 사비 정산 때 관리자가 바로 보내요." },
      { body: "자기 차로 출장 가면 차량 번호·유종을 넣어 두세요. 유종으로 유류비가 계산돼요." },
    ],
  },
  {
    id: "theme", cat: "basic", title: "화면 색상 바꾸기", summary: "관리자는 머리글 [색상], 직원은 [내 정보]에서 골라요.",
    keywords: ["색상", "테마", "화면 색", "다크"], path: "/employee/profile", pathLabel: "내 정보로 이동",
    steps: [{ body: "관리자 모드에서는 머리글 [색상]을, 직원 모드에서는 [내 정보]의 화면 색상을 눌러 골라요. 내 계정에만 적용돼요." }],
  },
  {
    id: "feedback", cat: "basic", title: "버그 신고·기능 개선 보내기", summary: "머리글 경광등 아이콘 [의견 보내기]로 만드는 사람들에게 바로 보내요.",
    keywords: ["버그", "오류", "신고", "기능 요청", "기능 개선", "의견", "문의"],
    steps: [
      { body: "머리글의 경광등 아이콘(의견 보내기)을 눌러요." },
      { body: "[버그 신고] 또는 [기능 개선]을 고르고 내용을 적어요. 버그는 화면 캡처 1장을 붙일 수 있어요." },
      { body: "회사 관리자는 보지 않고 서비스 만드는 사람들에게만 가요. 버그는 24시간 안에 확인해요." },
    ],
  },
  {
    id: "help-center", cat: "basic", title: "AI 도움말 쓰는 법", summary: "궁금한 걸 문장이나 단어로 물으면 도움말 글을 바탕으로 답해요.",
    keywords: ["도움말", "사용법", "AI", "물어보기", "질문"],
    path: "/employee/help", adminPath: "/admin/help", pathLabel: "도움말 열기",
    steps: [
      { body: "직원은 홈 맨 아래 [AI 도움말], 관리자는 머리글 [?]에서 물어봐요." },
      { body: "\"퇴근 안 찍었어요\"처럼 문장도, \"연차\"처럼 단어 하나도 돼요. 단어 하나면 맞는 글을 바로 보여 줘요." },
      { body: "답 아래 글에는 단계별 화면 그림과 [▶ 화면으로 보기], [이동] 버튼이 있어요. AI 답변은 한 사람 하루 20번까지예요." },
    ],
  },
  {
    id: "billing", cat: "basic", audience: "admin", title: "요금제와 저장 용량", summary: "설정 › 요금제에서 요금제·남은 영수증·저장 용량을 봐요.",
    keywords: ["요금", "결제", "가격", "용량", "해지", "구독", "크레딧"], path: "/admin/billing", pathLabel: "요금제로 이동",
    steps: [
      { body: "설정 › [요금제]에서 지금 요금제와 남은 영수증 장수를 봐요. 지금은 결제 준비 중이라 그대로 무료로 쓸 수 있어요." },
      { body: "채팅 사진·파일과 파일 보관함 용량을 늘리는 추가 상품(10·25·50·100GB)은 결제가 열리면 신청할 수 있어요." },
    ],
  },
  {
    id: "file-retention", cat: "basic", audience: "admin", title: "채팅 파일 보관 기간 정하기", summary: "설정 › 파일 보관에서 사용량과 채팅 파일 보관 기간을 정해요.",
    keywords: ["보관 기간", "파일 삭제", "용량", "저장 공간"], path: "/admin/chat-settings", pathLabel: "파일 보관으로 이동",
    steps: [
      { body: "설정 › [파일 보관]에서 회사 저장 공간 사용량을 봐요." },
      { body: "채팅 사진·파일을 얼마 동안 둘지 골라요. 기간이 지나면 지워지고, 오래 둘 파일은 직원이 [영구 보관]으로 파일 보관함에 넣어요." },
    ],
  },

  // ── 경비 ──
  {
    id: "claim-write", cat: "expense", title: "지출결의서 쓰기(영수증 올리기)", summary: "영수증 사진을 올리면 AI가 칸을 채워요. 확인하고 [결재 상신]만 누르면 돼요.",
    keywords: ["결의서", "영수증", "올리기", "작성", "청구", "경비", "상신"], path: "/employee/claims", pathLabel: "지출결의로 이동", sim: "receipt",
    steps: [
      { body: "홈 [지출결의]에서 새 결의서를 만들어요.", shot: "emp-claims" },
      { body: "[영수증 추가]로 사진·PDF를 올려요(한 번에 10장, 결의서당 30장). AI가 가맹점·날짜·금액·분류를 채워요." },
      { body: "행을 눌러 인원수·목적 같은 남은 칸을 채우면 '입력 완료'가 돼요." },
      { body: "[결재 상신]을 눌러요. 누구에게 가는지 결재선을 먼저 보여 줘요." },
    ],
  },
  {
    id: "claim-edit-item", cat: "expense", title: "AI가 잘못 읽은 금액·단가·날짜 고치기", summary: "영수증 행을 눌러 칸을 직접 고쳐요. 작성 중이거나 반려된 결의서만 돼요.",
    keywords: ["수정", "고치기", "단가", "금액", "잘못", "인식", "틀려요", "바꾸기"], path: "/employee/claims", pathLabel: "지출결의로 이동",
    steps: [
      { body: "결의서 화면에서 그 영수증 행을 눌러 항목 화면을 열어요." },
      { body: "금액·날짜·가맹점 칸을 고치고 저장해요. 고친 칸은 'AI 입력' 표시가 사라져요." },
      { body: "이미 결재 중이면 결재자에게 반려를 부탁한 뒤 고쳐요. 영수증 사진을 다시 올리면 새로 읽어요." },
    ],
  },
  {
    id: "claim-trip", cat: "expense", title: "출장 경비 올리기", summary: "[출장 경비]를 켜고 출장지·기간·목적을 넣으면 영수증이 출장비로 분류돼요.",
    keywords: ["출장", "숙박", "택시", "교통비", "일비"], path: "/employee/claims", pathLabel: "지출결의로 이동",
    steps: [
      { body: "결의서 위 [출장 경비] 스위치를 켜고 출장지·기간·목적을 넣어요. 캘린더에 적어 둔 출장을 고르면 자동으로 채워져요." },
      { body: "그다음 올리는 영수증은 출장비로 분류되고 세부 유형(출장 식비·대중교통·택시·통행료·숙박 등)이 추천돼요." },
      { body: "회사가 출장 일비를 쓰면 기간만큼 일비 한 줄이 자동으로 들어가요(영수증 필요 없음)." },
    ],
  },
  {
    id: "own-car", cat: "expense", title: "자기 차로 다녀온 유류비 청구", summary: "[영수증 없이 항목 추가] → 자차로 출발지·도착지를 넣으면 거리·유류비가 계산돼요.",
    keywords: ["자차", "유류비", "기름값", "주행", "거리", "km"], path: "/employee/claims", pathLabel: "지출결의로 이동",
    steps: [
      { body: "결의서에서 [영수증 없이 항목 추가] → 자차를 골라요." },
      { body: "출발지·도착지를 넣으면 거리가 계산되고, 회사가 정한 km당 단가(또는 그날 전국 평균 유가)로 금액이 나와요. 왕복이면 왕복을 켜요." },
      { body: "회사가 계기판 사진을 받기로 했으면 출발·도착 사진 2장을 올려요." },
    ],
  },
  {
    id: "meal", cat: "expense", title: "식대 올릴 때 인원수", summary: "식대는 '1인 한도 × 함께 먹은 인원수'로 계산해서 인원수를 꼭 넣어요.",
    keywords: ["식대", "점심", "인원", "회식", "한도 초과"], path: "/employee/claims", pathLabel: "지출결의로 이동",
    steps: [
      { body: "식대 영수증 행을 눌러 함께 먹은 인원수를 넣어요." },
      { body: "한도를 넘으면 회사 정책에 따라 넘은 금액을 직원이 내거나(절사), '한도 초과' 표시만 붙어요." },
    ],
  },
  {
    id: "claim-rejected", cat: "expense", title: "반려된 결의서 다시 내기", summary: "반려 사유를 보고 고친 뒤 [재상신]을 눌러요.",
    keywords: ["반려", "다시", "재상신", "거절", "돌려받"], path: "/employee/claims?status=rejected", pathLabel: "반려된 결의서 보기",
    steps: [
      { body: "홈 [나의 신청함]의 [반려] 또는 [지출결의]에서 반려된 결의서를 열어요. 반려 사유와 문제 항목이 강조돼 보여요." },
      { body: "항목을 고치거나 지우고 [재상신]을 누르면 결재가 처음 단계부터 다시 진행돼요." },
    ],
  },
  {
    id: "settlement", cat: "expense", title: "사비로 쓴 돈 정산 받기", summary: "결의서가 승인되면 정산 대기 → 관리자가 이체하면 알림이 와요.",
    keywords: ["정산", "사비", "입금", "지급", "돈 언제", "환급"], path: "/employee/settlements", pathLabel: "정산으로 이동",
    steps: [
      { body: "개인 카드·현금으로 낸 경비는 결의서가 승인되면 '정산 대기'가 돼요." },
      { body: "관리자가 이체한 뒤 [지급 완료]로 바꾸면 알림이 와요. 홈 [정산]에서 받을 돈과 받은 내역을 봐요." },
      { body: "정산 계좌는 [내 정보]에 넣어 두세요." },
    ],
  },
  {
    id: "approve", cat: "expense", title: "결재하기(승인·반려)", summary: "알림을 누르거나 결재함·지출 승인 관리에서 [일괄 승인]·[반려].",
    keywords: ["결재", "승인", "반려하기", "결재함", "검토"], path: "/approvals", adminPath: "/admin/claims", pathLabel: "결재하러 가기",
    steps: [
      { body: "결재할 결의서는 [결재함](사전 검토자) 또는 관리자 [지출 승인 관리]에 모여요. 알림을 누르면 바로 열려요." },
      { body: "[일괄 승인]은 결의서 전체를 한 번에 승인해요. [반려]는 사유를 적고(5자 이상) 문제 항목을 골라 줄 수 있어요." },
      { body: "관리자 누구든 처리할 수 있고 먼저 처리한 사람의 결정이 반영돼요. 본인 결의서는 처리할 수 없어요." },
    ],
  },
  {
    id: "approval-lines", cat: "expense", audience: "admin", title: "사전 검토 결재라인(팀장 검토) 만들기", summary: "관리자 승인 전에 먼저 볼 사람(팀장 등)을 정해요.",
    keywords: ["결재라인", "팀장", "검토자", "결재 순서", "사전 검토"], path: "/admin/approval-lines", pathLabel: "결재라인으로 이동",
    steps: [
      { body: "설정 › 양식·결재 › [사전 검토 결재라인]을 열어요." },
      { body: "부서·직원별로 관리자 승인 전에 먼저 볼 사람을 정해요. 없으면 결의서는 바로 관리자 승인으로 가요." },
    ],
  },
  {
    id: "meal-limit", cat: "expense", audience: "admin", title: "식대 한도·유류비·출장 일비 정하기", summary: "설정 › 경비 정책 탭에서 정해요. 바꾼 값은 이후 상신부터 적용돼요.",
    keywords: ["식대 한도", "한도", "유류비 단가", "일비", "km", "정책"], path: "/admin/settings/meal", pathLabel: "경비 정책으로 이동",
    steps: [
      { body: "설정 › 경비 정책 › [식대 한도]: 1인 한도와 넘었을 때 처리(절사·자율 승인)를 골라요.", shot: "admin-policy-tabs" },
      { body: "[자차 유류비]: km당 고정 단가 또는 그날 전국 평균 유가 기준, 계기판 사진 받기를 정해요." },
      { body: "[출장 일비]: 하루 금액을 정하면 출장 기간만큼 자동으로 들어가요." },
    ],
  },
  {
    id: "corporate-cards", cat: "expense", audience: "admin", title: "법인카드 등록과 카드 내역 대조", summary: "카드를 등록하면 영수증 카드 번호로 자동 판별, 카드사 파일로 빠진 영수증을 찾아요.",
    keywords: ["법인카드", "카드", "대조", "카드 내역", "카드사"], path: "/admin/corporate-cards", pathLabel: "법인카드로 이동",
    steps: [
      { body: "설정 › 회사 자산 › [법인카드]에 별칭과 번호 앞 6자리·뒤 4자리를 넣어요." },
      { body: "직원이 올린 영수증의 카드 번호로 법인카드인지 자동으로 가려요." },
      { body: "월말에 카드사 사용 내역 파일(엑셀·CSV)을 올리면 결의서 없는 카드 결제와 사비로 잘못 올린 건을 찾아 줘요." },
    ],
  },
  {
    id: "recurring", cat: "expense", audience: "admin", title: "매달 나가는 정기 결제 등록", summary: "월세·구독처럼 매달 나가는 지출을 등록해 두면 매달 챙겨 줘요.",
    keywords: ["정기 결제", "구독", "월세", "매달", "자동이체"], path: "/admin/recurring", pathLabel: "정기 결제로 이동",
    steps: [
      { body: "설정 › 경비 정책 › [정기 결제]에서 이름·금액·결제일·담당자를 넣어요." },
      { body: "카드 내역 대조 때 정기 결제와 맞춰 보고, 금액·가맹점 이름이 바뀌면 알려 줘요." },
    ],
  },
  {
    id: "payouts", cat: "expense", audience: "admin", title: "직원 사비 정산 지급하기", summary: "[정산 지급 관리]에서 직원별 금액을 보고 이체 뒤 [지급 완료].",
    keywords: ["정산 지급", "이체", "지급 완료", "사비 정산"], path: "/admin/payouts", pathLabel: "정산 지급 관리로 이동",
    steps: [
      { body: "왼쪽 [정산 지급 관리]에서 승인됐지만 아직 보내지 않은 직원별 금액을 봐요." },
      { body: "은행에서 이체한 뒤 [지급 완료]를 누르면 직원에게 알림이 가요. 계좌가 없는 직원에겐 등록 요청 문구를 복사해 보낼 수 있어요." },
    ],
  },
  {
    id: "tax-closing", cat: "expense", audience: "admin", title: "월말 세무 마감 자료 보내기", summary: "[세무 마감]에서 승인된 지출 장부·영수증·결의서 PDF를 한 번에 받아요.",
    keywords: ["세무", "마감", "세무사", "장부", "다운로드", "월말"], path: "/admin/export", pathLabel: "세무 마감으로 이동", sim: "closing",
    steps: [
      { body: "왼쪽 [세무 마감]에서 달을 골라요. 승인된 지출만 모여 있어요." },
      { body: "지출 장부(엑셀)·영수증·지출결의서 PDF를 한 번에 받을 수 있어요." },
      { body: "세무사무소를 연결해 두면 사무소가 전용 화면에서 직접 받아 가요." },
    ],
  },
  {
    id: "tax-office-connect", cat: "expense", audience: "admin", title: "세무사무소 연결하기", summary: "설정 › 회사 기본정보 › 세무사무소에 사무소 이메일을 넣어요.",
    keywords: ["세무사무소", "세무사", "기장", "연결"], path: "/admin/tax-office", pathLabel: "세무사무소로 이동",
    steps: [
      { body: "설정 › 회사 기본정보 › [세무사무소]에 계약한 사무소 이름·이메일을 넣어요." },
      { body: "안내 문구를 복사해 사무소에 보내면, 사무소는 무료 전용 화면에서 승인된 장부·영수증을 받아요." },
    ],
  },
  {
    id: "spending", cat: "expense", audience: "admin", title: "월별 지출 현황 보기", summary: "[월별 지출 현황]에서 계정과목·부서별로 이번 달 지출을 봐요.",
    keywords: ["지출 현황", "통계", "부서별", "계정과목", "이번 달 지출"], path: "/admin/spending", pathLabel: "지출 현황으로 이동",
    steps: [{ body: "왼쪽 [월별 지출 현황]에서 달을 골라 계정과목별·부서별 금액을 봐요." }],
  },
  {
    id: "vehicles", cat: "expense", audience: "admin", title: "회사차량 등록", summary: "설정 › 회사 자산 › 회사차량에 등록하면 출장 때 직원이 골라요.",
    keywords: ["회사차량", "법인차", "차량 등록"], path: "/admin/vehicles", pathLabel: "회사차량으로 이동",
    steps: [{ body: "설정 › 회사 자산 › [회사차량]에 차 이름과 번호를 넣어요. 직원이 출장 경비에서 회사차량을 고를 수 있어요." }],
  },

  // ── 근태/신청 ──
  {
    id: "qr-attend", cat: "attendance", needs: "attendance", title: "QR로 출근·퇴근 찍기", summary: "입구 기기의 QR을 아래 가운데 [QR 출퇴근]으로 찍어요.",
    keywords: ["출근", "퇴근", "QR", "찍기", "출퇴근", "인증"], path: "/employee/attend", pathLabel: "QR 출퇴근 열기", sim: "qr",
    steps: [
      { body: "회사 입구 PC·태블릿(출근 단말)에 30초마다 바뀌는 QR이 떠 있어요." },
      { body: "앱 아래 가운데 [QR 출퇴근] 버튼이나 휴대폰 기본 카메라로 찍어요. 시각은 휴대폰이 아니라 서버 시간이에요." },
      { body: "처음 찍으면 출근, 다시 찍으면 '퇴근할까요?'를 확인하고 퇴근이에요. 하루 출근 1번·퇴근 1번만 돼요." },
    ],
  },
  {
    id: "attendance-fix", cat: "attendance", needs: "attendance", title: "출퇴근 시각 잘못 찍었을 때(정정 신청)", summary: "[출퇴근 기록]에서 그날을 눌러 정정 신청해요.",
    keywords: ["정정", "잘못", "늦게", "깜빡", "안 찍", "못 찍", "안찍", "못찍", "수정", "기록이 없"], path: "/employee/attendance", pathLabel: "출퇴근 기록으로 이동", sim: "qr",
    steps: [
      { body: "홈 [출퇴근 기록]을 눌러요.", shot: "emp-home-tiles" },
      { body: "고칠 날짜를 누르고 [정정 신청]을 눌러요. 이번 달 기록만, 날짜마다 대기 1건만 돼요.", shot: "emp-attendance-month" },
      { body: "바꿀 시각과 사유를 적어 보내요. 관리자가 승인하면 반영되고 원래 기록은 그대로 남아요." },
    ],
  },
  {
    id: "holiday-work", cat: "attendance", needs: "attendance", title: "휴일에 일했을 때(휴일 근무 상신)", summary: "휴일에 QR로 찍은 날은 한 일을 적어 상신해요.",
    keywords: ["휴일 근무", "주말 근무", "특근", "휴일"], path: "/employee/attendance", pathLabel: "출퇴근 기록으로 이동",
    steps: [
      { body: "휴일에도 QR로 출퇴근을 찍어요." },
      { body: "[출퇴근 기록]에서 그날을 눌러 한 일을 적어 상신해요. 승인돼야 근무한 날로 세요." },
    ],
  },
  {
    id: "leave-request", cat: "attendance", needs: "attendance", title: "휴가 신청하기와 남은 연차 보기", summary: "[휴가 및 근태 신청]에서 남은 연차를 보고 [휴가 신청].",
    keywords: ["휴가", "연차", "반차", "신청", "남은 연차", "병가", "경조사"], path: "/employee/vacation", pathLabel: "휴가 및 근태 신청으로 이동", sim: "leave",
    steps: [
      { body: "홈 [휴가 및 근태 신청]에서 남은 연차를 봐요.", shot: "emp-vacation" },
      { body: "[휴가 신청]에서 종류·날짜를 고르면 근무일과 '남은 연차 4일 → 3일'을 미리 보여 줘요. 시간차를 쓰는 회사는 시간 단위로도 돼요.", shot: "emp-vacation-new" },
      { body: "회사 휴가신청서 양식이 있으면 [회사 추가 항목](업무 대행자 등)을 채워요. 지난번 값이 미리 채워져요." },
      { body: "보내면 관리자에게 알림이 가요. 진행 상태는 홈 [나의 신청함]에서 보여요." },
    ],
  },
  {
    id: "leave-cancel", cat: "attendance", needs: "attendance", title: "휴가 취소하기", summary: "승인 전에는 바로 취소, 승인 뒤에는 취소 신청을 해요.",
    keywords: ["휴가 취소", "연차 취소", "취소 신청", "연차 돌려"], path: "/employee/vacation", pathLabel: "휴가 및 근태 신청으로 이동",
    steps: [
      { body: "[휴가 및 근태 신청]에서 그 휴가를 눌러요." },
      { body: "승인 전이면 [신청 취소]로 바로 취소돼요. 승인 뒤면 사유를 적어 취소 신청 → 관리자가 승인하면 연차를 돌려받아요." },
    ],
  },
  {
    id: "leave-proof", cat: "attendance", needs: "attendance", title: "휴가 증빙(진단서 등) 올리기", summary: "증빙이 필요한 휴가는 서류를 올려야 승인돼요. 나중에 올려도 돼요.",
    keywords: ["증빙", "진단서", "서류", "첨부", "병가 서류"], path: "/employee/vacation", pathLabel: "휴가 및 근태 신청으로 이동",
    steps: [
      { body: "신청할 때 사진·PDF를 올리거나, 나중에 [휴가 및 근태 신청]에서 그 휴가를 눌러 올려요." },
      { body: "민감정보 수집·이용에 동의해야 올릴 수 있어요. 증빙은 휴가 끝난 날로부터 3년 뒤 지워져요." },
    ],
  },
  {
    id: "leave-company-form", cat: "attendance", needs: "attendance", title: "우리 회사 휴가신청서(PDF·엑셀) 받기", summary: "회사 양식으로 낸 휴가는 상세에서 [휴가신청서 PDF]·[엑셀]을 받아요.",
    keywords: ["휴가신청서", "양식", "회사 양식", "PDF", "출력", "인쇄"], path: "/employee/vacation", pathLabel: "휴가 및 근태 신청으로 이동", sim: "leave",
    steps: [
      { body: "[휴가 및 근태 신청]에서 휴가를 눌러 상세를 열어요." },
      { body: "[휴가신청서 PDF] 또는 [엑셀]을 누르면 회사가 등록한 양식 모양 그대로 나와요." },
      { body: "결재란에는 신청한 사람과 승인한 사람의 이름·직급·날짜가 들어가요. 승인 전이면 '결재 전'이에요." },
    ],
  },
  {
    id: "my-requests", cat: "attendance", title: "나의 신청함 보는 법", summary: "홈 메뉴 아래에 지금 진행 중인 내 신청이 모여요.",
    keywords: ["나의 신청함", "신청 내역", "상태", "대기", "진행"], path: "/employee", pathLabel: "홈으로 이동",
    steps: [
      { body: "홈 메뉴 아래 [나의 신청함]에 오늘 출근, 오늘 내 회의실 예약, 휴가·근태 신청, 지출결의서, 사비 정산 대기금이 모여요.", shot: "emp-my-requests" },
      { body: "[대기중]은 결재를 기다리는 것, [승인]은 최근 7일 안에 승인된 것, [반려]는 반려된 것이에요. 누르면 그 화면으로 가요." },
    ],
  },
  {
    id: "attendance-admin", cat: "attendance", audience: "admin", needs: "attendance", title: "근무 기준 정하기", summary: "설정 › 근태 정책 › 근무 기준에서 근무 요일·시각·5인 미만 여부를 정해요.",
    keywords: ["근무 기준", "근무시간", "근무 요일", "5인 미만", "연차 기준"], path: "/admin/attendance-settings", pathLabel: "근무 기준으로 이동",
    steps: [
      { body: "설정 › 근태 정책 › [근무 기준]에서 근무 요일·시각, 퇴근을 잊었을 때 알릴 시간을 정해요." },
      { body: "5인 미만 회사인지, 연차 연도 기준(회계연도·입사일)도 여기서 골라요. 바꾼 내용은 [변경 이력]에 남아요." },
    ],
  },
  {
    id: "attendance-terminal", cat: "attendance", audience: "admin", needs: "attendance", title: "출근 단말(QR 띄울 기기) 연결", summary: "출근 단말 탭에서 연결 코드를 받아 입구 기기에서 넣어요.",
    keywords: ["출근 단말", "QR 단말", "태블릿", "단말 연결", "QR 띄우기"], path: "/admin/attendance-settings/terminals", pathLabel: "출근 단말로 이동",
    steps: [
      { body: "설정 › 근태 정책 › [출근 단말]에서 [출근 단말 추가 (연결 코드 받기)]를 눌러요." },
      { body: "입구 PC·태블릿에서 출근 단말 화면을 열고 그 코드를 넣으면 그 기기에 QR이 떠요. 켜 둔 채로 두면 돼요." },
    ],
  },
  {
    id: "attendance-approve", cat: "attendance", audience: "admin", needs: "attendance", title: "근태 승인하기(정정·휴일 근무·휴가)", summary: "왼쪽 [근태]의 승인 대기에서 처리해요.",
    keywords: ["근태 승인", "휴가 승인", "정정 승인", "승인 대기"], path: "/admin/attendance?tab=pending", pathLabel: "근태 승인으로 이동",
    steps: [
      { body: "왼쪽 [근태]의 [승인 대기]에 정정·휴일 근무·휴가 신청이 모여요. 숫자 배지는 내가 처리할 수 있는 건수예요." },
      { body: "[승인] 또는 [반려](사유 필수)를 눌러요. 휴가는 남은 연차가 어떻게 바뀌는지 함께 보여 줘요." },
      { body: "회사 양식으로 낸 휴가는 [휴가신청서 PDF]·[엑셀]로 바로 받을 수 있어요." },
    ],
  },
  {
    id: "leave-admin", cat: "attendance", audience: "admin", needs: "attendance", title: "직원별 연차 정하기", summary: "근로기준법 기준 추천 일수를 보고 직원마다 확정해요.",
    keywords: ["직원 연차", "연차 부여", "연차 확정", "연차 정", "입사일", "근로기준법"], path: "/admin/attendance-settings/leave", pathLabel: "직원별 연차로 이동",
    steps: [
      { body: "설정 › 근태 정책 › [직원별 연차]에서 직원마다 추천 일수를 봐요. 입사일도 여기서 넣어요." },
      { body: "[확정]하면 직원 화면에 남은 연차가 보여요. 바꾼 내용은 [변경 이력]에 남아요." },
    ],
  },
  {
    id: "leave-types", cat: "attendance", audience: "admin", needs: "attendance", title: "휴가 종류 켜고 끄기", summary: "경조사·병가·법정 휴가 중 우리 회사가 쓸 것을 켜요.",
    keywords: ["휴가 종류", "경조사", "병가", "법정 휴가", "포상휴가"], path: "/admin/attendance-settings/vacation-types", pathLabel: "휴가 종류로 이동",
    steps: [
      { body: "설정 › 근태 정책 › [휴가 종류]에서 쓸 종류를 켜요. 직접 만들 수도 있어요." },
      { body: "연차가 모자랄 때 막을지·당겨 쓰게 할지도 여기서 정해요." },
    ],
  },

  // ── 서류·양식 ──
  {
    id: "convert", cat: "convert", title: "종이·PDF 서류를 엑셀로 바꾸기", summary: "사진·PDF를 올리면 AI가 표 모양 그대로 엑셀로 바꿔요.",
    keywords: ["엑셀", "변환", "서류", "표", "PDF", "스캔", "사진을 엑셀"], path: "/employee/convert", pathLabel: "서류 → 엑셀로 이동", sim: "convert",
    steps: [
      { body: "홈 [서류 → 엑셀]에서 사진·PDF를 올려요." },
      { body: "AI가 칸·합친 칸·굵은 글씨까지 표 모양 그대로 읽어요." },
      { body: "PC에서는 표를 바로 고칠 수 있어요(글자·행 추가·삭제·되돌리기). 다 됐으면 엑셀이나 PDF로 받아요." },
    ],
  },
  {
    id: "convert-from-chat", cat: "convert", needs: "chat", title: "채팅 사진을 바로 엑셀로", summary: "채팅의 사진·PDF를 길게 눌러 [엑셀로 변환].",
    keywords: ["채팅 엑셀", "엑셀로 변환", "사진 길게"], path: "/chat", pathLabel: "채팅으로 이동",
    steps: [{ body: "채팅방의 사진·PDF를 길게 누르고(PC는 오른쪽 클릭) [엑셀로 변환]을 골라요. 결과는 [서류 → 엑셀]에 쌓여요." }],
  },
  {
    id: "company-forms", cat: "convert", audience: "admin", title: "회사 양식(휴가신청서) 등록하기", summary: "빈 양식 사진·PDF를 올리면 AI가 읽고, PC에서 칸을 연결해 등록해요.",
    keywords: ["양식", "휴가신청서", "회사 양식", "서식", "양식 등록"], path: "/admin/company-forms", pathLabel: "회사 양식으로 이동",
    steps: [
      { body: "설정 › 양식·결재 › [회사 양식]에서 [양식 추가]로 빈 양식 사진·PDF를 올려요. 휴대폰에서는 담아 두고 PC에서 이어 해요." },
      { body: "AI가 표와 값이 들어갈 칸을 읽어요. 칸마다 우리 데이터 / 직원 입력 / 고정 값 / 비워 두기 / 빼기를 골라요." },
      { body: "이름을 정하고 [등록하기]. 휴가신청서는 회사에 하나이고, 다시 올리면 새 버전이 돼요(무료)." },
    ],
  },
  {
    id: "form-template", cat: "convert", audience: "admin", title: "지출결의서 양식 맞추기", summary: "기본 양식을 쓰거나 회사에서 쓰던 결의서 양식을 올려 맞춰요.",
    keywords: ["지출결의서 양식", "결의서 양식", "칸 추가"], path: "/admin/form-template", pathLabel: "지출결의서 양식으로 이동",
    steps: [{ body: "설정 › 양식·결재 › [지출결의서 양식]에서 기본 양식을 쓰거나 쓰던 양식을 올려 AI로 맞춰요. 추가로 받을 칸(프로젝트명 등)도 여기서 정해요." }],
  },
  {
    id: "employee-forms", cat: "convert", needs: "attendance", title: "회사 양식이 있으면 휴가는 어떻게 달라지나요", summary: "신청 화면에 [회사 추가 항목]이 생기고, 우리 회사 휴가신청서로 받을 수 있어요.",
    keywords: ["양식", "회사 양식", "휴가신청서", "추가 항목"], path: "/employee/vacation", pathLabel: "휴가 및 근태 신청으로 이동", sim: "leave",
    steps: [
      { body: "관리자가 휴가신청서 양식을 등록하면 휴가 신청 화면 아래에 [회사 추가 항목]이 생겨요(필수 칸은 채워야 신청돼요)." },
      { body: "낸 휴가는 상세에서 [휴가신청서 PDF]·[엑셀]로 회사 양식 모양 그대로 받아요." },
    ],
  },

  // ── 채팅·캘린더 ──
  {
    id: "chat", cat: "together", needs: "chat", title: "사내 채팅 쓰기", summary: "1:1·단체 대화, 사진·파일 보내기.",
    keywords: ["채팅", "메신저", "대화", "단톡", "사진 보내기"], path: "/chat", pathLabel: "채팅으로 이동", sim: "chat",
    steps: [
      { body: "아래 [채팅](관리자는 머리글 말풍선)에서 1:1·단체 대화를 해요. 사진·파일도 보낼 수 있어요." },
      { body: "채팅 사진·파일은 회사가 정한 기간이 지나면 지워져요. 오래 두려면 길게 눌러 [영구 보관]해요." },
    ],
  },
  {
    id: "chat-thread", cat: "together", needs: "chat", title: "서브 대화(한 주제만 따로)", summary: "메시지에서 서브 대화를 열면 그 주제만 따로 이야기해요.",
    keywords: ["서브 대화", "스레드", "답글", "주제", "이슈"], path: "/chat", pathLabel: "채팅으로 이동", sim: "chat",
    steps: [
      { body: "단체방·결의서방의 메시지를 길게 눌러 서브 대화를 만들어요. 제목은 AI가 제안해요." },
      { body: "끝나면 종결하면 한 줄 요약이 남아요. 필요하면 [다시 열기]." },
    ],
  },
  {
    id: "claim-chat", cat: "together", needs: "chat", title: "결의서로 바로 대화하기", summary: "결의서에서 [이 건으로 대화]를 누르면 그 건 대화방이 열려요.",
    keywords: ["결의서 대화", "이 건으로 대화", "확인 요청"], path: "/employee/claims", pathLabel: "지출결의로 이동", sim: "chat",
    steps: [{ body: "궁금한 결의서에서 [이 건으로 대화]를 누르면 그 결의서 대화방이 열려요. 캡처해 보낼 필요가 없어요." }],
  },
  {
    id: "vault", cat: "together", needs: "chat", title: "파일 보관함", summary: "채팅 파일을 [영구 보관]하면 기간이 지나도 남아요.",
    keywords: ["보관", "보관함", "영구", "파일 지워", "저장"], path: "/employee/vault", pathLabel: "파일 보관함으로 이동", sim: "chat",
    steps: [
      { body: "채팅의 사진·파일을 길게 눌러 [영구 보관]하면 홈 [파일 보관함]에 남아요." },
      { body: "보관할 때 [나만 보기]·[회사 공유]를 골라요. 지우기는 보관한 사람과 관리자만 할 수 있어요." },
    ],
  },
  {
    id: "assistant", cat: "together", needs: "chat", title: "채팅 도우미에게 물어보기", summary: `채팅 목록 맨 위 [${BRAND.name} 도우미]에게 일정·회의실·결의서를 물어요.`,
    keywords: ["도우미", "챗봇", "내 일정", "빈 회의실"], path: "/chat", pathLabel: "채팅으로 이동",
    steps: [{ body: `채팅 목록 맨 위 [${BRAND.name} 도우미]에게 "내일 일정", "3층 회의실 언제 비어 있어?", "반려된 결의서"처럼 물으면 찾아 줘요.` }],
  },
  {
    id: "calendar", cat: "together", needs: "calendar", title: "캘린더에 일정 넣기", summary: "회의·외근·출장 일정을 넣고 함께할 사람을 골라요.",
    keywords: ["캘린더", "일정", "외근", "출장 일정", "스케줄"], path: "/calendar", pathLabel: "캘린더로 이동",
    steps: [
      { body: "[캘린더]에서 날짜를 눌러 회의·외근·출장 일정을 넣어요." },
      { body: "함께할 사람을 고르면 그 사람 캘린더에도 보여요. 청구·세무 마감일도 달력에 표시돼요." },
    ],
  },
  {
    id: "room-booking", cat: "together", needs: "calendar", title: "회의실 예약하기", summary: "[회의실 예약]에서 빈 칸을 누르거나 끌어서 예약해요.",
    keywords: ["회의실", "예약", "회의실 예약", "빈 회의실"], path: "/calendar/rooms", pathLabel: "회의실 예약으로 이동", sim: "rooms",
    steps: [
      { body: "캘린더의 [회의실 예약]에서 날짜를 골라요. PC는 회의실별 가로 시간표, 휴대폰은 회의실을 고르고 세로 시간표예요." },
      { body: "빈 칸을 누르면 그 시각부터 1시간, 끌면 끈 만큼 잡혀요. 같은 회의실은 같은 시간에 한 건만 돼요." },
      { body: "참석자를 고르면 그 사람 캘린더에 회의로 잡히고, 10분 전에 채팅 [알림]방으로 안내가 가요." },
    ],
  },
  {
    id: "meeting-agenda", cat: "together", needs: "calendar", title: "회의 안건·자료 미리 붙이기", summary: "회의 일정에 안건과 파일을 붙이면 참석자가 미리 봐요.",
    keywords: ["안건", "회의 자료", "첨부", "회의 준비"], path: "/calendar", pathLabel: "캘린더로 이동", sim: "rooms",
    steps: [{ body: "회의 일정이나 회의실 예약에서 [안건 및 자료]에 안건(2,000자)과 파일(10개)을 붙여요. 10분 전 알림 카드에서 바로 열려요." }],
  },
  {
    id: "bus", cat: "together", needs: "bus", title: "주변 버스 도착 정보", summary: "홈 [주변 버스]에서 회사 근처 정류장을 지도로, 누르면 도착 정보.",
    keywords: ["버스", "정류장", "도착", "교통", "지도", "몇 분"], path: "/employee/bus", pathLabel: "주변 버스로 이동",
    steps: [
      { body: "홈 [주변 버스]를 열면 회사 200m 안 정류장 3곳이 지도와 목록에 나와요(전국 시내버스)." },
      { body: "지도의 정류장이나 목록을 누르면 하이라이트되고 도착 정보가 펼쳐져요. 시간은 참고용이에요." },
    ],
  },
  {
    id: "bus-alert", cat: "together", needs: "bus", title: "버스 도착 알림 받기", summary: "[자세히 · 알림 받기]에서 버스 하나를 골라 10분·5분 전에 알림을 받아요.",
    keywords: ["버스 알림", "도착 알림", "10분 전"], path: "/employee/bus", pathLabel: "주변 버스로 이동",
    steps: [{ body: "정류장을 펼쳐 [자세히 · 알림 받기] → 노선의 [알림 받기]. 30분 동안 도착 10분 전·5분 전에 채팅 [알림]방과 휴대폰으로 알려요(직원당 1개)." }],
  },
];
