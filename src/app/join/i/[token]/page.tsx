import { redirect } from "next/navigation";
import { Suspense } from "react";
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

  if (await getCurrentUserId()) {
    redirect(destinationAfterLogin(await getMembership(), next));
  }

  const supabase = await createClient();
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
