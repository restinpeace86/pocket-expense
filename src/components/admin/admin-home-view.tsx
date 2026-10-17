import { ChevronRight, SlidersHorizontal, UserPlus } from "lucide-react";
import Link from "next/link";
import { InviteLinkCard } from "./invite-link-card";

// 관리자 홈 (spec/screens/admin-dashboard.md ①). 지금 범위: 할 일(가입 승인 대기) + 직원 초대 카드 + 무료 영수증 잔량.
// 직원 초대 카드: 승인된 멤버가 본인뿐이면 맨 위에 크게(안내 포함), 직원이 들어온 뒤에는 아래로 내려 간단히(①-2).
// KPI·차트·체크리스트는 지출 승인·정산 기능(T7 이후)과 함께 채운다.
export function AdminHomeView({
  adminName,
  companyName,
  inviteCode,
  pendingCount,
  approvedCount,
  creditsLeft,
  creditsGranted,
  basePath,
  policyToConfirm = null,
  preview = false,
}: {
  adminName: string;
  companyName: string;
  inviteCode: string;
  pendingCount: number;
  approvedCount: number;
  creditsLeft: number;
  creditsGranted: number;
  basePath: string;
  policyToConfirm?: string[] | null; // 정산 정책을 아직 한 번도 저장하지 않았으면 현재(기본) 정책 요약 (D-068)
  preview?: boolean;
}) {
  const onlyMe = approvedCount <= 1;
  const credits = (
    <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
      <h2 className="font-semibold">무료 영수증</h2>
      <p className="mt-1 text-sm text-zinc-600">
        {creditsLeft.toLocaleString("ko-KR")}장 남음 (총 {creditsGranted.toLocaleString("ko-KR")}장 · 이벤트 기간 동안 다 쓰면 100장 추가)
      </p>
    </section>
  );

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

      {policyToConfirm && (
        <Link
          href={`${basePath}/settings`}
          className="flex items-start gap-3 rounded-xl border border-brand-200 bg-brand-50 p-4 text-brand-900 hover:bg-brand-100"
        >
          <SlidersHorizontal className="mt-0.5 size-5 shrink-0" />
          <span className="min-w-0 flex-1">
            <span className="block font-medium">정산 정책을 확인해 주세요</span>
            <span className="mt-0.5 block text-sm">
              지금은 기본값으로 운영돼요: {policyToConfirm.join(" · ")}. 우리 회사 규정과 다르면 바꾸고, 그대로 써도 되면 [저장]만 누르세요.
            </span>
          </span>
          <ChevronRight className="mt-0.5 size-5 shrink-0" />
        </Link>
      )}

      {onlyMe ? (
        <>
          <InviteLinkCard inviteCode={inviteCode} companyName={companyName} preview={preview} />
          {credits}
        </>
      ) : (
        <>
          {credits}
          <InviteLinkCard inviteCode={inviteCode} companyName={companyName} preview={preview} compact />
        </>
      )}
      <p className="text-sm text-zinc-500">지출 승인·정산·세무 마감 화면은 준비 중입니다. 준비되면 이 홈에 이번 달 지출과 처리할 일이 먼저 보여요.</p>
    </>
  );
}
