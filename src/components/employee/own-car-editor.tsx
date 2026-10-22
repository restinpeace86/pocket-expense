"use client";

import { Loader2, TriangleAlert } from "lucide-react";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { saveOwnCarItemAction, saveOwnCarRouteAction } from "@/app/workspace/[id]/employee/claims/actions";
import { RouteEvidenceCard } from "@/components/claims/route-evidence-card";
import { PlaceSearch } from "@/components/employee/place-search";
import { inputClass } from "@/components/ui/page-shell";
import type { EditorClaim, EditorItem, FuelPolicy, RoutePlaceInput } from "@/lib/employee/editor-types";
import { fuelAmount, routeCardFrom, routeFormula } from "@/lib/expense/route";
import { formatWon } from "@/lib/format";
import { measureAction } from "@/lib/perf/client";
import type { ItemFormHandle } from "./item-editor";

// 자차 유류비 (trip-expense.md §4, D-069, D-085) — 결의서 화면 안에서 펼쳐 입력한다(화면 이동 없음, 개선사항(2차) 4)
// 출발지·도착지를 고르면 서버가 Kakao 길찾기로 편도 거리를 구하고, 거리 × 회사 km당 단가로 금액을 정한다(직원이 금액을 넣지 않음).
// 결과는 '출장 경로 및 거리 산정 요약' 카드로 그 자리에 붙는다. 길찾기가 안 되면 주행거리를 직접 입력한다(직접 입력 거리로 표시).
// item이 없으면(새 경로) 첫 장소를 고를 때 항목을 만든다 — 자차만 눌러 두고 떠나도 빈 항목이 남지 않게.
const toPlace = (name: string | null, lat: number | null, lng: number | null, address: unknown): RoutePlaceInput | null =>
  name && lat != null && lng != null ? { name, lat: Number(lat), lng: Number(lng), address: typeof address === "string" ? address : null } : null;

export function OwnCarInline({
  claim,
  item,
  fuel,
  ensureItem,
  register,
  onError,
}: {
  claim: EditorClaim;
  item: EditorItem | null;
  fuel: FuelPolicy;
  ensureItem: () => Promise<string | null>; // 새 경로: 항목을 만들고 id를 돌려준다(실패하면 null)
  register: (id: string, h: ItemFormHandle | null) => void;
  onError: (message: string | null) => void;
}) {
  const ev = (item?.route_evidence && typeof item.route_evidence === "object" ? item.route_evidence : {}) as Record<string, unknown>;
  const [start, setStart] = useState<RoutePlaceInput | null>(() => (item ? toPlace(item.start_location, item.start_lat, item.start_lng, ev.start_address) : null));
  const [end, setEnd] = useState<RoutePlaceInput | null>(() => (item ? toPlace(item.end_location, item.end_lat, item.end_lng, ev.end_address) : null));
  const [roundTrip, setRoundTrip] = useState(item?.is_round_trip === true); // 기본 편도(D-089)
  const [manualOpen, setManualOpen] = useState(item?.distance_source === "manual");
  const [manualKm, setManualKm] = useState(item?.distance_source === "manual" && item.route_one_way_km != null ? String(item.route_one_way_km) : "");
  // 사용일·적요는 직원이 고치기 전까지 저장된 값을 그대로 보여 준다(새 경로는 항목이 만들어지면 DB가 정한 사용일이 나타남)
  const [metaEdit, setMetaEdit] = useState<{ expenseDate: string; purpose: string } | null>(null);
  const expenseDate = metaEdit?.expenseDate ?? item?.expense_date ?? "";
  const purpose = metaEdit?.purpose ?? item?.purpose ?? "";
  const [notice, setNotice] = useState<string | null>(null);
  const [calculating, startCalc] = useTransition();
  const [savingRound, startRoundSave] = useTransition();
  const createdId = useRef<string | null>(null); // 새 경로에서 만든 항목 id(부모가 새로 그리기 전까지)
  const itemId = item?.id ?? null;
  const uid = itemId ?? "new";

  const saved = item ? routeCardFrom(item, fuel.ratePerKm) : null;
  // 왕복 × 2는 화면에서 바로 계산해 보여 주고(기다림 없음), 저장은 뒤에서 한다. 금액의 최종값은 DB가 같은 식으로 다시 계산한다
  const card = saved && { ...saved, roundTrip, totalKm: saved.oneWayKm * (roundTrip ? 2 : 1), amount: fuelAmount(saved.oneWayKm, saved.rate, roundTrip) };

  // 사용일·적요: 고치면 0.8초 뒤 자동 저장, 임시저장·상신 전에 남은 것 저장
  const meta = useRef<{ expenseDate: string; purpose: string } | null>(null);
  const savedMeta = useRef("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flush = useCallback(async (): Promise<boolean> => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    const m = meta.current;
    const snap = JSON.stringify(m);
    if (!itemId || !m || snap === savedMeta.current) return true;
    const res = await measureAction("employee.save_item", () => saveOwnCarItemAction(itemId, m));
    if (!res.ok) {
      onError(res.error);
      return false;
    }
    savedMeta.current = snap;
    onError(null);
    return true;
  }, [itemId, onError]);
  useEffect(() => {
    if (!itemId) return;
    register(itemId, { flush });
    return () => {
      register(itemId, null);
      void flush();
    };
  }, [itemId, register, flush]);
  const setMeta = (next: { expenseDate: string; purpose: string }) => {
    meta.current = next;
    setMetaEdit(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), 800);
  };

  // 장소·왕복·직접 입력 거리를 서버에 저장(저장 뒤 화면은 새 거리·금액으로 다시 그려진다)
  function saveRoute(next: { start: RoutePlaceInput | null; end: RoutePlaceInput | null; roundTrip: boolean; manual: number | null }) {
    startCalc(async () => {
      onError(null);
      setNotice(null);
      let id = itemId ?? createdId.current;
      if (!id) {
        id = await ensureItem();
        if (!id) return;
        createdId.current = id;
      }
      const target = id;
      const res = await measureAction("employee.own_car_route", () =>
        saveOwnCarRouteAction(target, { start: next.start, end: next.end, roundTrip: next.roundTrip, manualOneWayKm: next.manual }),
      );
      if (!res.ok) return onError(res.error);
      if (res.autoFailed) {
        setManualOpen(true);
        setNotice("거리를 자동으로 계산하지 못했어요. 주행거리(편도)를 직접 입력해 주세요.");
      }
    });
  }

  const manualNum = Number(manualKm);
  const manualValid = manualKm !== "" && Number.isFinite(manualNum) && manualNum > 0 && manualNum <= 5000;
  const manualPreview = manualValid ? Math.round(manualNum * 10) / 10 : null;

  const toggleRound = (next: boolean) => {
    setRoundTrip(next);
    if (!itemId) return;
    onError(null);
    startRoundSave(async () => {
      const res = await measureAction("employee.own_car_round_trip", () =>
        saveOwnCarRouteAction(itemId, { start, end, roundTrip: next, manualOneWayKm: manualOpen && manualValid ? manualNum : null }),
      );
      if (!res.ok) {
        setRoundTrip(!next); // 저장 실패 → 화면 되돌림
        onError(res.error);
      }
    });
  };

  const choose = (which: "start" | "end", p: RoutePlaceInput | null) => {
    const s = which === "start" ? p : start;
    const e = which === "end" ? p : end;
    if (which === "start") setStart(p);
    else setEnd(p);
    saveRoute({ start: s, end: e, roundTrip, manual: null });
  };

  return (
    <div className="flex flex-col gap-4">
      {/* 디지털 증빙 — 영수증 사진 자리 */}
      <div className="flex flex-col gap-2" aria-live="polite">
        {calculating ? (
          <div className="flex min-h-24 items-center justify-center gap-2 rounded-xl border border-dashed border-brand-300 bg-brand-50 text-sm text-brand-800">
            <Loader2 className="size-4 animate-spin" />
            길찾기로 거리를 계산하는 중…
          </div>
        ) : card ? (
          <>
            <RouteEvidenceCard card={card} />
            {/* 편도 금액이 먼저, 왕복은 직원이 골라서 × 2 (D-089) */}
            <button
              type="button"
              aria-pressed={roundTrip}
              onClick={() => toggleRound(!roundTrip)}
              data-saving={savingRound || undefined}
              className={`inline-flex min-h-12 items-center justify-center gap-1.5 rounded-xl border px-4 text-sm font-semibold ${roundTrip ? "border-zinc-300 bg-white text-zinc-700" : "border-brand-300 bg-brand-50 text-brand-800"}`}
            >
              {roundTrip ? "편도로 되돌리기" : `왕복으로 계산 (× 2 = ${formatWon(fuelAmount(card.oneWayKm, card.rate, true))})`}
            </button>
          </>
        ) : (
          <p className="rounded-xl border border-dashed border-zinc-300 bg-white px-4 py-4 text-center text-sm text-zinc-600">
            출발지와 도착지를 고르면 거리와 금액이 바로 계산되고, 경로 요약 카드가 증빙으로 붙어요. 내비 화면을 캡처하지 않아도 돼요.
          </p>
        )}
      </div>

      {fuel.blocked && item && (
        <p className="flex gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          {fuel.blocked === "allowance" ? "자가운전보조금을 받고 있어 자차 유류비는 청구할 수 없어요. 이 항목은 지워 주세요." : "회사에서 자차 유류비 청구를 쓰지 않아요. 이 항목은 지워 주세요."}
        </p>
      )}

      <PlaceSearch label="출발지" value={start} onSelect={(p) => choose("start", p)} placeholder="예: 판교역, 회사 이름, 주소" disabled={calculating} />
      <PlaceSearch label="도착지" value={end} onSelect={(p) => choose("end", p)} placeholder="예: 부산역, 거래처 이름, 주소" suggestion={claim.trip_destination ?? undefined} disabled={calculating} />
      {notice && <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">{notice}</p>}
      {manualOpen ? (
        <div className="flex flex-col gap-1.5 rounded-xl bg-zinc-50 p-3">
          <label htmlFor={`manual-km-${uid}`} className="text-sm font-medium">
            주행거리 직접 입력 (편도)
          </label>
          <div className="flex gap-2">
            <div className="relative min-w-0 flex-1">
              <input
                id={`manual-km-${uid}`}
                inputMode="decimal"
                className={`${inputClass} pr-10 text-right tabular-nums`}
                value={manualKm}
                placeholder="예: 128.4"
                onChange={(e) => setManualKm(e.target.value.replace(/[^0-9.]/g, "").slice(0, 7))}
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-zinc-500">km</span>
            </div>
            <button
              type="button"
              disabled={!manualValid || calculating || !start || !end}
              onClick={() => saveRoute({ start, end, roundTrip, manual: manualNum })}
              className="min-h-11 shrink-0 rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white disabled:opacity-50"
            >
              적용
            </button>
          </div>
          {manualPreview !== null && <p className="text-xs text-zinc-600 tabular-nums">{routeFormula({ roundTrip, oneWayKm: manualPreview, rate: fuel.ratePerKm })}</p>}
          <p className="text-xs text-zinc-500">직접 입력한 거리는 결재 화면에 &ldquo;직접 입력 거리&rdquo;로 표시돼요.</p>
          {item?.distance_source !== "manual" && (
            <button type="button" onClick={() => setManualOpen(false)} className="self-start text-sm text-zinc-600 underline underline-offset-2">
              자동 계산으로 돌아가기
            </button>
          )}
        </div>
      ) : (
        start &&
        end &&
        !calculating && (
          <button type="button" onClick={() => setManualOpen(true)} className="self-start text-sm text-zinc-600 underline underline-offset-2">
            실제 주행거리가 달라요 (직접 입력)
          </button>
        )
      )}

      {item && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`oc-date-${uid}`} className="text-sm font-medium text-zinc-800">
              사용일<span className="ml-0.5 text-red-600">*</span>
            </label>
            <input id={`oc-date-${uid}`} type="date" className={inputClass} value={expenseDate} onChange={(e) => setMeta({ expenseDate: e.target.value, purpose })} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`oc-purpose-${uid}`} className="text-sm font-medium text-zinc-800">
              적요 (선택)
            </label>
            <input id={`oc-purpose-${uid}`} className={inputClass} value={purpose} maxLength={200} placeholder="예: 부산 지사 미팅 이동" onChange={(e) => setMeta({ expenseDate, purpose: e.target.value })} />
          </div>
        </div>
      )}
      <p className="text-xs text-zinc-500">
        차량번호 {fuel.vehicleNumber ? <b className="text-zinc-800">{fuel.vehicleNumber}</b> : "미등록 — [내 정보]에서 등록해 주세요"} · km당 {fuel.ratePerKm.toLocaleString("ko-KR")}원 · 결제수단은 개인(사비). 주유 영수증은 필요 없어요. 통행료·주차비는 영수증으로 따로 올려 주세요.
      </p>
    </div>
  );
}
