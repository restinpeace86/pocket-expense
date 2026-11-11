// 도움말 글 모음(D-251 개선사항 7): 화면 설명글을 기능별로 모은 것. AI 답변은 이 글들만 보고 한다(지어내지 않게)
// path = `/workspace/{회사}` 뒤 주소 → [해당 메뉴로 이동]. audience admin = 관리자에게만 보임
export type HelpCategory = "basic" | "expense" | "attendance" | "convert" | "together";
export type HelpFeature = "attendance" | "calendar" | "chat" | "bus";
export type HelpFeatures = Record<HelpFeature, boolean>;
// needs: 그 기능을 쓰는 회사에만 보이는 글(꺼진 회사에서 [이동]이 없는 화면으로 가지 않게)
export type HelpGuide = { id: string; cat: HelpCategory; audience: "all" | "admin"; title: string; body: string[]; path?: string; adminPath?: string; pathLabel?: string; keywords: string[]; needs?: HelpFeature };

export const HELP_CATEGORIES: { key: HelpCategory; label: string }[] = [
  { key: "basic", label: "기본 설정" },
  { key: "expense", label: "경비" },
  { key: "attendance", label: "근태/신청" },
  { key: "convert", label: "AI 엑셀 변환" },
  { key: "together", label: "채팅·캘린더" },
];

export const HELP_GUIDES: HelpGuide[] = [
  // ── 기본 설정(관리자) ──
  {
    id: "settings-map",
    cat: "basic",
    audience: "admin",
    title: "관리자 설정은 어디에 뭐가 있나요",
    body: [
      "왼쪽 메뉴 [설정]을 누르면 8개 메뉴가 나오고, 각 메뉴 화면 위 탭에서 세부 항목을 골라요.",
      "- 회사 기본정보: 회사정보 · 회사 위치 · 부서 · 세무사무소",
      "- 회사 자산: 법인카드 · 회사차량 · 회의실",
      "- 기능 사용: 근태 · 사내 캘린더 켜기/끄기",
      "- 경비 정책: 식대 한도 · 자차 유류비 · 출장 일비 · 정기 결제 · 마감 일정",
      "- 근태 정책(근태를 켰을 때만): 직원별 연차 · 휴가 종류 · 근무 기준 · 출근 단말 · 변경 이력",
      "- 양식·결재: 지출결의서 양식 · 회사 양식 · 사전 검토 결재라인",
      "- 파일 보관 · 요금제",
      "이 휴대폰·PC에서 알림을 받을지는 회사 설정이 아니라 메뉴 맨 아래 [이 기기 알림]에서 정해요.",
    ],
    path: "/admin/settings",
    pathLabel: "설정 열기",
    keywords: ["설정 메뉴", "설정 어디", "메뉴 구성"], // "어디"·"위치" 같은 흔한 말은 넣지 않는다(다른 글보다 앞서 버려서)
  },
  {
    id: "company-info",
    cat: "basic",
    audience: "admin",
    title: "회사 이름·사업자등록번호 바꾸기",
    body: ["설정 › 회사 기본정보 › 회사정보에서 회사명과 사업자등록번호를 고치고 [저장]을 눌러요.", "사업자등록번호를 바꾸면 회사 등록 때와 같은 확인을 다시 거쳐요. 하이픈(-)은 넣어도 되고 빼도 돼요."],
    path: "/admin/settings",
    pathLabel: "회사정보로 이동",
    keywords: ["회사명", "회사 이름", "사업자", "사업자등록번호", "상호"],
  },
  {
    id: "company-location",
    cat: "basic",
    audience: "admin",
    title: "회사 위치(주소) 넣기",
    body: [
      "설정 › 회사 기본정보 › 회사 위치에서 [주소 검색]을 누르고 도로명·지번·건물명 아무거나로 찾아 고르면 바로 저장돼요.",
      "도로명 주소·지번 주소·우편번호가 함께 저장되고, 위치(좌표)는 자동으로 찾아요.",
      "회사 근처에 버스 정류장이 있으면 직원 홈에 [주변 버스]가 생기고, 회사 200m 안 정류장이 지도에 보여요(전국 시내버스).",
    ],
    path: "/admin/settings/location",
    pathLabel: "회사 위치로 이동",
    keywords: ["주소", "위치", "우편번호", "지번", "회사 주소", "버스", "정류장"],
  },
  {
    id: "departments",
    cat: "basic",
    audience: "admin",
    title: "부서 만들기와 직원 부서 정하기",
    body: ["설정 › 회사 기본정보 › 부서에서 부서를 만들어요.", "직원의 부서는 왼쪽 메뉴 [멤버 관리]에서 직원을 눌러 정해요. 월별 지출 현황을 부서별로 볼 때 쓰여요."],
    path: "/admin/departments",
    pathLabel: "부서로 이동",
    keywords: ["부서", "조직도", "팀"],
  },
  {
    id: "invite",
    cat: "basic",
    audience: "admin",
    title: "직원 초대하고 가입 승인하기",
    body: ["관리자 홈이나 [멤버 관리]의 초대 링크를 카카오톡으로 보내면 직원이 링크로 가입해요.", "가입한 직원은 [멤버 관리]에서 승인해야 쓸 수 있어요. 관리자 역할도 여기서 바꿔요."],
    path: "/admin/members",
    pathLabel: "멤버 관리로 이동",
    keywords: ["초대", "가입", "직원 추가", "승인", "멤버", "링크", "역할", "관리자 권한"],
  },
  {
    id: "features",
    cat: "basic",
    audience: "admin",
    title: "근태·사내 캘린더 켜고 끄기",
    body: [
      "설정 › 기능 사용에서 켜고 꺼요. 꺼도 지금까지의 기록은 지워지지 않아요.",
      "근태를 켜면 직원 아래 가운데 버튼이 [QR 출퇴근]으로 바뀌고, 설정에 [근태 정책] 메뉴가 생겨요.",
      "사내 캘린더는 처음부터 켜져 있어요. 쓰지 않으면 꺼서 직원 화면에서 숨길 수 있어요.",
    ],
    path: "/admin/features",
    pathLabel: "기능 사용으로 이동",
    keywords: ["근태 켜기", "캘린더 켜기", "끄기", "기능", "스위치", "사용"],
  },
  {
    id: "device-alerts",
    cat: "basic",
    audience: "all",
    title: "휴대폰·PC에서 알림 받기",
    body: [
      "알림은 기기마다 따로 켜요. 직원은 [내 정보], 관리자는 왼쪽 메뉴 맨 아래 [이 기기 알림]에서 [알림 켜기]를 눌러요.",
      "아이폰은 Safari [공유 › 홈 화면에 추가]로 만든 아이콘으로 열어야 켤 수 있어요.",
      "알림이 막혀 있으면 휴대폰(또는 브라우저) 설정 › 알림에서 허용해 주세요.",
    ],
    path: "/employee/profile",
    adminPath: "/admin/device-alerts",
    pathLabel: "알림 설정으로 이동",
    keywords: ["알림", "푸시", "알람", "안 와요", "소리", "진동", "아이폰"],
  },
  {
    id: "billing",
    cat: "basic",
    audience: "admin",
    title: "요금제와 저장 용량",
    body: ["설정 › 요금제에서 지금 요금제와 남은 영수증 장수를 봐요. 지금은 결제 준비 중이라 그대로 무료로 쓸 수 있어요.", "채팅 사진·파일과 파일 보관함 용량을 늘리는 추가 상품(10·25·50·100GB)은 결제가 열리면 신청할 수 있어요."],
    path: "/admin/billing",
    pathLabel: "요금제로 이동",
    keywords: ["요금", "결제", "가격", "용량", "해지", "구독"],
  },

  // ── 경비 ──
  {
    id: "claim-write",
    cat: "expense",
    audience: "all",
    title: "지출결의서 쓰기(영수증 올리기)",
    body: [
      "홈 [지출결의] 또는 아래 [결의서 쓰기]로 새 결의서를 만들고 [영수증 추가]로 사진·PDF를 올려요(한 번에 10장, 결의서당 30장까지).",
      "AI가 가맹점·날짜·금액·분류를 채워요. 행을 눌러 인원수·목적 같은 남은 칸을 채우면 '입력 완료'가 돼요.",
      "자차 출장비처럼 영수증이 없는 건 [영수증 없이 항목 추가]로 만들어요.",
      "다 됐으면 [결재 상신]을 눌러요. 누구에게 가는지 결재선을 먼저 보여 줘요.",
    ],
    path: "/employee/claims",
    pathLabel: "지출결의로 이동",
    keywords: ["결의서", "영수증", "올리기", "작성", "청구", "경비", "상신", "결재 요청"],
  },
  {
    id: "claim-edit-item",
    cat: "expense",
    audience: "all",
    title: "AI가 잘못 읽은 금액·단가·날짜 고치기",
    body: [
      "결의서 화면에서 그 영수증 행을 누르면 항목 화면이 열려요. 금액·날짜·가맹점 등 칸을 직접 고치고 저장하면 돼요(고친 칸은 'AI 입력' 표시가 사라져요).",
      "결재 요청 전(작성 중)이나 반려된 결의서만 고칠 수 있어요. 이미 결재 중이면 결재자에게 반려를 부탁한 뒤 고쳐요.",
      "영수증 사진을 다시 올리면 새로 읽어요.",
    ],
    path: "/employee/claims",
    pathLabel: "지출결의로 이동",
    keywords: ["수정", "고치기", "단가", "금액", "잘못", "AI", "인식", "틀려요", "바꾸기"],
  },
  {
    id: "claim-trip",
    cat: "expense",
    audience: "all",
    title: "출장 경비 올리기",
    body: [
      "결의서 위 [출장 경비] 스위치를 켜고 출장지·기간·목적을 넣어요. 그다음 올리는 영수증은 모두 출장비로 분류되고 세부 유형(출장 식비·대중교통·택시·통행료·숙박·자차 등)이 추천돼요.",
      "회사가 출장 일비를 쓰면 기간만큼 일비 한 줄이 자동으로 들어가요(영수증 필요 없음).",
      "자기 차로 다녀왔으면 [영수증 없이 항목 추가] → 자차로 출발지·도착지를 넣으면 거리와 유류비가 계산돼요.",
    ],
    path: "/employee/claims",
    pathLabel: "지출결의로 이동",
    keywords: ["출장", "자차", "유류비", "일비", "거리", "숙박", "택시"],
  },
  {
    id: "claim-rejected",
    cat: "expense",
    audience: "all",
    title: "반려된 결의서 다시 내기",
    body: ["홈 [나의 신청함]이나 [지출결의]에서 반려된 결의서를 열면 반려 사유와 문제 항목이 강조돼 보여요.", "항목을 고치거나 지우고 [재상신]을 누르면 결재가 처음 단계부터 다시 진행돼요."],
    path: "/employee/claims?status=rejected",
    pathLabel: "반려된 결의서 보기",
    keywords: ["반려", "다시", "재상신", "거절", "돌려받"],
  },
  {
    id: "settlement",
    cat: "expense",
    audience: "all",
    title: "사비로 쓴 돈 정산 받기",
    body: ["개인 카드·현금으로 낸 경비는 결의서가 승인되면 '정산 대기'가 되고, 관리자가 이체한 뒤 [지급 완료]로 바꾸면 알림이 와요.", "홈 [정산]에서 받을 돈과 받은 내역을 봐요. 정산 계좌는 [내 정보]에 넣어 두세요."],
    path: "/employee/settlements",
    pathLabel: "정산으로 이동",
    keywords: ["정산", "사비", "입금", "지급", "계좌", "돈", "언제"],
  },
  {
    id: "approve",
    cat: "expense",
    audience: "all",
    title: "결재하기(승인·반려)",
    body: [
      "결재할 결의서는 [결재함](사전 검토자) 또는 관리자 [지출 승인 관리]에 모여요. 알림을 누르면 바로 열려요.",
      "[일괄 승인]은 결의서 전체를 한 번에 승인해요. [반려]는 사유를 적고(5자 이상) 문제 항목을 골라 줄 수 있어요. 항목별 부분 승인은 없어요.",
      "관리자 누구든 처리할 수 있고 먼저 처리한 사람의 결정이 반영돼요. 본인 결의서는 처리할 수 없어요.",
    ],
    path: "/approvals",
    pathLabel: "결재함으로 이동",
    keywords: ["결재", "승인", "반려하기", "결재함", "검토"],
  },
  {
    id: "approval-lines",
    cat: "expense",
    audience: "admin",
    title: "사전 검토 결재라인(팀장 검토) 만들기",
    body: ["설정 › 양식·결재 › 사전 검토 결재라인에서 부서·직원별로 관리자 승인 전에 먼저 볼 사람(팀장 등)을 정해요.", "결재라인이 없으면 결의서는 바로 관리자 승인으로 가요."],
    path: "/admin/approval-lines",
    pathLabel: "결재라인으로 이동",
    keywords: ["결재라인", "팀장", "검토자", "결재 순서", "사전 검토"],
  },
  {
    id: "meal-limit",
    cat: "expense",
    audience: "admin",
    title: "식대 한도·유류비·출장 일비 정하기",
    body: [
      "설정 › 경비 정책 탭에서 정해요. 식대는 '1인 한도 × 함께 먹은 인원수'로 계산하고, 넘으면 직원 부담(절사)이나 표시만(자율 승인) 중 골라요.",
      "자차 유류비는 km당 고정 단가 또는 그날 전국 평균 유가로 계산해요. 출장 일비는 하루 금액을 정해요.",
      "바꾼 값은 이후 결재 요청하는 경비부터 적용돼요.",
    ],
    path: "/admin/settings/meal",
    pathLabel: "경비 정책으로 이동",
    keywords: ["식대", "한도", "유류비", "일비", "km", "정책", "인원"],
  },
  {
    id: "corporate-cards",
    cat: "expense",
    audience: "admin",
    title: "법인카드 등록과 카드 내역 대조",
    body: ["설정 › 회사 자산 › 법인카드에 카드 별칭과 번호 앞 6자리·뒤 4자리를 넣으면, 영수증의 카드 번호로 법인카드인지 자동으로 가려요.", "카드사 내역 파일을 올리면 결의서와 맞춰 빠진 영수증을 찾아 줘요."],
    path: "/admin/corporate-cards",
    pathLabel: "법인카드로 이동",
    keywords: ["법인카드", "카드", "대조", "카드 내역", "카드사"],
  },
  {
    id: "tax-closing",
    cat: "expense",
    audience: "admin",
    title: "월말 세무 마감 자료 보내기",
    body: ["왼쪽 [세무 마감]에서 달을 고르면 승인된 지출 장부(엑셀)·영수증·지출결의서 PDF를 한 번에 받을 수 있어요.", "세무사무소를 연결해 두면(설정 › 회사 기본정보 › 세무사무소) 사무소가 직접 자료를 받아 가요."],
    path: "/admin/export",
    pathLabel: "세무 마감으로 이동",
    keywords: ["세무", "마감", "세무사", "엑셀", "장부", "다운로드", "월말"],
  },

  // ── 근태/신청 ──
  {
    id: "qr-attend",
    needs: "attendance",
    cat: "attendance",
    audience: "all",
    title: "QR로 출근·퇴근 찍기",
    body: [
      "회사 입구 PC·태블릿(출근 단말)에 뜬 QR을 앱 아래 가운데 [QR 출퇴근] 버튼이나 휴대폰 기본 카메라로 찍어요.",
      "처음 찍으면 출근, 다시 찍으면 '퇴근할까요?'를 확인하고 퇴근이에요. 하루 출근 1번·퇴근 1번만 돼요. 시각은 휴대폰이 아니라 서버 시간이에요.",
      "QR은 30초마다 바뀌어서 사진을 찍어 보내도 쓸 수 없어요.",
    ],
    path: "/employee/attend",
    pathLabel: "QR 출퇴근 열기",
    keywords: ["출근", "퇴근", "QR", "찍기", "출퇴근", "인증"],
  },
  {
    id: "attendance-fix",
    needs: "attendance",
    cat: "attendance",
    audience: "all",
    title: "출퇴근 시각 잘못 찍었을 때(정정 신청)",
    body: ["홈 [출퇴근 기록]에서 그날을 누르고 바꿀 시각과 사유를 적어 정정 신청을 해요. 이번 달 기록만, 날짜마다 대기 1건만 돼요.", "휴일에 일했다면 같은 곳에서 휴일 근무를 상신해요. 관리자가 승인하면 반영되고, 원래 기록은 그대로 남아요."],
    path: "/employee/attendance",
    pathLabel: "출퇴근 기록으로 이동",
    keywords: ["정정", "잘못", "늦게", "깜빡", "퇴근 안 찍", "휴일 근무", "수정"],
  },
  {
    id: "leave-request",
    needs: "attendance",
    cat: "attendance",
    audience: "all",
    title: "휴가 신청하기와 남은 연차 보기",
    body: [
      "홈 [휴가 및 근태 신청]에서 남은 연차를 보고 [휴가 신청]으로 종류·날짜·사유를 넣어 신청해요. 시간차를 쓰는 회사는 시간 단위로도 돼요.",
      "증빙이 필요한 휴가는 서류를 올려야 승인돼요. 나중에 올려도 돼요.",
      "승인 전에는 바로 취소, 승인 뒤에는 취소 신청을 해요. 진행 상태는 홈 [나의 신청함]에서 보여요.",
    ],
    path: "/employee/vacation",
    pathLabel: "휴가 및 근태 신청으로 이동",
    keywords: ["휴가", "연차", "반차", "신청", "남은 연차", "병가", "경조사", "취소"],
  },
  {
    id: "my-requests",
    cat: "attendance",
    audience: "all",
    title: "나의 신청함 보는 법",
    body: [
      "홈 메뉴 아래 [나의 신청함]에 지금 진행 중인 내 신청이 모여요: 오늘 출근, 오늘 내 회의실 예약, 휴가·근태 신청, 지출결의서, 사비 정산 대기금.",
      "[대기중]은 결재를 기다리는 것, [승인]은 최근 7일 안에 승인된 것, [반려]는 반려된 것이에요. 누르면 그 화면으로 가요.",
    ],
    path: "/employee",
    pathLabel: "홈으로 이동",
    keywords: ["나의 신청함", "신청 내역", "상태", "대기", "진행"],
  },
  {
    id: "attendance-admin",
    needs: "attendance",
    cat: "attendance",
    audience: "admin",
    title: "근무 기준·출근 단말 정하기",
    body: [
      "설정 › 근태 정책 › 근무 기준에서 근무 요일·시각, 퇴근을 잊었을 때 알릴 시간, 5인 미만 여부, 연차 연도 기준을 정해요.",
      "출근 단말 탭에서 [출근 단말 추가 (연결 코드 받기)]를 누르고, 입구 PC·태블릿에서 그 코드를 넣으면 그 기기에 QR이 떠요.",
      "근태 승인(정정·휴일 근무·휴가)은 왼쪽 메뉴 [근태]에서 해요.",
    ],
    path: "/admin/attendance-settings",
    pathLabel: "근무 기준으로 이동",
    keywords: ["근무 기준", "출근 단말", "QR 단말", "태블릿", "근무시간", "근태 승인"],
  },
  {
    id: "leave-admin",
    needs: "attendance",
    cat: "attendance",
    audience: "admin",
    title: "직원별 연차 정하기·휴가 종류 켜기",
    body: ["설정 › 근태 정책 › 직원별 연차에서 근로기준법 기준 추천 일수를 보고 직원마다 연차를 확정해요. 입사일도 여기서 넣어요.", "휴가 종류 탭에서 경조사·병가·법정 휴가 중 우리 회사가 쓸 것을 켜요."],
    path: "/admin/attendance-settings/leave",
    pathLabel: "직원별 연차로 이동",
    keywords: ["직원 연차", "연차 부여", "연차 확정", "연차 정", "입사일", "휴가 종류", "근로기준법"],
  },

  // ── AI 엑셀 변환 ──
  {
    id: "convert",
    cat: "convert",
    audience: "all",
    title: "종이·PDF 서류를 엑셀로 바꾸기",
    body: [
      "홈 [서류 → 엑셀]에서 사진·PDF를 올리거나, 채팅의 사진·PDF를 길게 눌러 [엑셀로 변환]을 골라요. AI가 표 모양 그대로 읽어 줘요.",
      "PC에서는 표를 바로 고칠 수 있어요(글자·행 추가·삭제·되돌리기). 다 됐으면 엑셀이나 PDF로 받아요.",
    ],
    path: "/employee/convert",
    pathLabel: "서류 → 엑셀로 이동",
    keywords: ["엑셀", "변환", "서류", "표", "PDF", "스캔", "사진을 엑셀"],
  },
  {
    id: "company-forms",
    cat: "convert",
    audience: "admin",
    title: "회사 양식(휴가신청서) 등록하기",
    body: [
      "설정 › 양식·결재 › 회사 양식에서 [양식 추가]로 빈 양식 사진·PDF를 올리면 AI가 표와 값 칸을 읽어요. 칸 연결은 PC에서 해요.",
      "칸마다 우리 데이터 / 직원 입력 / 고정 값 / 비워 두기 / 빼기 중에 골라요. 정할 칸이 남으면 등록이 안 돼요.",
      "휴가신청서는 회사에 하나예요. 다시 올리면 새 버전이 돼요(무료). 칸을 다 쓰면 [추가 신청]을 해요.",
    ],
    path: "/admin/company-forms",
    pathLabel: "회사 양식으로 이동",
    keywords: ["양식", "휴가신청서", "회사 양식", "서식", "등록"],
  },
  {
    id: "form-template",
    cat: "convert",
    audience: "admin",
    title: "지출결의서 양식 맞추기",
    body: ["설정 › 양식·결재 › 지출결의서 양식에서 기본 양식을 쓰거나, 회사에서 쓰던 결의서 양식을 올려 AI로 맞춰요.", "결의서에 추가로 받을 칸(프로젝트명 등)도 여기서 정해요."],
    path: "/admin/form-template",
    pathLabel: "지출결의서 양식으로 이동",
    keywords: ["지출결의서 양식", "결의서 양식", "서식", "칸 추가"],
  },

  // ── 채팅·캘린더 ──
  {
    id: "chat",
    needs: "chat",
    cat: "together",
    audience: "all",
    title: "사내 채팅 쓰기",
    body: [
      "아래 [채팅](관리자는 머리글 말풍선)에서 1:1·단체 대화를 해요. 사진·파일도 보낼 수 있어요.",
      "채팅 사진·파일은 회사가 정한 기간이 지나면 지워져요. 오래 두려면 길게 눌러 [영구 보관]해서 [파일 보관함]에 넣어요.",
      "메시지에서 서브 대화(스레드)를 열어 한 주제만 따로 이야기할 수 있어요.",
    ],
    path: "/chat",
    pathLabel: "채팅으로 이동",
    keywords: ["채팅", "메신저", "대화", "파일", "사진", "스레드", "서브 대화"],
  },
  {
    id: "vault",
    needs: "chat",
    cat: "together",
    audience: "all",
    title: "파일 보관함",
    body: ["채팅의 사진·파일을 길게 눌러 [영구 보관]하면 [파일 보관함]에 남아요(채팅 쪽은 기간이 지나면 지워져도 보관함은 그대로).", "보관할 때 [나만 보기]·[회사 공유]를 골라요. 지우기는 보관한 사람과 관리자만 할 수 있어요."],
    path: "/employee/vault",
    pathLabel: "파일 보관함으로 이동",
    keywords: ["보관", "보관함", "영구", "파일 지워", "저장"],
  },
  {
    id: "calendar",
    needs: "calendar",
    cat: "together",
    audience: "all",
    title: "캘린더에 일정 넣기와 회의실 예약",
    body: [
      "[캘린더]에서 회의·외근·출장 일정을 넣고 함께할 사람을 고르면 그 사람 캘린더에도 보여요. 회의는 시작 10분 전에 채팅 [알림]방으로 안내가 와요.",
      "[회의실 예약]에서 날짜를 고르고 빈 칸을 누르거나 끌어서 예약해요. 같은 회의실은 같은 시간에 한 건만 잡혀요.",
      "회의 안건과 자료를 미리 붙여 둘 수 있어요.",
    ],
    path: "/calendar",
    pathLabel: "캘린더로 이동",
    keywords: ["캘린더", "일정", "회의실", "예약", "회의", "안건"],
  },
  {
    id: "bus",
    needs: "bus",
    cat: "together",
    audience: "all",
    title: "주변 버스 도착 정보",
    body: ["회사 근처에 정류장이 있으면 홈 [주변 버스]에서 회사 200m 안 정류장을 지도로 보여 줘요(전국 시내버스). 정류장을 누르면 도착 정보가 펼쳐져요.", "[자세히 · 알림 받기]에서 버스 하나를 골라 도착 10분·5분 전에 알림을 받을 수 있어요(30분 동안). 시간은 참고용이에요."],
    path: "/employee/bus",
    pathLabel: "주변 버스로 이동",
    keywords: ["버스", "정류장", "도착", "교통", "지도"],
  },
];

export const ALL_FEATURES: HelpFeatures = { attendance: true, calendar: true, chat: true, bus: true };
export function guidesFor(admin: boolean, has: HelpFeatures = ALL_FEATURES): HelpGuide[] {
  return HELP_GUIDES.filter((g) => (admin || g.audience === "all") && (!g.needs || has[g.needs]));
}

// 질문과 가까운 글 고르기: 키워드·제목·본문에 겹치는 말(2글자 조각) 점수. AI에는 상위 몇 편만 넘긴다
const grams = (t: string) => {
  const s = t.toLowerCase().replace(/[^0-9a-z가-힣]+/g, " ");
  const out = new Set<string>();
  for (const w of s.split(" ").filter(Boolean)) {
    if (w.length === 1) out.add(w);
    for (let i = 0; i < w.length - 1; i++) out.add(w.slice(i, i + 2));
  }
  return out;
};
export function rankGuides(q: string, list: HelpGuide[], n = 4): HelpGuide[] {
  const qg = grams(q);
  if (!qg.size) return [];
  const scored = list.map((g) => {
    let score = 0;
    for (const k of g.keywords) if (q.includes(k)) score += 6;
    const tg = grams(g.title);
    const kg = grams(g.keywords.join(" "));
    const bg = grams(g.body.join(" "));
    for (const x of qg) score += (tg.has(x) ? 3 : 0) + (kg.has(x) ? 2 : 0) + (bg.has(x) ? 1 : 0);
    return { g, score };
  });
  return scored
    .filter((x) => x.score >= 3)
    .sort((a, b) => b.score - a.score)
    .slice(0, n)
    .map((x) => x.g);
}

export function guidePath(g: HelpGuide, admin: boolean): string | null {
  return (admin && g.adminPath) || g.path || null;
}
