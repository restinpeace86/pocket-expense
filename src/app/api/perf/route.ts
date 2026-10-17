import { createClient } from "@/lib/supabase/server";

// 체감 성능 기록 받기 (D-075). 검증·로그인 확인·기록 수 제한은 DB 함수 record_perf_events가 한다.
export async function POST(request: Request) {
  try {
    const text = await request.text();
    if (text.length > 20000) return new Response(null, { status: 413 });
    const events = JSON.parse(text);
    if (!Array.isArray(events) || events.length === 0) return new Response(null, { status: 204 });
    const supabase = await createClient();
    await supabase.rpc("record_perf_events", { p_events: events.slice(0, 30) });
  } catch {
    // 측정 실패는 사용자에게 영향을 주지 않는다
  }
  return new Response(null, { status: 204 });
}
