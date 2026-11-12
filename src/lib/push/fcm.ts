import "server-only";
import crypto from "node:crypto";

// 설치 앱 알림(FCM HTTP v1, 안드로이드 D-228 · 아이폰 D-259 — 아이폰도 FCM이 APNs로 넘겨 줌). 무료.
// - 키: FCM_SERVICE_ACCOUNT(Firebase 서비스 계정 JSON 한 줄, Vercel Secret). 없으면 보내지 않는다.
// - 채팅·회의처럼 바로 봐야 하는 알림(urgency high)은 앱의 "chat" 채널(중요도 높음·길게 진동·소리), 나머지는 "general".
//   진동 모양·세기는 앱이 채널을 만들 때 정하고(android/MainActivity), 사용자는 휴대폰 설정에서 채널별로 바꿀 수 있다.
type ServiceAccount = { project_id: string; client_email: string; private_key: string; token_uri?: string };

let sa: ServiceAccount | null | undefined;
function account(): ServiceAccount | null {
  if (sa !== undefined) return sa;
  try {
    const raw = process.env.FCM_SERVICE_ACCOUNT;
    const j = raw ? (JSON.parse(raw) as ServiceAccount) : null;
    sa = j?.project_id && j.client_email && j.private_key ? j : null;
  } catch {
    sa = null;
  }
  return sa;
}
export function fcmConfigured(): boolean {
  return !!account();
}

let cached: { token: string; until: number } | null = null;
async function accessToken(a: ServiceAccount): Promise<string | null> {
  if (cached && cached.until > Date.now() + 60_000) return cached.token;
  const now = Math.floor(Date.now() / 1000);
  const aud = a.token_uri || "https://oauth2.googleapis.com/token";
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const unsigned = `${b64({ alg: "RS256", typ: "JWT" })}.${b64({ iss: a.client_email, scope: "https://www.googleapis.com/auth/firebase.messaging", aud, iat: now, exp: now + 3600 })}`;
  const sig = crypto.createSign("RSA-SHA256").update(unsigned).sign(a.private_key, "base64url");
  const r = await fetch(aud, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${unsigned}.${sig}` }),
  });
  if (!r.ok) return null;
  const j = (await r.json()) as { access_token?: string; expires_in?: number };
  if (!j.access_token) return null;
  cached = { token: j.access_token, until: Date.now() + (j.expires_in ?? 3600) * 1000 };
  return j.access_token;
}

export type FcmMessage = { title: string; body: string; url: string; tag?: string; urgency?: "high" | "normal" };
export type FcmResult = "ok" | "gone" | "fail";

// 앱 채널 이름(안드로이드 MainActivity와 같아야 함)
export function fcmChannel(m: Pick<FcmMessage, "urgency">): "chat" | "general" {
  return m.urgency === "high" ? "chat" : "general";
}

// FCM이 보낼 메시지 본문(순수 — 단위 테스트)
export function fcmBody(token: string, m: FcmMessage) {
  const high = m.urgency === "high";
  return {
    message: {
      token,
      notification: { title: m.title, body: m.body },
      data: { url: m.url, ...(m.tag ? { tag: m.tag } : {}) },
      android: {
        priority: high ? "HIGH" : "NORMAL",
        ttl: "86400s",
        notification: {
          channel_id: fcmChannel(m),
          ...(m.tag ? { tag: m.tag } : {}),
          icon: "ic_stat_notify",
          color: "#4F46E5",
          default_sound: true,
          notification_priority: high ? "PRIORITY_HIGH" : "PRIORITY_DEFAULT",
        },
      },
      // 아이폰 설치 앱(D-259): 같은 tag면 앞 알림을 바꾸고(collapse), 같은 방끼리 묶고(thread-id), 소리 기본
      apns: {
        headers: { "apns-priority": high ? "10" : "5", ...(m.tag ? { "apns-collapse-id": m.tag.slice(0, 64) } : {}) },
        payload: { aps: { sound: "default", ...(m.tag ? { "thread-id": m.tag } : {}) } },
      },
    },
  };
}

export async function sendFcm(token: string, m: FcmMessage): Promise<FcmResult> {
  const a = account();
  if (!a) return "fail";
  const at = await accessToken(a).catch(() => null);
  if (!at) return "fail";
  try {
    const r = await fetch(`https://fcm.googleapis.com/v1/projects/${a.project_id}/messages:send`, {
      method: "POST",
      headers: { authorization: `Bearer ${at}`, "content-type": "application/json" },
      body: JSON.stringify(fcmBody(token, m)),
    });
    if (r.ok) return "ok";
    // 앱을 지웠거나 토큰이 바뀜 → 그 토큰을 지운다
    // (메시지 모양이 틀린 INVALID_ARGUMENT는 토큰 탓이 아니므로 지우지 않는다 — 토큰이 틀렸다고 할 때만)
    const j = (await r.json().catch(() => null)) as { error?: { status?: string; message?: string; details?: { errorCode?: string }[] } } | null;
    const code = j?.error?.details?.find((d) => d.errorCode)?.errorCode ?? j?.error?.status;
    if (r.status === 404 || code === "UNREGISTERED") return "gone";
    if (r.status === 400 && code === "INVALID_ARGUMENT" && /registration token/i.test(j?.error?.message ?? "")) return "gone";
    return "fail";
  } catch {
    return "fail";
  }
}
