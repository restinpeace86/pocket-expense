import { connection, NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// 운영 보관함 정리 (D-080): 직원이 지운 영수증 사진은 삭제 후 3개월이 지나면 지운다. 기록(텍스트)은 남긴다.
// Vercel Cron이 매일 부른다(vercel.json). CRON_SECRET이 없거나 맞지 않으면 아무것도 하지 않는다.
export async function GET(request: NextRequest) {
  await connection(); // 빌드 때 미리 만들어 두지 않고 요청마다 실행
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new NextResponse("Not Found", { status: 404 });
  }
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ ok: false }, { status: 500 });

  let purged = 0;
  for (let round = 0; round < 10; round++) {
    const { data: due, error } = await admin
      .from("receipt_usage_records")
      .select("id, archived_receipt_path, archived_thumb_path")
      .is("photo_purged_at", null)
      .lt("photo_purge_after", new Date().toISOString())
      .limit(200);
    if (error) return NextResponse.json({ ok: false, purged }, { status: 500 });
    if (!due?.length) break;
    const paths = due.flatMap((r) => [r.archived_receipt_path, r.archived_thumb_path]).filter((p): p is string => !!p);
    if (paths.length) {
      const { error: removeError } = await admin.storage.from("receipt-archive").remove(paths);
      if (removeError) return NextResponse.json({ ok: false, purged }, { status: 500 });
    }
    const { error: updateError } = await admin
      .from("receipt_usage_records")
      .update({ photo_purged_at: new Date().toISOString() })
      .in("id", due.map((r) => r.id));
    if (updateError) return NextResponse.json({ ok: false, purged }, { status: 500 });
    purged += due.length;
  }
  return NextResponse.json({ ok: true, purged });
}
