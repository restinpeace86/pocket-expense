"use client";

import { AlertTriangle, ArrowLeft, ChevronLeft, ChevronRight, FileText, ImageOff, Loader2, Minus, Plus, RefreshCw, Sparkles, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { rereadReceiptAction, saveItemAction } from "@/app/workspace/[id]/employee/claims/actions";
import { AmountInput } from "@/components/ui/amount-input";
import { inputClass } from "@/components/ui/page-shell";
import type { EditorCard, EditorClaim, EditorItem, EvidenceType, ItemInput, PaymentMethod } from "@/lib/employee/editor-types";
import { isMealLike, itemAmounts, type MealPolicy } from "@/lib/expense/amounts";
import { CATEGORY_LABEL, PURCHASE_TYPE_LABEL, TRIP_TYPE_LABEL, type ExpenseCategory, type PurchaseType, type TripType } from "@/lib/expense/categories";
import { formatWon } from "@/lib/format";
import { measureAction } from "@/lib/perf/client";

// 화면 E-02 항목 편집 (worker-tax-processing.md §2·§3-3, smart-meal.md §4, corporate-cards.md §3)
const CATEGORIES: ExpenseCategory[] = ["meal", "trip", "meeting", "purchase"];
const CATEGORY_ICON: Record<ExpenseCategory, string> = { meal: "🍚", trip: "🧳", meeting: "🤝", purchase: "📦" };
const TRIP_TYPES: TripType[] = ["meal", "public_transport", "taxi", "toll_parking", "lodging", "other"]; // 자차 유류비는 T7
const PURCHASE_TYPES: PurchaseType[] = ["pantry", "office_supplies", "small_equipment"];
const EVIDENCE: { value: EvidenceType; label: string }[] = [
  { value: "card_slip", label: "카드매출전표" },
  { value: "cash_receipt", label: "현금영수증" },
  { value: "tax_invoice", label: "세금계산서" },
  { value: "simple_receipt", label: "간이영수증" },
  { value: "other", label: "기타" },
];

function toInput(i: EditorItem): ItemInput {
  return {
    category: i.category,
    tripType: i.trip_type,
    purchaseType: i.purchase_type,
    paymentMethod: i.payment_method,
    corporateCardId: i.corporate_card_id,
    evidenceType: i.evidence_type,
    expenseDate: i.expense_date ?? "",
    merchantName: i.merchant_name ?? "",
    merchantBusinessNumber: i.merchant_business_number ?? "",
    amount: i.amount?.toString() ?? "",
    supplyAmount: i.supply_amount?.toString() ?? "",
    vatAmount: i.vat_amount?.toString() ?? "",
    headcount: i.headcount ?? 1,
    purpose: i.purpose ?? "",
    clientName: i.client_name ?? "",
    attendees: i.attendees ?? "",
    tripStartDate: i.trip_start_date ?? "",
    tripEndDate: i.trip_end_date ?? "",
  };
}

function Field({ label, required, htmlFor, children, hint }: { label: string; required?: boolean; htmlFor?: string; children: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium text-zinc-800">
        {label}
        {required && <span className="ml-0.5 text-red-600">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-zinc-500">{hint}</p>}
    </div>
  );
}

function Chips<T extends string>({ label, options, value, onChange }: { label: string; options: { value: T; label: string }[]; value: T | null; onChange: (v: T) => void }) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`min-h-10 rounded-full border px-3.5 text-sm ${value === o.value ? "border-brand-600 bg-brand-600 font-semibold text-white" : "border-zinc-300 bg-white text-zinc-700"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Warn({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
      <AlertTriangle className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

// 식대·출장 식비 1식 한도 실시간 안내 (smart-meal.md §4)
function MealCalc({ input, policy, override }: { input: ItemInput; policy: MealPolicy; override: number | null }) {
  const amount = input.amount === "" ? null : Number(input.amount);
  const r = itemAmounts({ category: input.category, tripType: input.tripType, amount, headcount: input.headcount }, policy, override);
  if (!policy.enabled) return <p className="text-sm text-zinc-600">회사 정책: 식대 한도 없이 전액 지원해요.</p>;
  if (r.appliedLimit === null || r.totalLimit === null) return null;
  const corporate = input.paymentMethod === "corporate_card";
  return (
    <div className="flex flex-col gap-1 rounded-xl bg-zinc-50 px-3 py-2.5 text-sm">
      <p className="text-zinc-600">
        1인 한도 {formatWon(r.appliedLimit)} × {input.headcount}명 = <b className="text-zinc-900">{formatWon(r.totalLimit)}</b>
      </p>
      {amount !== null && (
        <>
          {r.appliedMode === "notify" && r.overLimit > 0 ? (
            <p className="font-medium text-orange-700">한도 초과 {formatWon(r.overLimit)} — 회사 정책상 전액 지원, 관리자에게 표시됩니다</p>
          ) : (
            <p>
              회사 지원 <b>{formatWon(r.supported ?? 0)}</b> + 개인 부담 <b className={r.burden > 0 ? "text-orange-700" : undefined}>{formatWon(r.burden)}</b>
            </p>
          )}
          <p className="text-zinc-600">
            {corporate ? (r.burden > 0 ? `개인 부담 ${formatWon(r.burden)}을 회사에 납부해야 합니다` : "추가 정산 없음") : `회사가 ${formatWon(r.supported ?? 0)}을 지급합니다`}
          </p>
        </>
      )}
    </div>
  );
}

export function ItemEditor({
  claim,
  item,
  index,
  total,
  prevId,
  nextId,
  cards,
  mealPolicy,
  mealOverride,
  originalUrl,
  base,
}: {
  claim: EditorClaim;
  item: EditorItem;
  index: number;
  total: number;
  prevId: string | null;
  nextId: string | null;
  cards: EditorCard[];
  mealPolicy: MealPolicy;
  mealOverride: number | null;
  originalUrl: string | null;
  base: string;
}) {
  const router = useRouter();
  const [input, setInput] = useState<ItemInput>(() => toInput(item));
  const [saved, setSaved] = useState(() => JSON.stringify(toInput(item)));
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(false);
  const [pending, start] = useTransition();
  const [rereading, startReread] = useTransition();
  const dirty = JSON.stringify(input) !== saved;
  const claimHref = `${base}/claims/${claim.id}/edit`;
  const itemHref = (id: string) => `${base}/claims/${claim.id}/items/${id}`;

  const set = <K extends keyof ItemInput>(k: K, v: ItemInput[K]) => setInput((f) => ({ ...f, [k]: v }));
  const setPayment = (pm: PaymentMethod) =>
    setInput((f) => ({ ...f, paymentMethod: pm, corporateCardId: pm === "corporate_card" ? (f.corporateCardId ?? (cards.length === 1 ? cards[0].id : null)) : null }));

  const go = (href: string) =>
    start(async () => {
      setError(null);
      if (dirty) {
        const res = await measureAction("employee.save_item", () => saveItemAction(item.id, input));
        if (!res.ok) {
          setError(res.error);
          return;
        }
        setSaved(JSON.stringify(input));
      }
      router.push(href);
    });

  const reread = () =>
    startReread(async () => {
      setError(null);
      // 입력 중인 값을 먼저 저장해 둔다(다시 읽기는 빈 칸만 채운다)
      if (dirty) {
        const saveRes = await saveItemAction(item.id, input);
        if (!saveRes.ok) return setError(saveRes.error);
      }
      const res = await measureAction("employee.reread_receipt", () => rereadReceiptAction(item.id));
      if (!res.ok) setError(res.error);
      else if (!res.parsed) setError("자동 인식에 실패했어요. 직접 입력해 주세요.");
    });

  const amount = input.amount === "" ? null : Number(input.amount);
  const supply = input.supplyAmount === "" ? null : Number(input.supplyAmount);
  const vat = input.vatAmount === "" ? null : Number(input.vatAmount);
  const sumMismatch = amount !== null && supply !== null && vat !== null && supply + vat !== amount;
  const outsideTrip =
    claim.is_business_trip &&
    input.category === "trip" &&
    !!input.expenseDate &&
    ((claim.trip_start_date && input.expenseDate < claim.trip_start_date) || (claim.trip_end_date && input.expenseDate > claim.trip_end_date));
  const matchedCard = item.aiCardLast4 ? cards.find((c) => c.last4 === item.aiCardLast4) : undefined;
  const mealLike = isMealLike(input.category, input.tripType);

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-5 px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-3 md:max-w-2xl">
      <div className="flex items-center justify-between gap-2">
        <button type="button" onClick={() => go(claimHref)} className="-ml-2 inline-flex min-h-11 items-center gap-1 rounded-xl px-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100">
          <ArrowLeft className="size-4" />
          소명서로
        </button>
        <span className="text-sm text-zinc-500">
          영수증 {index + 1} / {total}
        </span>
      </div>

      {/* 1. 영수증 사진 */}
      {item.receipt_path ? (
        <section className="flex items-start gap-3 rounded-2xl border border-zinc-200 bg-white p-3">
          {item.isPdf ? (
            <a href={originalUrl ?? undefined} target="_blank" rel="noreferrer" className="inline-flex size-24 shrink-0 flex-col items-center justify-center gap-1 rounded-xl bg-zinc-100 text-xs text-zinc-600">
              <FileText className="size-8" />
              PDF 열기
            </a>
          ) : item.thumbUrl || originalUrl ? (
            <button type="button" onClick={() => setZoom(true)} className="shrink-0" aria-label="영수증 크게 보기">
              {/* eslint-disable-next-line @next/next/no-img-element -- 10분짜리 서명 링크 */}
              <img src={item.thumbUrl ?? originalUrl ?? undefined} alt="영수증" className="size-24 rounded-xl border border-zinc-200 object-cover" />
            </button>
          ) : (
            <span className="inline-flex size-24 shrink-0 flex-col items-center justify-center gap-1 rounded-xl bg-zinc-100 px-1 text-center text-[11px] text-zinc-500">
              <ImageOff className="size-6" />
              사진을 불러오지 못했어요
            </span>
          )}
          <div className="flex min-w-0 flex-1 flex-col gap-2 text-sm">
            {item.parse_status === "success" && (
              <p className="inline-flex items-center gap-1 text-brand-700">
                <Sparkles className="size-4" />
                AI가 채운 값이에요. 영수증과 맞는지 확인해 주세요.
              </p>
            )}
            {(item.parse_status === "failed" || item.parse_status === "parsing") && (
              <>
                <p className="text-zinc-600">{item.parse_status === "failed" ? "자동 인식에 실패했어요. 직접 입력해 주세요." : "AI가 아직 읽지 못했어요."}</p>
                <button type="button" onClick={reread} disabled={rereading} className="inline-flex min-h-10 w-fit items-center gap-1.5 rounded-lg border border-zinc-300 px-3 text-sm hover:bg-zinc-50 disabled:opacity-60">
                  {rereading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                  AI로 다시 읽기
                </button>
              </>
            )}
          </div>
        </section>
      ) : (
        <p className="rounded-2xl border border-dashed border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-600">영수증 없이 추가한 항목이에요. 사용 내용을 직접 입력해 주세요.</p>
      )}

      {/* 2. 결제수단 (D-048, D-055) */}
      <section className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-4">
        <h2 className="font-semibold">결제수단</h2>
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="결제수단">
          {(
            [
              ["corporate_card", "💳 법인카드"],
              ["personal_card", "🧾 개인(사비)"],
            ] as [PaymentMethod, string][]
          ).map(([v, label]) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={input.paymentMethod === v}
              onClick={() => setPayment(v)}
              className={`min-h-11 rounded-xl border text-sm font-medium ${input.paymentMethod === v ? "border-brand-600 bg-brand-50 text-brand-800" : "border-zinc-300 bg-white text-zinc-700"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="text-xs text-zinc-500">{input.paymentMethod === "corporate_card" ? "회사 카드로 결제했어요. 따로 돌려받을 돈은 없어요." : "내 돈(개인카드·현금)으로 냈어요. 승인되면 회사가 돌려줘요."}</p>
        {item.aiCardLast4 && cards.length > 0 && (
          <p className="rounded-xl bg-sky-50 px-3 py-2 text-sm text-sky-800">
            {matchedCard
              ? `💳 ${matchedCard.nickname}(${matchedCard.last4})로 인식했어요.`
              : `영수증 카드 끝자리(${item.aiCardLast4})가 등록된 법인카드와 달라 개인(사비)으로 골랐어요. 법인카드였다면 바꿔 주세요.`}
          </p>
        )}
        {input.paymentMethod === "corporate_card" && cards.length > 1 && (
          <Field label="사용한 카드" htmlFor="card">
            <select id="card" className={inputClass} value={input.corporateCardId ?? ""} onChange={(e) => set("corporateCardId", e.target.value || null)}>
              <option value="">선택해 주세요</option>
              {cards.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nickname} ({c.last4})
                </option>
              ))}
            </select>
          </Field>
        )}
      </section>

      {/* 3. 영수증 정보 */}
      <section className="flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-4">
        <h2 className="font-semibold">영수증 정보</h2>
        <Field label="가맹점명" required htmlFor="merchant">
          <input id="merchant" className={inputClass} value={input.merchantName} maxLength={100} placeholder="예: 스타벅스 강남점" onChange={(e) => set("merchantName", e.target.value)} />
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="사용일자" required htmlFor="date">
            <input id="date" type="date" className={inputClass} value={input.expenseDate} onChange={(e) => set("expenseDate", e.target.value)} />
          </Field>
          <Field label="합계 금액" required>
            <AmountInput name="amount" ariaLabel="합계 금액" value={input.amount} onChange={(v) => set("amount", v)} />
          </Field>
        </div>
        {outsideTrip && <Warn>출장 기간 밖의 날짜예요. 날짜를 확인해 주세요(그대로 상신할 수도 있어요).</Warn>}
        <details className="group rounded-xl bg-zinc-50 px-3 py-2" open={!!(input.merchantBusinessNumber || input.supplyAmount || input.vatAmount) || undefined}>
          <summary className="flex min-h-10 cursor-pointer list-none items-center text-sm font-medium text-zinc-700 [&::-webkit-details-marker]:hidden">
            사업자등록번호·공급가액·부가세 <span className="ml-1 text-xs font-normal text-zinc-500">(세무사 전달용 · AI가 채워요)</span>
          </summary>
          <div className="mt-2 flex flex-col gap-3 pb-2">
            <Field label="가맹점 사업자등록번호" htmlFor="bn">
              <input id="bn" className={inputClass} inputMode="numeric" value={input.merchantBusinessNumber} maxLength={12} placeholder="숫자 10자리" onChange={(e) => set("merchantBusinessNumber", e.target.value.replace(/[^0-9-]/g, ""))} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="공급가액">
                <AmountInput name="supply" ariaLabel="공급가액" value={input.supplyAmount} onChange={(v) => set("supplyAmount", v)} />
              </Field>
              <Field label="부가세">
                <AmountInput name="vat" ariaLabel="부가세" value={input.vatAmount} onChange={(v) => set("vatAmount", v)} />
              </Field>
            </div>
            {sumMismatch && <Warn>공급가액 + 부가세가 합계 금액과 달라요. 영수증을 확인해 주세요.</Warn>}
          </div>
        </details>
        <Field label="증빙 구분" required>
          <Chips label="증빙 구분" options={EVIDENCE} value={input.evidenceType} onChange={(v) => set("evidenceType", v)} />
        </Field>
        {item.aiIncomeDeduction && input.evidenceType === "cash_receipt" && <Warn>소득공제용 현금영수증이에요. 지출증빙용이 아니라 회사 경비 처리 시 불이익이 있을 수 있어요.</Warn>}
      </section>

      {/* 4. 카테고리 + 조건부 항목 */}
      <section className="flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-4">
        <h2 className="font-semibold">
          지출 카테고리<span className="ml-0.5 text-red-600">*</span>
        </h2>
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="지출 카테고리">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={input.category === c}
              onClick={() => setInput((f) => ({ ...f, category: c, tripType: c === "trip" ? f.tripType : null, purchaseType: c === "purchase" ? f.purchaseType : null }))}
              className={`min-h-12 rounded-xl border px-2 text-sm font-medium ${input.category === c ? "border-brand-600 bg-brand-50 text-brand-800" : "border-zinc-300 bg-white text-zinc-700"}`}
            >
              {CATEGORY_ICON[c]} {CATEGORY_LABEL[c]}
            </button>
          ))}
        </div>
        {input.category === "trip" && (
          <Field label="출장비 세부 유형" required>
            <Chips label="출장비 세부 유형" options={TRIP_TYPES.map((t) => ({ value: t, label: TRIP_TYPE_LABEL[t] }))} value={input.tripType} onChange={(v) => set("tripType", v)} />
          </Field>
        )}
        {input.category === "purchase" && (
          <>
            <Field label="구매 세부 유형" required>
              <Chips label="구매 세부 유형" options={PURCHASE_TYPES.map((t) => ({ value: t, label: PURCHASE_TYPE_LABEL[t] }))} value={input.purchaseType} onChange={(v) => set("purchaseType", v)} />
            </Field>
            <Field label="구매 목적·품목" required htmlFor="purpose" hint="회사 물품은 전액 지원돼요.">
              <input id="purpose" className={inputClass} value={input.purpose} maxLength={200} placeholder="예: 탕비실 커피·생수" onChange={(e) => set("purpose", e.target.value)} />
            </Field>
          </>
        )}
        {input.category === "meeting" && (
          <>
            <Field label="미팅 목적" required htmlFor="purpose">
              <input id="purpose" className={inputClass} value={input.purpose} maxLength={200} placeholder="예: A사 신규 계약 협의" onChange={(e) => set("purpose", e.target.value)} />
            </Field>
            <Field label="거래처명" htmlFor="client">
              <input id="client" className={inputClass} value={input.clientName} maxLength={100} placeholder="예: (주)에이컴퍼니" onChange={(e) => set("clientName", e.target.value)} />
            </Field>
            <Field label="참석자" htmlFor="attendees">
              <input id="attendees" className={inputClass} value={input.attendees} maxLength={200} placeholder="예: A사 김부장, 우리 회사 박과장" onChange={(e) => set("attendees", e.target.value)} />
            </Field>
          </>
        )}
        {input.category === "trip" && input.tripType === "lodging" && (
          <Field label="숙박 기간 (체크인 ~ 체크아웃)" required>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-center">
              <input type="date" aria-label="체크인" className={`${inputClass} min-w-0`} value={input.tripStartDate} onChange={(e) => set("tripStartDate", e.target.value)} />
              <span className="hidden text-zinc-500 sm:inline">~</span>
              <input type="date" aria-label="체크아웃" className={`${inputClass} min-w-0`} value={input.tripEndDate} min={input.tripStartDate || undefined} onChange={(e) => set("tripEndDate", e.target.value)} />
            </div>
          </Field>
        )}
        {input.category === "trip" && input.tripType === "other" && (
          <Field label="적요" required htmlFor="purpose">
            <input id="purpose" className={inputClass} value={input.purpose} maxLength={200} placeholder="예: 출장 중 자료 출력비" onChange={(e) => set("purpose", e.target.value)} />
          </Field>
        )}
        {(mealLike || input.category === "meeting") && (
          <Field label="인원수" required>
            <div className="flex items-center gap-3">
              <button type="button" aria-label="인원 줄이기" disabled={input.headcount <= 1} onClick={() => set("headcount", Math.max(1, input.headcount - 1))} className="inline-flex size-11 items-center justify-center rounded-xl border border-zinc-300 bg-white disabled:opacity-40">
                <Minus className="size-4" />
              </button>
              <span className="min-w-12 text-center text-lg font-semibold tabular-nums" aria-live="polite">
                {input.headcount}명
              </span>
              <button type="button" aria-label="인원 늘리기" disabled={input.headcount >= 99} onClick={() => set("headcount", Math.min(99, input.headcount + 1))} className="inline-flex size-11 items-center justify-center rounded-xl border border-zinc-300 bg-white disabled:opacity-40">
                <Plus className="size-4" />
              </button>
            </div>
          </Field>
        )}
        {mealLike && <MealCalc input={input} policy={mealPolicy} override={mealOverride} />}
      </section>

      {zoom && originalUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4" role="dialog" aria-modal aria-label="영수증 크게 보기" onClick={() => setZoom(false)}>
          <button type="button" aria-label="닫기" className="absolute right-3 top-3 inline-flex size-11 items-center justify-center rounded-full bg-white/15 text-white">
            <X className="size-5" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element -- 10분짜리 서명 링크 */}
          <img src={originalUrl} alt="영수증 원본" className="max-h-full max-w-full object-contain" />
        </div>
      )}

      {/* 하단: 이전 / 다음 / 완료 (§3-3 6) */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-zinc-200 bg-white/95 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur">
        <div className="mx-auto flex max-w-md flex-col gap-2 md:max-w-2xl">
          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
              {error}
            </p>
          )}
          <div className="grid grid-cols-[auto_1fr_auto] gap-2">
            <button type="button" disabled={!prevId || pending} onClick={() => prevId && go(itemHref(prevId))} aria-label="이전 영수증" className="inline-flex min-h-12 min-w-12 items-center justify-center rounded-xl border border-zinc-300 bg-white disabled:opacity-40">
              <ChevronLeft className="size-5" />
            </button>
            <button type="button" disabled={pending} onClick={() => go(nextId ? itemHref(nextId) : claimHref)} className="inline-flex min-h-12 items-center justify-center gap-1.5 rounded-xl bg-brand-600 font-semibold text-white hover:bg-brand-700 disabled:opacity-70">
              {pending && <Loader2 className="size-4 animate-spin" />}
              {nextId ? "저장하고 다음 영수증" : "저장하고 완료"}
            </button>
            <button type="button" disabled={!nextId || pending} onClick={() => nextId && go(itemHref(nextId))} aria-label="다음 영수증" className="inline-flex min-h-12 min-w-12 items-center justify-center rounded-xl border border-zinc-300 bg-white disabled:opacity-40">
              <ChevronRight className="size-5" />
            </button>
          </div>
          <Link href={claimHref} className="sr-only">
            소명서로 돌아가기
          </Link>
        </div>
      </div>
    </main>
  );
}
