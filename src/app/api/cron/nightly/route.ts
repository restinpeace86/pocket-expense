import { connection, NextResponse, type NextRequest } from "next/server";
import { syncOilPrices } from "@/lib/fuel/sync";
import { purgeChatFiles, purgeMeetingExpired, purgeMeetingOrphans } from "@/lib/chat/purge";
import { purgeReceiptArchive } from "@/lib/receipts/purge";
import { createAdminClient } from "@/lib/supabase/admin";

// 매일 새벽 03:00(KST) 작업 하나로 모음(vercel.json): ① 운영 보관함 정리(D-080) ② 오피넷 전국 평균 유가 받기(D-117) ③ 채팅 첨부 정리(90일·삭제·버려진 파일, D-204) ④ 남은 회의 자료 파일(D-217)
// 하나가 실패해도 다른 하나는 한다. CRON_SECRET이 없거나 맞지 않으면 아무것도 하지 않는다.
export async function GET(request: NextRequest) {
  await connection();
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new NextResponse("Not Found", { status: 404 });
  }
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ ok: false }, { status: 500 });
  const fail = (e: unknown) => ({ ok: false, error: String(e) });
  const [purge, oil, chat, meeting, meetingExpired] = await Promise.all([purgeReceiptArchive(admin).catch(fail), syncOilPrices(admin).catch(fail), purgeChatFiles(admin).catch(fail), purgeMeetingOrphans(admin).catch(fail), purgeMeetingExpired(admin).catch(fail)]);
  return NextResponse.json({ ok: true, purge, oil, chat, meeting, meetingExpired });
}
