import { Suspense } from "react";
import { CreateCompanyForm } from "@/components/onboarding/create-company-form";
import { Card, PageShell } from "@/components/ui/page-shell";
import { requireNoMembership } from "@/lib/auth/guards";

export const metadata = { title: "회사 등록 · PocketExpense" };

// 회사 생성 위저드 (spec/screens/admin-onboarding.md). 로그인(Step 1)은 /login에서, 여기는 Step 2~3.
export default function CreateCompanyPage() {
  return (
    <PageShell>
      <div className="pt-6">
        <p className="text-sm font-medium text-blue-600">회사 등록</p>
        <h1 className="text-2xl font-bold tracking-tight">우리 회사 정보를 입력해 주세요</h1>
        <p className="mt-1 text-sm text-zinc-600">등록하면 바로 무료로 영수증 100장을 쓸 수 있어요. 결제는 필요 없습니다.</p>
      </div>
      <Card>
        <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-zinc-100" />}>
          <Guarded />
        </Suspense>
      </Card>
    </PageShell>
  );
}

async function Guarded() {
  await requireNoMembership("/onboarding/create-company");
  return <CreateCompanyForm />;
}
