import { Suspense } from "react";
import { AnnouncementForm, AnnouncementList } from "@/components/push/announcement-form";
import { SectionHeading } from "@/components/ui/help";
import { requireWorkspace } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { postCompanyAnnouncementAction } from "./actions";

export const metadata = { title: "사내 공지 · PocketExpense" };

// 사내 공지 (D-116 채널 B)
export default function AnnouncementsPage({ params }: PageProps<"/workspace/[id]/admin/announcements">) {
  return (
    <>
      <SectionHeading as="h1" title="사내 공지" summary="우리 회사 직원에게만 보내는 공지예요. 올리면 홈 화면에 보이고, 알림을 켠 직원에게는 바로 알림이 가요." />
      <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-zinc-100" />}>
        <Content params={params} />
      </Suspense>
    </>
  );
}

async function Content({ params }: { params: PageProps<"/workspace/[id]/admin/announcements">["params"] }) {
  const { id } = await params;
  const membership = await requireWorkspace(id, { admin: true });
  const supabase = await createClient();
  const { data } = await supabase.from("announcements").select("id, title, body, created_at, pushed_count").eq("scope", "company").eq("company_id", membership.company_id).order("created_at", { ascending: false }).limit(30);
  return (
    <div className="flex flex-col gap-4">
      <AnnouncementForm action={postCompanyAnnouncementAction} placeholderTitle="예: 11월부터 식대 1인 12,000원" audience="우리 회사 직원" />
      <AnnouncementList rows={data ?? []} />
    </div>
  );
}
