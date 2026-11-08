"use server";

import { headers } from "next/headers";
import { isOpenHour } from "@/lib/attendance/rules";
import { clientIp, qrSecret } from "@/lib/attendance/server";
import { verifyToken } from "@/lib/attendance/token";
import { getMembership } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

// QR 출퇴근(spec/features/attendance.md §3, D-236): QR 서명·시간·로그인·소속을 서버에서 확인한 뒤 기록(service role)
export type PunchResult =
  | { kind: "in"; inAt: string; holiday: boolean }
  | { kind: "confirm_out"; inAt: string; now: string; holiday: boolean }
  | { kind: "out"; inAt: string; outAt: string; holiday: boolean }
  | { kind: "already"; inAt: string; outAt: string; holiday: boolean }
  | { kind: "error"; code: "EXPIRED" | "INVALID" | "OTHER_COMPANY" | "DISABLED" | "CLOSED" | "LOGIN" | "FAILED" };

export async function punchAction(token: string, confirmOut: boolean): Promise<PunchResult> {
  const h = await headers();
  const admin = createAdminClient();
  const secret = qrSecret();
  if (!admin || !secret) return { kind: "error", code: "FAILED" };
  const membership = await getMembership();
  const log = (code: string, companyId: string | null = null, terminalId: string | null = null) =>
    admin.rpc("attendance_log_attempt", {
      p_company: companyId as string,
      p_member: (membership?.member_id ?? null) as string,
      p_terminal: terminalId as string,
      p_code: code,
      p_ip: clientIp(h) ?? "",
      p_ua: h.get("user-agent") ?? "",
    });
  if (!membership || membership.status !== "approved") return { kind: "error", code: "LOGIN" };
  // 퇴근 확인을 누르는 동안 QR이 바뀌어도 되도록 확인 단계는 2분 30초까지 받는다
  const check = verifyToken(secret, token, Date.now(), confirmOut ? 5 : 1);
  if (!check.ok) {
    await log(check.error);
    return { kind: "error", code: check.error };
  }
  if (check.companyId !== membership.company_id) {
    await log("OTHER_COMPANY", check.companyId, check.terminalId);
    return { kind: "error", code: "OTHER_COMPANY" };
  }
  if (!isOpenHour()) return { kind: "error", code: "CLOSED" };
  const { data, error } = await admin.rpc("attendance_punch", { p_company: check.companyId, p_terminal: check.terminalId, p_member: membership.member_id, p_confirm_out: confirmOut });
  if (error) {
    const m = error.message;
    const code = m.includes("FEATURE_DISABLED") ? "DISABLED" : m.includes("TERMINAL_REVOKED") || m.includes("NOT_MEMBER") ? "OTHER_COMPANY" : m.includes("CLOSED_HOURS") ? "CLOSED" : "FAILED";
    await log(m.slice(0, 40), check.companyId, check.terminalId);
    return { kind: "error", code };
  }
  const d = data as { result: string; in_at: string; out_at?: string; now?: string; holiday: boolean };
  if (d.result === "in") return { kind: "in", inAt: d.in_at, holiday: d.holiday };
  if (d.result === "confirm_out") return { kind: "confirm_out", inAt: d.in_at, now: d.now!, holiday: d.holiday };
  if (d.result === "out") return { kind: "out", inAt: d.in_at, outAt: d.out_at!, holiday: d.holiday };
  return { kind: "already", inAt: d.in_at, outAt: d.out_at!, holiday: d.holiday };
}
