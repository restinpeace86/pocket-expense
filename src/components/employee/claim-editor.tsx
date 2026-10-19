"use client";

import { ArrowLeft, Camera, FileText, ImageIcon, Loader2, PenLine, Plus, ReceiptText, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { createManualItemAction, deleteDraftClaimAction, deleteItemAction, saveClaimHeaderAction } from "@/app/workspace/[id]/employee/claims/actions";
import { inputClass } from "@/components/ui/page-shell";
import type { ClaimHeaderInput, EditorData, EditorItem, PaymentMethod } from "@/lib/employee/editor-types";
import { CATEGORY_LABEL, PURCHASE_TYPE_LABEL, TRIP_TYPE_LABEL } from "@/lib/expense/categories";
import { claimStatusBadge } from "@/lib/expense/status";
import { suggestTitle } from "@/lib/expense/title";
import { formatWon } from "@/lib/format";
import { measureAction } from "@/lib/perf/client";
import { MAX_PER_CLAIM, useReceiptUpload, type UploadRow } from "./use-receipt-upload";

// 화면 E-02 지출소명서 작성 (spec/screens/worker-tax-processing.md §1·§3-1·§3-2·§3-4·§4)

// 휴대폰·태블릿(손가락 터치)에서만 카메라 촬영을 보여 준다 (workspace-architecture.md §2.C)
function useTouchDevice() {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia("(pointer: coarse)");
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia("(pointer: coarse)").matches,
    () => false,
  );
}

export function itemNeedsCheck(item: EditorItem): boolean {
  if (item.parse_status === "failed") return true;
  if (item.amount === null || !item.expense_date || !item.category || !item.evidence_type) return true;
  if (item.category === "trip" && !item.trip_type) return true;
  if (item.category === "purchase" && !item.purchase_type) return true;
  return false;
}

function itemTypeLabel(item: EditorItem): string | null {
  if (!item.category) return null;
  if (item.category === "trip" && item.trip_type) return `${CATEGORY_LABEL.trip} · ${TRIP_TYPE_LABEL[item.trip_type]}`;
  if (item.category === "purchase" && item.purchase_type) return PURCHASE_TYPE_LABEL[item.purchase_type];
  return CATEGORY_LABEL[item.category];
}

function Thumb({ item }: { item: EditorItem }) {
  const cls = "size-12 shrink-0 rounded-lg border border-zinc-200 bg-zinc-50 object-cover";
  if (item.thumbUrl) {
    // eslint-disable-next-line @next/next/no-img-element -- 10분짜리 서명 링크라 next/image 최적화 대상이 아니다
    return <img src={item.thumbUrl} alt="" className={cls} />;
  }
  return (
    <span className={`${cls} inline-flex items-center justify-center text-zinc-400`}>
      {item.isPdf ? <FileText className="size-5" /> : item.receipt_path ? <ImageIcon className="size-5" /> : <PenLine className="size-5" />}
    </span>
  );
}

function ItemRow({ item, href, onOpen, onDelete }: { item: EditorItem; href: string; onOpen: (href: string) => void; onDelete: () => void }) {
  const [confirm, setConfirm] = useState(false);
  const check = itemNeedsCheck(item);
  const parsing = item.parse_status === "parsing";
  return (
    <li className="flex items-center gap-2 rounded-2xl border border-zinc-200 bg-white p-3">
      <a
        href={href}
        onClick={(e) => {
          e.preventDefault();
          onOpen(href);
        }}
        className="flex min-w-0 flex-1 items-center gap-3"
      >
        <Thumb item={item} />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{item.merchant_name || (parsing ? "읽는 중…" : "가맹점 미입력")}</span>
          <span className="block truncate text-xs text-zinc-500">
            {[item.expense_date?.replaceAll("-", "."), itemTypeLabel(item)].filter(Boolean).join(" · ") || "날짜·카테고리 미입력"}
          </span>
          <span className="mt-1 flex flex-wrap items-center gap-1.5">
            <span className="mr-auto font-semibold tabular-nums">{item.amount !== null ? formatWon(item.amount) : "금액 미입력"}</span>
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${item.payment_method === "corporate_card" ? "bg-sky-100 text-sky-800" : "bg-orange-100 text-orange-800"}`}>
              {item.payment_method === "corporate_card" ? "💳 법인" : "🧾 사비"}
            </span>
            {parsing ? (
              <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] text-zinc-600">분석 중</span>
            ) : check ? (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">확인 필요</span>
            ) : (
              <span className="rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-medium text-green-700">입력 완료</span>
            )}
          </span>
        </span>
      </a>
      {confirm ? (
        <span className="flex shrink-0 flex-col gap-1">
          <button type="button" onClick={onDelete} className="min-h-9 rounded-lg bg-red-600 px-2.5 text-xs font-semibold text-white">
            삭제
          </button>
          <button type="button" onClick={() => setConfirm(false)} className="min-h-9 rounded-lg border border-zinc-300 px-2.5 text-xs">
            취소
          </button>
        </span>
      ) : (
        <button type="button" onClick={() => setConfirm(true)} aria-label="이 영수증 삭제" className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl text-zinc-400 hover:bg-zinc-100 hover:text-red-600">
          <Trash2 className="size-5" />
        </button>
      )}
    </li>
  );
}

function UploadingRow({ row, onDismiss }: { row: UploadRow; onDismiss: () => void }) {
  const label = { preparing: "사진을 준비하고 있어요…", uploading: "올리는 중…", reading: "AI가 영수증을 읽고 있어요… 🪄", failed: row.error ?? "올리지 못했어요" }[row.phase];
  return (
    <li className={`flex items-center gap-3 rounded-2xl border p-3 ${row.phase === "failed" ? "border-red-200 bg-red-50" : "border-zinc-200 bg-white"}`} aria-live="polite">
      <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-400">
        {row.phase === "failed" ? <X className="size-5 text-red-500" /> : <Loader2 className="size-5 animate-spin" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{row.name}</span>
        <span className={`block text-xs ${row.phase === "failed" ? "text-red-700" : "text-zinc-500"}`}>{label}</span>
      </span>
      {row.phase === "failed" && (
        <button type="button" onClick={onDismiss} className="min-h-9 shrink-0 rounded-lg border border-red-200 bg-white px-2.5 text-xs">
          닫기
        </button>
      )}
    </li>
  );
}

function AddSheet({
  touch,
  remaining,
  onCamera,
  onGallery,
  onManual,
  onClose,
}: {
  touch: boolean;
  remaining: number;
  onCamera: () => void;
  onGallery: () => void;
  onManual: () => void;
  onClose: () => void;
}) {
  const btn = "flex min-h-14 w-full items-center gap-3 rounded-xl border border-zinc-200 bg-white px-4 text-left font-medium hover:bg-zinc-50";
  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal aria-labelledby="add-sheet-title">
      <button type="button" className="absolute inset-0 bg-black/40" aria-label="닫기" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 mx-auto flex max-w-md flex-col gap-2 rounded-t-2xl bg-zinc-50 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 id="add-sheet-title" className="font-semibold">
            영수증 추가 <span className="text-sm font-normal text-zinc-500">({remaining}장 더 담을 수 있어요)</span>
          </h2>
          <button type="button" onClick={onClose} aria-label="닫기" className="-mr-2 inline-flex size-11 items-center justify-center rounded-xl hover:bg-zinc-200">
            <X className="size-5" />
          </button>
        </div>
        {touch && (
          <button type="button" className={btn} onClick={onCamera} disabled={remaining === 0}>
            <Camera className="size-5 text-brand-700" />
            <span>
              카메라로 직접 촬영
              <span className="block text-xs font-normal text-zinc-500">종이 영수증·택시 영수증</span>
            </span>
          </button>
        )}
        <button type="button" className={btn} onClick={onGallery} disabled={remaining === 0}>
          <ImageIcon className="size-5 text-brand-700" />
          <span>
            {touch ? "갤러리에서 불러오기" : "사진·PDF 파일 선택"}
            <span className="block text-xs font-normal text-zinc-500">배달앱 캡처·KTX 예매증·PDF 영수증 · 한 번에 10장까지</span>
          </span>
        </button>
        <button type="button" className={btn} onClick={onManual} disabled={remaining === 0}>
          <PenLine className="size-5 text-brand-700" />
          <span>
            영수증 없이 항목 추가
            <span className="block text-xs font-normal text-zinc-500">영수증을 잃어버렸거나 받지 못한 경우</span>
          </span>
        </button>
        {!touch && <p className="px-1 text-xs text-zinc-500">카메라 촬영은 모바일에서 사용 가능합니다.</p>}
      </div>
    </div>
  );
}

function Label({ children, required, htmlFor }: { children: React.ReactNode; required?: boolean; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="text-sm font-medium text-zinc-800">
      {children}
      {required && <span className="ml-0.5 text-red-600">*</span>}
    </label>
  );
}

export function ClaimEditor({ data, base, openAdd }: { data: EditorData; base: string; openAdd: boolean }) {
  const { claim, items } = data;
  const router = useRouter();
  const touch = useTouchDevice();
  const initial: ClaimHeaderInput = useMemo(
    () => ({
      title: claim.title,
      description: claim.description ?? "",
      defaultPaymentMethod: claim.default_payment_method,
      isBusinessTrip: claim.is_business_trip,
      tripDestination: claim.trip_destination ?? "",
      tripStartDate: claim.trip_start_date ?? "",
      tripEndDate: claim.trip_end_date ?? "",
      tripPurpose: claim.trip_purpose ?? "",
    }),
    [claim],
  );
  const [form, setForm] = useState<ClaimHeaderInput>(initial);
  const [titleTouched, setTitleTouched] = useState(claim.title !== "");
  const [savedForm, setSavedForm] = useState<ClaimHeaderInput>(initial);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [sheet, setSheet] = useState(openAdd && items.length === 0);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saving, startSave] = useTransition();
  const [busy, startBusy] = useTransition();
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const uploader = useReceiptUpload(claim.id, items.length);

  // ?add=1은 처음 한 번만 (뒤로 가기·새로고침 때 시트가 다시 열리지 않게)
  useEffect(() => {
    if (openAdd) window.history.replaceState(null, "", window.location.pathname);
  }, [openAdd]);

  const suggestion = suggestTitle({ isBusinessTrip: form.isBusinessTrip, tripDestination: form.tripDestination, tripStartDate: form.tripStartDate || null }, items);
  const title = titleTouched ? form.title : suggestion;
  const current = { ...form, title };
  const dirty = JSON.stringify(current) !== JSON.stringify(savedForm);
  const uploadingIds = new Set(uploader.rows.map((r) => r.itemId).filter(Boolean));
  const visibleItems = items.filter((i) => !uploadingIds.has(i.id));
  const editable = claim.status === "draft" || claim.status === "rejected";
  const badge = claimStatusBadge(claim.status);

  // 정산 미리보기 (§3-4): 서버가 저장한 항목 금액 기준
  const payout = items.filter((i) => i.payment_method === "personal_card").reduce((s, i) => s + (i.company_supported_amount ?? 0), 0);
  const corporateOver = items.filter((i) => i.payment_method === "corporate_card").reduce((s, i) => s + i.personal_burden_amount, 0);

  const set = <K extends keyof ClaimHeaderInput>(k: K, v: ClaimHeaderInput[K]) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    const res = await measureAction("employee.save_claim", () => saveClaimHeaderAction(claim.id, current));
    if (res.ok) {
      setSavedForm(current);
      setForm(current);
      setTitleTouched(true);
      setMessage({ kind: "ok", text: "임시저장했어요. 다른 기기(PC)에서도 이어서 쓸 수 있어요." });
    } else {
      setMessage({ kind: "error", text: res.error });
    }
    return res.ok;
  };

  // 항목 화면으로 가기 전에 바뀐 헤더를 먼저 저장한다
  const openItem = (href: string) =>
    startBusy(async () => {
      if (dirty && !(await save())) return;
      router.push(href);
    });

  const addManual = () =>
    startBusy(async () => {
      setSheet(false);
      if (dirty && !(await save())) return;
      const res = await measureAction("employee.add_manual_item", () => createManualItemAction(claim.id));
      if (res.ok) router.push(`${base}/claims/${claim.id}/items/${res.itemId}`);
      else setMessage({ kind: "error", text: res.error });
    });

  const removeItem = (itemId: string) =>
    startBusy(async () => {
      const res = await deleteItemAction(itemId);
      if (!res.ok) setMessage({ kind: "error", text: res.error });
      router.refresh();
    });

  const pick = (input: HTMLInputElement | null) => {
    setSheet(false);
    input?.click();
  };

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-5 px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-3 md:max-w-2xl">
      <div className="flex items-center justify-between gap-2">
        <Link href={base} className="-ml-2 inline-flex min-h-11 items-center gap-1 rounded-xl px-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100">
          <ArrowLeft className="size-4" />내 소명서
        </Link>
        <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}>{badge.label}</span>
      </div>

      {claim.status === "rejected" && (
        <section className="rounded-2xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-semibold text-red-700">반려 사유</p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-red-700">{claim.rejection_reason || "사유가 적혀 있지 않아요. 관리자에게 확인해 주세요."}</p>
        </section>
      )}

      <section className="flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-4">
        <h1 className="text-lg font-bold">지출소명서</h1>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="claim-title" required>
            제목
          </Label>
          <input
            id="claim-title"
            className={inputClass}
            value={title}
            maxLength={100}
            placeholder="예: 클라이언트 미팅 간식 구입"
            onChange={(e) => {
              setTitleTouched(true);
              set("title", e.target.value);
            }}
          />
          {!titleTouched && suggestion && <p className="text-xs text-zinc-500">영수증 내용으로 자동 제안했어요. 고쳐 써도 돼요.</p>}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="claim-desc" required>
            소명 내용
          </Label>
          <textarea
            id="claim-desc"
            className={`${inputClass} min-h-20 py-2`}
            value={form.description}
            maxLength={1000}
            placeholder="예: A사 프로젝트 킥오프 미팅 시 참석자 음료 제공"
            onChange={(e) => set("description", e.target.value)}
          />
          <p className="text-xs text-zinc-500">관리자가 &ldquo;이 돈을 왜 썼지?&rdquo; 하고 묻지 않도록 한 줄로 적어 주세요.</p>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-zinc-800">결제수단 기본값</span>
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="결제수단 기본값">
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
                aria-checked={form.defaultPaymentMethod === v}
                onClick={() => set("defaultPaymentMethod", v)}
                className={`min-h-11 rounded-xl border text-sm font-medium ${form.defaultPaymentMethod === v ? "border-brand-600 bg-brand-50 text-brand-800" : "border-zinc-300 bg-white text-zinc-700"}`}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="text-xs text-zinc-500">새로 올리는 영수증에 먼저 적용돼요. 영수증마다 바꿀 수 있어요.</p>
        </div>
        <div className="flex flex-col gap-3 rounded-xl bg-zinc-50 p-3">
          <label className="flex min-h-11 items-center justify-between gap-3">
            <span>
              <span className="text-sm font-medium">출장 경비</span>
              <span className="block text-xs text-zinc-500">켜면 올리는 영수증이 출장비로 분류돼요.</span>
            </span>
            <input type="checkbox" role="switch" className="peer sr-only" checked={form.isBusinessTrip} onChange={(e) => set("isBusinessTrip", e.target.checked)} />
            <span aria-hidden className="relative h-7 w-12 shrink-0 rounded-full bg-zinc-300 transition peer-checked:bg-brand-600 peer-focus-visible:ring-2 peer-focus-visible:ring-brand-500 after:absolute after:left-1 after:top-1 after:size-5 after:rounded-full after:bg-white after:transition peer-checked:after:translate-x-5" />
          </label>
          {form.isBusinessTrip && (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="trip-dest" required>
                  출장지
                </Label>
                <input id="trip-dest" className={inputClass} value={form.tripDestination} maxLength={100} placeholder="예: 부산" onChange={(e) => set("tripDestination", e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-zinc-800">
                  출장 기간<span className="ml-0.5 text-red-600">*</span>
                </span>
                {/* 휴대폰에서는 날짜 칸 두 개를 위아래로 (가로로 두면 폭을 넘는다) */}
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-center">
                  <input type="date" aria-label="출장 시작일" className={`${inputClass} min-w-0`} value={form.tripStartDate} onChange={(e) => set("tripStartDate", e.target.value)} />
                  <span className="hidden text-zinc-500 sm:inline">~</span>
                  <input type="date" aria-label="출장 종료일" className={`${inputClass} min-w-0`} value={form.tripEndDate} min={form.tripStartDate || undefined} onChange={(e) => set("tripEndDate", e.target.value)} />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="trip-purpose" required>
                  출장 목적
                </Label>
                <input id="trip-purpose" className={inputClass} value={form.tripPurpose} maxLength={100} placeholder="예: 부산 지사 분기 점검" onChange={(e) => set("tripPurpose", e.target.value)} />
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">
            영수증 <span className="text-sm font-normal text-zinc-500">{items.length}/{MAX_PER_CLAIM}장</span>
          </h2>
          {editable && (
            <button
              type="button"
              onClick={() => setSheet(true)}
              disabled={uploader.remaining === 0}
              className="inline-flex min-h-11 items-center gap-1 rounded-xl border border-brand-600 px-3 text-sm font-semibold text-brand-700 hover:bg-brand-50 disabled:opacity-50"
            >
              <Plus className="size-4" />
              영수증 추가
            </button>
          )}
        </div>
        {uploader.notice && (
          <p className="rounded-xl bg-sky-50 px-3 py-2 text-sm text-sky-800" role="status">
            {uploader.notice}
          </p>
        )}
        {visibleItems.length === 0 && uploader.rows.length === 0 ? (
          <button type="button" onClick={() => setSheet(true)} className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-zinc-300 bg-white px-4 py-8 text-sm text-zinc-500 hover:bg-zinc-50">
            <ReceiptText className="size-8 text-zinc-300" />
            아직 영수증이 없어요. 눌러서 영수증을 올려 주세요.
          </button>
        ) : (
          <ul className="flex flex-col gap-2">
            {visibleItems.map((item) => (
              <ItemRow key={item.id} item={item} href={`${base}/claims/${claim.id}/items/${item.id}`} onOpen={openItem} onDelete={() => removeItem(item.id)} />
            ))}
            {uploader.rows.map((row) => (
              <UploadingRow key={row.key} row={row} onDismiss={() => uploader.dismiss(row.key)} />
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-4">
        <dl className="grid grid-cols-[1fr_auto] gap-y-1.5 text-sm">
          <dt className="text-zinc-600">합계</dt>
          <dd className="text-right text-base font-bold">{formatWon(claim.total_amount)}</dd>
          <dt className="text-zinc-600">회사 지원</dt>
          <dd className="text-right">{formatWon(claim.total_company_supported)}</dd>
          <dt className="text-zinc-600">개인 부담</dt>
          <dd className="text-right">{formatWon(claim.total_personal_burden)}</dd>
        </dl>
        {(payout > 0 || corporateOver > 0) && (
          <p className="mt-3 rounded-xl bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
            {[payout > 0 && `사비 지급 예정 ${formatWon(payout)}`, corporateOver > 0 && `법인카드 한도 초과 납부 ${formatWon(corporateOver)}`].filter(Boolean).join(" / ")}
          </p>
        )}
      </section>

      {claim.status === "draft" && (
        <div className="flex justify-center">
          {confirmDelete ? (
            <div className="flex w-full flex-col gap-2 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm">
              <p className="text-red-800">이 소명서와 올린 영수증 {items.length}장을 모두 삭제할까요? 되돌릴 수 없어요.</p>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setConfirmDelete(false)} className="min-h-11 rounded-xl border border-zinc-300 bg-white font-medium">
                  취소
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    startBusy(async () => {
                      const res = await deleteDraftClaimAction(claim.id);
                      if (res && !res.ok) setMessage({ kind: "error", text: res.error });
                    })
                  }
                  className="min-h-11 rounded-xl bg-red-600 font-semibold text-white disabled:opacity-60"
                >
                  삭제
                </button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => setConfirmDelete(true)} className="inline-flex min-h-11 items-center gap-1.5 px-3 text-sm text-zinc-500 hover:text-red-600">
              <Trash2 className="size-4" />
              소명서 삭제
            </button>
          )}
        </div>
      )}

      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => e.target.files && uploader.upload(e.target.files).finally(() => (e.target.value = ""))} />
      <input ref={galleryRef} type="file" accept="image/*,application/pdf" multiple className="hidden" onChange={(e) => e.target.files && uploader.upload(e.target.files).finally(() => (e.target.value = ""))} />

      {sheet && editable && (
        <AddSheet touch={touch} remaining={uploader.remaining} onCamera={() => pick(cameraRef.current)} onGallery={() => pick(galleryRef.current)} onManual={addManual} onClose={() => setSheet(false)} />
      )}

      {/* 하단 액션 바 (§4) */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-zinc-200 bg-white/95 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur">
        <div className="mx-auto flex max-w-md flex-col gap-2 md:max-w-2xl">
          {message && (
            <p className={`rounded-lg px-3 py-2 text-sm ${message.kind === "ok" ? "bg-green-50 text-green-800" : "bg-red-50 text-red-700"}`} role={message.kind === "error" ? "alert" : "status"}>
              {message.text}
            </p>
          )}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={saving || !editable}
              onClick={() => startSave(async () => void (await save()))}
              className="inline-flex min-h-12 items-center justify-center gap-1.5 rounded-xl border border-zinc-300 bg-white font-semibold text-zinc-800 hover:bg-zinc-50 disabled:opacity-60"
            >
              {saving && <Loader2 className="size-4 animate-spin" />}💾 임시저장{dirty ? " •" : ""}
            </button>
            <button type="button" disabled className="min-h-12 rounded-xl bg-brand-600 font-semibold text-white opacity-50" title="결재 상신은 다음 업데이트에서 열려요">
              🚀 {claim.status === "rejected" ? "재상신" : "결재 상신"}
            </button>
          </div>
          <p className="text-center text-[11px] text-zinc-500">결재 상신은 준비 중이에요. 지금은 임시저장까지 할 수 있어요.</p>
        </div>
      </div>
    </main>
  );
}
