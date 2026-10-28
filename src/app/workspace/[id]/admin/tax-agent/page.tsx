import { Suspense } from "react";
import { TaxAgentForm } from "@/components/admin/tax-agent-form";
import { SectionHeading } from "@/components/ui/help";
import { requireWorkspace } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "담당 세무사 · PocketExpense" };

// 담당 세무사 (D-148): 세무사무소·담당자 이메일을 넣으면 그 이메일로 로그인한 세무사가 승인된 지출 자료를 본다(회사 멤버 아님)
export default function TaxAgentPage({ params }: PageProps<"/workspace/[id]/admin/tax-agent">) {
  return (
    <>
      <SectionHeading
        as="h1"
        title="담당 세무사"
        summary="세무사무소 담당자 이메일을 넣으면, 그 이메일로 로그인한 세무사가 승인된 지출과 세무 엑셀을 직접 볼 수 있어요."
        helpId="admin.tax-agent"
        help={
          <>
            <p>
              <b>세무사는 직원이 아니에요.</b> 멤버 목록에 들어가지 않고, 결의서 작성·결재·마감은 할 수 없어요. 볼 수 있는 건 승인·지급된 지출(세무 마감과 같은
              내용), 영수증, 세무용 엑셀이에요. 계정과목·계정코드와 분류 연결은 세무사도 고칠 수 있어요.
            </p>
            <p>
              <b>어떻게 연결되나요?</b> 저장하면 바로 연결돼요. 세무사가 그 이메일(구글·카카오 계정 이메일)로 PocketExpense에 로그인하면 담당 회사 목록에
              우리 회사가 보여요. 같은 세무사가 다른 고객사도 맡고 있으면 목록에 함께 쌓여요.
            </p>
            <p>
              <b>바꾸거나 끊으면?</b> 이메일을 바꾸거나 [연결 끊기]를 누르면 이전 이메일로는 바로 볼 수 없어요.
            </p>
          </>
        }
      />
      <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-zinc-100" />}>
        <Content params={params} />
      </Suspense>
    </>
  );
}

async function Content({ params }: { params: PageProps<"/workspace/[id]/admin/tax-agent">["params"] }) {
  const { id } = await params;
  const membership = await requireWorkspace(id, { admin: true });
  const supabase = await createClient();
  const { data } = await supabase.from("tax_agent_links").select("office_name, agent_name, agent_email, agent_phone, updated_at").maybeSingle();
  return <TaxAgentForm current={data ?? null} companyName={membership.company_name} />;
}
