"use client";

import { useEffect } from "react";
import { useReportWebVitals } from "next/web-vitals";
import { flushPerf, recordPerf, type PerfMetric } from "@/lib/perf/client";

// 화면을 열거나 이동할 때(soft navigation 포함) 체감 지표를 기록한다 (D-075, performance.md §7)
const report: Parameters<typeof useReportWebVitals>[0] = (metric) => {
  const pathname = metric.navigationURL ? new URL(metric.navigationURL, window.location.origin).pathname : undefined;
  recordPerf(metric.name as PerfMetric, metric.value, { nav: metric.navigationType, pathname });
};

export function WebVitals() {
  useReportWebVitals(report);
  useEffect(() => {
    const onHide = () => document.visibilityState === "hidden" && flushPerf();
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", flushPerf);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", flushPerf);
    };
  }, []);
  return null;
}
