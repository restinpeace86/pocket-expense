import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

// 출근 단말 동적 QR (spec/features/attendance.md §2-2, D-236)
// 토큰 = v1.<회사>.<단말>.<30초 칸 번호>.<서명> — 서버 비밀키 HMAC, DB에 저장하지 않는다
export const SLOT_MS = 30_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export const slotOf = (now: number) => Math.floor(now / SLOT_MS);

function sign(secret: string, body: string) {
  return createHmac("sha256", secret).update(body).digest("base64url").slice(0, 22);
}

export function makeToken(secret: string, companyId: string, terminalId: string, slot: number): string {
  const body = `v1.${companyId}.${terminalId}.${slot}`;
  return `${body}.${sign(secret, body)}`;
}

export type TokenCheck = { ok: true; companyId: string; terminalId: string; slot: number } | { ok: false; error: "INVALID" | "EXPIRED" };

// maxBack: 지금 칸에서 몇 칸 전까지 받을지(1 = 직전 칸까지, 최대 약 60초)
export function verifyToken(secret: string, token: string, now: number, maxBack = 1): TokenCheck {
  const parts = token.split(".");
  if (parts.length !== 5 || parts[0] !== "v1") return { ok: false, error: "INVALID" };
  const [, companyId, terminalId, slotText, sig] = parts;
  if (!UUID.test(companyId) || !UUID.test(terminalId) || !/^\d{1,12}$/.test(slotText)) return { ok: false, error: "INVALID" };
  const expected = Buffer.from(sign(secret, parts.slice(0, 4).join(".")));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return { ok: false, error: "INVALID" };
  const slot = Number(slotText);
  const current = slotOf(now);
  if (slot > current || slot < current - maxBack) return { ok: false, error: "EXPIRED" };
  return { ok: true, companyId, terminalId, slot };
}

export const sha256 = (text: string) => createHash("sha256").update(text).digest("hex");
export const newTerminalKey = () => randomBytes(32).toString("base64url");
export const newPairCode = () => String(randomInt(0, 1_000_000)).padStart(6, "0");
