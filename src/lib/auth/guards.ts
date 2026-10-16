import "server-only";
import { redirect } from "next/navigation";
import { destinationAfterLogin, isAdminRole, workspaceHome, type Membership } from "./paths";
import { getCurrentUserId, getMembership } from "./session";

// 화면 접근 가드. redirect()는 예외를 던지므로 반환값이 있으면 통과한 것이다.

export async function requireLogin(returnTo: string): Promise<string> {
  const userId = await getCurrentUserId();
  if (!userId) redirect(`/login?next=${encodeURIComponent(returnTo)}`);
  return userId;
}

// 가입·회사 생성 화면: 로그인했고 아직 어느 회사에도 속하지 않은 사람만
export async function requireNoMembership(returnTo: string): Promise<void> {
  await requireLogin(returnTo);
  const membership = await getMembership();
  if (membership) redirect(destinationAfterLogin(membership, null));
}

// 승인 대기 화면: 소속은 있지만 아직 승인되지 않았거나 비활성
export async function requireUnapprovedMembership(): Promise<Membership> {
  await requireLogin("/onboarding/pending");
  const membership = await getMembership();
  if (!membership) redirect("/onboarding");
  if (membership.status === "approved") redirect(workspaceHome(membership));
  return membership;
}

// 워크스페이스: 승인된 멤버 + URL의 회사가 본인 회사일 때만. 다른 회사 id면 본인 회사로 돌려보낸다.
export async function requireWorkspace(companyId: string, options: { admin?: boolean } = {}): Promise<Membership> {
  const returnTo = `/workspace/${companyId}/${options.admin ? "admin" : "employee"}`;
  await requireLogin(returnTo);
  const membership = await getMembership();
  if (!membership) redirect("/onboarding");
  if (membership.status !== "approved") redirect("/onboarding/pending");
  if (membership.company_id !== companyId) redirect(workspaceHome(membership));
  if (options.admin && !isAdminRole(membership.role)) redirect(workspaceHome(membership));
  return membership;
}
