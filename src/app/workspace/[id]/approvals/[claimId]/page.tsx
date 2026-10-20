import { redirect } from "next/navigation";
import { Suspense } from "react";
import { requireWorkspace } from "@/lib/auth/guards";
import { isAdminRole } from "@/lib/auth/paths";
import { getClaimDetail } from "@/lib/claims/detail";

export const metadata = { title: "결재 · PocketExpense" };

// 알림톡 [결재하러 가기] 도착지 (notification-rule.md 트리거 A, kakao-alimtalk.md §4).
// 링크에 토큰이 없으므로 로그인은 proxy가 확인하고(로그인 뒤 이 주소로 돌아옴), 여기서는 권한에 맞는 화면으로 보낸다.
export default function ApprovalLandingPage({ params }: PageProps<"/workspace/[id]/approvals/[claimId]">) {
  return (
    <Suspense fallback={<div className="m-4 h-64 animate-pulse rounded-xl bg-zinc-100" />}>
      <Landing params={params} />
    </Suspense>
  );
}

async function Landing({ params }: Pick<PageProps<"/workspace/[id]/approvals/[claimId]">, "params">) {
  const { id, claimId } = await params;
  const membership = await requireWorkspace(id);
  if (isAdminRole(membership.role)) redirect(`/workspace/${id}/admin/claims/${claimId}`);
  const detail = await getClaimDetail(membership.company_id, claimId);
  if (detail && detail.claim.member_id === membership.member_id) redirect(`/workspace/${id}/employee/claims/${claimId}`);
  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-3 px-4 py-16 text-center">
      <h1 className="text-xl font-bold">{detail ? "사전 검토 화면은 준비 중이에요" : "접근 권한이 없습니다"}</h1>
      <p className="text-sm text-zinc-600">{detail ? "결재라인 설정(사전 검토)이 열리면 이 화면에서 바로 검토할 수 있어요." : "이 지출소명서를 볼 수 있는 계정으로 로그인했는지 확인해 주세요."}</p>
    </main>
  );
}
