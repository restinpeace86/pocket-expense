import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ChatRetention, type RetentionStatus } from "@/components/admin/chat-retention";
import { SectionHeading } from "@/components/ui/help";
import { requireWorkspace } from "@/lib/auth/guards";
import { chatEnabled } from "@/lib/chat/server";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "채팅 · PocketExpense" };

// 채팅 설정(D-212, spec/features/messenger.md §10): 사진·파일 저장 사용량 + 보관 기간(30·60·90일). 메신저가 켜진 회사만
export default function ChatSettingsPage({ params }: PageProps<"/workspace/[id]/admin/chat-settings">) {
  return (
    <>
      <SectionHeading
        as="h1"
        title="채팅"
        summary="사내 채팅 사진·파일 저장 공간과 보관 기간을 정해요."
        helpId="admin.chat-settings"
        help={
          <>
            <p>
              <b>저장 공간</b>은 회사 전체가 함께 써요. 보관 기간이 지난 사진·파일은 매일 새벽 자동으로 지워지고(글·말풍선은 남음), 지워진 만큼 다시 보낼 수 있어요.
            </p>
            <p>
              <b>보관 기간을 짧게</b> 하면 오래된 파일이 먼저 지워져 같은 저장 공간으로 더 많이 주고받을 수 있어요. 오래 남겨야 하는 자료(계약서·증빙 원본)는 채팅에만
              두지 말고 결의서 등에 따로 보관해 주세요.
            </p>
            <p>채팅 색감은 사람마다 채팅 목록 위 팔레트 버튼이나 [내 정보]에서 고를 수 있어요.</p>
          </>
        }
      />
      <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-zinc-100" />}>
        <Content params={params} />
      </Suspense>
    </>
  );
}

async function Content({ params }: { params: PageProps<"/workspace/[id]/admin/chat-settings">["params"] }) {
  const { id } = await params;
  await requireWorkspace(id, { admin: true });
  if (!(await chatEnabled())) notFound();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("chat_retention_status");
  if (error || !data) throw new Error("채팅 저장 공간을 불러오지 못했어요.");
  return <ChatRetention status={data as unknown as RetentionStatus} />;
}
