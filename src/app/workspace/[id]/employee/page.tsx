import { Suspense } from "react";
import { WorkspaceHeader } from "@/components/workspace/workspace-header";
import { requireWorkspace } from "@/lib/auth/guards";

export const metadata = { title: "내 경비 · PocketExpense" };

// T2 범위: 가입 후 도착 화면. 본문(E-01)은 T6에서 구현.
export default function EmployeeHomePage({ params }: PageProps<"/workspace/[id]/employee">) {
  return (
    <Suspense fallback={<div className="m-4 h-64 animate-pulse rounded-xl bg-zinc-100" />}>
      <EmployeeHome params={params} />
    </Suspense>
  );
}

async function EmployeeHome({ params }: { params: PageProps<"/workspace/[id]/employee">["params"] }) {
  const { id } = await params;
  const membership = await requireWorkspace(id);
  return (
    <div className="flex flex-1 flex-col">
      <WorkspaceHeader membership={membership} mode="employee" />
      <main className="mx-auto flex w-full max-w-md flex-col gap-2 px-4 py-8">
        <h1 className="text-2xl font-bold tracking-tight">안녕하세요, {membership.name}님 👋</h1>
        <p className="text-zinc-600">영수증 청구 화면은 준비 중입니다.</p>
      </main>
    </div>
  );
}
