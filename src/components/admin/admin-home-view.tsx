import { ChevronRight, UserPlus } from "lucide-react";
import Link from "next/link";
import { InviteLinkCard } from "./invite-link-card";

// 관리자 홈 (spec/screens/admin-dashboard.md ①의 첫 단계: 초대 카드 + 할 일 + 무료 크레딧)
export function AdminHomeView({
  adminName,
  companyName,
  inviteCode,
  pendingCount,
  creditsLeft,
  creditsGranted,
  basePath,
  preview = false,
}: {
  adminName: string;
  companyName: string;
  inviteCode: string;
  pendingCount: number;
  creditsLeft: number;
  creditsGranted: number;
  basePath: string;
  preview?: boolean;
}) {
  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight">{adminName}님, 안녕하세요</h1>

      {pendingCount > 0 && (
        <Link
          href={`${basePath}/members?tab=pending`}
          className="flex min-h-14 items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 text-amber-900 hover:bg-amber-100"
        >
          <UserPlus className="size-5 shrink-0" />
          <span className="flex-1 font-medium">가입 승인을 기다리는 직원 {pendingCount}명</span>
          <ChevronRight className="size-5 shrink-0" />
        </Link>
      )}

      <InviteLinkCard inviteCode={inviteCode} companyName={companyName} preview={preview} />

      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="font-semibold">무료 영수증</h2>
        <p className="mt-1 text-sm text-zinc-600">
          {creditsLeft.toLocaleString("ko-KR")}장 남음 (총 {creditsGranted.toLocaleString("ko-KR")}장 · 이벤트 기간 동안 다 쓰면 100장 추가)
        </p>
      </section>
      <p className="text-sm text-zinc-500">지출 승인·정산·세무 마감 화면은 준비 중입니다.</p>
    </>
  );
}
