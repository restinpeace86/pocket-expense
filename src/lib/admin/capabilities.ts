import type { MemberRole, MemberStatus } from "@/lib/auth/paths";

export type MemberCapabilities = {
  canEdit: boolean; // 관리자: 일반 멤버·본인 / 최고 관리자: 모두
  canChangeRole: boolean; // 최고 관리자만, 대상이 최고 관리자가 아닌 활성 멤버
  canTransfer: boolean; // 최고 관리자만, 본인 외 활성 멤버
  canDeactivate: boolean; // 관리자: 일반 멤버 / 최고 관리자: 관리자까지. 최고 관리자·본인 제외
  canReactivate: boolean; // 비활성 멤버만. 권한 기준은 비활성화와 같다 (D-062)
};

// 멤버 상세 화면의 버튼 노출 기준 (spec/features/roles-and-permissions.md §3·§5).
// 화면 표시용일 뿐이며, 실제 권한 검사는 DB 함수(migration 013)가 다시 한다.
export function capabilitiesFor(
  viewer: { member_id: string; role: MemberRole },
  target: { id: string; role: MemberRole; status: MemberStatus },
): MemberCapabilities {
  const isSuper = viewer.role === "super_admin";
  const isSelf = viewer.member_id === target.id;
  const active = target.status === "approved";
  return {
    canEdit: isSuper || isSelf || target.role === "employee",
    canChangeRole: isSuper && target.role !== "super_admin" && active,
    canTransfer: isSuper && !isSelf && active,
    canDeactivate: active && !isSelf && target.role !== "super_admin" && (isSuper || target.role === "employee"),
    canReactivate: target.status === "inactive" && (isSuper || target.role === "employee"),
  };
}
