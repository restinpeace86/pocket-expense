import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AlreadyMemberNotice } from "@/components/auth/already-member-notice";
import { OAuthButtons } from "@/components/auth/oauth-buttons";
import { Card, PageShell } from "@/components/ui/page-shell";
import { destinationAfterLogin } from "@/lib/auth/paths";
import { getCurrentUserId, getMembership } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "회사 초대 · PocketExpense" };

// 공용 초대 링크/QR 진입 (spec/features/auth-onboarding.md §3.1)
export default function InviteLinkPage({ params }: PageProps<"/join/[inviteCode]">) {
  return (
    <PageShell>
      <Suspense fallback={<div className="mt-10 h-64 animate-pulse rounded-xl bg-zinc-100" />}>
        <InviteContent params={params} />
      </Suspense>
    </PageShell>
  );
}

async function InviteContent({ params }: { params: PageProps<"/join/[inviteCode]">["params"] }) {
  const { inviteCode } = await params;
  const code = inviteCode.trim().toUpperCase();
  const next = `/onboarding/join?code=${encodeURIComponent(code)}`;

  const supabase = await createClient();
  if (await getCurrentUserId()) {
    const membership = await getMembership();
    // 다른 회사 초대 링크면 말없이 내 회사로 보내지 않고 안내(같은 회사 링크·잘못된 코드는 그대로 이동)
    if (membership) {
      const [{ data: invited }, { data: own }] = await Promise.all([
        supabase.rpc("get_invite_company", { p_code: code }),
        supabase.from("companies").select("invite_code").eq("id", membership.company_id).maybeSingle(),
      ]);
      if (invited && own?.invite_code !== code) return <AlreadyMemberNotice membership={membership} invitedCompany={invited} />;
    }
    redirect(destinationAfterLogin(membership, next));
  }

  const { data: companyName } = await supabase.rpc("get_invite_company", { p_code: code });
  if (!companyName) {
    return (
      <Card>
        <p role="alert" className="text-zinc-700">
          초대 코드를 확인해 주세요. 관리자에게 초대 링크를 다시 요청하세요.
        </p>
      </Card>
    );
  }

  return (
    <>
      <div className="pt-8 text-center">
        <p className="text-sm text-zinc-500">경비 정산 초대</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">{companyName}</h1>
        <p className="mt-2 text-zinc-600">로그인하고 직원 정보를 입력하면 가입 신청이 완료됩니다.</p>
      </div>
      <Card>
        <OAuthButtons next={next} />
      </Card>
    </>
  );
}
