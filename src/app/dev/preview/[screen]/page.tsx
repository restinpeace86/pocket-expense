import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { AdminHomeView } from "@/components/admin/admin-home-view";
import { AccountTitlesHeading, AccountTitlesView } from "@/components/admin/account-titles-view";
import { AdminShell, type ShellTheme } from "@/components/admin/admin-shell";
import { CorporateCardsHeading, CorporateCardsView } from "@/components/admin/corporate-cards-view";
import { CompanySettingsForm } from "@/components/admin/company-settings-form";
import { EmployeeHomeView } from "@/components/employee/employee-home-view";
import { EmployeeShell } from "@/components/employee/employee-shell";
import { ClaimEditor } from "@/components/employee/claim-editor";
import { AppAdminShell } from "@/components/app-admin/app-admin-shell";
import { BillingView } from "@/components/admin/billing-view";
import { CompaniesView } from "@/components/app-admin/companies-view";
import { CompanyDetailView, type CompanyDetail } from "@/components/app-admin/company-detail-view";
import { ReceiptRecordView, type ReceiptRecordData } from "@/components/app-admin/receipt-record-view";
import { ItemEditor } from "@/components/employee/item-editor";
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

const SAMPLE_ITEM: EditorItem = {
  id: "i1", sort_order: 1, category: "meal", trip_type: null, purchase_type: null, payment_method: "corporate_card", corporate_card_id: "card1",
  evidence_type: "card_slip", expense_date: "2026-10-16", merchant_name: "김밥천국 강남역점", merchant_business_number: "2208162517",
  amount: 31000, supply_amount: 28182, vat_amount: 2818, headcount: 2, purpose: null, attendees: null, client_name: null,
  trip_start_date: null, trip_end_date: null, parse_status: "success", receipt_path: "x/receipt.jpg", company_supported_amount: 20000,
  personal_burden_amount: 11000, thumbUrl: null, isPdf: false, aiFilled: true, aiCardLast4: "7890", aiIncomeDeduction: false,
  paid_time: "12:41", approval_number: "30012345", merchant_address: "서울 강남구 테헤란로 123 강남역 지하상가 B1층 (아주 긴 주소 줄바꿈 확인)",
  line_items: [
    { name: "참치김밥", quantity: 2, unit_price: 4500, amount: 9000 },
    { name: "라볶이 (치즈 추가, 아주 긴 품목 이름 줄바꿈 확인)", quantity: 2, unit_price: 6500, amount: 13000 },
    { name: "돈까스", quantity: 1, unit_price: 9000, amount: 9000 },
    { name: "쿠폰 할인", quantity: null, unit_price: null, amount: -1000 },
  ],
  duplicate: null,
};
const SAMPLE_EDITOR: EditorData = {
  claim: {
    id: "claim1", status: "draft", title: "", description: "", default_payment_method: "corporate_card", is_business_trip: false,
    trip_destination: null, trip_start_date: null, trip_end_date: null, trip_purpose: null, item_count: 4, total_amount: 172000,
    total_company_supported: 161000, total_personal_burden: 11000, rejection_reason: null,
  },
  items: [
    { ...SAMPLE_ITEM, duplicate: { mine: [], others: 1 } },
    { ...SAMPLE_ITEM, id: "i2", sort_order: 2, category: "trip", trip_type: "public_transport", merchant_name: "코레일 KTX 서울→부산 (아주 긴 가맹점 이름 테스트)", amount: 59800, payment_method: "personal_card", corporate_card_id: null, company_supported_amount: 59800, personal_burden_amount: 0, headcount: 1, aiCardLast4: null },
    { ...SAMPLE_ITEM, id: "i3", sort_order: 3, category: null, merchant_name: null, expense_date: null, amount: null, parse_status: "failed", evidence_type: null, isPdf: true, receipt_path: "x/a.pdf", company_supported_amount: null, personal_burden_amount: 0 },
    { ...SAMPLE_ITEM, id: "i4", sort_order: 4, category: "purchase", purchase_type: "pantry", merchant_name: "이마트24", amount: 81200, receipt_path: null, aiFilled: false, company_supported_amount: 81200, personal_burden_amount: 0 },
  ],
  cards: [{ id: "card1", nickname: "대표 법인카드", last4: "7890" }, { id: "card2", nickname: "영업팀 카드", last4: "1234" }],
  mealPolicy: { enabled: true, perPerson: 10000, mode: "split" },
  mealOverride: null,
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
  { code: "starter", name: "스타터", monthly_price: 30000, annual_price: 324000, monthly_receipts: 150, recommended_size: "5인 미만", is_featured: false },
  { code: "standard", name: "스탠다드", monthly_price: 60000, annual_price: 648000, monthly_receipts: 400, recommended_size: "5~15인", is_featured: true },
  { code: "pro", name: "프로", monthly_price: 110000, annual_price: 1188000, monthly_receipts: 800, recommended_size: "영업·현장직이 많은 팀", is_featured: false },
];
const SAMPLE_CREDIT = { granted: 200, used: 163, freeTrial: 100, eventCount: 1, eventTotal: 100, eventEnabled: true, eventAmount: 100, showEventBanner: false };

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
        <EmployeeShell membership={screen === "employee-home" ? SAMPLE_MEMBERSHIP : EMPLOYEE_MEMBERSHIP} theme={theme} previewPath="">
          <EmployeeHomeView
            name={screen === "employee-home" ? "김대표" : "김개발"}
            base="#"
            month="2026-10"
            thisMonth="2026-10"
            filter="all"
            summary={{ pending_payout: screen === "employee-home" ? 142000 : 0, rejected_count: screen === "employee-home" ? 1 : 0, credits_left: screen === "employee-home-blocked" ? 0 : 80 }}
            creditsBlocked={screen === "employee-home-blocked"}
            initial={{ items: screen === "employee-home" ? SAMPLE_CLAIMS : [], nextCursor: screen === "employee-home" ? "x" : null }}
            initialSheet={screen === "employee-home-rejected" ? SAMPLE_CLAIMS[3] : undefined}
          />
        </EmployeeShell>
      );
    case "employee-claim-edit":
    case "employee-claim-edit-empty":
    case "employee-claim-edit-trip":
      return (
        <EmployeeShell membership={EMPLOYEE_MEMBERSHIP} theme={theme} previewPath="/claims/claim1/edit">
          <ClaimEditor
            data={
              screen === "employee-claim-edit-empty"
                ? { ...SAMPLE_EDITOR, items: [], claim: { ...SAMPLE_EDITOR.claim, item_count: 0, total_amount: 0, total_company_supported: 0, total_personal_burden: 0 } }
                : screen === "employee-claim-edit-trip"
                  ? { ...SAMPLE_EDITOR, claim: { ...SAMPLE_EDITOR.claim, status: "rejected", rejection_reason: "KTX 영수증의 날짜가 출장 기간과 달라요.", is_business_trip: true, trip_destination: "부산", trip_start_date: "2026-10-15", trip_end_date: "2026-10-16", trip_purpose: "지사 점검", default_payment_method: "personal_card" } }
                  : SAMPLE_EDITOR
            }
            base="#"
            openAdd={screen === "employee-claim-edit-empty"}
          />
        </EmployeeShell>
      );
    case "employee-item-edit":
    case "employee-item-edit-trip":
    case "employee-item-edit-manual":
      return (
        <EmployeeShell membership={EMPLOYEE_MEMBERSHIP} theme={theme} previewPath="/claims/claim1/items/i1">
          <ItemEditor
            claim={screen === "employee-item-edit-trip" ? { ...SAMPLE_EDITOR.claim, is_business_trip: true, trip_start_date: "2026-10-15", trip_end_date: "2026-10-16" } : SAMPLE_EDITOR.claim}
            item={
              screen === "employee-item-edit-trip"
                ? { ...SAMPLE_ITEM, category: "trip", trip_type: "lodging", expense_date: "2026-10-18", merchant_name: "부산호텔", amount: 90000, supply_amount: 80000, vat_amount: 8182, parse_status: "failed" }
                : screen === "employee-item-edit-manual"
                  ? { ...SAMPLE_ITEM, receipt_path: null, aiFilled: false, aiCardLast4: null, parse_status: "none", category: "meeting", merchant_name: "", amount: null, purpose: "", payment_method: "personal_card", corporate_card_id: null }
                  : { ...SAMPLE_ITEM, duplicate: { mine: [{ claim_id: "c0", title: "10/16 팀 점심", status: "draft" }], others: 1 } }
            }
            index={0}
            total={4}
            prevId={null}
            nextId="i2"
            cards={SAMPLE_EDITOR.cards}
            mealPolicy={SAMPLE_EDITOR.mealPolicy}
            mealOverride={null}
            originalUrl={null}
            base="#"
          />
        </EmployeeShell>
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
    case "admin-billing":
    case "admin-billing-banner":
    case "admin-billing-empty":
      return (
        <AdminShell membership={SAMPLE_MEMBERSHIP} theme={theme} previewPath="/billing">
          <BillingView
            preview
            plans={SAMPLE_PLANS}
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
    case "admin-home":
      return (
        <AdminShell membership={SAMPLE_MEMBERSHIP} theme={theme} previewPath="">
          <AdminHomeView
            adminName="김대표"
            companyName="포켓컴퍼니 주식회사"
            inviteCode="ABCD2345"
            pendingCount={2}
            approvedCount={1}
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
        <AdminShell membership={SAMPLE_MEMBERSHIP} theme={theme} previewPath="">
          <AdminHomeView
            adminName="김대표"
            companyName="포켓컴퍼니 주식회사"
            inviteCode="ABCD2345"
            pendingCount={0}
            approvedCount={8}
            creditsLeft={73}
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
    case "admin-corporate-cards":
      return (
        <AdminShell membership={SAMPLE_MEMBERSHIP} theme={theme} previewPath="/corporate-cards">
          <CorporateCardsHeading />
          <CorporateCardsView
            cards={[
              { id: "c1", nickname: "대표 법인카드", last4: "7890", is_active: true, holder_member_id: "p1", holder_name: "김대표", month_total: 1284000 },
              { id: "c2", nickname: "영업팀 공용카드 (서울·부산 지사 함께 사용)", last4: "1234", is_active: true, holder_member_id: null, holder_name: null, month_total: 0 },
              { id: "c3", nickname: "해지한 예전 카드", last4: "5555", is_active: false, holder_member_id: null, holder_name: null, month_total: 0 },
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
