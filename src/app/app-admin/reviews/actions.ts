"use server";

import { refresh, updateTag } from "next/cache";
import { getAppAdmin } from "@/lib/app-admin/guard";

// 랜딩 후기 숨김·다시 보이기 (D-130): 앱 운영자만. 부적절한 후기를 랜딩에서 내린다(설문·크레딧 기록은 그대로)
export async function setReviewDisplayedAction(id: string, displayed: boolean): Promise<{ error: string | null }> {
  const ok = await getAppAdmin();
  if (!ok) return { error: "운영자만 바꿀 수 있어요." };
  const { error } = await ok.admin.from("feedback_surveys").update({ is_displayed: displayed }).eq("id", id);
  if (error) return { error: "바꾸지 못했어요. 다시 시도해 주세요." };
  updateTag("testimonials");
  refresh();
  return { error: null };
}
