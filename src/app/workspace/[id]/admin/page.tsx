import { Suspense } from "react";
import { Card } from "@/components/ui/page-shell";
import { WorkspaceHeader } from "@/components/workspace/workspace-header";
import { requireWorkspace } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "관리자 · PocketExpense" };

// T2 범위: 회사 생성 직후 도착 화면(초대 안내). 대시보드 본문은 T3·T11에서 구현.
export default function AdminHomePage({ params }: PageProps<"/workspace/[id]/admin">) {
  return (
    <Suspense fallback={<div className="m-4 h-64 animate-pulse rounded-xl bg-zinc-100" />}>
      <AdminHome params={params} />
    </Suspense>
  );
}

async function AdminHome({ params }: { params: PageProps<"/workspace/[id]/admin">["params"] }) {
  const { id } = await params;
  const membership = await requireWorkspace(id, { admin: true });
  const supabase = await createClient();
  const { data: company } = await supabase
    .from("companies")
    .select("invite_code, receipt_credits_granted, receipt_credits_used")
    .eq("id", membership.company_id)
    .single();

  return (
    <div className="flex flex-1 flex-col">
      <WorkspaceHeader membership={membership} mode="admin" />
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-8">
        <h1 className="text-2xl font-bold tracking-tight">{membership.name}님, 회사 등록이 완료됐어요</h1>
        <Card>
          <h2 className="font-semibold">직원 초대</h2>
          <p className="mt-1 text-sm text-zinc-600">아래 코드를 직원에게 알려 주세요. 초대 링크·QR 화면은 곧 제공됩니다.</p>
          <p className="mt-3 font-mono text-2xl tracking-[0.3em]">{company?.invite_code}</p>
        </Card>
        {company && (
          <Card>
            <h2 className="font-semibold">무료 영수증</h2>
            <p className="mt-1 text-sm text-zinc-600">
              {company.receipt_credits_granted - company.receipt_credits_used}장 남음 (총 {company.receipt_credits_granted}장)
            </p>
          </Card>
        )}
        <p className="text-sm text-zinc-500">관리자 대시보드는 준비 중입니다.</p>
      </main>
    </div>
  );
}
