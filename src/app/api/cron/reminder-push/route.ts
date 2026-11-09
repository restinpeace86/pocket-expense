import { connection, NextResponse, type NextRequest } from "next/server";
import { sendDueNoticePushes } from "@/lib/push/notice-push";
import { createAdminClient } from "@/lib/supabase/admin";

// 회의 10분 전 알림의 휴대폰 알림(D-206). Supabase pg_cron(10분마다)이 알림방에 글을 넣은 뒤 pg_net으로 이 주소를 부른다.
// 비밀값(REMINDER_PUSH_SECRET — Supabase Vault 'reminder_push_secret'과 같은 값)이 없거나 다르면 아무것도 하지 않는다.
// 근태 알림(D-238·D-239·D-241)은 ⏰, 버스(D-243)는 🚌 — src/lib/push/notice-push.ts
async function handle(request: NextRequest) {
  await connection();
  const secret = process.env.REMINDER_PUSH_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new NextResponse("Not Found", { status: 404 });
  }
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ ok: false }, { status: 500 });
  const r = await sendDueNoticePushes(admin);
  if (!r.ok) return NextResponse.json({ ok: false }, { status: 500 });
  return NextResponse.json(r);
}

export const POST = handle;
export const GET = handle;
