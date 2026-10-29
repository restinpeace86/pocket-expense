import { Suspense } from "react";
import { CompanyTaxOfficeForm, type CompanyTaxOffice } from "@/components/admin/company-tax-office-form";
import { SectionHeading } from "@/components/ui/help";
import { requireWorkspace } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "세무사무소 · PocketExpense" };

// 우리 회사 세무사무소 (D-149): 계약한 세무사무소를 지정하면 그 사무소 워크스페이스의 고객사 목록에 우리 회사가 뜬다(사무소가 담당 세무사 배정)
export default function CompanyTaxOfficePage({ params }: PageProps<"/workspace/[id]/admin/tax-office">) {
  return (
    <>
      <SectionHeading
        as="h1"
        title="세무사무소"
        summary="계약한 세무사무소를 지정하면, 사무소가 승인된 지출과 세무용 엑셀을 직접 확인해요. 담당 세무사는 사무소가 배정해요."
        helpId="admin.tax-office"
        help={
          <>
            <p>
              <b>세무사무소는 직원이 아니에요.</b> 멤버 목록에 들어가지 않고, 결의서 작성·결재·마감은 할 수 없어요. 볼 수 있는 건 승인·지급된 지출(세무 마감과 같은
              내용), 영수증, 세무용 엑셀이에요. 계정과목·계정코드와 분류 연결은 세무사무소도 고칠 수 있어요.
            </p>
            <p>
              <b>어떻게 연결되나요?</b> 저장하면 우리 회사 전용 <b>연결 링크</b>가 생겨요. 담당 세무사 휴대폰 번호를 적어 두면 그 링크가 카카오 알림톡으로 가고(발송 서비스 연결 뒤),
              [안내 복사]로 직접 보낼 수도 있어요. 세무사무소가 그 링크로 들어와 로그인하면 어떤 계정이든 바로 연결돼요. 세무사무소 이메일과 같은 계정으로 로그인해도 연결돼요.
            </p>
            <p>
              <b>담당 세무사는?</b> 사무소가 소속 세무사 중에서 배정해요. 담당 세무사 이메일을 알고 있으면 적어 두세요 — 그 세무사가 사무소에 합류하면 자동으로
              배정돼요. 사무소 대표·관리자는 모든 고객사를, 소속 세무사는 맡은 고객사만 봐요.
            </p>
            <p>
              <b>계정과목은 누가 관리하나요?</b> 세무사무소가 가입해 연결되면 계정과목·계정코드·분류 연결은 세무사무소가 관리하고, 우리 회사는 보기만 해요. 세무사무소가 바꾼
              내용은 [계정과목] 화면의 변경 이력과 관리자 홈 알림으로 확인할 수 있어요.
            </p>
            <p>
              <b>바꾸거나 끊으면?</b> 다른 사무소로 바꾸거나 [연결 끊기]를 누르면 이전 사무소는 바로 볼 수 없어요.
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

async function Content({ params }: { params: PageProps<"/workspace/[id]/admin/tax-office">["params"] }) {
  const { id } = await params;
  const membership = await requireWorkspace(id, { admin: true });
  const supabase = await createClient();
  const [{ data }, { data: code }] = await Promise.all([supabase.rpc("my_company_tax_office"), supabase.rpc("my_company_tax_office_code")]);
  return <CompanyTaxOfficeForm current={(data ?? null) as CompanyTaxOffice | null} companyName={membership.company_name} connectCode={(code as string | null) ?? null} />;
}
