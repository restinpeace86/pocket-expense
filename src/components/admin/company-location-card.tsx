"use client";

import { Loader2, MapPin } from "lucide-react";
import { useState, useTransition } from "react";
import { saveCompanyLocationAction, type LocationResult } from "@/app/workspace/[id]/admin/settings/location-actions";
import type { Nearby } from "@/lib/bus/server";

// 회사 위치(D-243): 직원 [주변 버스]가 이 위치 200m 안 정류장을 보여 준다. 지금은 서울 버스만
export function CompanyLocationCard({ current }: { current: Nearby }) {
  const [address, setAddress] = useState(current?.address ?? "");
  const [result, setResult] = useState<LocationResult | null>(null);
  const [busy, start] = useTransition();
  const save = () =>
    start(async () => {
      setResult(await saveCompanyLocationAction(address));
    });
  const shown =
    result && result.ok
      ? { found: result.found, seoul: result.region === "서울", stops: result.stops, fallback: result.fallback }
      : current
        ? { found: current.found_address ?? current.address, seoul: current.seoul, stops: current.stops, fallback: current.fallback }
        : null;
  return (
    <section aria-labelledby="loc-title" className="flex flex-col gap-2.5 rounded-2xl border border-zinc-200 bg-white p-4 md:p-5" data-company-location>
      <h2 id="loc-title" className="flex items-center gap-2 text-lg font-bold">
        <MapPin className="size-5 text-brand-700" aria-hidden />
        회사 위치
      </h2>
      <p className="text-sm leading-relaxed text-zinc-600">직원 홈 [주변 버스]에서 이 위치 200m 안 정류장의 버스 도착 정보를 보여 줘요. 도로명 주소를 넣으면 위치를 찾아 저장해요. 지금은 서울 버스만 보여 드려요.</p>
      <div className="flex flex-wrap gap-2">
        <label htmlFor="company-address" className="sr-only">
          회사 주소
        </label>
        <input id="company-address" value={address} maxLength={200} onChange={(e) => setAddress(e.target.value)} placeholder="예: 서울 중구 세종대로 110" className="h-11 min-w-0 flex-1 rounded-xl border border-zinc-300 px-3 text-[15px] outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20" />
        <button type="button" onClick={save} disabled={busy || address.trim().length < 2} className="flex h-11 items-center gap-1.5 rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60" data-save-location>
          {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
          위치 찾기·저장
        </button>
      </div>
      {result && !result.ok && (
        <p role="alert" className="text-sm font-semibold text-red-700">
          {result.error}
        </p>
      )}
      {shown && (
        <div className={`rounded-xl px-3.5 py-3 text-[13px] leading-relaxed ${shown.seoul ? "border border-green-200 bg-green-50 text-green-950" : "border border-amber-200 bg-amber-50 text-amber-950"}`} data-location-result>
          {result?.ok ? "저장했어요" : "지금 위치"}: <b>{shown.found}</b>
          {shown.seoul ? (
            shown.stops.length ? (
              <span className="block">
                {shown.fallback ? "200m 안에 정류장이 없어 500m 안 가까운 곳" : "200m 안 정류장"} {shown.stops.length}곳: {shown.stops.map((s) => `${s.name}(${s.meters}m)`).join(", ")}
              </span>
            ) : (
              <span className="block">500m 안에 정류장이 없어요.</span>
            )
          ) : (
            <span className="block">서울이 아니라 지금은 [주변 버스]가 보이지 않아요(서울 버스만 지원).</span>
          )}
          {current?.updated_by_name && !result && <span className="block text-zinc-600">마지막 변경: {current.updated_by_name}</span>}
        </div>
      )}
    </section>
  );
}
