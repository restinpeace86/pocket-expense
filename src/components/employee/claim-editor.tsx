"use client";

import { exceptionFlags, exceptionSummary } from "@/lib/expense/exceptions";
import { ArrowLeft, Camera, Car, FileText, ImageIcon, Loader2, PenLine, Plus, ReceiptText, TrainFront, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { createManualItemAction, createOwnCarItemAction, deleteDraftClaimAction, deleteItemAction, saveClaimHeaderAction } from "@/app/workspace/[id]/employee/claims/actions";
import { RouteEvidenceCard } from "@/components/claims/route-evidence-card";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { inputClass } from "@/components/ui/page-shell";
import type { ClaimHeaderInput, EditorData, EditorItem, PaymentMethod, TripTransport } from "@/lib/employee/editor-types";
import { routeCardFrom } from "@/lib/expense/route";
import { CATEGORY_LABEL, PURCHASE_TYPE_LABEL, TRIP_TYPE_LABEL } from "@/lib/expense/categories";
import { claimStatusBadge } from "@/lib/expense/status";
import { suggestPurpose } from "@/lib/expense/purpose";
import { isAutoTitle, suggestTitle } from "@/lib/expense/title";
import { formatWon } from "@/lib/format";
import { submitClaimAction } from "@/lib/claims/actions";
import { HEADER_PROBLEM_LABEL, ITEM_PROBLEM_LABEL, type ClaimProblems } from "@/lib/claims/problems";
import { measureAction } from "@/lib/perf/client";
import { MAX_PER_CLAIM, useReceiptUpload, type UploadRow } from "./use-receipt-upload";

// 화면 E-02 지출결의서 작성 (spec/screens/worker-tax-processing.md §1·§3-1·§3-2·§3-4·§4)

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

const isOwnCar = (item: EditorItem) => item.category === "trip" && item.trip_type === "own_car";

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
      {isOwnCar(item) ? <Car className="size-5 text-brand-600" /> : item.isPdf ? <FileText className="size-5" /> : item.receipt_path ? <ImageIcon className="size-5" /> : <PenLine className="size-5" />}
    </span>
  );
}

function ItemRow({ item, href, onOpen, onDelete, problem }: { item: EditorItem; href: string; onOpen: (href: string) => void; onDelete: () => void; problem?: boolean }) {
  const [confirm, setConfirm] = useState(false);
  const check = itemNeedsCheck(item);
  const parsing = item.parse_status === "parsing";
  return (
    <li className={`flex items-center gap-2 rounded-2xl border bg-white p-3 ${problem ? "border-red-400 ring-1 ring-red-300" : "border-zinc-200"}`}>
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
          <span className="block truncate font-medium">
            {isOwnCar(item) ? (item.start_location && item.end_location ? `${item.start_location} → ${item.end_location}` : "경로 미입력") : item.merchant_name || (parsing ? "읽는 중…" : "가맹점 미입력")}
          </span>
          <span className="block truncate text-xs text-zinc-500">
            {[item.expense_date?.replaceAll("-", "."), itemTypeLabel(item)].filter(Boolean).join(" · ") || "날짜·카테고리 미입력"}
          </span>
          <span className="mt-1 flex flex-wrap items-center gap-1.5">
            <span className="mr-auto font-semibold tabular-nums">{item.amount !== null ? formatWon(item.amount) : "금액 미입력"}</span>
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${item.payment_method === "corporate_card" ? "bg-sky-100 text-sky-800" : "bg-orange-100 text-orange-800"}`}>
              {item.payment_method === "corporate_card" ? "💳 법인" : "🧾 사비"}
            </span>
            {item.duplicate && <span className="rounded-full bg-amber-200 px-2 py-0.5 text-[11px] font-semibold text-amber-900">중복 의심</span>}
            {item.overdueDeadline && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">기한 초과</span>}
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
          <button type="button" onClick={onDelete} className="min-h-11 rounded-lg bg-red-600 px-3 text-xs font-semibold text-white">
            삭제
          </button>
          <button type="button" onClick={() => setConfirm(false)} className="min-h-11 rounded-lg border border-zinc-300 px-3 text-xs">
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

// 업로드 진행 단계 — 단계 이름·진행 막대·경과 시간을 보여 줘 "멈춘 것 아님"을 알린다
const UPLOAD_STEPS: { phase: UploadRow["phase"]; label: string; short: string; photoLabel?: string; pct: number }[] = [
  { phase: "waiting", label: "차례를 기다리는 중", short: "기다리는 중", pct: 5 },
  { phase: "preparing", label: "사진 최적화 중 (크기 줄이는 중)", short: "사진 최적화 중", photoLabel: "PDF 확인 중", pct: 25 },
  { phase: "uploading", label: "사진 업로드 중", short: "업로드 중", pct: 55 },
  { phase: "reading", label: "AI가 영수증을 읽는 중 · 보통 2~5초", short: "AI가 읽는 중", pct: 85 },
  { phase: "done", label: "다 읽었어요 · 목록에 넣는 중", short: "목록에 넣는 중", pct: 100 },
];

function useElapsed(since?: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!since) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [since]);
  return since ? Math.max(0, Math.floor((now - since) / 1000)) : 0;
}

// 하단 바의 한 줄 진행 요약 — 휴대폰에서 목록이 화면 아래에 있어도 진행 중임을 보이게
function UploadSummary({ rows }: { rows: UploadRow[] }) {
  const live = rows.filter((r) => r.phase !== "failed");
  const started = live.reduce<number | undefined>((m, r) => (r.since && (!m || r.since < m) ? r.since : m), undefined);
  const elapsed = useElapsed(started);
  if (live.length === 0) return null;
  const done = live.filter((r) => r.phase === "done").length;
  const order: UploadRow["phase"][] = ["reading", "uploading", "preparing", "waiting", "done"];
  const current = order.find((ph) => live.some((r) => r.phase === ph)) ?? "waiting";
  const step = UPLOAD_STEPS.find((x) => x.phase === current)!;
  const pct = Math.round(live.reduce((s, r) => s + (UPLOAD_STEPS.find((x) => x.phase === r.phase)?.pct ?? 0), 0) / live.length);
  return (
    <div className="rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-900" role="status" aria-live="polite">
      <p className="flex items-center gap-2">
        <Loader2 className="size-4 shrink-0 animate-spin" />
        <span className="min-w-0 flex-1 truncate">
          영수증 {live.length}장 · {done}장 완료 · {step.short}
        </span>
        {elapsed >= 2 && <span className="shrink-0 text-xs text-brand-700">{elapsed}초</span>}
      </p>
      <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-white" aria-hidden>
        <span className="block h-full rounded-full bg-brand-500 transition-all duration-700" style={{ width: `${pct}%` }} />
      </span>
    </div>
  );
}

function UploadingRow({ row, onDismiss }: { row: UploadRow; onDismiss: () => void }) {
  const elapsed = useElapsed(row.phase === "failed" ? undefined : row.since);
  const idx = UPLOAD_STEPS.findIndex((s) => s.phase === row.phase);
  const step = UPLOAD_STEPS[idx];
  const label = row.phase === "failed" ? (row.error ?? "올리지 못했어요") : row.isPdf && step.photoLabel ? step.photoLabel : step.label;
  return (
    <li className={`flex items-center gap-3 rounded-2xl border p-3 ${row.phase === "failed" ? "border-red-200 bg-red-50" : "border-zinc-200 bg-white"}`} aria-live="polite">
      <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-400">
        {row.phase === "failed" ? <X className="size-5 text-red-500" /> : <Loader2 className="size-5 animate-spin" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{row.name}</span>
        <span className={`block text-xs ${row.phase === "failed" ? "text-red-700" : "text-zinc-600"}`}>
          {(row.phase === "preparing" || row.phase === "uploading" || row.phase === "reading") && <b className="mr-1 text-brand-700">{idx}/3</b>}
          {label}
          {row.phase !== "failed" && elapsed >= 2 && <span className="ml-1 text-zinc-400">{elapsed}초</span>}
        </span>
        {row.phase !== "failed" && (
          <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-zinc-100" aria-hidden>
            <span className="block h-full rounded-full bg-brand-500 transition-all duration-700" style={{ width: `${step.pct}%` }} />
          </span>
        )}
      </span>
      {row.phase === "failed" && (
        <button type="button" onClick={onDismiss} className="min-h-11 shrink-0 rounded-lg border border-red-200 bg-white px-3.5 text-xs">
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

// selfApprove: 최고 관리자 본인 결의서는 결재 없이 바로 승인된다(D-026) — 확인 문구에만 쓴다
export function ClaimEditor({ data, base, openAdd, selfApprove = false, approvalPreview = "관리자 승인" }: { data: EditorData; base: string; openAdd: boolean; selfApprove?: boolean; approvalPreview?: string }) {
  const { claim, items } = data;
  const router = useRouter();
  const touch = useTouchDevice();
  const initial: ClaimHeaderInput = useMemo(
    () => ({
      title: claim.title,
      description: claim.description ?? "",
      exceptionMemo: claim.exception_memo ?? "",
      defaultPaymentMethod: claim.default_payment_method,
      isBusinessTrip: claim.is_business_trip,
      tripDestination: claim.trip_destination ?? "",
      tripStartDate: claim.trip_start_date ?? "",
      tripEndDate: claim.trip_end_date ?? "",
      tripPurpose: claim.trip_purpose ?? "",
      tripTransport: claim.trip_transport,
    }),
    [claim],
  );
  const [form, setForm] = useState<ClaimHeaderInput>(initial);
  // 저장된 제목이 자동 제안 모양이면 계속 자동(카테고리를 고르면 [카테고리]가 붙는다, D-087). 직원이 직접 쓴 제목만 고정
  const [titleTouched, setTitleTouched] = useState(() => !isAutoTitle(claim.title, { isBusinessTrip: claim.is_business_trip, tripDestination: claim.trip_destination, tripStartDate: claim.trip_start_date }, items));
  // 지출 사유: 직원이 쓰기 전까지는 AI 초안을 보여 주고 그대로 저장·상신된다(D-086)
  const [descTouched, setDescTouched] = useState((claim.description ?? "") !== "");
  const [savedForm, setSavedForm] = useState<ClaimHeaderInput>(initial);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [sheet, setSheet] = useState(openAdd && items.length === 0);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saving, startSave] = useTransition();
  const [busy, startBusy] = useTransition();
  const [problems, setProblems] = useState<ClaimProblems | null>(null);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [submitting, startSubmit] = useTransition();
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const uploader = useReceiptUpload(claim.id, items.length);

  // ?add=1(새 결의서)이면 처음에만 추가 시트를 연다(영수증이 생기면 다시 열리지 않음).
  // 주소에서 ?add=1을 지우지 않는다: 주소를 바꾸면 업로드 뒤 화면 갱신 때 Next가 이 화면을 새로 만들어
  // 그 사이 입력한 제목·지출 사유가 지워졌다(2026-10-21 로그인 E2E에서 재현).

  const exceptionText = exceptionSummary(exceptionFlags(items));
  const suggestion = suggestTitle({ isBusinessTrip: form.isBusinessTrip, tripDestination: form.tripDestination, tripStartDate: form.tripStartDate || null }, items);
  const title = titleTouched ? form.title : suggestion;
  const purposeDraft = suggestPurpose({ isBusinessTrip: form.isBusinessTrip, tripDestination: form.tripDestination, tripPurpose: form.tripPurpose }, items);
  const description = descTouched ? form.description : purposeDraft;
  const current = { ...form, title, description };
  const dirty = JSON.stringify(current) !== JSON.stringify(savedForm);
  const uploadingIds = new Set(uploader.rows.filter((r) => r.phase !== "done").map((r) => r.itemId).filter(Boolean));
  const { prune } = uploader;
  const itemKey = items.map((i) => `${i.id}:${i.parse_status}`).join(",");
  // 다 읽은 영수증이 목록에 나타나면 진행 행을 지운다
  useEffect(() => {
    prune(new Set(items.filter((i) => i.parse_status !== "parsing").map((i) => i.id)));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- itemKey가 items의 변화를 대표한다
  }, [itemKey, prune]);
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
      if (current.description.trim()) setDescTouched(true);
      setMessage({ kind: "ok", text: "임시저장했어요. 다른 기기(PC)에서도 이어서 쓸 수 있어요." });
    } else {
      setMessage({ kind: "error", text: res.error });
    }
    return res.ok;
  };

  // 자차 항목을 만들고 경로 입력 화면으로 (헤더를 먼저 저장해 출장 시작일이 사용일 기본값이 되게)
  const ownCarItems = items.filter(isOwnCar);
  const addOwnCar = () =>
    startBusy(async () => {
      if (dirty && !(await save())) return;
      const res = await measureAction("employee.create_own_car", () => createOwnCarItemAction(claim.id));
      if (!res.ok) return setMessage({ kind: "error", text: res.error });
      router.push(`${base}/claims/${claim.id}/items/${res.itemId}`);
    });

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
          <ArrowLeft className="size-4" />내 결의서
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
        <h1 className="text-lg font-bold">지출결의서</h1>
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
            지출 사유
          </Label>
          <textarea
            id="claim-desc"
            className={`${inputClass} min-h-20 py-2`}
            value={description}
            maxLength={1000}
            placeholder="예: A사 프로젝트 킥오프 미팅 시 참석자 음료 제공"
            onChange={(e) => {
              setDescTouched(true);
              set("description", e.target.value);
            }}
          />
          {!descTouched && purposeDraft && (
            <p className="flex items-start gap-1.5 text-xs text-brand-700">
              <span className="shrink-0 whitespace-nowrap rounded-full bg-brand-50 px-2 py-0.5 font-semibold">✨ AI 초안</span>
              영수증 내용으로 써 뒀어요. 다르면 눌러서 고쳐 주세요.
            </p>
          )}
          <p className="text-xs text-zinc-500">관리자가 &ldquo;이 돈을 왜 썼지?&rdquo; 하고 묻지 않도록 한 줄로 적어 주세요.</p>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="claim-memo">예외 소명 사유 (선택)</Label>
          {exceptionText && (
            <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
              {exceptionText}이 있어요. 왜 이때 썼는지 적어 두면 결재가 빨라져요.
            </p>
          )}
          <textarea
            id="claim-memo"
            className={`${inputClass} min-h-16 py-2`}
            value={form.exceptionMemo}
            maxLength={500}
            placeholder="예: 토요일 고객사 장애 긴급 대응 후 식사"
            onChange={(e) => set("exceptionMemo", e.target.value)}
          />
          <p className="text-xs text-zinc-500">주말·심야 사용처럼 평소와 다른 지출이 있을 때만 적어요.</p>
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
              {/* 달력 하나에서 시작일 → 종료일 (개선사항 6-1) */}
              <DateRangePicker label="출장 기간" required start={form.tripStartDate} end={form.tripEndDate} onChange={(s, e) => setForm((f) => ({ ...f, tripStartDate: s, tripEndDate: e }))} />
              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-zinc-800">이동 수단</span>
                <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="이동 수단">
                  {(
                    [
                      ["own_car", "자차", Car],
                      ["public_transport", "대중교통·KTX", TrainFront],
                    ] as [TripTransport, string, typeof Car][]
                  ).map(([v, label, Icon]) => (
                    <button
                      key={v}
                      type="button"
                      role="radio"
                      aria-checked={form.tripTransport === v}
                      onClick={() => set("tripTransport", v)}
                      className={`inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border text-sm font-medium ${form.tripTransport === v ? "border-brand-600 bg-brand-50 text-brand-800" : "border-zinc-300 bg-white text-zinc-700"}`}
                    >
                      <Icon className="size-4" />
                      {label}
                    </button>
                  ))}
                </div>
                {form.tripTransport === "public_transport" && <p className="text-xs text-zinc-500">KTX·버스·항공권 영수증을 올리면 출장비 › 대중교통으로 분류돼요.</p>}
              </div>
              {form.tripTransport === "own_car" && (
                <div className="flex flex-col gap-2 rounded-xl border border-brand-200 bg-white p-3">
                  <p className="text-sm font-semibold">🚗 자차 유류비</p>
                  {data.fuel.blocked ? (
                    <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
                      {data.fuel.blocked === "allowance"
                        ? "자가운전보조금을 받고 있어 자차 유류비는 청구할 수 없어요. 통행료·주차비는 영수증으로 올려 주세요."
                        : "회사에서 자차 유류비 청구를 쓰지 않아요. 통행료·주차비는 영수증으로 올려 주세요."}
                    </p>
                  ) : (
                    <>
                      <p className="text-xs text-zinc-500">출발지·도착지를 고르면 거리 × km당 {data.fuel.ratePerKm.toLocaleString("ko-KR")}원으로 자동 계산하고, 경로 요약 카드를 증빙으로 붙여요.</p>
                      {ownCarItems.map((i) => {
                        const card = routeCardFrom(i, data.fuel.ratePerKm);
                        const href = `${base}/claims/${claim.id}/items/${i.id}`;
                        return (
                          <a
                            key={i.id}
                            href={href}
                            onClick={(e) => {
                              e.preventDefault();
                              openItem(href);
                            }}
                            className="block"
                          >
                            {card ? <RouteEvidenceCard card={card} compact /> : <span className="block rounded-lg border border-dashed border-zinc-300 px-3 py-3 text-sm text-zinc-600">경로를 아직 입력하지 않았어요 — 눌러서 입력</span>}
                          </a>
                        );
                      })}
                      {editable && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={addOwnCar}
                          className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-brand-300 bg-brand-50 px-3 text-sm font-semibold text-brand-800 disabled:opacity-60"
                        >
                          {busy ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                          {ownCarItems.length ? "자차 이동 하나 더 (다른 경로)" : "경로 입력하고 유류비 계산"}
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}
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
              <ItemRow key={item.id} item={item} href={`${base}/claims/${claim.id}/items/${item.id}`} onOpen={openItem} onDelete={() => removeItem(item.id)} problem={!!problems?.items.some((p) => p.item_id === item.id)} />
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
              <p className="text-red-800">이 결의서와 올린 영수증 {items.length}장을 모두 삭제할까요? 되돌릴 수 없어요.</p>
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
              결의서 삭제
            </button>
          )}
        </div>
      )}

      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => e.target.files && uploader.upload(e.target.files).finally(() => (e.target.value = ""))} />
      <input ref={galleryRef} type="file" accept="image/*,application/pdf" multiple className="hidden" onChange={(e) => e.target.files && uploader.upload(e.target.files).finally(() => (e.target.value = ""))} />

      {sheet && editable && (
        <AddSheet touch={touch} remaining={uploader.remaining} onCamera={() => pick(cameraRef.current)} onGallery={() => pick(galleryRef.current)} onManual={addManual} onClose={() => setSheet(false)} />
      )}

      {problems && (
        <section className="flex flex-col gap-2 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800" role="alert">
          <p className="font-semibold">아래 칸을 채우면 상신할 수 있어요</p>
          {problems.header.length > 0 && <p>결의서: {problems.header.map((h) => HEADER_PROBLEM_LABEL[h] ?? h).join(", ")}</p>}
          {problems.items.map((p) => {
            const it = items.find((x) => x.id === p.item_id);
            const n = items.findIndex((x) => x.id === p.item_id) + 1;
            return (
              <button key={p.item_id} type="button" onClick={() => openItem(`${base}/claims/${claim.id}/items/${p.item_id}`)} className="text-left underline-offset-2 hover:underline">
                영수증 {n} ({it?.merchant_name || "가맹점 미입력"}): {p.fields.map((f) => ITEM_PROBLEM_LABEL[f] ?? f).join(", ")} →
              </button>
            );
          })}
        </section>
      )}

      {confirmSubmit && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal aria-labelledby="submit-title">
          <button type="button" className="absolute inset-0 bg-black/40" aria-label="닫기" onClick={() => setConfirmSubmit(false)} />
          <div className="absolute inset-x-0 bottom-0 mx-auto flex max-w-md flex-col gap-3 rounded-t-2xl bg-white px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-5 shadow-xl sm:bottom-auto sm:top-1/3 sm:rounded-2xl">
            <h2 id="submit-title" className="text-lg font-semibold">
              {claim.status === "rejected" ? "다시 상신할까요?" : "결재를 상신할까요?"}
            </h2>
            <p className="text-sm text-zinc-700">
              영수증 {items.length}건 · {formatWon(claim.total_amount)}
              {payout > 0 && ` · 사비 지급 예정 ${formatWon(payout)}`}
            </p>
            <p className="rounded-xl bg-zinc-50 px-3 py-2 text-sm text-zinc-600">{selfApprove ? "최고 관리자 본인 결의서라 결재 없이 바로 승인됩니다." : `결재선: ${approvalPreview}. 상신하면 승인·반려 전까지 고칠 수 없어요.`}</p>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setConfirmSubmit(false)} className="min-h-12 rounded-xl border border-zinc-300 font-medium">
                취소
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() =>
                  startSubmit(async () => {
                    const res = await measureAction("employee.submit_claim", () => submitClaimAction(claim.id));
                    setConfirmSubmit(false);
                    if (res.ok) {
                      router.push(base);
                      return;
                    }
                    if ("problems" in res) setProblems(res.problems);
                    setMessage({ kind: "error", text: res.error });
                  })
                }
                className="inline-flex min-h-12 items-center justify-center gap-1.5 rounded-xl bg-brand-600 font-semibold text-white disabled:opacity-60"
              >
                {submitting && <Loader2 className="size-4 animate-spin" />}
                {claim.status === "rejected" ? "재상신" : "상신"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 하단 액션 바 (§4) */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-zinc-200 bg-white/95 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur">
        <div className="mx-auto flex max-w-md flex-col gap-2 md:max-w-2xl">
          <UploadSummary rows={uploader.rows} />
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
            <button
              type="button"
              disabled={!editable || submitting || uploader.rows.some((r) => r.phase !== "failed")}
              onClick={() =>
                startSubmit(async () => {
                  setMessage(null);
                  // 바뀐 헤더를 먼저 저장하고, 서버에서 빠진 칸을 확인한 뒤 확인 창을 연다
                  if (dirty && !(await save())) return;
                  setProblems(null);
                  setConfirmSubmit(true);
                })
              }
              className="inline-flex min-h-12 items-center justify-center gap-1.5 rounded-xl bg-brand-600 font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {submitting && <Loader2 className="size-4 animate-spin" />}🚀 {claim.status === "rejected" ? "재상신" : "결재 상신"}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
