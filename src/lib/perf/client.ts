"use client";

import { normalizeRoute, shouldRecordRoute } from "./route";

// 사용자 체감 성능(D-075): 브라우저에서 잰 값을 모아 /api/perf로 보낸다. 측정 실패는 화면에 영향을 주지 않는다.
export type PerfMetric = "TTFB" | "FCP" | "LCP" | "INP" | "CLS" | "ACTION";
type PerfEvent = { route: string; metric: PerfMetric; value: number; action?: string; nav?: string; device: string; conn?: string; build?: string };

const BUILD = process.env.NEXT_PUBLIC_BUILD_ID ?? "local";
const MAX_BATCH = 30;
const queue: PerfEvent[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;

const device = () => (window.matchMedia("(max-width: 767px)").matches ? "mobile" : "desktop");
const conn = () => (navigator as Navigator & { connection?: { effectiveType?: string } }).connection?.effectiveType;

export function flushPerf() {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  while (queue.length) {
    const batch = queue.splice(0, MAX_BATCH);
    const body = JSON.stringify(batch);
    try {
      // 페이지를 떠나는 순간에도 보내지도록 sendBeacon 우선
      if (!navigator.sendBeacon?.("/api/perf", new Blob([body], { type: "application/json" }))) {
        void fetch("/api/perf", { method: "POST", body, headers: { "content-type": "application/json" }, keepalive: true }).catch(() => {});
      }
    } catch {
      // 측정 전송 실패는 무시
    }
  }
}

export function recordPerf(metric: PerfMetric, value: number, extra: { action?: string; nav?: string; pathname?: string } = {}) {
  if (typeof window === "undefined") return;
  const pathname = extra.pathname ?? window.location.pathname;
  if (!shouldRecordRoute(pathname) || !Number.isFinite(value) || value < 0) return;
  queue.push({ route: normalizeRoute(pathname), metric, value: Math.round(value * 100) / 100, action: extra.action, nav: extra.nav, device: device(), conn: conn(), build: BUILD });
  if (queue.length >= MAX_BATCH) flushPerf();
  else if (!timer) timer = setTimeout(flushPerf, 15000);
}

const nextPaint = () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));

// 버튼을 누른 순간부터 결과가 화면에 그려질 때까지(서버 왕복 + 화면 갱신)를 잰다. 작업 결과는 그대로 돌려준다.
export async function measureAction<T>(action: string, run: () => Promise<T>): Promise<T> {
  const start = performance.now();
  try {
    return await run();
  } finally {
    await nextPaint();
    recordPerf("ACTION", performance.now() - start, { action });
  }
}
