import Link from "next/link";
import { Suspense } from "react";
import { ScanResult } from "@/components/attendance/scan-result";
import { requireLogin } from "@/lib/auth/guards";
import { getMembership } from "@/lib/auth/session";

export const metadata = { title: "QR 출퇴근 · Moa-on", robots: { index: false } };

// QR 출퇴근 결과(spec/features/attendance.md §3, D-236): 휴대폰 기본 카메라·앱 [QR 출퇴근] 모두 이 주소로 온다
export default function ScanPage({ searchParams }: PageProps<"/attend/scan">) {
  return (
    <Suspense fallback={<div className="mx-auto mt-40 size-24 animate-pulse rounded-full bg-zinc-100" />}>
      <Scan searchParams={searchParams} />
    </Suspense>
  );
}

async function Scan({ searchParams }: Pick<PageProps<"/attend/scan">, "searchParams">) {
  const sp = await searchParams;
  const token = typeof sp.t === "string" ? sp.t : "";
  await requireLogin(`/attend/scan?t=${encodeURIComponent(token)}`);
  const membership = await getMembership();
  if (!membership || membership.status !== "approved") {
    return (
      <main className="mx-auto w-full flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="text-xl font-bold">회사 가입 승인 후에 쓸 수 있어요</h1>
        <Link href="/" className="inline-flex min-h-11 items-center rounded-xl bg-brand-600 px-5 font-semibold text-white">
          처음으로
        </Link>
      </main>
    );
  }
  return <ScanResult token={token} home={`/workspace/${membership.company_id}/employee`} camera={`/workspace/${membership.company_id}/employee/attend`} />;
}
