import { NextResponse, type NextRequest } from "next/server";
import { newTerminalKey, sha256 } from "@/lib/attendance/token";
import { clientIp } from "@/lib/attendance/server";
import { createAdminClient } from "@/lib/supabase/admin";

// 출근 단말 연결(spec/features/attendance.md §2-1, D-236): 관리자가 만든 6자리 코드(10분, 한 번만) → 이 기기 전용 단말 열쇠
// 열쇠는 이 응답으로 한 번만 기기에 가고, 서버에는 해시만 남는다
const NO_STORE = { "Cache-Control": "no-store" };

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { code?: unknown } | null;
  const code = typeof body?.code === "string" ? body.code.replace(/\D/g, "") : "";
  if (code.length !== 6) return NextResponse.json({ error: "6자리 숫자 코드를 입력해 주세요." }, { status: 400, headers: NO_STORE });
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "지금은 연결할 수 없어요. 잠시 뒤 다시 해 주세요." }, { status: 503, headers: NO_STORE });
  const key = newTerminalKey();
  const { data, error } = await admin.rpc("attendance_terminal_pair", { p_code_hash: sha256(code), p_key_hash: sha256(key), p_ip: clientIp(request.headers) ?? "" });
  if (error) {
    const m = error.message;
    const text = m.includes("TOO_MANY")
      ? "여러 번 틀렸어요. 10분 뒤 다시 해 주세요."
      : m.includes("TERMINAL_LIMIT")
        ? "출근 단말은 20대까지예요. 관리자 화면에서 안 쓰는 단말을 해제해 주세요."
        : m.includes("FEATURE_DISABLED")
          ? "회사에서 근태를 꺼 두었어요."
          : "코드가 맞지 않거나 시간이 지났어요. 관리자 화면에서 새 코드를 받아 주세요.";
    return NextResponse.json({ error: text }, { status: 400, headers: NO_STORE });
  }
  const d = data as { name: string };
  return NextResponse.json({ key, name: d.name }, { headers: NO_STORE });
}
