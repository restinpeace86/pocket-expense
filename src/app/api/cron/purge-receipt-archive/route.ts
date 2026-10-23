import { connection, NextResponse, type NextRequest } from "next/server";
import { purgeReceiptArchive } from "@/lib/receipts/purge";
import { createAdminClient } from "@/lib/supabase/admin";

// 운영 보관함 정리 (D-080). 매일 새벽 작업은 /api/cron/nightly로 옮겼고(D-117), 이 경로는 손으로 돌릴 때용으로 남긴다.
// CRON_SECRET이 없거나 맞지 않으면 아무것도 하지 않는다.
export async function GET(request: NextRequest) {
  await connection(); // 빌드 때 미리 만들어 두지 않고 요청마다 실행
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new NextResponse("Not Found", { status: 404 });
  }
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ ok: false }, { status: 500 });
  const r = await purgeReceiptArchive(admin);
  return NextResponse.json(r, { status: r.ok ? 200 : 500 });
}
