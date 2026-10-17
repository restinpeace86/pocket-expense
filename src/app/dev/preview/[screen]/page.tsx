import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { AdminHomeView } from "@/components/admin/admin-home-view";
import { AdminShell, type ShellTheme } from "@/components/admin/admin-shell";
import { CompanySettingsForm } from "@/components/admin/company-settings-form";
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
