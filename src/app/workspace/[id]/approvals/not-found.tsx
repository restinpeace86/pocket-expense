import { NotFoundState } from "@/components/ui/error-state";

// 워크스페이스 안의 없는 결의서·멤버 등(7-15): 메뉴는 그대로 두고 본문만 안내
export default function NotFound() {
  return <NotFoundState area="employee" />;
}
