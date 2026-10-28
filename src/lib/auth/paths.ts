// 로그인 후 이동 경로 계산 (spec/common/routes.md §1). 순수 함수라 단위 테스트한다.

export type MemberRole = "super_admin" | "admin" | "employee";
export type MemberStatus = "pending" | "approved" | "inactive";

export type Membership = {
  member_id: string;
  company_id: string;
  company_name: string;
  name: string;
  role: MemberRole;
  status: MemberStatus;
  ui_theme?: string | null; // 화면 색상 (D-066)
};

// 외부 사이트로 튕기는 오픈 리다이렉트를 막는다: 같은 사이트의 절대 경로만 허용
export function safeNextPath(next: string | null | undefined): string | null {
  if (!next) return null;
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return null;
  if (next.startsWith("/auth/")) return null;
  return next;
}

export function isAdminRole(role: MemberRole): boolean {
  return role === "super_admin" || role === "admin";
}

export function workspaceHome(m: Pick<Membership, "company_id" | "role">): string {
  return isAdminRole(m.role) ? `/workspace/${m.company_id}/admin` : `/workspace/${m.company_id}/employee`;
}

const isArea = (next: string, area: string) => next === area || next.startsWith(`${area}/`) || next.startsWith(`${area}?`);

// 소속 상태에 따라 갈 곳을 정한다. next는 그 상태에서 허용되는 경로일 때만 따른다.
// taxAgent: 담당 세무사로 연결된 회사가 있는 계정(D-148, 회사 멤버 소속과는 별개)
export function destinationAfterLogin(membership: Membership | null, nextRaw: string | null | undefined, opts: { taxAgent?: boolean } = {}): string {
  const next = safeNextPath(nextRaw);
  // 운영자 화면(D-080)·세무사 화면(D-148): 로그인 뒤 그대로 돌려보낸다. 볼 수 있는지는 그 화면(서버·DB)이 확인한다
  if (next && (isArea(next, "/app-admin") || isArea(next, "/tax-office"))) return next;

  if (!membership) {
    // 아직 회사가 없으면 가입·회사 생성 경로만 허용
    if (next && (next.startsWith("/onboarding") || next.startsWith("/join/"))) return next;
    // 회사 멤버가 아닌 세무사는 세무사 화면으로
    if (opts.taxAgent) return "/tax-office";
    return "/onboarding";
  }
  if (membership.status === "pending" || membership.status === "inactive") {
    return "/onboarding/pending";
  }
  // 승인된 멤버: 자기 회사 워크스페이스 안의 경로만 따른다 (다른 회사 경로로 보내지 않음)
  if (next && next.startsWith(`/workspace/${membership.company_id}/`)) {
    if (next.startsWith(`/workspace/${membership.company_id}/admin`) && !isAdminRole(membership.role)) {
      return workspaceHome(membership);
    }
    return next;
  }
  return workspaceHome(membership);
}
