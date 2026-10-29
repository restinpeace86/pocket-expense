import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { OAuthButtons } from "@/components/auth/oauth-buttons";
import { Card, PageShell } from "@/components/ui/page-shell";
import { destinationAfterLogin } from "@/lib/auth/paths";
import { isTaxOfficeUser } from "@/lib/tax-office/queries";
import { getCurrentUserId, getMembership } from "@/lib/auth/session";

export const metadata = { title: "로그인 · PocketExpense" };

const ERRORS: Record<string, string> = {
  missing_code: "로그인 정보가 없어요. 다시 시도해 주세요.",
  exchange_failed: "로그인을 완료하지 못했어요. 다시 시도해 주세요.",
};

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <PageShell>
      <div className="flex flex-col gap-2 pt-8 text-center">
        <h1 className="text-2xl font-bold tracking-tight">PocketExpense 시작하기</h1>
        <p className="text-zinc-600">영수증 한 장으로 경비 청구부터 결재까지</p>
      </div>
      <Card>
        <Suspense fallback={<div className="h-28 animate-pulse rounded-xl bg-zinc-100" />}>
          <LoginContent searchParams={searchParams} />
        </Suspense>
      </Card>
      <p className="text-center text-xs text-zinc-500">휴대폰 인증 없이 카카오 또는 Google 계정으로 로그인합니다.</p>
      <nav className="flex justify-center gap-4 text-xs text-zinc-500">
        <Link href="/terms" className="inline-flex min-h-11 items-center underline underline-offset-2">이용약관</Link>
        <Link href="/privacy" className="inline-flex min-h-11 items-center font-semibold underline underline-offset-2">개인정보 처리방침</Link>
      </nav>
    </PageShell>
  );
}

async function LoginContent({ searchParams }: { searchParams: PageProps<"/login">["searchParams"] }) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : undefined;
  const errorKey = typeof params.error === "string" ? params.error : undefined;

  // 이미 로그인했다면 소속에 맞는 화면으로
  if (await getCurrentUserId()) {
    const membership = await getMembership();
    redirect(destinationAfterLogin(membership, next, { taxAgent: !membership && (await isTaxOfficeUser()) }));
  }

  return (
    <div className="flex flex-col gap-4">
      {errorKey && ERRORS[errorKey] && (
        <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
          {ERRORS[errorKey]}
        </p>
      )}
      {next?.startsWith("/tax-office") && (
        <p className="break-keep rounded-xl bg-brand-50 px-3 py-2 text-sm text-brand-900">
          <b>세무사무소 계정</b>으로 로그인해요. 고객사(회사) 계정과는 따로이고, 사무소 이용은 무료예요.
        </p>
      )}
      <OAuthButtons next={next} />
      {/* 세무사무소 입구(D-163): 세무사·회계사 사무소는 여기서 사무소 화면으로 */}
      <p className="text-center text-sm text-zinc-500">
        {next?.startsWith("/tax-office") ? (
          <Link href="/login" className="inline-flex min-h-11 items-center underline underline-offset-2">
            회사(경비 관리)로 시작하기
          </Link>
        ) : (
          <Link href="/login?next=%2Ftax-office" className="inline-flex min-h-11 items-center underline underline-offset-2">
            세무사무소이신가요? 세무사무소로 시작하기
          </Link>
        )}
      </p>
    </div>
  );
}
