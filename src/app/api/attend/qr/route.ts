import { NextResponse, type NextRequest } from "next/server";
import { isOpenHour } from "@/lib/attendance/rules";
import { qrSecret } from "@/lib/attendance/server";
import { makeToken, sha256, SLOT_MS, slotOf } from "@/lib/attendance/token";
import { createAdminClient } from "@/lib/supabase/admin";

// 출근 단말 화면이 몇 초마다 부르는 곳(spec/features/attendance.md §2-2): 단말 열쇠 확인 → 지금 30초 칸의 QR 주소 + 방금 찍은 사람
// QR은 한국 시간 06:00~24:00에만 준다
const NO_STORE = { "Cache-Control": "no-store" };

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { key?: unknown } | null;
  const key = typeof body?.key === "string" ? body.key : "";
  const admin = createAdminClient();
  const secret = qrSecret();
  if (!key || key.length > 200) return NextResponse.json({ status: "revoked" }, { headers: NO_STORE });
  if (!admin || !secret) return NextResponse.json({ status: "error" }, { status: 503, headers: NO_STORE });
  const { data, error } = await admin.rpc("attendance_terminal_auth", { p_key_hash: sha256(key) });
  if (error || !data) return NextResponse.json({ status: "error" }, { status: 503, headers: NO_STORE });
  const t = data as { status: "ok" | "disabled" | "revoked"; terminal_id?: string; company_id?: string; name?: string; company_name?: string; recent?: { name: string; kind: "in" | "out"; at: string }[] };
  const now = Date.now();
  const base = { serverNow: new Date(now).toISOString(), name: t.name, companyName: t.company_name };
  if (t.status !== "ok") return NextResponse.json({ ...base, status: t.status }, { headers: NO_STORE });
  if (!isOpenHour(new Date(now))) return NextResponse.json({ ...base, status: "closed" }, { headers: NO_STORE });
  const slot = slotOf(now);
  const token = makeToken(secret, t.company_id!, t.terminal_id!, slot);
  return NextResponse.json(
    { ...base, status: "ok", url: `${request.nextUrl.origin}/attend/scan?t=${encodeURIComponent(token)}`, slotEndsAt: new Date((slot + 1) * SLOT_MS).toISOString(), recent: t.recent ?? [] },
    { headers: NO_STORE },
  );
}
