import Link from "next/link";
import { Suspense } from "react";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { buttonSecondary, Card, PageShell } from "@/components/ui/page-shell";
import { requireUnapprovedMembership } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "승인 대기 · PocketExpense" };

// 승인 대기 / 이용 중지 안내 (spec/features/auth-onboarding.md §3.3)
export default function PendingPage() {
  return (
    <PageShell>
      <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-zinc-100" />}>
        <PendingContent />
      </Suspense>
    </PageShell>
  );
}

async function PendingContent() {
  const membership = await requireUnapprovedMembership();
  const supabase = await createClient();
  // RLS상 승인 대기 멤버는 자기 행만 볼 수 있다
  const { data: me } = await supabase.from("members").select("name, phone, position").eq("id", membership.member_id).maybeSingle();

  const inactive = membership.status === "inactive";
  return (
    <>
      <div className="pt-8 text-center">
        <h1 className="text-2xl font-bold tracking-tight">{inactive ? "이용이 중지된 계정입니다" : "관리자 승인 후 이용할 수 있습니다"}</h1>
        <p className="mt-2 text-zinc-600">
          {inactive ? "회사 관리자에게 문의해 주세요." : `${membership.company_name} 관리자가 가입을 승인하면 바로 시작할 수 있어요.`}
        </p>
      </div>
      <Card>
        <dl className="grid grid-cols-[6rem_1fr] gap-y-2 text-sm">
          <dt className="text-zinc-500">회사</dt>
          <dd className="font-medium">{membership.company_name}</dd>
          <dt className="text-zinc-500">이름</dt>
          <dd>{me?.name ?? membership.name}</dd>
          {me?.phone && (
            <>
              <dt className="text-zinc-500">휴대폰</dt>
              <dd>{me.phone.replace(/^(\d{3})(\d{3,4})(\d{4})$/, "$1-$2-$3")}</dd>
            </>
          )}
          {me?.position && (
            <>
              <dt className="text-zinc-500">직급</dt>
              <dd>{me.position}</dd>
            </>
          )}
        </dl>
      </Card>
      {!inactive && (
        <Link href="/onboarding/pending" prefetch={false} className={buttonSecondary}>
          승인 여부 다시 확인
        </Link>
      )}
      <div className="text-center">
        <SignOutButton />
      </div>
    </>
  );
}
