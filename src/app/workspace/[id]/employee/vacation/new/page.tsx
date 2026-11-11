import { redirect } from "next/navigation";

// 예전 휴가 신청 주소(D-241) → D-257: [휴가 및 근태 신청] 위 창이 열린 화면으로
export default async function VacationNewPage({ params }: PageProps<"/workspace/[id]/employee/vacation/new">) {
  const { id } = await params;
  redirect(`/workspace/${id}/employee/vacation?new=1`);
}
