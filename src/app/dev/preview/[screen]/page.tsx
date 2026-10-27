import Link from "next/link";
import { AnnouncementForm, AnnouncementList } from "@/components/push/announcement-form";
import { NoticeStrip } from "@/components/push/notice-strip";
import type { Notice } from "@/lib/push/notices";
import { ReconcileHeading, ReconcileView } from "@/components/admin/reconcile-view";
import { RecurringHeading, RecurringView } from "@/components/admin/recurring-view";
import { VehiclesHeading, VehiclesView } from "@/components/admin/vehicles-view";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { AdminHomeView } from "@/components/admin/admin-home-view";
import { AccountTitlesHeading, AccountTitlesView } from "@/components/admin/account-titles-view";
import { AdminShell, type ShellTheme } from "@/components/admin/admin-shell";
import { TestimonialsView } from "@/components/landing/testimonials";
import { CorporateCardsHeading, CorporateCardsView } from "@/components/admin/corporate-cards-view";
import { CompanySettingsForm } from "@/components/admin/company-settings-form";
import { EmployeeHomeView } from "@/components/employee/employee-home-view";
import { EmployeeShell } from "@/components/employee/employee-shell";
import { ClaimEditor } from "@/components/employee/claim-editor";
import { ProfileForm } from "@/components/employee/profile-form";
import { TaxClosingView } from "@/components/admin/tax-closing-view";
import type { ExportRow } from "@/lib/tax/export-rows";
import type { Dashboard } from "@/lib/admin/dashboard";
import { SettlementsView } from "@/components/employee/settlements-view";
import { AppAdminShell } from "@/components/app-admin/app-admin-shell";
import { BillingView } from "@/components/admin/billing-view";
import { ApprovalLinesHeading, ApprovalLinesView } from "@/components/admin/approval-lines-view";
import { NotificationList } from "@/components/admin/notification-list";
import { AdminClaimDetail } from "@/components/claims/admin-claim-detail";
import { AdminClaimList, ApprovalTabs } from "@/components/claims/admin-claim-list";
import { ClaimFiltersBar } from "@/components/claims/claim-filters";
import { ApprovalTimeline } from "@/components/claims/approval-timeline";
import { EmployeeClaimDetail } from "@/components/claims/employee-claim-detail";
import { PayoutsView } from "@/components/claims/payouts-view";
import type { ClaimDetail, DetailItem } from "@/lib/claims/types";
import { CompaniesView } from "@/components/app-admin/companies-view";
import { CompanyDetailView, type CompanyDetail } from "@/components/app-admin/company-detail-view";
import { ReceiptRecordView, type ReceiptRecordData } from "@/components/app-admin/receipt-record-view";
import type { EditorData, EditorItem } from "@/lib/employee/editor-types";
import type { MyClaimRow } from "@/lib/employee/types";
import { DepartmentsHeading, DepartmentsView } from "@/components/admin/departments-view";
import { MemberDetailView } from "@/components/admin/member-detail";
import { capabilitiesFor } from "@/lib/admin/capabilities";
import { InviteLinkCard } from "@/components/admin/invite-link-card";
import { MembersHeading, MembersView, type MemberRow } from "@/components/admin/members-view";
import { PerfCheck } from "@/components/dev/perf-check";
import { ReceiptImageCheck } from "@/components/dev/receipt-image-check";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { ConsentSection } from "@/components/legal/consent-section";
import { CreateCompanyForm } from "@/components/onboarding/create-company-form";
import { InviteCodeForm } from "@/components/onboarding/invite-code-form";
import { JoinForm } from "@/components/onboarding/join-form";
import { buttonSecondary, Card, PageShell } from "@/components/ui/page-shell";
import { SectionHeading } from "@/components/ui/help";
import { FormTemplateView } from "@/components/admin/form-template-view";
import { PRESETS as FORM_PRESETS, SAMPLE_DOC as FORM_SAMPLE_DOC } from "@/lib/forms/layout";
import { WorkspaceHeader } from "@/components/workspace/workspace-header";
import type { Membership } from "@/lib/auth/paths";
import { isThemeKey } from "@/lib/theme";

// 반응형 점검 전용 미리보기 (CLAUDE.md 헌법 제2장 제4조의2).
// 로그인해야 보이는 화면을 실제 컴포넌트 그대로, 데이터 없이 그린다. ENABLE_UI_PREVIEW=1일 때만 열린다(배포 환경에서는 404).
const SAMPLE_DEPARTMENTS = [
  { id: "00000000-0000-0000-0000-000000000001", name: "경영지원" },
  { id: "00000000-0000-0000-0000-000000000002", name: "개발팀" },
  { id: "00000000-0000-0000-0000-000000000003", name: "영업팀" },
];
const SAMPLE_MEMBERSHIP: Membership = {
  member_id: "m",
  company_id: "00000000-0000-0000-0000-0000000000aa",
  company_name: "포켓컴퍼니 주식회사",
  name: "김대표",
  role: "super_admin",
  status: "approved",
  ui_theme: null,
};

const SAMPLE_CLAIMS: MyClaimRow[] = [
  { id: "c1", title: "", status: "draft", is_business_trip: false, item_count: 0, total_amount: 0, settlement_required: null, created_at: "2026-10-20T01:00:00Z", rejection_reason: null, rejected_at: null, dateFrom: null, dateTo: null, corporateCount: 0, personalCount: 0, categories: [] },
  { id: "c2", title: "거래처 미팅 식사 진행", status: "submitted", is_business_trip: false, item_count: 1, total_amount: 45000, settlement_required: true, created_at: "2026-10-16T01:00:00Z", rejection_reason: null, rejected_at: null, dateFrom: "2026-10-16", dateTo: "2026-10-16", corporateCount: 1, personalCount: 0, categories: ["meeting"] },
  { id: "c3", title: "10/15 부산 출장 (KTX·숙박·식대 포함 긴 제목 테스트)", status: "approved", is_business_trip: true, item_count: 3, total_amount: 172000, settlement_required: true, created_at: "2026-10-15T01:00:00Z", rejection_reason: null, rejected_at: null, dateFrom: "2026-10-14", dateTo: "2026-10-15", corporateCount: 2, personalCount: 1, categories: ["trip"] },
  { id: "c4", title: "팀 점심", status: "rejected", is_business_trip: false, item_count: 2, total_amount: 38000, settlement_required: true, created_at: "2026-10-10T01:00:00Z", rejection_reason: "영수증 2장 중 1장의 금액이 카드 내역과 달라요.\n카드 승인 내역 캡처를 함께 올려 주세요.", rejected_at: "2026-10-12T02:00:00Z", dateFrom: "2026-10-09", dateTo: "2026-10-10", corporateCount: 0, personalCount: 2, categories: ["meal"] },
  { id: "c5", title: "탕비실 간식·사무용품", status: "paid", is_business_trip: false, item_count: 2, total_amount: 61200, settlement_required: false, created_at: "2026-10-02T01:00:00Z", rejection_reason: null, rejected_at: null, dateFrom: "2026-10-01", dateTo: "2026-10-02", corporateCount: 2, personalCount: 0, categories: ["purchase", "meal"] },
];
const EMPLOYEE_MEMBERSHIP: Membership = { ...SAMPLE_MEMBERSHIP, name: "김개발", role: "employee" };

const NO_ROUTE = { start_location: null, start_lat: null, start_lng: null, end_location: null, end_lat: null, end_lng: null, is_round_trip: null, route_one_way_km: null, distance_km: null, distance_source: null, route_evidence: null, applied_fuel_rate_per_km: null, overdueDeadline: null } as const;
const SAMPLE_ITEM: EditorItem = {
  id: "i1", sort_order: 1, category: "meal", trip_type: null, purchase_type: null, payment_method: "corporate_card", corporate_card_id: "card1",
  evidence_type: "card_slip", expense_date: "2026-10-16", merchant_name: "김밥천국 강남역점", merchant_business_number: "2208162517",
  amount: 31000, supply_amount: 28182, vat_amount: 2818, headcount: 2, purpose: null, attendees: null, client_name: null,
  trip_start_date: null, trip_end_date: null, parse_status: "success", receipt_path: "x/receipt.jpg", company_supported_amount: 20000,
  personal_burden_amount: 11000, thumbUrl: null, isPdf: false, aiFilled: true, aiCardMasked: "532712******7890", aiIncomeDeduction: false, aiPurpose: "부서 정기 점심 식사 진행", aiEvidence: { suggested: "card_slip", hasApproval: true, hasCardNumber: true },
  paid_time: "12:41", approval_number: "30012345", merchant_address: "서울 강남구 테헤란로 123 강남역 지하상가 B1층 (아주 긴 주소 줄바꿈 확인)",
  line_items: [
    { name: "참치김밥", quantity: 2, unit_price: 4500, amount: 9000 },
    { name: "라볶이 (치즈 추가, 아주 긴 품목 이름 줄바꿈 확인)", quantity: 2, unit_price: 6500, amount: 13000 },
    { name: "돈까스", quantity: 1, unit_price: 9000, amount: 9000 },
    { name: "쿠폰 할인", quantity: null, unit_price: null, amount: -1000 },
  ],
  duplicate: null,
  aiCategory: "meal",
  category_mismatch_ack: false,
  evidence_kind: "receipt",
  no_evidence_reason: null,
  ...NO_ROUTE,
};
const SAMPLE_EDITOR: EditorData = {
  claim: {
    id: "claim1", status: "draft", title: "", description: "", exception_memo: null, trip_transport: null, default_payment_method: "corporate_card", is_business_trip: false,
    trip_destination: null, trip_start_date: null, trip_end_date: null, trip_purpose: null, item_count: 4, total_amount: 172000,
    total_company_supported: 161000, total_personal_burden: 11000, rejection_reason: null,
    category: "meal", purchase_type: null, meeting_purpose: null, client_name: null, attendees: null, purchase_purpose: null, purchase_items: null, headcount: null, vehicle_id: null, recurring_payment_id: null, header_custom_payload: {}, condolence_target: null,
  },
  items: [
    { ...SAMPLE_ITEM, duplicate: { mine: [], others: 1 } },
    { ...SAMPLE_ITEM, id: "i2", sort_order: 2, category: "trip", trip_type: "public_transport", merchant_name: "코레일 KTX 서울→부산 (아주 긴 가맹점 이름 테스트)", amount: 59800, payment_method: "personal_card", corporate_card_id: null, company_supported_amount: 59800, personal_burden_amount: 0, headcount: 1, aiCardMasked: null },
    { ...SAMPLE_ITEM, id: "i3", sort_order: 3, category: null, merchant_name: null, expense_date: null, amount: null, parse_status: "failed", evidence_type: null, isPdf: true, receipt_path: "x/a.pdf", company_supported_amount: null, personal_burden_amount: 0 },
    { ...SAMPLE_ITEM, id: "i4", sort_order: 4, category: "purchase", purchase_type: "pantry", merchant_name: "이마트24", amount: 81200, receipt_path: null, aiFilled: false, company_supported_amount: 81200, personal_burden_amount: 0 },
  ],
  cards: [{ id: "card1", nickname: "대표 법인카드", bin6: "532712", last4: "7890" }, { id: "card2", nickname: "영업팀 카드", bin6: null, last4: "1234" }],
  mealPolicy: { enabled: true, perPerson: 10000, mode: "split" },
  mealOverride: null,
  fuel: { mode: "fixed", fuelType: "gasoline", enabled: true, ratePerKm: 200, blocked: null, vehicleNumber: "12가3456" },
  vehicles: [{ id: "v1", nickname: "영업 1호차", plate_number: "12가3456", is_active: true }],
  deadline: { type: "next_month_day", days: 5 },
  perDiem: { enabled: false, amount: 0 },
  companyFields: [],
  lastCustom: {},
};

const AA_PAYLOAD = {
  merchant_name: "이마트 판교점", merchant_business_number: "2208162517", card_last4: "7890", suggested_evidence_type: "card_slip",
  cash_receipt_income_deduction: null, amount: 48300, supply_amount: 43909, vat_amount: 4391, expense_date: "2026-10-16",
  suggested_category: "purchase", suggested_trip_type: null, suggested_purchase_type: "pantry", paid_time: "18:22",
  approval_number: "30012345", merchant_address: "경기 성남시 분당구 대왕판교로 606번길 10 (아주 긴 주소 줄바꿈 확인용 텍스트)",
  line_items: [
    { name: "제주삼다수 2L x6", quantity: 2, unit_price: 5980, amount: 11960 },
    { name: "맥심 모카골드 커피믹스 180T (아주 긴 품목 이름 확인)", quantity: 1, unit_price: 27900, amount: 27900 },
    { name: "종이컵 1000입", quantity: 1, unit_price: 9440, amount: 9440 },
    { name: "행사 할인", quantity: null, unit_price: null, amount: -1000 },
  ],
};
const AA_COMPANY_DETAIL: CompanyDetail = {
  company: { id: "c1", name: "포켓컴퍼니 주식회사", business_number: "1234567890", business_status: "verified", created_at: "2026-10-01T01:00:00Z", billing_status: "free_trial", receipt_credits_granted: 200, receipt_credits_used: 112, last_event_bonus_at: "2026-10-15T01:00:00Z" },
  members: [
    { id: "m1", name: "김대표", role: "super_admin", status: "approved", created_at: "2026-10-01T01:00:00Z" },
    { id: "m2", name: "이직원", role: "employee", status: "approved", created_at: "2026-10-02T01:00:00Z" },
    { id: "m3", name: "최신입", role: "employee", status: "pending", created_at: "2026-10-18T01:00:00Z" },
  ],
  ledger: [
    { id: "l2", delta: 100, reason: "event_bonus", created_at: "2026-10-15T01:00:00Z", member_id: null, item_id: null },
    { id: "l1", delta: 100, reason: "free_trial_grant", created_at: "2026-10-01T01:00:00Z", member_id: null, item_id: null },
  ],
  records: [
    { id: "r1", credited_at: "2026-10-16T09:22:00Z", member_name: "이직원", claim_title: "10/16 탕비실 물품", claim_status: "submitted", status: "in_claim", item_deleted_at: null, parse_status: "success", merchant_name: "이마트 판교점", amount: 48300, expense_date: "2026-10-16", line_item_count: 4, photo_state: "live", photo_purge_after: null },
    { id: "r2", credited_at: "2026-10-15T03:10:00Z", member_name: "이직원", claim_title: "팀 점심", claim_status: "draft", status: "item_deleted", item_deleted_at: "2026-10-15T05:00:00Z", parse_status: "success", merchant_name: "김밥천국 강남역점", amount: 31000, expense_date: "2026-10-15", line_item_count: 3, photo_state: "archived", photo_purge_after: "2027-01-15T05:00:00Z" },
    { id: "r3", credited_at: "2026-10-14T03:10:00Z", member_name: "김대표", claim_title: "", claim_status: "draft", status: "in_claim", item_deleted_at: null, parse_status: "failed", merchant_name: null, amount: null, expense_date: null, line_item_count: 0, photo_state: "live", photo_purge_after: null },
  ],
  truncated: false,
};
const AA_RECORD = {
  id: "r2", company_id: "c1", item_id: "i9", claim_id: "cl9", member_id: "m2", member_name: "이직원", ledger_id: "l9",
  credited_at: "2026-10-15T03:10:00Z", receipt_path: "c1/m2/cl9/i9.jpg", thumb_path: null, parse_status: "success", parsed_at: "2026-10-15T03:10:03Z",
  ai_parsed_payload: AA_PAYLOAD, claim_title: "10/16 탕비실 물품", claim_status: "draft", item_deleted_at: "2026-10-15T05:00:00Z",
  item_snapshot: { merchant_name: "이마트 판교점", expense_date: "2026-10-16", amount: 48300, supply_amount: 43909, vat_amount: 4391, category: "purchase", purchase_type: "pantry", payment_method: "corporate_card", evidence_type: "card_slip", headcount: 1, purpose: "탕비실 커피·생수", company_supported_amount: 48300, personal_burden_amount: 0 },
  archived_receipt_path: "c1/i9.jpg", archived_thumb_path: null, photo_purge_after: "2027-01-15T05:00:00Z", photo_purged_at: null, created_at: "2026-10-15T03:10:00Z",
} as unknown as ReceiptRecordData["record"];

const SAMPLE_PLANS = [
  { code: "starter", name: "스타터", monthly_price: 29000, monthly_receipts: 150, recommended_size: "5인 미만", is_featured: false },
  { code: "standard", name: "스탠다드", monthly_price: 49000, monthly_receipts: 400, recommended_size: "5~15인", is_featured: true },
  { code: "pro", name: "프로", monthly_price: 89000, monthly_receipts: 800, recommended_size: "영업·현장직이 많은 팀", is_featured: false },
];
const SAMPLE_NOTICES: Notice[] = [
  { id: "n1", scope: "company", title: "11월부터 식대 1인 12,000원 (아주 긴 공지 제목이 들어가도 한 줄로 줄여 보이는지 확인)", body: "11월 1일 사용분부터 1인 한도가 12,000원으로 바뀝니다.\n야근 식대도 같아요.", created_at: "2026-10-22T01:00:00Z" },
  { id: "n2", scope: "platform", title: "10/30(목) 02:00~03:00 정기 점검", body: "점검 시간에는 영수증 업로드가 잠시 안 돼요.", created_at: "2026-10-21T01:00:00Z" },
];
const SAMPLE_CREDIT = { granted: 200, used: 163, freeTrial: 100, eventCount: 1, eventTotal: 100, eventEnabled: true, eventAmount: 100, showEventBanner: false, surveyDone: false };

const DI: DetailItem = {
  id: "d1", sort_order: 1, category: "trip", trip_type: "public_transport", purchase_type: null, payment_method: "corporate_card", corporate_card_id: "card1", card_last4: "7890",
  evidence_type: "card_slip", evidence_kind: "receipt", no_evidence_reason: null, expense_date: "2026-10-14", merchant_name: "코레일 KTX", merchant_business_number: "2208162517", amount: 50000, supply_amount: 45455, vat_amount: 4545,
  headcount: 1, purpose: null, attendees: null, client_name: null, trip_start_date: null, trip_end_date: null, parse_status: "success", receipt_path: "x/1.jpg",
  company_supported_amount: 50000, personal_burden_amount: 0, applied_meal_limit_per_person: null, applied_meal_limit_mode: null, account_title_id: "t2", account_title_name: "여비교통비", account_title_code: null, closed_month: null,
  account_title_overridden: false, paid_time: "08:10", approval_number: "30012345", merchant_address: "서울 용산구 한강대로 405", line_items: [], ai: { merchant_name: "코레일 KTX", amount: 50000, expense_date: "2026-10-14" },
  thumbUrl: null, isPdf: false, duplicate: null, route: null, routeLabel: null, routeCardUrl: null, overdueDeadline: null,
};
const EXPORT_BASE = {
  kind: "current", claim_id: "cl100000-aaaa", claim_title: "9월 팀 점심", claim_description: "부서 정기 점심 식사 진행", exception_memo: null, is_trip: false,
  trip_destination: null, trip_start: null, trip_end: null, trip_purpose: null, claim_status: "approved", self_approved: false, submitted_at: null, approved_at: null, paid_at: null,
  approvers: "김대표(9/26)", header_custom: {}, merchant_business_number: "1234567890", evidence_type: "card_slip", supply_amount: null, vat_amount: null,
  payment_method: "personal_card", card_nickname: null, card_last4: null, account_title_name: "복리후생비", account_title_code: null, category: "meal", trip_type: null,
  purchase_type: null, department: "개발팀", member_name: "김개발", position: "대리", employee_number: null, vehicle_number: null, purpose: null, headcount: 1, attendees: null,
  client_name: null, lodging_in: null, lodging_out: null, start_location: null, end_location: null, is_round_trip: null, route_one_way_km: null, distance_km: null,
  distance_source: null, applied_meal_limit_per_person: 10000, applied_fuel_rate_per_km: null, personal_burden_amount: 0, route_card_path: null, item_custom: {},
} as const;
const SAMPLE_EXPORT_ROWS: ExportRow[] = [
  { ...EXPORT_BASE, seq: 1, item_id: "it000001", expense_date: "2026-09-10", merchant_name: "김밥천국 강남역점 (아주 긴 가맹점 이름이 들어가도 괜찮은지)", amount: 31000, company_supported_amount: 31000, receipt_path: "x/1.jpg" },
  { ...EXPORT_BASE, seq: 2, item_id: "it000002", expense_date: "2026-09-12", merchant_name: "이마트 판교점", amount: 12000, company_supported_amount: 12000, payment_method: "corporate_card", receipt_path: "x/2.jpg" },
  { ...EXPORT_BASE, seq: 3, item_id: "it000003", expense_date: "2026-09-14", merchant_name: null, amount: 150800, company_supported_amount: 150800, category: "trip", trip_type: "own_car", account_title_name: "여비교통비", start_location: "판교역", end_location: "부산역", is_round_trip: true, route_one_way_km: 377, distance_km: 754, distance_source: "api", receipt_path: null, route_card_path: "x/route.png" },
  { ...EXPORT_BASE, seq: 4, kind: "carryover", item_id: "it000004", expense_date: "2026-08-29", merchant_name: "스타벅스", amount: 9000, company_supported_amount: 9000, category: "meeting", account_title_name: "기업업무추진비", receipt_path: "x/4.jpg" },
];
const SAMPLE_DASHBOARD: Dashboard = {
  month: "2026-10",
  kpi: { spend: 2450000, spend_prev: 2130000, pending_claims: 5, pending_oldest_days: 8, unpaid_payout: 1820000, unpaid_payback: 12000 },
  todo: { pending_members: 1, unmapped_items: 3, settle_claims: 4, failed_notifications: 2 },
  checklist: { approved_members: 8, departments: 3, policy_confirmed: true, review_steps: 0 },
  categories: [
    { category: "trip", trip_type: "public_transport", amount: 640000, count: 8 },
    { category: "trip", trip_type: "own_car", amount: 450000, count: 5 },
    { category: "trip", trip_type: "lodging", amount: 360000, count: 3 },
    { category: "meal", trip_type: null, amount: 520000, count: 41 },
    { category: "meeting", trip_type: null, amount: 300000, count: 6 },
    { category: "purchase", trip_type: null, amount: 180000, count: 9 },
  ],
  top_members: [
    { name: "김개발", department: "개발팀", amount: 820000, count: 14 },
    { name: "박영업", department: "영업팀 (서울·부산 지사 담당 아주 긴 부서 이름)", amount: 610000, count: 9 },
    { name: "이디자인", department: "디자인팀", amount: 320000, count: 11 },
    { name: "최기획", department: null, amount: 210000, count: 6 },
    { name: "정인사", department: "경영지원", amount: 90000, count: 4 },
  ],
};
const SAMPLE_DETAIL_CLAIM: ClaimDetail = {
  claim: {
    id: "cl1", member_id: "p3", status: "submitted", title: "10/15 부산 출장 경비", description: "부산 지사 미팅 및 현장 점검 건", exception_memo: "토요일 오전 현장 점검 일정이라 전날 밤 이동", is_business_trip: true, trip_destination: "부산",
    trip_start_date: "2026-10-14", trip_end_date: "2026-10-15", trip_purpose: "부산 지사 미팅", item_count: 3, total_amount: 72000, total_company_supported: 65000, total_personal_burden: 7000,
    settlement_required: null, self_approved: false, current_round: 2, rejection_reason: null, created_at: "2026-10-14T01:00:00Z", submitted_at: "2026-10-16T01:00:00Z", approved_at: null, rejected_at: null, paid_at: null, category: "trip", vehicle: null,
  },
  owner: { name: "김개발", department: "개발팀", position: "대리" },
  items: [
    DI,
    {
      ...DI, id: "d4", sort_order: 4, trip_type: "own_car", merchant_name: null, merchant_business_number: null, receipt_path: null, payment_method: "personal_card", corporate_card_id: null, card_last4: null,
      amount: 150800, company_supported_amount: 150800, supply_amount: null, vat_amount: null, paid_time: null, approval_number: null, merchant_address: null, ai: null,
      routeLabel: "🚗 판교역 → 부산역",
      route: { startName: "판교역", startAddress: "경기 성남시 분당구 판교역로 160", endName: "부산역", endAddress: "부산 동구 중앙대로 206", roundTrip: true, oneWayKm: 377, totalKm: 754, rate: 200, amount: 150800, source: "api", computedAt: "2026-10-14T00:30:00Z" },
    },
    { ...DI, id: "d2", sort_order: 2, merchant_name: "한국도로공사", trip_type: "toll_parking", amount: 5000, supply_amount: null, vat_amount: null, company_supported_amount: 5000, merchant_business_number: null },
    { ...DI, id: "d3", sort_order: 3, merchant_name: "부산국밥 (직원이 고친 이름)", trip_type: "meal", amount: 17000, payment_method: "personal_card", corporate_card_id: null, company_supported_amount: 10000, personal_burden_amount: 7000, applied_meal_limit_per_person: 10000, applied_meal_limit_mode: "split", ai: { merchant_name: "부산국밥", amount: 17000 }, duplicate: { mine: 0, others: 1 } },
  ],
  approvals: [
    { id: "a1", round: 1, step_order: 1, step_kind: "final", status: "rejected", approver_member_id: null, approver_name: null, acted_by_name: "김대표", acted_at: "2026-10-15T05:00:00Z", comment: "국밥 영수증 날짜를 확인해 주세요", flagged_item_ids: ["d3"] },
    { id: "a2", round: 2, step_order: 1, step_kind: "final", status: "pending", approver_member_id: null, approver_name: null, acted_by_name: null, acted_at: null, comment: null, flagged_item_ids: [] },
  ],
  cards: [{ id: "card1", nickname: "대표", last4: "7890" }],
  payout: 10000,
  payback: 0,
  flaggedItemIds: [],
  pendingStep: { id: "a2", round: 2, step_order: 1, step_kind: "final", status: "pending", approver_member_id: null, approver_name: null, acted_by_name: null, acted_at: null, comment: null, flagged_item_ids: [] },
};
const SAMPLE_ADMIN_ROWS = [
  { id: "cl1", title: "10/15 부산 출장 경비", status: "submitted" as const, is_business_trip: true, category: "trip" as const, item_count: 3, total_amount: 72000, settlement_required: null, self_approved: false, submitted_at: "2026-10-16T01:00:00Z", member_id: "p3", member_name: "김개발", reviewing: null },
  { id: "cl2", title: "10/14 간식 구입", status: "submitted" as const, is_business_trip: false, item_count: 1, total_amount: 25000, settlement_required: null, self_approved: false, submitted_at: "2026-10-16T03:00:00Z", member_id: "p4", member_name: "이디자인", reviewing: "박팀장" },
];

const SAMPLE_MEMBERS: MemberRow[] = [
  { id: "p1", name: "김대표", phone: "01011112222", email: "ceo@pocket.co.kr", position: "대표", role: "super_admin", status: "approved", department: null, created_at: "2026-10-01T00:00:00Z" },
  { id: "p2", name: "박관리", phone: "01022223333", email: null, position: "과장", role: "admin", status: "approved", department: "경영지원", created_at: "2026-10-02T00:00:00Z" },
  { id: "p3", name: "이직원", phone: "01033334444", email: "lee.employee.long-address@pocketcompany.co.kr", position: "대리", role: "employee", status: "pending", department: "개발팀", created_at: "2026-10-16T00:00:00Z" },
  { id: "p4", name: "최신입", phone: "0103335555", email: null, position: null, role: "employee", status: "pending", department: "영업팀", created_at: "2026-10-17T00:00:00Z" },
];

const SAMPLE_DETAIL = {
  ...SAMPLE_MEMBERS[1],
  department_id: SAMPLE_DEPARTMENTS[0].id,
  employee_number: "PK-2024-007",
  receives_car_allowance: false,
  meal_limit_override: 15000,
};
const SAMPLE_DEPT_ROWS = [
  { id: "d1", name: "경영지원", sort_order: 1, memberCount: 2, hasApprovalLine: false },
  { id: "d2", name: "개발팀", sort_order: 2, memberCount: 7, hasApprovalLine: true },
  { id: "d3", name: "영업·마케팅 본부 (서울·부산 지사 통합)", sort_order: 3, memberCount: 0, hasApprovalLine: false },
];

export default function PreviewPage({ params, searchParams }: PageProps<"/dev/preview/[screen]">) {
  return (
    <Suspense fallback={null}>
      <Preview params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Preview({
  params,
  searchParams,
}: {
  params: PageProps<"/dev/preview/[screen]">["params"];
  searchParams: PageProps<"/dev/preview/[screen]">["searchParams"];
}) {
  await connection();
  if (process.env.ENABLE_UI_PREVIEW !== "1") notFound();
  const [{ screen }, sp] = await Promise.all([params, searchParams]);
  // 색상 미리보기: ?theme=navy|light|emerald|wine|amber|ocean|violet
  // 클라이언트 컴포넌트 파일의 값은 서버에서 쓸 수 없으므로 공용 목록(lib/theme)으로 판별
  const theme: ShellTheme | undefined = isThemeKey(sp.theme) ? sp.theme : undefined;

  switch (screen) {
    case "onboarding":
      return (
        <PageShell>
          <h1 className="pt-6 text-2xl font-bold tracking-tight">어떻게 시작할까요?</h1>
          <Card>
            <h2 className="text-lg font-semibold">초대 코드로 회사 합류</h2>
            <p className="mb-4 mt-1 text-sm text-zinc-600">관리자에게 받은 초대 링크가 없다면 코드를 직접 입력하세요.</p>
            <InviteCodeForm />
          </Card>
          <Card>
            <h2 className="text-lg font-semibold">새 회사 만들기</h2>
            <p className="mb-4 mt-1 text-sm text-zinc-600">대표·관리자라면 회사를 등록하고 직원을 초대하세요.</p>
            <Link href="#" className={buttonSecondary}>
              회사 등록하기
            </Link>
          </Card>
          <div className="text-center">
            <SignOutButton />
          </div>
        </PageShell>
      );
    case "create-company":
      return (
        <PageShell>
          <div className="pt-6">
            <p className="text-sm font-medium text-blue-600">회사 등록</p>
            <h1 className="text-2xl font-bold tracking-tight">우리 회사 정보를 입력해 주세요</h1>
          </div>
          <Card>
            <CreateCompanyForm />
          </Card>
        </PageShell>
      );
    case "join":
      return (
        <PageShell>
          <h1 className="pt-6 text-2xl font-bold tracking-tight">직원 정보 입력</h1>
          <Card>
            <JoinForm companyName="포켓컴퍼니 주식회사" departments={SAMPLE_DEPARTMENTS} code="ABCDEFGH" />
          </Card>
        </PageShell>
      );
    case "join-invite":
      return (
        <PageShell>
          <h1 className="pt-6 text-2xl font-bold tracking-tight">직원 정보 입력</h1>
          <Card>
            <JoinForm
              companyName="포켓컴퍼니 주식회사"
              departments={SAMPLE_DEPARTMENTS}
              token="preview"
              prefill={{ name: "이직원", phone: "01012345678", departmentId: SAMPLE_DEPARTMENTS[1].id, position: "대리" }}
            />
          </Card>
        </PageShell>
      );
    case "consent-dialog":
      return (
        <PageShell>
          <Card>
            <ConsentSection withOptional initiallyOpen="privacy" />
          </Card>
        </PageShell>
      );
    case "workspace-admin":
      return (
        <div className="flex flex-1 flex-col">
          <WorkspaceHeader membership={SAMPLE_MEMBERSHIP} mode="admin" />
        </div>
      );
    case "workspace-employee":
      return (
        <div className="flex flex-1 flex-col">
          <WorkspaceHeader membership={SAMPLE_MEMBERSHIP} mode="employee" />
        </div>
      );
    case "employee-home":
    case "employee-home-empty":
    case "employee-home-blocked":
    case "employee-home-rejected":
      return (
        <EmployeeShell membership={screen === "employee-home" ? SAMPLE_MEMBERSHIP : EMPLOYEE_MEMBERSHIP} theme={theme} previewPath="/employee">
          <EmployeeHomeView
            name={screen === "employee-home" ? "김대표" : "김개발"}
            base="#"
            month="2026-10"
            thisMonth="2026-10"
            filter="all"
            summary={{ pending_payout: screen === "employee-home" ? 142000 : 0, rejected_count: screen === "employee-home" ? 1 : 0, credits_left: screen === "employee-home-blocked" ? 0 : 80 }}
            notices={screen === "employee-home" ? <NoticeStrip notices={SAMPLE_NOTICES} /> : undefined}
            creditsBlocked={screen === "employee-home-blocked"}
            initial={{ items: screen === "employee-home" ? SAMPLE_CLAIMS : [], nextCursor: screen === "employee-home" ? "x" : null }}
            initialSheet={screen === "employee-home-rejected" ? SAMPLE_CLAIMS[3] : undefined}
          />
        </EmployeeShell>
      );
    case "employee-claim-edit":
    case "employee-claim-edit-empty":
    case "employee-claim-edit-trip":
    case "employee-claim-edit-owncar":
    case "employee-claim-edit-company-fields":
    case "employee-claim-edit-condolence":
      return (
        <EmployeeShell membership={EMPLOYEE_MEMBERSHIP} theme={theme} previewPath="/employee/claims/claim1/edit">
          <ClaimEditor
            data={
              screen === "employee-claim-edit-condolence"
                ? { ...SAMPLE_EDITOR, claim: { ...SAMPLE_EDITOR.claim, category: "condolence" as const, condolence_target: "external" as const, client_name: "(주)에이컴퍼니 김부장 부친상" } }
                : screen === "employee-claim-edit-company-fields"
                ? { ...SAMPLE_EDITOR, companyFields: [{ key: "custom.proj0001", label: "프로젝트", required: true, options: ["A프로젝트", "B프로젝트", "공통 운영비"] }, { key: "custom.code0001", label: "예산 코드 (아주 긴 칸 이름이 줄바꿈되는지 확인)", required: false, options: null }], lastCustom: { "custom.proj0001": "B프로젝트" } }
                : screen === "employee-claim-edit-empty"
                ? { ...SAMPLE_EDITOR, items: [], claim: { ...SAMPLE_EDITOR.claim, item_count: 0, total_amount: 0, total_company_supported: 0, total_personal_burden: 0 } }
                : screen === "employee-claim-edit-owncar"
                  ? {
                      ...SAMPLE_EDITOR,
                      claim: { ...SAMPLE_EDITOR.claim, is_business_trip: true, category: "trip" as const, trip_destination: "부산", trip_start_date: "2026-10-15", trip_end_date: "2026-10-16", trip_purpose: "지사 점검", trip_transport: "own_car" },
                      items: [
                        {
                          ...SAMPLE_ITEM, id: "oc1", category: "trip", trip_type: "own_car", payment_method: "personal_card", corporate_card_id: null, receipt_path: null, thumbUrl: null, merchant_name: null, amount: 64200,
                          start_location: "판교역 신분당선", end_location: "부산역", start_lat: 37.39, start_lng: 127.11, end_lat: 35.11, end_lng: 129.04, route_one_way_km: 321, distance_km: 321, distance_source: "api", is_round_trip: false, applied_fuel_rate_per_km: 200,
                          route_evidence: { start_address: "경기 성남시 분당구 판교역로 160", end_address: "부산 동구 중앙대로 206", computed_at: "2026-10-15T09:00:00+09:00" },
                        },
                        ...SAMPLE_EDITOR.items.slice(1, 3).map((i) => ({ ...i, category: "trip" as const, trip_type: "public_transport" as const })),
                      ],
                    }
                  : screen === "employee-claim-edit-trip"
                  ? { ...SAMPLE_EDITOR, claim: { ...SAMPLE_EDITOR.claim, status: "rejected", rejection_reason: "KTX 영수증의 날짜가 출장 기간과 달라요.", is_business_trip: true, category: "trip" as const, trip_destination: "부산", trip_start_date: "2026-10-15", trip_end_date: "2026-10-16", trip_purpose: "지사 점검", default_payment_method: "personal_card" } }
                  : SAMPLE_EDITOR
            }
            base="#"
            openAdd={screen === "employee-claim-edit-empty"}
            openItemId={screen === "employee-claim-edit-owncar" ? "oc1" : null}
          />
        </EmployeeShell>
      );
    case "employee-item-edit":
    case "employee-item-edit-trip":
    case "employee-item-edit-manual":
      return (
        <EmployeeShell membership={EMPLOYEE_MEMBERSHIP} theme={theme} previewPath="/employee/claims/claim1/edit">
          <ClaimEditor
            data={(() => {
              const it: EditorItem =
                screen === "employee-item-edit-trip"
                  ? { ...SAMPLE_ITEM, category: "trip", trip_type: "lodging", expense_date: "2026-10-18", merchant_name: "부산호텔", amount: 90000, supply_amount: 80000, vat_amount: 8182, parse_status: "failed" }
                  : screen === "employee-item-edit-manual"
                    ? { ...SAMPLE_ITEM, receipt_path: null, aiFilled: false, aiCardMasked: null, parse_status: "none", category: "meeting", merchant_name: "", amount: null, purpose: "", payment_method: "personal_card", corporate_card_id: null }
                    : { ...SAMPLE_ITEM, duplicate: { mine: [{ claim_id: "c0", title: "10/16 팀 점심", status: "draft" }], others: 1 } };
              const claim = screen === "employee-item-edit-trip" ? { ...SAMPLE_EDITOR.claim, is_business_trip: true, category: "trip" as const, trip_destination: "부산", trip_start_date: "2026-10-15", trip_end_date: "2026-10-16" } : SAMPLE_EDITOR.claim;
              return { ...SAMPLE_EDITOR, claim, items: [it, ...SAMPLE_EDITOR.items.slice(1)] };
            })()}
            base="#"
            openAdd={false}
            openItemId="i1"
          />
        </EmployeeShell>
      );
    case "app-admin-announcements":
      return (
        <AppAdminShell>
          <h1 className="text-2xl font-bold">전체 공지</h1>
          <AnnouncementForm preview placeholderTitle="예: 10/30(목) 02:00~03:00 정기 점검" audience="모든 회사의 모든 사용자" />
          <AnnouncementList rows={SAMPLE_NOTICES.map((n) => ({ ...n, pushed_count: 128 }))} />
        </AppAdminShell>
      );
    case "admin-announcements":
      return (
        <AdminShell membership={SAMPLE_MEMBERSHIP} theme={theme} previewPath="/announcements">
          <h1 className="text-2xl font-bold">사내 공지</h1>
          <AnnouncementForm preview placeholderTitle="예: 11월부터 식대 1인 12,000원" audience="우리 회사 직원" />
          <AnnouncementList rows={SAMPLE_NOTICES.filter((n) => n.scope === "company").map((n) => ({ ...n, pushed_count: 7 }))} />
        </AdminShell>
      );
    case "app-admin-companies":
      return (
        <AppAdminShell>
          <CompaniesView
            month="2026-10"
            base="#"
            rows={[
              { company_id: "c1", name: "포켓컴퍼니 주식회사", business_number: "1234567890", created_at: "2026-10-01T01:00:00Z", billing_status: "free_trial", credits_granted: 200, credits_used: 112, members_approved: 12, members_pending: 1, receipts_total: 112, receipts_month: 64, receipts_deleted: 3, last_receipt_at: "2026-10-19T09:00:00Z" },
              { company_id: "c2", name: "아주 긴 이름의 디자인 스튜디오 유한회사", business_number: "2208162517", created_at: "2026-10-10T01:00:00Z", billing_status: "free_trial", credits_granted: 100, credits_used: 0, members_approved: 1, members_pending: 0, receipts_total: 0, receipts_month: 0, receipts_deleted: 0, last_receipt_at: null },
            ]}
          />
        </AppAdminShell>
      );
    case "app-admin-company":
      return (
        <AppAdminShell>
          <CompanyDetailView data={AA_COMPANY_DETAIL} month="2026-10" base="#" />
        </AppAdminShell>
      );
    case "app-admin-receipt":
      return (
        <AppAdminShell>
          <ReceiptRecordView data={{ record: AA_RECORD, company: { id: "c1", name: "포켓컴퍼니 주식회사" }, item: null, claim: null, photoUrl: null, thumbUrl: null }} base="#" />
        </AppAdminShell>
      );
    case "landing-testimonials":
      return (
        <div className="flex-1 bg-zinc-950 text-white">
          <TestimonialsView
            rows={[
              { id: "t1", rating: 5, review: "현장 영수증 정리가 정말 편해졌어요. 월말에 경리 담당자 야근이 없어졌습니다.", industry: "construction", company_size: "5-10", job_role: "site_manager" },
              { id: "t2", rating: 4, review: "카톡으로 바로 승인하니 결재가 하루 빨라졌어요", industry: "interior", company_size: "1-4", job_role: "ceo" },
              { id: "t3", rating: 5, review: "세무사무소에 엑셀 하나로 끝", industry: "it", company_size: "11-30", job_role: "finance" },
            ]}
          />
        </div>
      );
    case "admin-billing":
    case "admin-billing-banner":
    case "admin-billing-empty":
      return (
        <AdminShell membership={SAMPLE_MEMBERSHIP} theme={theme} previewPath="/billing">
          <BillingView
            preview
            plans={SAMPLE_PLANS}
            addons={[{ code: "receipts_50", name: "추가 크레딧 50장", receipts: 50, price: 8000 }]}
            status={
              screen === "admin-billing-banner"
                ? { ...SAMPLE_CREDIT, used: 188, showEventBanner: true }
                : screen === "admin-billing-empty"
                  ? { ...SAMPLE_CREDIT, granted: 100, used: 100, eventCount: 0, eventTotal: 0, eventEnabled: false }
                  : SAMPLE_CREDIT
            }
          />
        </AdminShell>
      );
    case "admin-claims-detail":
    case "admin-claims-own":
      return (
        <AdminShell membership={SAMPLE_MEMBERSHIP} theme={theme} previewPath="/claims">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,3fr)]">
            <div className="hidden min-w-0 flex-col gap-3 lg:flex">
              <ApprovalTabs tab="pending" pendingCount={2} base="#" />
              <ClaimFiltersBar
                filters={{ month: "2026-10", department: null, member: null, category: "trip", q: null }}
                tab="pending"
                base="#"
                departments={[{ id: "d1", name: "개발팀" }]}
                members={[{ id: "p3", name: "김개발" }]}
              />
              <AdminClaimList rows={SAMPLE_ADMIN_ROWS} tab="pending" base="#" selectedId="cl1" />
            </div>
            <AdminClaimDetail
              detail={SAMPLE_DETAIL_CLAIM}
              canAct={screen === "admin-claims-detail"}
              blockedReason={screen === "admin-claims-own" ? "본인 결의서는 다른 관리자가 승인합니다." : null}
              backHref="#"
              payoutsHref="#"
              timeline={<ApprovalTimeline detail={SAMPLE_DETAIL_CLAIM} />}
              accountTitles={[
                { id: "t1", name: "복리후생비", code: "811" },
                { id: "t2", name: "여비교통비", code: "812" },
                { id: "t3", name: "기업업무추진비", code: "813" },
              ]}
            />
          </div>
        </AdminShell>
      );
    case "admin-export":
    case "admin-export-closed":
      return (
        <AdminShell membership={SAMPLE_MEMBERSHIP} theme={theme} previewPath="/export">
          <TaxClosingView
            data={{
              month: "2026-09",
              status: screen === "admin-export-closed" ? "closed" : "pending",
              closedAt: screen === "admin-export-closed" ? "2026-10-05T01:00:00Z" : null,
              reopenedAt: null,
              reopenReason: null,
              excluded: { draft: 2, submitted: 3, rejected: 1, claims: 4 },
              rows: SAMPLE_EXPORT_ROWS,
            }}
            months={["2026-10", "2026-09", "2026-08"]}
            base="#"
            claimsBase="#"
            companyName="포켓컴퍼니 주식회사"
            isSuper
          />
        </AdminShell>
      );
    case "admin-payouts":
      return (
        <AdminShell membership={SAMPLE_MEMBERSHIP} theme={theme} previewPath="/payouts">
          <PayoutsView
            tab="waiting"
            base="#"
            claimsBase="#"
            groups={[
              { member_id: "p3", name: "김개발", department: "개발팀", bank: { bank_name: "국민은행", account_number: "123456-01-234567", account_holder: "김개발" }, payout: 52000, payback: 0, claims: [
                { id: "c1", title: "10/15 부산 출장 경비", approved_at: "2026-10-16T05:00:00Z", paid_at: null, payout: 10000, payback: 0 },
                { id: "c2", title: "10월 야근 식대 (아주 긴 제목이 들어가도 줄이 넘치지 않는지 확인)", approved_at: "2026-10-17T05:00:00Z", paid_at: null, payout: 42000, payback: 0 },
              ] },
              { member_id: "p4", name: "이디자인", department: null, bank: null, payout: 0, payback: 6000, claims: [{ id: "c3", title: "거래처 점심", approved_at: "2026-10-17T05:00:00Z", paid_at: null, payout: 0, payback: 6000 }] },
            ]}
          />
        </AdminShell>
      );
    case "employee-claim-detail":
    case "employee-claim-detail-rejected":
      return (
        <EmployeeShell membership={EMPLOYEE_MEMBERSHIP} theme={theme} previewPath="/employee/claims/cl1">
          <EmployeeClaimDetail
            base="#"
            detail={
              screen === "employee-claim-detail"
                ? SAMPLE_DETAIL_CLAIM
                : { ...SAMPLE_DETAIL_CLAIM, claim: { ...SAMPLE_DETAIL_CLAIM.claim, status: "rejected", current_round: 1, rejection_reason: "국밥 영수증 날짜를 확인해 주세요" }, approvals: SAMPLE_DETAIL_CLAIM.approvals.slice(0, 1), flaggedItemIds: ["d3"], pendingStep: null }
            }
          />
        </EmployeeShell>
      );
    case "admin-notifications":
      return (
        <AdminShell membership={SAMPLE_MEMBERSHIP} theme={theme} previewPath="/notifications">
          <NotificationList
            devMode
            failedOnly={false}
            base="#"
            rows={[
              { id: "n1", claim_id: "c1", recipient_member_id: "m1", recipient_phone: "01011112222", template_code: "APPROVAL_REQUEST", payload: { text: "[PocketExpense] 새로운 지출결의서가 상신되었습니다.\n상신자: 김개발 (개발팀)\n제목: 10/15 부산 출장 경비\n금액: 72,000 원 (영수증 3장)\n결제수단: 법인 2 · 사비 1", button_label: "결재하러 가기", button_url: "https://pocket-expense-ruby.vercel.app/workspace/00000000-0000-0000-0000-0000000000aa/approvals/00000000-0000-0000-0000-000000000001" }, status: "sent", provider: "log", error_message: null, created_at: "2026-10-20T01:00:00Z", recipient_name: "김대표", claim_title: "10/15 부산 출장 경비" },
              { id: "n2", claim_id: "c1", recipient_member_id: "m2", recipient_phone: "", template_code: "APPROVAL_REJECTED", payload: { text: "[PocketExpense] 지출결의서가 반려되었습니다.", button_label: "수정 후 재상신하기", button_url: "#" }, status: "failed", provider: "log", error_message: "수신 번호가 없거나 휴대폰 번호 형식이 아닙니다", created_at: "2026-10-20T02:00:00Z", recipient_name: "이직원", claim_title: "팀 점심" },
            ]}
          />
        </AdminShell>
      );
    case "admin-approval-lines":
      return (
        <AdminShell membership={SAMPLE_MEMBERSHIP} theme={theme} previewPath="/approval-lines">
          <ApprovalLinesHeading />
          <ApprovalLinesView
            lines={[
              { department_id: null, name: "기본 결재라인", reviewers: [], appliesTo: 6 },
              { department_id: "d1", name: "영업팀 결재라인", reviewers: [{ id: "m5", name: "박영업", position: "팀장" }, { id: "m6", name: "최본부장", position: "본부장 (아주 긴 직급 이름 확인)" }], appliesTo: 4 },
            ]}
            departments={[
              { id: "d1", name: "영업팀", hasLine: true },
              { id: "d2", name: "개발팀", hasLine: false },
            ]}
            members={[
              { id: "m1", name: "김대표", position: "대표", department_id: null, role: "super_admin" },
              { id: "m5", name: "박영업", position: "팀장", department_id: "d1", role: "employee" },
              { id: "m6", name: "최본부장", position: "본부장", department_id: null, role: "admin" },
              { id: "m7", name: "이개발", position: null, department_id: "d2", role: "employee" },
            ]}
          />
        </AdminShell>
      );
    case "approvals-inbox":
      return (
        <EmployeeShell membership={EMPLOYEE_MEMBERSHIP} theme={theme} previewPath="/approvals" inbox={{ waiting: 2 }}>
          <main className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 pb-6 pt-5 md:max-w-2xl">
            <h1 className="text-xl font-bold tracking-tight">결재함</h1>
            <AdminClaimList rows={SAMPLE_ADMIN_ROWS.map((r) => ({ ...r, reviewing: null }))} tab="pending" base="#" />
          </main>
        </EmployeeShell>
      );
    case "approval-reviewer":
      return (
        <EmployeeShell membership={EMPLOYEE_MEMBERSHIP} theme={theme} previewPath="/approvals/cl1" inbox={{ waiting: 2 }}>
          <main className="mx-auto flex w-full max-w-md flex-col px-4 pt-3 md:max-w-3xl">
            <AdminClaimDetail
              detail={{ ...SAMPLE_DETAIL_CLAIM, pendingStep: { ...SAMPLE_DETAIL_CLAIM.pendingStep!, step_kind: "review", approver_member_id: "m" } }}
              canAct
              blockedReason={null}
              backHref="#"
              payoutsHref="#"
              timeline={<ApprovalTimeline detail={SAMPLE_DETAIL_CLAIM} />}
              reviewer
            />
          </main>
        </EmployeeShell>
      );
    case "employee-profile":
    case "employee-profile-new":
      return (
        <EmployeeShell membership={EMPLOYEE_MEMBERSHIP} theme={theme} previewPath="/employee/profile">
          <main className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 pb-6 pt-5">
            <h1 className="text-xl font-bold tracking-tight">내 정보</h1>
            <ProfileForm
              profile={
                screen === "employee-profile"
                  ? { name: "김개발", phone: "01012345678", position: "대리", employee_number: "PK-2024-007", vehicle_number: "12가3456", fuel_type: "diesel", department: "개발팀", role: "employee", optionalConsented: true, bank: { bank_name: "국민은행", account_number: "123456-01-234567", account_holder: "김개발" }, login: { provider: "kakao", email: "dev.long.address@pocketcompany.co.kr" } }
                  : { name: "최신입", phone: "01033335555", position: null, employee_number: null, vehicle_number: null, fuel_type: null, department: null, role: "employee", optionalConsented: false, bank: null, login: { provider: "google", email: "new@example.com" } }
              }
            />
          </main>
        </EmployeeShell>
      );
    case "employee-settlements":
      return (
        <EmployeeShell membership={EMPLOYEE_MEMBERSHIP} theme={theme} previewPath="/employee/settlements">
          <SettlementsView
            base="#"
            hasBank={false}
            waiting={52000}
            paidThisMonth={28000}
            payback={6000}
            cards={[
              { id: "s1", title: "10/15 부산 출장 경비", status: "approved", approved_at: "2026-10-16T05:00:00Z", paid_at: null, dateFrom: "2026-10-14", dateTo: "2026-10-15", personalCount: 1, corporateCount: 2, payout: 10000, payback: 0, items: [{ id: "x1", expense_date: "2026-10-15", merchant_name: "부산국밥", amount: 17000, supported: 10000, over: 7000 }] },
              { id: "s2", title: "고객사 방문 택시비 (아주 긴 제목이 들어가도 줄바꿈되는지 확인)", status: "paid", approved_at: "2026-10-15T05:00:00Z", paid_at: "2026-10-16T05:30:00Z", dateFrom: "2026-10-15", dateTo: "2026-10-15", personalCount: 1, corporateCount: 0, payout: 28000, payback: 0, items: [{ id: "x2", expense_date: "2026-10-15", merchant_name: "카카오T", amount: 28000, supported: 28000, over: 0 }] },
            ]}
          />
        </EmployeeShell>
      );
    case "admin-home":
      return (
        <AdminShell membership={SAMPLE_MEMBERSHIP} theme={theme} previewPath="/employee">
          <AdminHomeView
            adminName="김대표"
            companyName="포켓컴퍼니 주식회사"
            inviteCode="ABCD2345"
            dashboard={{ ...SAMPLE_DASHBOARD, kpi: { spend: 0, spend_prev: 0, pending_claims: 0, pending_oldest_days: null, unpaid_payout: 0, unpaid_payback: 0 }, todo: { pending_members: 2, unmapped_items: 0, settle_claims: 0, failed_notifications: 0 }, checklist: { approved_members: 1, departments: 2, policy_confirmed: false, review_steps: 0 }, categories: [], top_members: [] }}
            creditsLeft={100}
            creditsGranted={100}
            basePath="#"
            policyToConfirm={["식대 1인 10,000원", "자차 km당 200원", "청구 기한 결제한 다음 달 5일까지"]}
            preview
          />
        </AdminShell>
      );
    case "admin-home-team":
      // 직원이 들어온 뒤: 초대 카드는 아래로, 간단히
      return (
        <AdminShell membership={SAMPLE_MEMBERSHIP} theme={theme} previewPath="/employee">
          <AdminHomeView
            adminName="김대표"
            companyName="포켓컴퍼니 주식회사"
            inviteCode="ABCD2345"
            dashboard={SAMPLE_DASHBOARD}
            creditsLeft={18}
            creditsGranted={100}
            basePath="#"
            preview
          />
        </AdminShell>
      );
    case "admin-members":
      return (
        <AdminShell membership={SAMPLE_MEMBERSHIP} theme={theme} previewPath="/members">
          <MembersHeading />
          <InviteLinkCard inviteCode="ABCD2345" companyName="포켓컴퍼니 주식회사" preview compact />
          <MembersView members={SAMPLE_MEMBERS} tab="pending" basePath="#" preview />
        </AdminShell>
      );
    case "admin-members-all":
      return (
        <AdminShell membership={SAMPLE_MEMBERSHIP} theme={theme} previewPath="/members">
          <MembersHeading />
          <MembersView members={SAMPLE_MEMBERS} tab="all" basePath="#" preview />
        </AdminShell>
      );
    case "admin-account-titles":
      return (
        <AdminShell membership={SAMPLE_MEMBERSHIP} theme={theme} previewPath="/account-titles">
          <AccountTitlesHeading />
          <AccountTitlesView
            titles={[
              { id: "t1", name: "복리후생비", code: "811", sort_order: 1, used: true },
              { id: "t2", name: "여비교통비", code: "812", sort_order: 2, used: true },
              { id: "t3", name: "기업업무추진비", code: null, sort_order: 3, used: true },
              { id: "t5", name: "소모품비", code: "830", sort_order: 4, used: true },
              { id: "t4", name: "회의비(외부 손님 응대 아닌 내부 회의 다과)", code: "831", sort_order: 5, used: false },
            ]}
            mappings={[
              { id: "m1", category: "meal", trip_type: null, purchase_type: null, account_title_id: "t1" },
              ...["meal", "public_transport", "taxi", "toll_parking", "lodging", "own_car", "other"].map((t, i) => ({ id: `m${i + 2}`, category: "trip" as const, trip_type: t, purchase_type: null, account_title_id: "t2" })),
              { id: "m9", category: "meeting", trip_type: null, purchase_type: null, account_title_id: "t3" },
              { id: "m10", category: "purchase", trip_type: null, purchase_type: "pantry", account_title_id: "t1" },
              { id: "m11", category: "purchase", trip_type: null, purchase_type: "office_supplies", account_title_id: "t5" },
              { id: "m12", category: "purchase", trip_type: null, purchase_type: "small_equipment", account_title_id: "t5" },
            ]}
            preview
          />
        </AdminShell>
      );
    case "admin-reconcile":
      return (
        <AdminShell membership={SAMPLE_MEMBERSHIP} theme={theme} previewPath="/corporate-cards/reconcile">
          <ReconcileHeading />
          <ReconcileView base="#" holders={{ "7890": "대표 법인카드 · 김대표" }} />
        </AdminShell>
      );
    case "admin-form-template":
    case "admin-form-template-monthly":
      return (
        <AdminShell membership={SAMPLE_MEMBERSHIP} theme={theme} previewPath="/form-template">
          <SectionHeading as="h1" title="지출결의서 양식" summary="결재·보관용 지출결의서 문서 모양을 정해요. 결의서 상세의 [지출결의서 PDF]와 세무 마감 PDF가 이 양식으로 나가요." />
          <FormTemplateView
            companyId="c0000000-0000-0000-0000-000000000000"
            companyName="포켓컴퍼니 주식회사"
            active={screen === "admin-form-template-monthly" ? { version: 2, createdAt: "2026-10-23T00:00:00Z" } : null}
            initialLayout={screen === "admin-form-template-monthly" ? FORM_PRESETS.monthly.layout : FORM_PRESETS.standard.layout}
            previewDoc={FORM_SAMPLE_DOC}
            previewLabel="예시 결의서"
            preview
          />
        </AdminShell>
      );
    case "admin-recurring":
    case "admin-recurring-empty":
      return (
        <AdminShell membership={SAMPLE_MEMBERSHIP} theme={theme} previewPath="/recurring">
          <RecurringHeading />
          <RecurringView
            rows={
              screen === "admin-recurring-empty"
                ? []
                : [
                    { id: "r1", service_name: "노션 팀 플랜", amount: 48000, cycle: "monthly", billing_day: 5, billing_month: null, payment_method: "corporate_card", corporate_card_id: "c1", assignee_member_id: "p1", memo: null, starts_on: "2026-09-01", is_active: true, last: { claim_id: "x", period: "2026-10-05", status: "submitted" } },
                    { id: "r2", service_name: "구글 워크스페이스 비즈니스 스탠다드 (아주 긴 서비스명 줄바꿈 확인)", amount: 216000, cycle: "monthly", billing_day: 31, billing_month: null, payment_method: "corporate_card", corporate_card_id: null, assignee_member_id: "p2", memo: null, starts_on: "2026-09-01", is_active: true, last: null },
                    { id: "r3", service_name: "도메인 연장", amount: 22000, cycle: "yearly", billing_day: 10, billing_month: 3, payment_method: "personal_card", corporate_card_id: null, assignee_member_id: "p1", memo: null, starts_on: "2026-01-01", is_active: false, last: { claim_id: "y", period: "2026-03-10", status: "paid" } },
                  ]
            }
            members={[{ id: "p1", name: "김대표" }, { id: "p2", name: "박관리" }]}
            cards={[{ id: "c1", nickname: "대표 법인카드", last4: "7890" }]}
            today="2026-10-23"
            preview
          />
        </AdminShell>
      );
    case "admin-vehicles":
    case "admin-vehicles-empty":
      return (
        <AdminShell membership={SAMPLE_MEMBERSHIP} theme={theme} previewPath="/vehicles">
          <VehiclesHeading />
          <VehiclesView
            vehicles={
              screen === "admin-vehicles-empty"
                ? []
                : [
                    { id: "v1", nickname: "영업 1호차", plate_number: "12가3456", is_active: true, month_total: 384000 },
                    { id: "v2", nickname: "대표 차량 (제네시스 G80, 아주 긴 별칭 줄바꿈 확인)", plate_number: "123가4567", is_active: true, month_total: 0 },
                    { id: "v3", nickname: "처분한 예전 차량", plate_number: "34나5678", is_active: false, month_total: 0 },
                  ]
            }
            preview
          />
        </AdminShell>
      );
    case "admin-corporate-cards":
      return (
        <AdminShell membership={SAMPLE_MEMBERSHIP} theme={theme} previewPath="/corporate-cards">
          <CorporateCardsHeading />
          <CorporateCardsView
            cards={[
              { id: "c1", nickname: "대표 법인카드", bin6: "532712", last4: "7890", is_active: true, holder_member_id: "p1", holder_name: "김대표", month_total: 1284000 },
              { id: "c2", nickname: "영업팀 공용카드 (서울·부산 지사 함께 사용)", bin6: null, last4: "1234", is_active: true, holder_member_id: null, holder_name: null, month_total: 0 },
              { id: "c3", nickname: "해지한 예전 카드", bin6: "943011", last4: "5555", is_active: false, holder_member_id: null, holder_name: null, month_total: 0 },
            ]}
            members={[{ id: "p1", name: "김대표" }, { id: "p2", name: "박관리" }]}
            preview
          />
        </AdminShell>
      );
    case "admin-corporate-cards-empty":
      return (
        <AdminShell membership={SAMPLE_MEMBERSHIP} theme={theme} previewPath="/corporate-cards">
          <CorporateCardsHeading />
          <CorporateCardsView cards={[]} members={[{ id: "p1", name: "김대표" }]} preview />
        </AdminShell>
      );
    case "admin-member-detail":
      // 최고 관리자가 관리자를 볼 때: 편집·권한·넘기기·퇴사 처리 모두 보임 + 비활성화 점검 결과(경고)
      return (
        <AdminShell membership={SAMPLE_MEMBERSHIP} theme={theme} previewPath="/members">
          <MemberDetailView
            member={SAMPLE_DETAIL}
            departments={SAMPLE_DEPARTMENTS}
            can={capabilitiesFor({ member_id: "p1", role: "super_admin" }, SAMPLE_DETAIL)}
            backHref="#"
            preview
            companyMealLimit={10000}
            initialCheck={{ unpaid_claims: 2, payout_amount: 128000, payback_amount: 6000, open_claims: 1, approval_line_steps: 0, pending_reviews: 0, blocked: false }}
          />
        </AdminShell>
      );
    case "admin-member-inactive":
      return (
        <AdminShell membership={SAMPLE_MEMBERSHIP} theme={theme} previewPath="/members">
          <MemberDetailView
            member={{ ...SAMPLE_DETAIL, role: "employee", status: "inactive" }}
            departments={SAMPLE_DEPARTMENTS}
            can={capabilitiesFor({ member_id: "p1", role: "super_admin" }, { id: SAMPLE_DETAIL.id, role: "employee", status: "inactive" })}
            backHref="#"
            preview
          />
        </AdminShell>
      );
    case "admin-member-readonly":
      // 관리자가 다른 관리자를 볼 때: 읽기 전용
      return (
        <AdminShell membership={{ ...SAMPLE_MEMBERSHIP, role: "admin" }} theme={theme} previewPath="/members">
          <MemberDetailView
            member={SAMPLE_DETAIL}
            departments={SAMPLE_DEPARTMENTS}
            can={capabilitiesFor({ member_id: "p9", role: "admin" }, SAMPLE_DETAIL)}
            backHref="#"
            preview
          />
        </AdminShell>
      );
    case "admin-settings":
      return (
        <AdminShell membership={SAMPLE_MEMBERSHIP} theme={theme} previewPath="/settings">
          <h1 className="text-2xl font-bold tracking-tight">지출 한도·정책</h1>
          <CompanySettingsForm
            settings={{
              name: "포켓컴퍼니 주식회사",
              business_number: "1248100998",
              invite_code: "ABCD2345",
              meal_limit_enabled: true,
              meal_limit_per_person: 10000,
              meal_limit_mode: "split",
              fuel_enabled: true,
              fuel_rate_per_km: 200,
              fuel_rate_mode: "opinet",
              per_diem_enabled: true,
              per_diem_amount: 30000,
              latest_oil: { log_date: "2026-10-22", gasoline: 1680.12, diesel: 1540.5, lpg: 1010 },
              odometer_photo_required: false,
              claim_deadline_type: "next_month_day",
              claim_deadline_days: 5,
            }}
            preview
          />
        </AdminShell>
      );
    case "admin-departments":
      return (
        <AdminShell membership={SAMPLE_MEMBERSHIP} theme={theme} previewPath="/departments">
          <DepartmentsHeading />
          <DepartmentsView departments={SAMPLE_DEPT_ROWS} preview />
        </AdminShell>
      );
    case "perf-check":
      return <PerfCheck />;
    case "receipt-image":
      return <ReceiptImageCheck />;
    default:
      notFound();
  }
}
