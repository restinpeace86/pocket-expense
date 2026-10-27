// 후기·설문(+100 크레딧, D-130) 선택지와 표시 이름. DB 체크 제약(migration 066)과 같은 값만 쓴다.
export const SURVEY_BONUS = 100;
export const REVIEW_MAX = 100;

export const USEFUL_FEATURES = [
  ["receipt_ai", "영수증 AI 자동 입력"],
  ["kakao_approval", "카톡·휴대폰 결재"],
  ["tax_export", "월말 세무 자료 내려받기"],
  ["form_template", "우리 회사 결의서 양식"],
  ["meal_split", "식대 한도 자동 계산"],
  ["trip", "출장비·자차 유류비"],
  ["payouts", "사비 정산 지급 관리"],
  ["other", "기타"],
] as const;

export const INDUSTRIES = [
  ["construction", "건설업"],
  ["interior", "인테리어·시공"],
  ["it", "IT·스타트업"],
  ["manufacturing", "제조업"],
  ["distribution", "유통·도소매"],
  ["service", "서비스업"],
  ["nonprofit", "비영리·단체"],
  ["other", "기타 업종"],
] as const;

export const COMPANY_SIZES = [
  ["1-4", "5인 미만"],
  ["5-10", "10인 이하"],
  ["11-30", "30인 이하"],
  ["31+", "30인 초과"],
] as const;

export const JOB_ROLES = [
  ["ceo", "대표"],
  ["site_manager", "현장 소장"],
  ["finance", "경리·회계 담당"],
  ["office_admin", "총무·관리 담당"],
  ["team_lead", "팀장"],
  ["other", "실무자"],
] as const;

type Pairs = readonly (readonly [string, string])[];
const labelOf = (pairs: Pairs, key: string) => pairs.find(([k]) => k === key)?.[1] ?? "";
const keysOf = (pairs: Pairs) => pairs.map(([k]) => k);

export const isValidSurvey = (v: { rating: number; usefulFeature: string; industry: string; companySize: string; jobRole: string; review: string }) =>
  Number.isInteger(v.rating) &&
  v.rating >= 1 &&
  v.rating <= 5 &&
  keysOf(USEFUL_FEATURES).includes(v.usefulFeature) &&
  keysOf(INDUSTRIES).includes(v.industry) &&
  keysOf(COMPANY_SIZES).includes(v.companySize) &&
  keysOf(JOB_ROLES).includes(v.jobRole) &&
  v.review.trim().length <= REVIEW_MAX;

// 랜딩에 보일 작성자: 회사명·이름 없이 규모·업종·직무로만 — 예) "10인 이하 건설업 현장 소장"
export function authorLabel(r: { industry: string; company_size: string; job_role: string }): string {
  const industry = r.industry === "other" ? "" : labelOf(INDUSTRIES, r.industry);
  return [labelOf(COMPANY_SIZES, r.company_size), industry, labelOf(JOB_ROLES, r.job_role)].filter(Boolean).join(" ");
}

export const featureLabel = (key: string) => labelOf(USEFUL_FEATURES, key);
