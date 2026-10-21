"use client";

import { ArrowLeft, ChevronLeft, ChevronRight, Loader2, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { saveOwnCarItemAction, saveOwnCarRouteAction } from "@/app/workspace/[id]/employee/claims/actions";
import { RouteEvidenceCard } from "@/components/claims/route-evidence-card";
import { PlaceSearch } from "@/components/employee/place-search";
import { inputClass } from "@/components/ui/page-shell";
import type { EditorClaim, EditorItem, FuelPolicy, RoutePlaceInput } from "@/lib/employee/editor-types";
import { fuelAmount, routeCardFrom, routeFormula } from "@/lib/expense/route";
import { measureAction } from "@/lib/perf/client";

// 자차 유류비 항목 (trip-expense.md §4, D-069, D-085)
// 출발지·도착지를 고르면 서버가 Kakao 길찾기로 편도 거리를 구하고, 거리 × 회사 km당 단가로 금액을 정한다(직원이 금액을 넣지 않음).
// 결과는 '출장 경로 및 거리 산정 요약' 카드로 영수증 자리에 붙는다. 길찾기가 안 되면 주행거리를 직접 입력한다(직접 입력 거리로 표시).
const toPlace = (name: string | null, lat: number | null, lng: number | null, address: unknown): RoutePlaceInput | null =>
  name && lat != null && lng != null ? { name, lat: Number(lat), lng: Number(lng), address: typeof address === "string" ? address : null } : null;

export function OwnCarEditor({
  claim,
  item,
  index,
  total,
  prevId,
  nextId,
  fuel,
  base,
}: {
  claim: EditorClaim;
  item: EditorItem;
  index: number;
  total: number;
  prevId: string | null;
  nextId: string | null;
  fuel: FuelPolicy;
  base: string;
}) {
  const router = useRouter();
  const ev = (item.route_evidence && typeof item.route_evidence === "object" ? item.route_evidence : {}) as Record<string, unknown>;
  const [start, setStart] = useState<RoutePlaceInput | null>(() => toPlace(item.start_location, item.start_lat, item.start_lng, ev.start_address));
  const [end, setEnd] = useState<RoutePlaceInput | null>(() => toPlace(item.end_location, item.end_lat, item.end_lng, ev.end_address));
  const [roundTrip, setRoundTrip] = useState(item.is_round_trip !== false);
  const [manualOpen, setManualOpen] = useState(item.distance_source === "manual");
  const [manualKm, setManualKm] = useState(item.distance_source === "manual" && item.route_one_way_km != null ? String(item.route_one_way_km) : "");
  const [expenseDate, setExpenseDate] = useState(item.expense_date ?? "");
  const [purpose, setPurpose] = useState(item.purpose ?? "");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [calculating, startCalc] = useTransition();
  const [pending, start_] = useTransition();
  const claimHref = `${base}/claims/${claim.id}/edit`;
  const itemHref = (id: string) => `${base}/claims/${claim.id}/items/${id}`;
  const card = routeCardFrom(item, fuel.ratePerKm);
  const metaDirty = expenseDate !== (item.expense_date ?? "") || purpose !== (item.purpose ?? "");

  // 장소·왕복·직접 입력 거리를 서버에 저장(저장 뒤 화면은 새 거리·금액으로 다시 그려진다)
  function saveRoute(next: { start: RoutePlaceInput | null; end: RoutePlaceInput | null; roundTrip: boolean; manual: number | null }) {
    startCalc(async () => {
      setError(null);
      setNotice(null);
      const res = await measureAction("employee.own_car_route", () =>
        saveOwnCarRouteAction(item.id, { start: next.start, end: next.end, roundTrip: next.roundTrip, manualOneWayKm: next.manual }),
      );
      if (!res.ok) return setError(res.error);
      if (res.autoFailed) {
        setManualOpen(true);
        setNotice("거리를 자동으로 계산하지 못했어요. 주행거리(편도)를 직접 입력해 주세요.");
      }
      router.refresh();
    });
  }

  const choose = (which: "start" | "end") => (p: RoutePlaceInput | null) => {
    const s = which === "start" ? p : start;
    const e = which === "end" ? p : end;
    if (which === "start") setStart(p);
    else setEnd(p);
    saveRoute({ start: s, end: e, roundTrip, manual: null });
  };

  const go = (href: string) =>
    start_(async () => {
      setError(null);
      if (metaDirty) {
        const res = await measureAction("employee.save_item", () => saveOwnCarItemAction(item.id, { expenseDate, purpose }));
        if (!res.ok) return setError(res.error);
      }
      router.push(href);
    });

  const manualNum = Number(manualKm);
  const manualValid = manualKm !== "" && Number.isFinite(manualNum) && manualNum > 0 && manualNum <= 5000;
  const manualPreview = manualValid ? Math.round(manualNum * 10) / 10 : null;

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-5 px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-3 md:max-w-2xl">
      <div className="flex items-center justify-between gap-2">
        <button type="button" onClick={() => go(claimHref)} className="-ml-2 inline-flex min-h-11 items-center gap-1 rounded-xl px-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100">
          <ArrowLeft className="size-4" />
          결의서로
        </button>
        <span className="text-sm text-zinc-500">
          항목 {index + 1} / {total}
        </span>
      </div>

      {/* 1. 디지털 증빙 — 영수증 사진 자리 */}
      <section className="flex flex-col gap-2" aria-live="polite">
        <h1 className="text-lg font-bold">🚗 자차 유류비</h1>
        {calculating ? (
          <div className="flex min-h-32 items-center justify-center gap-2 rounded-xl border border-dashed border-brand-300 bg-brand-50 text-sm text-brand-800">
            <Loader2 className="size-4 animate-spin" />
            길찾기로 거리를 계산하는 중…
          </div>
        ) : card ? (
          <RouteEvidenceCard card={card} />
        ) : (
          <p className="rounded-xl border border-dashed border-zinc-300 bg-white px-4 py-6 text-center text-sm text-zinc-600">
            출발지와 도착지를 고르면 거리와 금액이 자동으로 계산되고,
            <br />
            경로 요약 카드가 증빙으로 붙어요. 내비 화면을 캡처하지 않아도 돼요.
          </p>
        )}
      </section>

      {fuel.blocked && (
        <p className="flex gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          {fuel.blocked === "allowance" ? "자가운전보조금을 받고 있어 자차 유류비는 청구할 수 없어요. 이 항목은 지워 주세요." : "회사에서 자차 유류비 청구를 쓰지 않아요. 이 항목은 지워 주세요."}
        </p>
      )}

      {/* 2. 경로 */}
      <section className="flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-4">
        <h2 className="font-semibold">경로</h2>
        <PlaceSearch label="출발지" value={start} onSelect={choose("start")} placeholder="예: 판교역, 회사 이름, 주소" disabled={calculating} />
        <PlaceSearch label="도착지" value={end} onSelect={choose("end")} placeholder="예: 부산역, 거래처 이름, 주소" suggestion={claim.trip_destination ?? undefined} disabled={calculating} />
        <label className="flex min-h-11 items-center gap-3">
          <input
            type="checkbox"
            className="size-5"
            checked={roundTrip}
            disabled={calculating}
            onChange={(e) => {
              setRoundTrip(e.target.checked);
              saveRoute({ start, end, roundTrip: e.target.checked, manual: manualOpen && manualValid ? manualNum : null });
            }}
          />
          <span>
            <span className="font-medium">왕복</span>
            <span className="block text-xs text-zinc-500">갔다가 돌아왔으면 켜 두세요. 거리 × 2로 계산해요.</span>
          </span>
        </label>
        {notice && <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">{notice}</p>}
        {manualOpen ? (
          <div className="flex flex-col gap-1.5 rounded-xl bg-zinc-50 p-3">
            <label htmlFor="manual-km" className="text-sm font-medium">
              주행거리 직접 입력 (편도)
            </label>
            <div className="flex gap-2">
              <div className="relative min-w-0 flex-1">
                <input
                  id="manual-km"
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
            {manualPreview !== null && (
              <p className="text-xs text-zinc-600 tabular-nums">
                {routeFormula({
                  roundTrip,
                  oneWayKm: manualPreview,
                  totalKm: roundTrip ? manualPreview * 2 : manualPreview,
                  rate: fuel.ratePerKm,
                  amount: fuelAmount(roundTrip ? manualPreview * 2 : manualPreview, fuel.ratePerKm),
                })}
              </p>
            )}
            <p className="text-xs text-zinc-500">직접 입력한 거리는 결재 화면에 &ldquo;직접 입력 거리&rdquo;로 표시돼요.</p>
            {item.distance_source !== "manual" && (
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
      </section>

      {/* 3. 사용일·적요·차량 */}
      <section className="flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="oc-date" className="text-sm font-medium text-zinc-800">
            사용일<span className="ml-0.5 text-red-600">*</span>
          </label>
          <input id="oc-date" type="date" className={inputClass} value={expenseDate} onChange={(e) => setExpenseDate(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="oc-purpose" className="text-sm font-medium text-zinc-800">
            적요 (선택)
          </label>
          <input id="oc-purpose" className={inputClass} value={purpose} maxLength={200} placeholder="예: 부산 지사 미팅 이동" onChange={(e) => setPurpose(e.target.value)} />
        </div>
        <p className="text-sm text-zinc-600">
          차량번호 {fuel.vehicleNumber ? <b className="text-zinc-900">{fuel.vehicleNumber}</b> : <span>미등록 — [내 정보]에서 등록해 주세요</span>} · km당 {fuel.ratePerKm.toLocaleString("ko-KR")}원 · 결제수단은 개인(사비)
        </p>
        <p className="text-xs text-zinc-500">주유 영수증은 필요 없어요. 통행료·주차비는 영수증으로 따로 올려 주세요.</p>
      </section>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-zinc-200 bg-white/95 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur">
        <div className="mx-auto flex max-w-md flex-col gap-2 md:max-w-2xl">
          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
              {error}
            </p>
          )}
          <div className="grid grid-cols-[auto_1fr_auto] gap-2">
            <button type="button" disabled={!prevId || pending} onClick={() => prevId && go(itemHref(prevId))} aria-label="이전 항목" className="inline-flex min-h-12 min-w-12 items-center justify-center rounded-xl border border-zinc-300 bg-white disabled:opacity-40">
              <ChevronLeft className="size-5" />
            </button>
            <button type="button" disabled={pending || calculating} onClick={() => go(nextId ? itemHref(nextId) : claimHref)} className="inline-flex min-h-12 items-center justify-center gap-1.5 rounded-xl bg-brand-600 font-semibold text-white hover:bg-brand-700 disabled:opacity-70">
              {pending && <Loader2 className="size-4 animate-spin" />}
              {nextId ? "저장하고 다음 항목" : "저장하고 완료"}
            </button>
            <button type="button" disabled={!nextId || pending} onClick={() => nextId && go(itemHref(nextId))} aria-label="다음 항목" className="inline-flex min-h-12 min-w-12 items-center justify-center rounded-xl border border-zinc-300 bg-white disabled:opacity-40">
              <ChevronRight className="size-5" />
            </button>
          </div>
          <Link href={claimHref} className="sr-only">
            결의서로 돌아가기
          </Link>
        </div>
      </div>
    </main>
  );
}
