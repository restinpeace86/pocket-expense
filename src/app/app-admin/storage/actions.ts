"use server";

import { refresh } from "next/cache";
import { getAppAdmin } from "@/lib/app-admin/guard";
import { postNoticeCards } from "@/lib/notify/card";

// 저장 공간 신청 처리(8-103, D-262): 결제가 붙을 때까지 운영자가 켜 줌(무료). 처리하면 신청한 관리자 [알림]방으로
type R = { error: string | null };
type Done = { company_id: string; member_id: string | null; storage_gb: number; kind: "add" | "change" | "cancel" };

async function tell(admin: NonNullable<Awaited<ReturnType<typeof getAppAdmin>>>["admin"], d: Done, title: string, lines: string[]) {
  if (!d.member_id) return;
  await postNoticeCards(admin, d.company_id, [d.member_id], { title, lines, url: `/workspace/${d.company_id}/admin/billing#storage` }).catch(() => 0);
}

export async function grantStorageAction(requestId: string): Promise<R> {
  const ok = await getAppAdmin();
  if (!ok) return { error: "운영자만 처리할 수 있어요." };
  const { data, error } = await ok.admin.rpc("storage_addon_grant", { p_request: requestId });
  if (error || !data) return { error: error?.message.includes("NOT_PENDING") ? "이미 처리된 신청이에요." : "처리하지 못했어요. 다시 시도해 주세요." };
  const d = data as unknown as Done;
  await tell(
    ok.admin,
    d,
    d.kind === "cancel" ? "추가 저장 공간을 해지했어요" : `저장 공간 ${d.storage_gb}GB를 켰어요`,
    d.kind === "cancel" ? ["기본 공간만 남았어요. 넘치는 파일은 지워지지 않고 새 업로드만 막혀요."] : ["채팅 사진·파일과 파일 보관함이 함께 써요.", "결제가 열릴 때까지는 무료예요. 열리면 요금제와 함께 매월 결제돼요(한 달 전에 알려 드려요)."],
  );
  refresh();
  return { error: null };
}

export async function rejectStorageAction(requestId: string, reason: string): Promise<R> {
  const ok = await getAppAdmin();
  if (!ok) return { error: "운영자만 처리할 수 있어요." };
  const text = String(reason ?? "").trim();
  if (!text || text.length > 200) return { error: "반려 사유를 적어 주세요(200자까지)." };
  const { data, error } = await ok.admin.rpc("storage_addon_reject", { p_request: requestId, p_reason: text });
  if (error || !data) return { error: error?.message.includes("NOT_PENDING") ? "이미 처리된 신청이에요." : "처리하지 못했어요. 다시 시도해 주세요." };
  await tell(ok.admin, data as unknown as Done, "저장 공간 신청이 반려됐어요", [`사유: ${text}`]);
  refresh();
  return { error: null };
}
