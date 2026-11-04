import { cookies } from "next/headers";
import { isAdminRole, type Membership } from "./paths";

// 관리자 모드 / 직원 모드(D-049). 채팅·캘린더처럼 두 모드가 같은 주소를 쓰는 화면은
// 마지막으로 본 모드(쿠키, ViewModeMark가 남김)를 따라 틀(하단 메뉴·왼쪽 메뉴)을 고른다. 직원은 늘 직원 모드.
export const VIEW_MODE_COOKIE = "pe_view";

export async function viewMode(m: Pick<Membership, "company_id" | "role">): Promise<"admin" | "employee"> {
  if (!isAdminRole(m.role)) return "employee";
  const v = (await cookies()).get(VIEW_MODE_COOKIE)?.value;
  return v === `${m.company_id}:employee` ? "employee" : "admin";
}
