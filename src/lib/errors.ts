// DB 함수가 던지는 오류 코드 → 사용자 안내 문구 (spec/common/ui-rules.md §5)
const MESSAGES: Record<string, string> = {
  NOT_AUTHENTICATED: "로그인이 필요합니다. 다시 로그인해 주세요.",
  ALREADY_MEMBER: "이미 회사에 소속된 계정입니다. 한 계정은 한 회사에만 속할 수 있어요.",
  PRIVACY_REQUIRED: "개인정보 수집·이용에 동의해 주세요.",
  TERMS_REQUIRED: "서비스 이용약관에 동의해 주세요.",
  OPTIONAL_CONSENT_REQUIRED: "정산 계좌·차량번호를 입력하려면 [선택] 항목 수집·이용에 동의해 주세요. 동의하지 않으려면 해당 칸을 비워 주세요.",
  INVALID_COMPANY_NAME: "회사명을 1~100자로 입력해 주세요.",
  INVALID_NAME: "이름을 1~50자로 입력해 주세요.",
  INVALID_PHONE: "휴대폰 번호를 확인해 주세요. (예: 010-1234-5678)",
  INVALID_BUSINESS_NUMBER: "사업자등록번호를 확인해 주세요. (숫자 10자리, 번호 오타 여부)",
  BUSINESS_CLOSED: "국세청 조회 결과 폐업한 사업자등록번호입니다. 번호를 확인해 주세요.",
  BUSINESS_NOT_REGISTERED: "국세청에 등록되지 않은 사업자등록번호입니다. 번호를 확인해 주세요.",
  INVALID_DEPARTMENTS: "부서를 1개 이상 입력해 주세요. (최대 50개)",
  INVALID_MY_DEPARTMENT: "본인 부서를 부서 목록에서 선택해 주세요.",
  INVALID_DEPARTMENT: "부서를 목록에서 선택해 주세요.",
  INVALID_INVITE_CODE: "초대 코드를 확인해 주세요. 관리자에게 초대 링크를 요청하세요.",
  INVALID_INVITATION: "초대 링크가 만료되었거나 이미 사용되었습니다. 관리자에게 다시 요청하세요.",
  NOT_ALLOWED: "이 작업을 할 권한이 없습니다. 관리자에게 문의하세요.",
  NOT_A_MEMBER: "회사 멤버로 승인된 계정만 이용할 수 있어요.",
  NOT_FOUND: "대상을 찾을 수 없어요. 화면을 새로고침해 주세요.",
  NOT_PENDING: "이미 처리된 가입 신청입니다. 화면을 새로고침해 주세요.",
  NOT_INACTIVE: "비활성 상태인 멤버만 다시 활성화할 수 있어요. 화면을 새로고침해 주세요.",
  NOT_APPROVED: "활성 상태인 멤버에게만 할 수 있어요.",
  INVALID_ROLE: "역할을 다시 선택해 주세요.",
  INVALID_TARGET: "본인에게는 할 수 없는 작업이에요.",
  INVALID_TEXT_LENGTH: "직급·사번은 50자 이내로 입력해 주세요.",
  SUPER_ADMIN_LOCKED: "최고 관리자는 역할을 바꾸거나 비활성화할 수 없어요. 먼저 [최고 관리자 넘기기]를 해 주세요.",
  MEMBER_IN_APPROVAL_LINE: "이 멤버가 사전 검토 결재라인에 들어 있어요. 결재라인에서 먼저 빼 주세요.",
  MEMBER_HAS_PENDING_REVIEW: "이 멤버가 검토할 차례인 소명서가 있어요. 먼저 처리해 주세요.",
  INCOMPLETE_BANK_ACCOUNT: "정산 계좌는 은행·계좌번호·예금주를 모두 입력하거나 모두 비워 주세요.",
};

export function messageForDbError(error: { message?: string } | null | undefined): string {
  const code = error?.message?.trim() ?? "";
  return MESSAGES[code] ?? "요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.";
}
