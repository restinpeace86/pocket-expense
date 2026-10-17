import { Suspense } from "react";
import { DepartmentsView } from "@/components/admin/departments-view";
import { getDepartments } from "@/lib/admin/queries";
import { requireWorkspace } from "@/lib/auth/guards";

export const metadata = { title: "부서 · PocketExpense" };

export default function DepartmentsPage({ params }: PageProps<"/workspace/[id]/admin/departments">) {
  return (
    <>
      <div>
        <h1 className="text-2xl font-bold tracking-tight">부서</h1>
        <p className="mt-1 text-sm text-zinc-600">직원이 가입할 때 고르는 부서 목록이에요. 화살표로 보이는 순서를 바꿀 수 있어요.</p>
      </div>
      <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-zinc-100" />}>
        <Departments params={params} />
      </Suspense>
    </>
  );
}

async function Departments({ params }: { params: PageProps<"/workspace/[id]/admin/departments">["params"] }) {
  const { id } = await params;
  const membership = await requireWorkspace(id, { admin: true });
  const departments = await getDepartments(membership.company_id);
  return <DepartmentsView departments={departments} />;
}
