import { Suspense } from "react";
import { DepartmentsHeading, DepartmentsView } from "@/components/admin/departments-view";
import { getDepartments } from "@/lib/admin/queries";
import { requireWorkspace } from "@/lib/auth/guards";

export const metadata = { title: "부서 · PocketExpense" };

export default function DepartmentsPage({ params }: PageProps<"/workspace/[id]/admin/departments">) {
  return (
    <>
      <DepartmentsHeading />
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
