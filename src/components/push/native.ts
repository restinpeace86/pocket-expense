"use client";

import { deleteAppTokenAction, saveAppTokenAction } from "@/app/push/actions";

// 안드로이드 설치 앱(D-228, spec/features/android-app.md) 안에서만 쓰는 알림 연결.
// 설치 앱은 우리 웹(운영 주소)을 그대로 열고, 앱이 `window.Capacitor`(앱 기능 다리)를 넣어 준다.
// 웹 코드는 @capacitor 패키지 없이 이 다리로 알림 기능(PushNotifications)만 부른다 — 브라우저에서는 아무것도 하지 않음.
type Perm = { receive: "prompt" | "prompt-with-rationale" | "granted" | "denied" };
type Delivered = { id: string; tag?: string; data?: unknown };
type PushPlugin = {
  checkPermissions(): Promise<Perm>;
  requestPermissions(): Promise<Perm>;
  register(): Promise<void>;
  unregister(): Promise<void>;
  addListener(event: "registration", cb: (t: { value: string }) => void): Promise<unknown>;
  addListener(event: "registrationError", cb: (e: unknown) => void): Promise<unknown>;
  addListener(event: "pushNotificationActionPerformed", cb: (a: { notification: { data?: Record<string, string> } }) => void): Promise<unknown>;
  getDeliveredNotifications(): Promise<{ notifications: Delivered[] }>;
  removeDeliveredNotifications(o: { notifications: Delivered[] }): Promise<void>;
};
type Cap = { isNativePlatform?: () => boolean; getPlatform?: () => string; Plugins?: { PushNotifications?: PushPlugin; App?: { getInfo(): Promise<{ version: string }> } } };

function cap(): Cap | null {
  if (typeof window === "undefined") return null;
  return ((window as unknown as { Capacitor?: Cap }).Capacitor ?? null) as Cap | null;
}
export function isNativeApp(): boolean {
  const c = cap();
  return !!c?.isNativePlatform?.() && c.getPlatform?.() === "android";
}
function push(): PushPlugin | null {
  return isNativeApp() ? (cap()?.Plugins?.PushNotifications ?? null) : null;
}

const TOKEN_KEY = "pe_app_token";
const read = () => {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
};
const write = (v: string | null) => {
  try {
    if (v) localStorage.setItem(TOKEN_KEY, v);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {}
};

let wired = false;
let waiters: ((t: string | null) => void)[] = [];
const settle = (t: string | null) => {
  const w = waiters;
  waiters = [];
  w.forEach((f) => f(t));
};

// 앱을 열 때 한 번: 토큰이 오면 서버에 등록, 알림을 누르면 그 화면으로. 이미 허용했으면 토큰을 새로 받아 둔다
export function initNativePush() {
  const p = push();
  if (!p || wired) return;
  wired = true;
  void p.addListener("registration", async ({ value }) => {
    write(value);
    const version = await cap()?.Plugins?.App?.getInfo().then((i) => i.version).catch(() => undefined);
    await saveAppTokenAction(value, version).catch(() => undefined);
    settle(value);
  });
  void p.addListener("registrationError", () => settle(null));
  void p.addListener("pushNotificationActionPerformed", ({ notification }) => {
    const url = notification?.data?.url;
    // 우리 사이트 안 주소만(앞이 "/"인 경로)
    if (url && url.startsWith("/") && !url.startsWith("//") && location.pathname + location.search !== url) location.assign(url);
  });
  void p
    .checkPermissions()
    .then((r) => (r.receive === "granted" ? p.register() : undefined))
    .catch(() => undefined);
}

export async function nativePushState(): Promise<"on" | "off" | "denied"> {
  const p = push();
  if (!p) return "off";
  const r = await p.checkPermissions().catch(() => null);
  if (r?.receive === "denied") return "denied";
  return r?.receive === "granted" && read() ? "on" : "off";
}

export async function nativePushOn(): Promise<{ ok: true } | { ok: false; error: string }> {
  const p = push();
  if (!p) return { ok: false, error: "앱에서만 켤 수 있어요." };
  initNativePush();
  let r = await p.checkPermissions().catch(() => null);
  if (r?.receive !== "granted") r = await p.requestPermissions().catch(() => null);
  if (r?.receive !== "granted") return { ok: false, error: r?.receive === "denied" ? "denied" : "알림을 허용하지 않았어요." };
  const token = await new Promise<string | null>((res) => {
    waiters.push(res);
    setTimeout(() => res(read()), 10000);
    void p.register().catch(() => res(null));
  });
  return token ? { ok: true } : { ok: false, error: "알림을 켜지 못했어요. 인터넷 연결을 확인해 주세요." };
}

export async function nativePushOff() {
  const p = push();
  const t = read();
  if (t) await deleteAppTokenAction(t).catch(() => undefined);
  write(null);
  await p?.unregister().catch(() => undefined);
}

// 그 대화방을 열면 앱 알림(같은 tag)도 닫는다
export function closeNativeNotifications(tag: string) {
  const p = push();
  if (!p) return;
  void p
    .getDeliveredNotifications()
    .then(({ notifications }) => {
      const hit = notifications.filter((n) => n.tag === tag);
      return hit.length ? p.removeDeliveredNotifications({ notifications: hit }) : undefined;
    })
    .catch(() => undefined);
}
