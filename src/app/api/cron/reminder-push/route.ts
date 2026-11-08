import { connection, NextResponse, type NextRequest } from "next/server";
import { pushToMembers } from "@/lib/push/server";
import { createAdminClient } from "@/lib/supabase/admin";

// 회의 10분 전 알림의 휴대폰 알림(D-206). Supabase pg_cron(10분마다)이 알림방에 글을 넣은 뒤 pg_net으로 이 주소를 부른다.
// 비밀값(REMINDER_PUSH_SECRET — Supabase Vault 'reminder_push_secret'과 같은 값)이 없거나 다르면 아무것도 하지 않는다.
type Due = { id: string; room_id: string; company_id: string; member_id: string; body: string | null; link: string | null };

async function handle(request: NextRequest) {
  await connection();
  const secret = process.env.REMINDER_PUSH_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new NextResponse("Not Found", { status: 404 });
  }
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ ok: false }, { status: 500 });
  const { data, error } = await admin.rpc("chat_notice_push_due");
  if (error) return NextResponse.json({ ok: false }, { status: 500 });
  const due = (data ?? []) as unknown as Due[];
  let sent = 0;
  for (const d of due) {
    const [first, ...rest] = (d.body ?? "").split("\n");
    const r = await pushToMembers(d.company_id, [d.member_id], {
      title: `${first.startsWith("퇴근") ? "⏰" : "📅"} ${first || "알림"}`, // 퇴근 누락 알림(D-238)은 ⏰
      body: rest.join(" · "),
      url: d.link ?? `/workspace/${d.company_id}/chat/${d.room_id}`,
      tag: `notice-${d.id}`,
      urgency: "high",
    }).catch(() => ({ sent: 0 }));
    sent += r.sent;
  }
  return NextResponse.json({ ok: true, messages: due.length, sent });
}

export const POST = handle;
export const GET = handle;
