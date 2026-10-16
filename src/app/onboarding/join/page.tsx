import Link from "next/link";
import { Suspense } from "react";
import { JoinForm } from "@/components/onboarding/join-form";
import { buttonSecondary, Card, PageShell } from "@/components/ui/page-shell";
import { requireNoMembership } from "@/lib/auth/guards";
import { messageForDbError } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "직원 가입 · PocketExpense" };

export default function JoinPage({ searchParams }: PageProps<"/onboarding/join">) {
  return (
    <PageShell>
      <h1 className="pt-6 text-2xl font-bold tracking-tight">직원 정보 입력</h1>
      <Card>
        <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-zinc-100" />}>
          <JoinContent searchParams={searchParams} />
        </Suspense>
      </Card>
    </PageShell>
  );
}

async function JoinContent({ searchParams }: { searchParams: PageProps<"/onboarding/join">["searchParams"] }) {
  const params = await searchParams;
  const code = typeof params.code === "string" ? params.code.trim().toUpperCase() : undefined;
  const token = typeof params.token === "string" ? params.token : undefined;
  const query = token ? `token=${encodeURIComponent(token)}` : `code=${encodeURIComponent(code ?? "")}`;
  await requireNoMembership(`/onboarding/join?${query}`);

  const supabase = await createClient();

  if (token) {
    const { data, error } = await supabase.rpc("get_invitation_detail", { p_token: token });
    if (error || !data) return <Invalid message={messageForDbError(error ?? { message: "INVALID_INVITATION" })} />;
    const detail = data as {
      company_name: string;
      name: string | null;
      phone: string | null;
      department_id: string | null;
      position: string | null;
      departments: { id: string; name: string }[];
    };
    return (
      <JoinForm
        companyName={detail.company_name}
        departments={detail.departments}
        token={token}
        prefill={{ name: detail.name, phone: detail.phone, departmentId: detail.department_id, position: detail.position }}
      />
    );
  }

  if (!code) return <Invalid message={messageForDbError({ message: "INVALID_INVITE_CODE" })} />;
  const [{ data: companyName }, { data: departments, error }] = await Promise.all([
    supabase.rpc("get_invite_company", { p_code: code }),
    supabase.rpc("get_invite_departments", { p_code: code }),
  ]);
  if (!companyName || error) return <Invalid message={messageForDbError(error ?? { message: "INVALID_INVITE_CODE" })} />;
  return <JoinForm companyName={companyName} departments={departments ?? []} code={code} />;
}

function Invalid({ message }: { message: string }) {
  return (
    <div className="flex flex-col gap-4">
      <p role="alert" className="text-zinc-700">
        {message}
      </p>
      <Link href="/onboarding" className={buttonSecondary}>
        처음으로
      </Link>
    </div>
  );
}
