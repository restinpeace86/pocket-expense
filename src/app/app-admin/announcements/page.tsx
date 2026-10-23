import { Suspense } from "react";
import { AppAdminShell, Panel } from "@/components/app-admin/app-admin-shell";
import { AnnouncementForm, AnnouncementList } from "@/components/push/announcement-form";
import { requireAppAdmin } from "@/lib/app-admin/guard";
import { postPlatformAnnouncementAction } from "./actions";

export const metadata = { title: "전체 공지 · PocketExpense 운영자" };

// 전체 공지 (D-116 채널 A) — 모든 회사의 대표·직원에게
export default function PlatformAnnouncementsPage() {
  return (
    <AppAdminShell>
      <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-zinc-100" />}>
        <Content />
      </Suspense>
    </AppAdminShell>
  );
}

async function Content() {
  const { admin } = await requireAppAdmin();
  const { data } = await admin.from("announcements").select("id, title, body, created_at, pushed_count").eq("scope", "platform").order("created_at", { ascending: false }).limit(30);
  return (
    <>
      <h1 className="text-2xl font-bold">전체 공지</h1>
      <p className="-mt-4 text-sm text-zinc-600">서비스 업데이트·신기능·정기 점검 안내. 모든 회사의 대표·직원 홈 화면에 보이고, 알림을 켠 기기에는 바로 알림이 가요.</p>
      <AnnouncementForm action={postPlatformAnnouncementAction} placeholderTitle="예: 10/30(목) 02:00~03:00 정기 점검" audience="모든 회사의 모든 사용자" />
      <Panel title="보낸 전체 공지">
        <AnnouncementList rows={data ?? []} />
      </Panel>
    </>
  );
}
