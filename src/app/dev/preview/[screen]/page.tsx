import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { ConsentSection } from "@/components/legal/consent-section";
import { CreateCompanyForm } from "@/components/onboarding/create-company-form";
import { InviteCodeForm } from "@/components/onboarding/invite-code-form";
import { JoinForm } from "@/components/onboarding/join-form";
import { buttonSecondary, Card, PageShell } from "@/components/ui/page-shell";
import { WorkspaceHeader } from "@/components/workspace/workspace-header";
import type { Membership } from "@/lib/auth/paths";

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
};

export default function PreviewPage({ params }: PageProps<"/dev/preview/[screen]">) {
  return (
    <Suspense fallback={null}>
      <Preview params={params} />
    </Suspense>
  );
}

async function Preview({ params }: { params: PageProps<"/dev/preview/[screen]">["params"] }) {
  await connection();
  if (process.env.ENABLE_UI_PREVIEW !== "1") notFound();
  const { screen } = await params;

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
    default:
      notFound();
  }
}
