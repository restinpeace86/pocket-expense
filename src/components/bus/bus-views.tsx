"use client";

import { Bell, BellOff, Bus as BusIcon, ChevronDown, ChevronLeft, ChevronRight, Loader2, RotateCw, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { offBusAlertAction, setBusAlertAction, stationArrivalsAction } from "@/app/workspace/[id]/employee/bus/actions";
import type { NearStop, StationData } from "@/lib/bus/server";
import { StopsMap, type MapStop } from "./stops-map";
import { arrivalLabel, CONGESTION, remainingSec, ROUTE_TYPE, stopsAway, type BusRoute } from "@/lib/bus/arrivals";
import { TAGO_ROUTE_TYPE } from "@/lib/bus/tago";

// 노선 종류 색: 서울(숫자 코드) · 서울 밖 TAGO("tago:직행좌석버스")
const routeType = (t: string) => (t.startsWith("tago:") ? TAGO_ROUTE_TYPE[t.slice(5)] : ROUTE_TYPE[t]) ?? { label: "", cls: "bg-zinc-700" };
const stopNoOf = (s: NearStop) => s.no ?? (/^\d{5}$/.test(s.ars_id) ? s.ars_id : null);

// 주변 버스(D-243, spec/features/bus.md): 주변 정류장 → 정류장(전 노선 도착) → 알림 받기(직원당 1개, 30분)
export type MyAlert = { ars_id: string; station_name: string; route_id: string; route_no: string; expires_at: string } | null;

function Note() {
  return <p className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-[13px] leading-relaxed text-amber-950" data-bus-note>도착 시간은 <b>참고용</b>이에요. 실제와 1~3분 차이가 날 수 있어요.</p>;
}

function useNow(ms = 15_000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

export function AlertBanner({ alert, base }: { alert: MyAlert; base: string }) {
  const now = useNow(30_000);
  const [busy, start] = useTransition();
  if (!alert) return null;
  // 서버·기기 시계 차이로 31분이 되지 않게 30분까지만
  const left = Math.min(30, Math.max(0, Math.ceil((new Date(alert.expires_at).getTime() - now.getTime()) / 60_000)));
  if (left <= 0) return null;
  return (
    <section aria-label="내 버스 알림" className="flex items-center gap-3 rounded-2xl border border-brand-200 bg-brand-50 px-4 py-3" data-my-bus-alert>
      <Bell className="size-5 shrink-0 text-brand-700" aria-hidden />
      <Link href={`${base}/bus/${alert.ars_id}`} className="min-w-0 flex-1 text-sm text-brand-950">
        <b>{alert.route_no}번</b> · {alert.station_name}
        <span className="block text-xs text-brand-900/80">도착 10분 전·5분 전에 [알림]방으로 알려 드려요 · {left}분 남음</span>
      </Link>
      <button type="button" disabled={busy} onClick={() => start(async () => void (await offBusAlertAction()))} className="flex h-10 shrink-0 items-center gap-1 rounded-lg border border-brand-300 bg-white px-3 text-sm font-semibold text-brand-800 hover:bg-brand-100" data-bus-alert-off>
        <BellOff className="size-4" aria-hidden /> 끄기
      </button>
    </section>
  );
}

// 주변 버스(D-243 → D-251 개선사항 4): 위 지도(회사 핀 + 정류장 최대 3곳) + 아래 정류장 목록.
// 마커나 목록을 누르면 그 정류장이 하이라이트되고 아코디언으로 도착 정보가 펼쳐진다(다시 누르거나 다른 곳을 누르면 접힘)
const MAP_STOPS = 3;
export function BusStops({ base, address, center, stops, fallback, alert }: { base: string; address: string; center: { lat: number; lng: number } | null; stops: NearStop[]; fallback: boolean; alert: MyAlert }) {
  const shown = useMemo(() => stops.slice(0, MAP_STOPS), [stops]);
  const [open, setOpen] = useState<string | null>(null);
  const toggle = useCallback((ars: string) => setOpen((o) => (o === ars ? null : ars)), []);
  const mapStops = useMemo(() => shown.filter((s): s is MapStop => typeof s.lat === "number" && typeof s.lng === "number"), [shown]);
  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-3 px-4 pb-28 pt-3 md:max-w-2xl md:px-6 md:pt-6">
      <div className="flex items-center gap-1">
        <Link href={base} aria-label="홈으로" className="flex size-10 items-center justify-center rounded-lg text-zinc-700 hover:bg-zinc-100">
          <ChevronLeft className="size-6" />
        </Link>
        <h1 className="text-xl font-bold md:text-2xl">주변 버스</h1>
      </div>
      <AlertBanner alert={alert} base={base} />
      {center && <StopsMap center={center} label="회사" stops={mapStops} selected={open} onSelect={toggle} />}
      <p className="text-[13px] text-zinc-600">
        {address}에서 {fallback ? "200m 안에 정류장이 없어 500m 안 가까운 곳" : "200m 안 정류장"}이에요. 정류장을 누르면 도착 정보가 펼쳐져요.
      </p>
      {shown.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-zinc-300 bg-white px-4 py-8 text-center text-sm text-zinc-500">회사 주변 500m 안에 정류장이 없어요.</p>
      ) : (
        <ul aria-label="주변 정류장" className="flex flex-col gap-2">
          {shown.map((s) => (
            <StopRow key={s.ars_id} base={base} stop={s} open={open === s.ars_id} onToggle={() => toggle(s.ars_id)} alertRoute={alert?.ars_id === s.ars_id ? alert.route_no : null} />
          ))}
        </ul>
      )}
      <Note />
    </main>
  );
}

function StopRow({ base, stop, open, onToggle, alertRoute }: { base: string; stop: NearStop; open: boolean; onToggle: () => void; alertRoute: string | null }) {
  const [data, setData] = useState<StationData | null | undefined>(undefined);
  const [busy, start] = useTransition();
  const now = useNow(15_000);
  const panel = `stop-${stop.ars_id}`;
  // 펼칠 때만 가져온다(목록·지도 마커 어느 쪽으로 열어도). 3분 안이면 서버가 저장된 값을 돌려줌
  useEffect(() => {
    if (!open || data !== undefined) return;
    start(async () => setData(await stationArrivalsAction(stop.ars_id)));
  }, [open, data, stop.ars_id]);
  const click = onToggle;
  const routes = data?.routes ?? [];
  return (
    <li className={`overflow-hidden rounded-2xl border bg-white transition-shadow ${open ? "border-emerald-600 shadow-[0_0_0_3px_rgba(4,120,87,0.18)]" : "border-zinc-200"}`} data-stop={stop.ars_id} data-open={open ? "" : undefined}>
      <button type="button" onClick={click} aria-expanded={open} aria-controls={panel} className="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left hover:bg-zinc-50">
        <span className={`inline-flex size-8 shrink-0 items-center justify-center rounded-lg border-2 ${open ? "border-emerald-700 bg-emerald-700 text-white" : "border-emerald-700 text-emerald-700"}`}>
          <BusIcon className="size-4" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <b className="text-[15px]">{stop.name}</b> {stopNoOf(stop) && <span className="text-xs text-zinc-500">{stopNoOf(stop)}</span>}
          {alertRoute && <span className="block text-xs font-semibold text-brand-700">알림: {alertRoute}번</span>}
        </span>
        <b className="text-sm text-zinc-700">{stop.meters}m</b>
        <ChevronDown className={`size-4 shrink-0 text-zinc-400 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>
      <div id={panel} hidden={!open} className="border-t border-dashed border-zinc-200 px-4 pb-3 pt-2" data-arrivals>
        {busy || data === undefined ? (
          <p className="flex items-center gap-2 py-2 text-sm text-zinc-500">
            <Loader2 className="size-4 animate-spin" aria-hidden /> 도착 정보를 가져오는 중…
          </p>
        ) : data === null ? (
          <p className="py-2 text-sm text-zinc-600">도착 정보를 가져오지 못했어요.</p>
        ) : (
          <>
            {data.error && <p className="py-1 text-[13px] text-zinc-600">{ERR[data.error] ?? ERR.NETWORK}</p>}
            {routes.length === 0 && !data.error && <p className="py-2 text-sm text-zinc-500">지금 들어오는 버스 정보가 없어요.</p>}
            <ul className="flex flex-col">
              {routes.slice(0, 6).map((r) => {
                const s1 = data.fetched_at ? remainingSec(r.arr1_sec, data.fetched_at, now) : r.arr1_sec;
                const t = routeType(r.route_type);
                return (
                  <li key={r.route_id + r.route_no} className="flex items-center gap-2.5 py-1.5" data-acc-route={r.route_no}>
                    <span className={`min-w-12 shrink-0 rounded-md px-1.5 py-0.5 text-center text-[13px] font-extrabold text-white ${t.cls}`}>{r.route_no}</span>
                    <span className="min-w-0 flex-1 truncate text-[14px] font-semibold">{arrivalLabel(s1, r.arr1_msg)}</span>
                  </li>
                );
              })}
            </ul>
            <Link href={`${base}/bus/${stop.ars_id}`} className="mt-1 inline-flex min-h-10 items-center gap-1 text-[13px] font-semibold text-brand-700 hover:underline" data-stop-detail>
              {routes.length > 6 ? `전체 ${routes.length}개 노선 · ` : ""}자세히 · 알림 받기
              <ChevronRight className="size-4" aria-hidden />
            </Link>
          </>
        )}
      </div>
    </li>
  );
}

const ERR: Record<string, string> = {
  KEY_NOT_REGISTERED: "버스 정보 연결이 아직 준비되지 않았어요. 잠시 뒤 다시 열어 주세요.",
  DAILY_LIMIT: "오늘 버스 정보 조회 한도를 다 써서 새로 가져오지 못했어요.",
  NETWORK: "버스 정보를 가져오지 못했어요. 잠시 뒤 다시 열어 주세요.",
  BAD_RESPONSE: "버스 정보를 가져오지 못했어요. 잠시 뒤 다시 열어 주세요.",
  NO_KEY: "버스 정보 연결이 아직 준비되지 않았어요.",
};

export function BusStation({
  base,
  arsId,
  stopNo = null,
  stationName,
  routes,
  fetchedAt,
  error,
  alert,
}: {
  base: string;
  arsId: string;
  stopNo?: string | null; // 화면에 보이는 정류장 번호(서울 = 5자리, TAGO = nodeno)
  stationName: string;
  routes: BusRoute[];
  fetchedAt: string | null;
  error: string | null;
  alert: MyAlert;
}) {
  const router = useRouter();
  const now = useNow(15_000);
  const [picking, setPicking] = useState<BusRoute | null>(null);
  // 3분마다 새로(서버가 3분 넘은 값이면 다시 가져온다)
  useEffect(() => {
    const t = setInterval(() => router.refresh(), 180_000);
    return () => clearInterval(t);
  }, [router]);
  const ageMin = fetchedAt ? Math.max(0, Math.floor((now.getTime() - new Date(fetchedAt).getTime()) / 60_000)) : null;
  const alertHere = alert && alert.ars_id === arsId && new Date(alert.expires_at) > now ? alert : null;

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-3 px-4 pb-28 pt-3 md:max-w-2xl md:px-6 md:pt-6">
      <div className="flex items-center gap-1">
        <Link href={`${base}/bus`} aria-label="주변 정류장으로" className="flex size-10 items-center justify-center rounded-lg text-zinc-700 hover:bg-zinc-100">
          <ChevronLeft className="size-6" />
        </Link>
        <h1 className="min-w-0 truncate text-xl font-bold md:text-2xl">
          {stationName} {stopNo && <span className="text-sm font-normal text-zinc-500">{stopNo}</span>}
        </h1>
        <button type="button" onClick={() => router.refresh()} className="ml-auto flex h-10 shrink-0 items-center gap-1 rounded-lg px-2 text-[13px] font-semibold text-brand-700 hover:bg-brand-50" data-bus-age>
          <RotateCw className="size-4" aria-hidden /> {ageMin === null ? "새로고침" : ageMin === 0 ? "방금 정보" : `${ageMin}분 전 정보`}
        </button>
      </div>
      <Note />
      <AlertBanner alert={alert} base={base} />
      {error && (
        <p role="alert" className="rounded-xl bg-zinc-100 px-3.5 py-2.5 text-[13px] text-zinc-800">
          {ERR[error] ?? ERR.NETWORK}
          {routes.length > 0 && " 아래는 마지막으로 가져온 정보예요."}
        </p>
      )}
      {routes.length > 0 && (
        <ul aria-label="도착 정보" className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
          {routes.map((r) => {
            const s1 = fetchedAt ? remainingSec(r.arr1_sec, fetchedAt, now) : r.arr1_sec;
            const s2 = fetchedAt ? remainingSec(r.arr2_sec, fetchedAt, now) : r.arr2_sec;
            const t = routeType(r.route_type);
            const on = alertHere?.route_id === r.route_id;
            const away = stopsAway(r.arr1_msg);
            return (
              <li key={r.route_id + r.route_no} className={`flex items-center gap-3 border-b border-zinc-100 px-3.5 py-3 last:border-b-0 ${on ? "bg-brand-50" : ""}`} data-route={r.route_no}>
                <span className={`min-w-14 shrink-0 rounded-lg px-2 py-1 text-center text-[15px] font-extrabold text-white ${t.cls}`} title={t.label}>
                  {r.route_no}
                </span>
                <span className="min-w-0 flex-1">
                  {r.direction && <span className="block truncate text-xs text-zinc-500">{r.direction} 방면</span>}
                  <b className="block text-[15px]" data-arr1>
                    {arrivalLabel(s1, r.arr1_msg)}
                    {s1 !== null && s1 > 60 && away && <span className="font-normal text-zinc-600"> · {away}</span>}
                  </b>
                  <span className="block text-[13px] text-zinc-600">
                    다음 {arrivalLabel(s2, r.arr2_msg)}
                    {r.is_last1 && " · 막차"}
                    {r.congestion && CONGESTION[r.congestion] && ` · ${CONGESTION[r.congestion]}`}
                  </span>
                </span>
                {on ? (
                  <span className="flex h-10 shrink-0 items-center gap-1 rounded-lg border border-brand-600 px-2.5 text-[13px] font-semibold text-brand-700">
                    <Bell className="size-4" aria-hidden /> 알림 중
                  </span>
                ) : (
                  <button type="button" onClick={() => setPicking(r)} className="flex h-10 shrink-0 items-center gap-1 rounded-lg border border-zinc-300 px-2.5 text-[13px] font-semibold text-zinc-800 hover:bg-zinc-50" data-alert-on={r.route_no}>
                    알림 받기
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {!error && routes.length === 0 && <p className="rounded-2xl border border-dashed border-zinc-300 bg-white px-4 py-8 text-center text-sm text-zinc-500">지금 이 정류장에 들어오는 버스 정보가 없어요.</p>}
      <p className="text-xs leading-relaxed text-zinc-600">가져온 시각 기준으로 시간을 줄여 보여 주고, 3분마다 새 정보로 바꿔요. 서울은 서울시, 그 밖의 지역은 국토교통부 버스 정보예요.</p>
      {picking && <AlertSheet route={picking} arsId={arsId} stationName={stationName} current={alert} onClose={() => setPicking(null)} />}
    </main>
  );
}

function AlertSheet({ route, arsId, stationName, current, onClose }: { route: BusRoute; arsId: string; stationName: string; current: MyAlert; onClose: () => void }) {
  const [busy, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const replacing = current && new Date(current.expires_at) > new Date() ? current : null;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const save = () =>
    start(async () => {
      setError(null);
      const r = await setBusAlertAction(arsId, route.route_id, route.route_no, stationName);
      if (!r.ok) return setError(r.error);
      onClose();
    });
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 md:items-center" onClick={onClose}>
      <section role="dialog" aria-modal="true" aria-labelledby="bus-alert-title" onClick={(e) => e.stopPropagation()} className="flex w-full max-w-md flex-col gap-3 rounded-t-3xl bg-white px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-5 md:rounded-3xl">
        <div className="flex items-center gap-2">
          <h2 id="bus-alert-title" className="text-lg font-bold">
            {route.route_no}번 알림 받기
          </h2>
          <button type="button" onClick={onClose} aria-label="닫기" className="ml-auto flex size-10 items-center justify-center rounded-lg text-zinc-600 hover:bg-zinc-100">
            <X className="size-5" />
          </button>
        </div>
        <p className="text-[14px] leading-relaxed text-zinc-800">
          {stationName}에 {route.route_no}번 버스가 <b>도착 10분 전, 5분 전</b>에 회사 채팅 [알림]방과 휴대폰으로 알려 드려요. 그 버스를 놓치면 <b>다음 {route.route_no}번</b>으로 이어서 알려요.
        </p>
        <p className="rounded-xl bg-indigo-50 px-3.5 py-2.5 text-[13px] text-indigo-950" data-alert-30>
          이 알림은 <b>30분 동안</b> 유지돼요. 그 전에 직접 끌 수도 있어요.
        </p>
        {replacing && (
          <p className="rounded-xl bg-amber-50 px-3.5 py-2.5 text-[13px] text-amber-950" data-alert-replace>
            지금 <b>{replacing.route_no}번</b>({replacing.station_name}) 알림을 받고 있어요. 알림은 한 사람에 하나라 <b>{route.route_no}번으로 바뀌어요.</b>
          </p>
        )}
        {error && (
          <p role="alert" className="text-sm font-semibold text-red-700">
            {error}
          </p>
        )}
        <button type="button" onClick={save} disabled={busy} className="flex h-12 items-center justify-center gap-1.5 rounded-xl bg-brand-600 font-semibold text-white hover:bg-brand-700 disabled:opacity-70" data-alert-save>
          {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
          {replacing ? `${route.route_no}번으로 알림 바꾸기` : `${route.route_no}번 알림 켜기`}
        </button>
      </section>
    </div>
  );
}
