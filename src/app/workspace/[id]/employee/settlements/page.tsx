import { redirect } from "next/navigation";

// 알림톡 [나의 정산 타임라인 확인] 도착지 (notification-rule.md 트리거 D).
// 정산 타임라인 화면(T6-10, worker-timeline.md)을 만들기 전까지는 내 소명서의 "완료" 목록으로 보낸다.
export default async function SettlementsPage({ params }: PageProps<"/workspace/[id]/employee/settlements">) {
  const { id } = await params;
  redirect(`/workspace/${id}/employee?status=done`);
}
