import { Suspense } from "react";
import { ChatRetention, type RetentionStatus } from "@/components/admin/chat-retention";
import { VaultUsageCard, type VaultUsage } from "@/components/admin/vault-usage";
import { SectionHeading } from "@/components/ui/help";
import { requireWorkspace } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { BRAND } from "@/lib/brand";

export const metadata = { title: `파일 보관 · ${BRAND.name}` };

// 사진·파일 보관(D-212 → D-218, spec/features/messenger.md §10): 회사 저장 공간 사용량 + 보관 기간(30·60·90일) — 채팅 사진·파일과 회의 자료 모두
export default function ChatSettingsPage({ params }: PageProps<"/workspace/[id]/admin/chat-settings">) {
  return (
    <>
      <SectionHeading
        as="h1"
        title="파일 보관"
        summary="채팅 사진·파일과 회의 자료의 저장 공간·보관 기간을 정해요."
        helpId="admin.chat-settings"
        help={
          <>
            <p>
              <b>저장 공간</b>은 회사 전체가 함께 써요(채팅 사진·파일 + 회의 자료). 보관 기간이 지난 파일은 매일 새벽 자동으로 지워지고(채팅 글·회의 안건과 자료 이름은 남음), 지워진 만큼 다시 올릴 수 있어요.
            </p>
            <p>
              <b>기준일</b>: 채팅은 보낸 날, 회의 자료는 회의가 끝난 날(미리 올린 자료가 회의 전에 지워지지 않게)부터 세요. 영수증·증빙(결의서 첨부)은 세무 보관 대상이라 지우지 않아요.
            </p>
            <p>
              <b>보관 기간을 짧게</b> 하면 오래된 파일이 먼저 지워져 같은 저장 공간으로 더 많이 주고받을 수 있어요. 오래 남겨야 하는 자료(계약서 등)는 채팅에서 길게 누르거나 오른쪽 클릭 → <b>[영구 보관]</b>하면 [파일 보관함]에 지울 때까지 남아요(영구 보관함은 공간이 따로예요). 증빙 원본은 결의서에 첨부해 주세요.
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
  const supabase = await createClient();
  const [{ data, error }, vault] = await Promise.all([supabase.rpc("chat_retention_status"), supabase.rpc("vault_member_usage")]);
  if (error || !data) throw new Error("채팅 저장 공간을 불러오지 못했어요.");
  return (
    <div className="flex flex-col gap-4">
      <ChatRetention status={data as unknown as RetentionStatus} />
      {vault.data && <VaultUsageCard usage={vault.data as unknown as VaultUsage} />}
    </div>
  );
}
