import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AlreadyMemberNotice } from "@/components/auth/already-member-notice";
import { OAuthButtons } from "@/components/auth/oauth-buttons";
import { Card, PageShell } from "@/components/ui/page-shell";
import { destinationAfterLogin } from "@/lib/auth/paths";
import { getCurrentUserId, getMembership } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "회사 초대 · PocketExpense" };

// 개별 초대 링크 진입 (D-042)
export default function PersonalInvitePage({ params }: PageProps<"/join/i/[token]">) {
  return (
    <PageShell>
      <Suspense fallback={<div className="mt-10 h-64 animate-pulse rounded-xl bg-zinc-100" />}>
        <PersonalInviteContent params={params} />
      </Suspense>
    </PageShell>
  );
}

async function PersonalInviteContent({ params }: { params: PageProps<"/join/i/[token]">["params"] }) {
  const { token } = await params;
  const next = `/onboarding/join?token=${encodeURIComponent(token)}`;

  const supabase = await createClient();
  if (await getCurrentUserId()) {
    const membership = await getMembership();
    // 이미 소속이 있는데 다른 회사의 아직 쓰지 않은 초대를 열면 말없이 내 회사로 보내지 않고 안내(같은 회사 초대는 그대로 이동)
    if (membership) {
      const { data } = await supabase.rpc("get_invitation_public", { p_token: token });
      const pending = data as { company_name: string } | null;
      if (pending && pending.company_name !== membership.company_name) return <AlreadyMemberNotice membership={membership} invitedCompany={pending.company_name} />;
    }
    redirect(destinationAfterLogin(membership, next));
  }

  const { data } = await supabase.rpc("get_invitation_public", { p_token: token });
  const invitation = data as { company_name: string; name: string } | null;
  if (!invitation) {
    return (
      <Card>
        <p role="alert" className="text-zinc-700">
          초대 링크가 만료되었거나 이미 사용되었습니다. 관리자에게 다시 요청하세요.
        </p>
      </Card>
    );
  }

  return (
    <>
      <div className="pt-8 text-center">
        <p className="text-sm text-zinc-500">{invitation.name}님, 초대가 도착했어요</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">{invitation.company_name}</h1>
        <p className="mt-2 text-zinc-600">로그인 후 정보를 확인하면 바로 시작할 수 있어요.</p>
      </div>
      <Card>
        <OAuthButtons next={next} />
      </Card>
    </>
  );
}
