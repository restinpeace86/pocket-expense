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
type AppPlugin = {
  getInfo(): Promise<{ version: string }>;
  getLaunchUrl(): Promise<{ url?: string } | undefined>;
  addListener(event: "appUrlOpen", cb: (e: { url: string }) => void): Promise<unknown>;
};
type Cap = { isNativePlatform?: () => boolean; getPlatform?: () => string; Plugins?: { PushNotifications?: PushPlugin; App?: AppPlugin } };

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

// ── 로그인(카카오·Google)은 휴대폰 크롬에서 하고 앱으로 돌아온다(D-230) ─────────────────────
// Google은 앱 안 화면(WebView) 로그인을 막고, 다른 주소는 앱이 크롬으로 넘긴다. 그래서 로그인 끝 주소를 앱 주소
// (kr.damounlab.app://auth/callback)로 받아, 앱이 열리면 그 코드를 우리 /auth/callback으로 넘겨 앱 안에서 로그인을 마친다.
// (로그인을 시작한 곳이 앱이라 확인용 값이 앱에 있어 앱 안에서만 마칠 수 있다. Supabase 로그인 허용 주소에 이 앱 주소가 있어야 함)
export const APP_AUTH_CALLBACK = "kr.damounlab.app://auth/callback";

export function appAuthRedirect(next?: string): string | null {
  if (!isNativeApp()) return null;
  return next ? `${APP_AUTH_CALLBACK}?next=${encodeURIComponent(next)}` : APP_AUTH_CALLBACK;
}

// 앱 주소로 돌아오면 → 우리 로그인 마무리 화면으로(코드·next 그대로)
export function appUrlToCallback(url: string): string | null {
  if (!url.startsWith(APP_AUTH_CALLBACK)) return null;
  const q = url.slice(APP_AUTH_CALLBACK.length);
  if (q && !q.startsWith("?")) return null;
  return `/auth/callback${q}`;
}

let authWired = false;
export function initNativeAuthReturn() {
  const app = isNativeApp() ? cap()?.Plugins?.App : null;
  if (!app || authWired) return;
  authWired = true;
  const go = (url?: string) => {
    const to = url ? appUrlToCallback(url) : null;
    if (to) location.assign(to);
  };
  void app.addListener("appUrlOpen", ({ url }) => go(url));
  // 앱이 꺼져 있다가 로그인 끝 주소로 켜진 경우
  void app
    .getLaunchUrl()
    .then((r) => go(r?.url))
    .catch(() => undefined);
}

