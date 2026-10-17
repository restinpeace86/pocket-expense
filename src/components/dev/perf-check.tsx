"use client";

import { flushPerf, measureAction, recordPerf } from "@/lib/perf/client";

// 개발용 점검 화면(/dev/preview/perf-check): 체감 성능 기록이 어떤 형태로 /api/perf에 가는지 확인
export function PerfCheck() {
  async function run() {
    recordPerf("LCP", 812.345, { nav: "navigate", pathname: "/workspace/1a2b3c4d-0000-0000-0000-000000000000/admin/members" });
    await measureAction("check.action", () => new Promise((r) => setTimeout(r, 120)));
    flushPerf();
  }
  return (
    <main className="p-6">
      <button type="button" onClick={run} className="rounded-xl bg-brand-600 px-4 py-2 text-white">
        측정 보내기
      </button>
    </main>
  );
}
