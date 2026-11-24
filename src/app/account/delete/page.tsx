import Link from "next/link";
import { Suspense } from "react";
import { DeleteAccountForm } from "@/components/account/delete-account-form";
import { OPERATOR } from "@/components/legal/documents";
import { buttonSecondary, Card, PageShell } from "@/components/ui/page-shell";
import { requireLogin } from "@/lib/auth/guards";
import { getMembership } from "@/lib/auth/session";
import { BRAND } from "@/lib/brand";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: `계정 삭제 · ${BRAND.name}` };

// 계정 삭제(D-314, spec/features/account-deletion.md) — 앱 스토어가 요구하는 "앱 안·웹에서 계정 삭제" 주소이기도 하다.
// 로그인 안 했으면 로그인 뒤 이 화면으로 돌아온다
export default function AccountDeletePage({ searchParams }: PageProps<"/account/delete">) {
  return (
    <PageShell>
      <h1 className="pt-6 text-2xl font-bold tracking-tight">계정 삭제</h1>
      <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-zinc-100" />}>
        <Content searchParams={searchParams} />
      </Suspense>
    </PageShell>
  );
}

type Check = { company: string | null; role: string | null; office: string | null; blocked: string | null };

async function Content({ searchParams }: { searchParams: PageProps<"/account/delete">["searchParams"] }) {
  const { done } = await searchParams;
  if (done === "1") {
    return (
      <Card>
        <p className="break-keep text-base font-semibold" data-account-deleted>
          계정을 삭제했어요.
        </p>
        <p className="mt-2 break-keep text-sm text-zinc-600">그동안 {BRAND.name}을 써 주셔서 고마워요. 다시 쓰려면 새로 가입하면 돼요.</p>
        <Link href="/" className={`${buttonSecondary} mt-4`}>
          처음 화면으로
        </Link>
      </Card>
    );
  }
  await requireLogin("/account/delete");
  const supabase = await createClient();
  const [{ data }, membership] = await Promise.all([supabase.rpc("account_deletion_check"), getMembership()]);
  const c = (data ?? { company: null, role: null, office: null, blocked: null }) as Check;
  const back = membership?.status === "approved" ? `/workspace/${membership.company_id}/employee/profile` : c.office ? "/tax-office" : "/onboarding";
  return (
    <>
      <Card>
        <h2 className="text-lg font-semibold">지워지는 것</h2>
        <ul className="mt-2 list-disc space-y-1 break-keep pl-5 text-sm text-zinc-700">
          <li>로그인 계정(이메일·카카오·구글 로그인 연결)</li>
          <li>휴대폰 번호·이메일·차량번호·정산 계좌</li>
          <li>앱·웹 알림 연결</li>
          {c.company && <li>파일 보관함의 &lsquo;나만 보기&rsquo; 파일(30일 뒤)</li>}
        </ul>
      </Card>
      {(c.company || c.office) && (
        <Card>
          <h2 className="text-lg font-semibold">남는 것</h2>
          {c.company && (
            <p className="mt-2 break-keep text-sm text-zinc-700" data-account-keeps>
              <b>{c.company}</b>에 낸 지출결의서·영수증·출퇴근·휴가·결재·채팅 기록은 회사 자료라 남아요. 회사는 법에 따라 세무 자료 5년, 근태 자료 3년을 보관해야 해요. 기록에는 이름만 남아요.
            </p>
          )}
          {c.office && <p className="mt-2 break-keep text-sm text-zinc-700">{c.office}에서 빠지고, 맡던 고객사 배정이 풀려요.</p>}
        </Card>
      )}
      <Card>
        {c.blocked ? <Blocked code={c.blocked} companyId={membership?.company_id ?? null} /> : <DeleteAccountForm />}
      </Card>
      <Link href={back} className="text-center text-sm text-zinc-500 underline underline-offset-2">
        삭제하지 않고 돌아가기
      </Link>
    </>
  );
}

// 바로 지울 수 없을 때: 막지 않고 무엇을 하면 되는지 알려 준다
function Blocked({ code, companyId }: { code: string; companyId: string | null }) {
  const members = companyId ? `/workspace/${companyId}/admin/members` : null;
  const text: Record<string, { title: string; body: string; href?: string | null; link?: string }> = {
    SUPER_ADMIN_MUST_TRANSFER: {
      title: "먼저 최고 관리자를 넘겨 주세요",
      body: "회사에 주인이 없어지지 않도록, 최고 관리자는 다른 멤버에게 [최고 관리자 넘기기]를 한 뒤에 계정을 지울 수 있어요.",
      href: members,
      link: "멤버 관리로 가기",
    },
    SOLE_ADMIN_CLOSE_COMPANY: {
      title: "회사에 다른 멤버가 없어요",
      body: `회사 전체를 그만 쓰려면 운영자에게 회사 해지를 요청해 주세요(${OPERATOR.email}). 해지하면 회사 자료는 30일 뒤 지워지고, 그 전에 내려받을 수 있어요. 해지와 함께 계정도 지워 드려요.`,
      href: `mailto:${OPERATOR.email}?subject=${encodeURIComponent("회사 해지·계정 삭제 요청")}`,
      link: "운영자에게 메일 보내기",
    },
    SELF_IN_APPROVAL_LINE: {
      title: "결재라인에 들어 있어요",
      body: "회사 결재가 멈추지 않도록, 관리자에게 결재라인에서 빼 달라고 요청한 뒤 다시 눌러 주세요.",
    },
    SELF_HAS_PENDING_REVIEW: {
      title: "검토할 결의서가 남아 있어요",
      body: "내 차례인 결의서를 먼저 처리한 뒤 다시 눌러 주세요.",
    },
    ADMIN_MUST_TRANSFER: {
      title: "먼저 사무소 관리자를 넘겨 주세요",
      body: "세무사무소 관리자는 [사무소 관리자 바꾸기]로 다른 세무사에게 맡기거나 [세무사무소 삭제]를 한 뒤에 계정을 지울 수 있어요.",
      href: "/tax-office/manage",
      link: "사무소 관리로 가기",
    },
  };
  const t = text[code] ?? { title: "지금은 계정을 지울 수 없어요", body: "잠시 후 다시 시도해 주세요." };
  return (
    <div data-account-blocked={code}>
      <h2 className="text-lg font-semibold">{t.title}</h2>
      <p className="mt-2 break-keep text-sm text-zinc-700">{t.body}</p>
      {t.href && t.link && (
        <Link href={t.href} className={`${buttonSecondary} mt-4`}>
          {t.link}
        </Link>
      )}
    </div>
  );
}
