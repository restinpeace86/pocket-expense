"use client";

import { Loader2, MapPin, Search } from "lucide-react";
import { useCallback, useState, useTransition } from "react";
import { saveCompanyLocationAction, type LocationResult } from "@/app/workspace/[id]/admin/settings/location-actions";
import type { Nearby } from "@/lib/bus/server";
import { PostcodeDialog, type PostcodePick } from "./postcode-dialog";

// 회사 위치(D-243 → D-251 개선사항 2): [주소 검색] → 우편번호 창에서 고르면 바로 저장(도로명·지번·우편번호 + 서버가 좌표)
// 직원 [주변 버스]가 이 위치 200m 안 정류장을 보여 준다. 지금은 서울 버스만
const field = "flex min-h-11 items-center rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-[15px] text-zinc-800";

export function CompanyLocationCard({ current }: { current: Nearby }) {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<PostcodePick | null>(null);
  const [result, setResult] = useState<LocationResult | null>(null);
  const [busy, start] = useTransition();
  const close = useCallback(() => setOpen(false), []);
  const onPick = useCallback((p: PostcodePick) => {
    setOpen(false);
    setPicked(p);
    start(async () => setResult(await saveCompanyLocationAction({ road: p.road, jibun: p.jibun, zonecode: p.zonecode })));
  }, []);

  const road = picked?.road ?? current?.address ?? "";
  const jibun = picked?.jibun ?? current?.jibun_address ?? "";
  const zonecode = picked?.zonecode ?? current?.zonecode ?? "";
  const shown =
    result && result.ok
      ? { seoul: result.region === "서울", stops: result.stops, fallback: result.fallback }
      : current
        ? { seoul: current.seoul, stops: current.stops, fallback: current.fallback }
        : null;
  return (
    <section aria-labelledby="loc-title" className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-4 md:p-5" data-company-location>
      <h2 id="loc-title" className="flex items-center gap-2 text-lg font-bold">
        <MapPin className="size-5 text-brand-700" aria-hidden />
        회사 위치
      </h2>
      <p className="text-sm leading-relaxed text-zinc-600">[주소 검색]에서 회사 주소를 고르면 바로 저장돼요. 직원 홈 [주변 버스]가 이 위치 200m 안 정류장을 보여 줘요(지금은 서울 버스만).</p>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={busy}
        className="flex min-h-12 w-full items-center gap-2 rounded-xl border border-brand-300 bg-white px-3.5 text-left text-[15px] text-zinc-500 hover:border-brand-500 disabled:opacity-60"
        data-address-search
      >
        <Search className="size-5 shrink-0 text-brand-600" aria-hidden />
        <span className="min-w-0 flex-1 truncate">{road ? "다른 주소로 바꾸기" : "도로명·지번·건물명으로 찾기"}</span>
        <span className="shrink-0 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white">주소 검색</span>
      </button>
      {(road || jibun) && (
        <dl className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_8rem]" data-address-fields>
          <div className="flex flex-col gap-1 sm:col-span-2">
            <dt className="text-xs text-zinc-500">도로명 주소</dt>
            <dd className={field} data-road>
              {road || "-"}
              {picked?.building ? <span className="ml-1 text-zinc-500">({picked.building})</span> : null}
            </dd>
          </div>
          <div className="flex min-w-0 flex-col gap-1">
            <dt className="text-xs text-zinc-500">지번 주소</dt>
            <dd className={field} data-jibun>
              {jibun || <span className="text-zinc-400">다시 고르면 함께 저장돼요</span>}
            </dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="text-xs text-zinc-500">우편번호</dt>
            <dd className={field} data-zonecode>
              {zonecode || "-"}
            </dd>
          </div>
        </dl>
      )}
      {busy && (
        <p className="flex items-center gap-2 text-sm text-zinc-600">
          <Loader2 className="size-4 animate-spin" aria-hidden /> 위치를 찾아 저장하는 중…
        </p>
      )}
      {result && !result.ok && (
        <p role="alert" className="text-sm font-semibold text-red-700">
          {result.error}
        </p>
      )}
      {shown && !busy && (
        <div className={`rounded-xl px-3.5 py-3 text-[13px] leading-relaxed ${shown.seoul ? "border border-green-200 bg-green-50 text-green-950" : "border border-amber-200 bg-amber-50 text-amber-950"}`} data-location-result>
          {result?.ok && <b className="block">저장했어요</b>}
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
      {open && <PostcodeDialog onPick={onPick} onClose={close} />}
    </section>
  );
}
