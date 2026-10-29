import { Suspense } from "react";
import { OfficeIntro } from "@/components/tax-office/office-intro";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "세무사무소 초대 · PocketExpense", robots: { index: false, follow: false } };

// 고객사가 보낸 연결 링크 (D-173): 로그인 전에도 고객사·사무소 이름만 보여 주고, 시작하면 /tax-connect/코드로
export default function TaxOfficeInvitePage({ params }: PageProps<"/for-tax-office/[code]">) {
  return (
    <Suspense fallback={<div className="m-6 h-96 animate-pulse rounded-xl bg-zinc-100" />}>
      <Invite params={params} />
    </Suspense>
  );
}

async function Invite({ params }: Pick<PageProps<"/for-tax-office/[code]">, "params">) {
  const { code } = await params;
  const clean = code.toUpperCase().replace(/[^A-Z2-9]/g, "").slice(0, 10);
  const supabase = await createClient();
  const { data } = await supabase.rpc("tax_office_connect_info", { p_code: clean });
  const info = data as { company_name: string; office_name: string; agent_name: string | null; connected: boolean } | null;
  if (!info) return <OfficeIntro startHref="/login?next=%2Ftax-office" invalid />;
  return <OfficeIntro companyName={info.company_name} officeName={info.office_name} agentName={info.agent_name} startHref={`/tax-connect/${clean}`} />;
}
