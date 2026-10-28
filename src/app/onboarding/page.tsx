import Link from "next/link";
import { Suspense } from "react";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { InviteCodeForm } from "@/components/onboarding/invite-code-form";
import { buttonPrimary, buttonSecondary, Card, PageShell } from "@/components/ui/page-shell";
import { requireNoMembership } from "@/lib/auth/guards";
import { isTaxAgent } from "@/lib/tax-office/queries";

export const metadata = { title: "시작하기 · PocketExpense" };

export default function OnboardingPage() {
  return (
    <PageShell>
      <h1 className="pt-6 text-2xl font-bold tracking-tight">어떻게 시작할까요?</h1>
      <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-zinc-100" />}>
        <OnboardingChoices />
      </Suspense>
    </PageShell>
  );
}

async function OnboardingChoices() {
  await requireNoMembership("/onboarding");
  const taxAgent = await isTaxAgent();
  return (
    <>
      {taxAgent && (
        <Card>
          <h2 className="text-lg font-semibold">담당 세무사로 연결된 회사가 있어요</h2>
          <p className="mb-4 mt-1 break-keep text-sm text-zinc-600">고객사가 이 계정의 이메일을 담당 세무사로 등록했어요. 승인된 지출과 세무용 엑셀을 볼 수 있어요.</p>
          <Link href="/tax-office" className={buttonPrimary}>
            세무사 화면으로 가기
          </Link>
        </Card>
      )}
      <Card>
        <h2 className="text-lg font-semibold">초대 코드로 회사 합류</h2>
        <p className="mb-4 mt-1 text-sm text-zinc-600">관리자에게 받은 초대 링크가 없다면 코드를 직접 입력하세요.</p>
        <InviteCodeForm />
      </Card>
      <Card>
        <h2 className="text-lg font-semibold">새 회사 만들기</h2>
        <p className="mb-4 mt-1 text-sm text-zinc-600">대표·관리자라면 회사를 등록하고 직원을 초대하세요.</p>
        <Link href="/onboarding/create-company" className={buttonSecondary}>
          회사 등록하기
        </Link>
      </Card>
      <div className="text-center">
        <SignOutButton />
      </div>
    </>
  );
}
