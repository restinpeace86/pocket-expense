import { NotFoundState } from "@/components/ui/error-state";

export const metadata = { title: "찾는 화면이 없어요 · PocketExpense" };

// 없는 주소·볼 수 없는 화면(7-15). 워크스페이스 안은 각 영역의 not-found가 메뉴를 남긴 채 보여 준다
export default function NotFound() {
  return <NotFoundState />;
}
