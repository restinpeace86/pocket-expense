"use client";

import { exceptionFlags, exceptionSummary } from "@/lib/expense/exceptions";
import { ArrowLeft, Building2, Camera, Car, ChevronDown, FileText, ImageIcon, Loader2, Minus, PenLine, Plus, ReceiptText, TrainFront, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, useTransition, type ReactNode } from "react";
import { ackItemCategoryAction, createManualItemAction, createOwnCarItemAction, deleteDraftClaimAction, deleteItemAction, moveItemToNewClaimAction, saveClaimHeaderAction } from "@/app/workspace/[id]/employee/claims/actions";
import { categoryMismatch } from "@/lib/expense/category-check";
import { RouteEvidenceCard } from "@/components/claims/route-evidence-card";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { inputClass } from "@/components/ui/page-shell";
import type { ClaimHeaderInput, EditorData, EditorItem, PaymentMethod, TripTransport } from "@/lib/employee/editor-types";
import { routeCardFrom } from "@/lib/expense/route";
import { CATEGORY_LABEL, EXTRA_CATEGORIES, MAIN_CATEGORIES, PURCHASE_TYPE_LABEL, TRIP_TYPE_LABEL, type ExpenseCategory } from "@/lib/expense/categories";
import { claimStatusBadge } from "@/lib/expense/status";
import { suggestPurpose } from "@/lib/expense/purpose";
import { isAutoTitle, suggestTitle } from "@/lib/expense/title";
import { formatWon } from "@/lib/format";
import { submitClaimAction } from "@/lib/claims/actions";
import { HEADER_PROBLEM_LABEL, ITEM_PROBLEM_LABEL, type ClaimProblems } from "@/lib/claims/problems";
import { measureAction } from "@/lib/perf/client";
import { MAX_PER_CLAIM, useReceiptUpload, type UploadRow } from "./use-receipt-upload";
import { useElementHeight } from "@/lib/ui/use-element-height";
import { CATEGORY_ICON, Chips, ItemInlineForm, PURCHASE_TYPES, type ItemFormHandle } from "./item-editor";
import { OwnCarInline } from "./own-car-editor";

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

// 지출 카테고리 칸: 고른 칸은 브랜드색으로 채우고(흰 글씨), 안 고른 칸은 흰 바탕 — 한눈에 구분(D-115)
function categoryChip(selected: boolean): string {
  return `inline-flex min-h-12 items-center justify-center gap-1 break-keep rounded-xl border px-2 py-1.5 text-center text-sm leading-tight transition-colors disabled:opacity-60 ${
    selected ? "border-brand-600 bg-brand-600 font-semibold text-white shadow-sm" : "border-zinc-300 bg-white font-medium text-zinc-700 hover:border-brand-300 hover:bg-brand-50"
  }`;
}

// 카테고리가 없는 예전 결의서의 처음 값: 출장 결의서면 출장비, 영수증 카테고리가 하나뿐이면 그것(섞여 있으면 직원이 고른다)
function initialCategory(claim: EditorData["claim"], items: EditorItem[]): ExpenseCategory | null {
  if (claim.is_business_trip) return "trip";
  const cats = new Set(items.map((i) => i.category).filter((c): c is ExpenseCategory => !!c));
  return cats.size === 1 ? [...cats][0] : null;
}

export function itemNeedsCheck(item: EditorItem): boolean {
  if (item.parse_status === "failed") return true;
  if (item.amount === null || !item.expense_date || !item.category || !item.evidence_type) return true;
  if (item.category === "trip" && !item.trip_type) return true;
  if (item.category === "purchase" && !item.purchase_type) return true;
  // 증빙 자료가 없으면(자차 제외) 확인 필요 — 증빙 없음은 사유 5자 이상일 때만 통과 (D-108)
  if (!item.receipt_path && !(item.category === "trip" && item.trip_type === "own_car") && !(item.evidence_kind === "none" && (item.no_evidence_reason ?? "").trim().length >= 5)) return true;
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

// 영수증 카드: 누르거나 아래 탭을 누르면 그 자리에서 펼쳐 고친다(원페이지 아코디언, 개선사항(2차) 3). 자차 유류비는 위 출장 영역의 경로 칸을 펼친다(개선사항(2차) 4)
function ItemRow({
  item,
  href,
  onOpen,
  onDelete,
  problem,
  open,
  onToggle,
  mismatch,
  children,
}: {
  item: EditorItem;
  href: string;
  onOpen: () => void;
  onDelete: () => void;
  problem?: boolean;
  open: boolean;
  onToggle: () => void;
  mismatch?: boolean;
  children?: ReactNode;
}) {
  const [confirm, setConfirm] = useState(false);
  const check = itemNeedsCheck(item);
  const parsing = item.parse_status === "parsing";
  const inline = !isOwnCar(item);
  const panelId = `item-panel-${item.id}`;
  return (
    <li id={`item-${item.id}`} className={`flex scroll-mt-4 flex-col rounded-2xl border bg-white ${problem ? "border-red-400 ring-1 ring-red-300" : open ? "border-brand-300" : "border-zinc-200"}`}>
      <div className="flex items-center gap-2 p-3">
      <a
        href={href}
        aria-expanded={inline ? open : undefined}
        aria-controls={inline ? panelId : undefined}
        onClick={(e) => {
          e.preventDefault();
          if (inline) onToggle();
          else onOpen();
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
            {mismatch && <span className="rounded-full bg-amber-200 px-2 py-0.5 text-[11px] font-semibold text-amber-900">카테고리 확인</span>}
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
      </div>
      {inline && open && (
        <div id={panelId} role="region" aria-label="영수증 상세 입력">
          {children}
        </div>
      )}
      {inline && (
        // 노치 탭: 카드 아래 가운데에서 펼치고 접는다
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={panelId}
          className="mx-auto flex min-h-9 items-center gap-1 rounded-t-xl border border-b-0 border-zinc-200 bg-zinc-50 px-5 text-xs font-medium text-zinc-600 hover:bg-zinc-100"
        >
          {open ? "접기" : check ? "펼쳐서 확인하기" : "펼쳐서 고치기"}
          <ChevronDown className={`size-4 transition-transform ${open ? "rotate-180" : ""}`} />
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
export function ClaimEditor({
  data,
  base,
  openAdd,
  openItemId = null,
  selfApprove = false,
  approvalPreview = "관리자 승인",
}: {
  data: EditorData;
  base: string;
  openAdd: boolean;
  openItemId?: string | null; // ?item=<id>: 그 영수증을 펼친 채로 연다
  selfApprove?: boolean;
  approvalPreview?: string;
}) {
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
      category: claim.category ?? initialCategory(claim, items),
      purchaseType: claim.purchase_type,
      meetingPurpose: claim.meeting_purpose ?? "",
      clientName: claim.client_name ?? "",
      attendees: claim.attendees ?? "",
      purchasePurpose: claim.purchase_purpose ?? "",
      purchaseItems: claim.purchase_items ?? "",
      headcount: claim.headcount,
      vehicleId: claim.vehicle_id,
    }),
    [claim, items],
  );
  const [form, setForm] = useState<ClaimHeaderInput>(initial);
  // 저장된 제목이 자동 제안 모양이면 계속 자동(카테고리를 고르면 [카테고리]가 붙는다, D-087). 직원이 직접 쓴 제목만 고정
  const [titleTouched, setTitleTouched] = useState(() => !isAutoTitle(claim.title, { isBusinessTrip: claim.is_business_trip, tripDestination: claim.trip_destination, tripStartDate: claim.trip_start_date, category: claim.category }, items));
  // 지출 사유: 직원이 쓰기 전까지는 AI 초안을 보여 주고 그대로 저장·상신된다(D-086)
  // 자동 저장이 AI 초안을 저장해도 직원이 쓴 것으로 보지 않는다: 저장된 사유가 지금 영수증으로 만든 초안과 같으면 계속 초안(D-103)
  const [descTouched, setDescTouched] = useState(() => {
    const saved = (claim.description ?? "").trim();
    return saved !== "" && saved !== suggestPurpose({ isBusinessTrip: claim.is_business_trip, tripDestination: claim.trip_destination ?? "", tripPurpose: claim.trip_purpose ?? "", category: claim.category }, items);
  });
  const [savedForm, setSavedForm] = useState<ClaimHeaderInput>(initial);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const { ref: barRef, height: barHeight } = useElementHeight<HTMLDivElement>();
  // 저장 성공 안내는 4초 뒤 사라진다(오류는 고칠 때까지 남김)
  useEffect(() => {
    if (message?.kind !== "ok") return;
    const t = setTimeout(() => setMessage(null), 4000);
    return () => clearTimeout(t);
  }, [message]);
  const [sheet, setSheet] = useState(openAdd && items.length === 0);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [busy, startBusy] = useTransition();
  const [problems, setProblems] = useState<ClaimProblems | null>(null);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [submitting, startSubmit] = useTransition();
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const uploader = useReceiptUpload(claim.id, items.length);
  // 펼친 영수증과 그 저장 손잡이(임시저장·상신 전에 고친 내용을 모두 먼저 저장한다)
  const [openIds, setOpenIds] = useState<Set<string>>(() => new Set(openItemId ? [openItemId] : []));
  const handles = useRef(new Map<string, ItemFormHandle>());
  const register = useCallback((id: string, h: ItemFormHandle | null) => {
    if (h) handles.current.set(id, h);
    else handles.current.delete(id);
  }, []);
  const flushItems = async () => (await Promise.all([...handles.current.values()].map((h) => h.flush()))).every(Boolean);
  const onItemError = useCallback((text: string | null) => setMessage(text ? { kind: "error", text } : null), []);
  const toggleItem = (id: string) =>
    setOpenIds((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const showItem = (id: string) => {
    setOpenIds((s) => new Set(s).add(id));
    // 새로 만든 항목은 화면 갱신 뒤에 나타나므로 잠깐(최대 3초) 기다렸다가 그 카드로 내린다
    let tries = 0;
    const go = () => {
      const el = document.getElementById(`owncar-${id}`) ?? document.getElementById(`item-${id}`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      else if (++tries < 30) setTimeout(go, 100);
    };
    requestAnimationFrame(go);
  };
  useEffect(() => {
    if (openItemId) (document.getElementById(`owncar-${openItemId}`) ?? document.getElementById(`item-${openItemId}`))?.scrollIntoView({ block: "start" });
  }, [openItemId]);

  // ?add=1(새 결의서)이면 처음에만 추가 시트를 연다(영수증이 생기면 다시 열리지 않음).
  // 주소에서 ?add=1을 지우지 않는다: 주소를 바꾸면 업로드 뒤 화면 갱신 때 Next가 이 화면을 새로 만들어
  // 그 사이 입력한 제목·지출 사유가 지워졌다(2026-10-21 로그인 E2E에서 재현).

  const exceptionText = exceptionSummary(exceptionFlags(items));
  // 결의서 카테고리: 직원이 고른 값, 없으면 AI 추천(올린 영수증의 AI 카테고리가 하나로 모이면, D-103). 자동 저장되며 "✨ AI 추천"으로 보인다
  const aiCategory = form.category ? null : initialCategory({ ...claim, is_business_trip: form.isBusinessTrip }, items);
  const category = form.category ?? aiCategory;
  const isTrip = category ? category === "trip" : form.isBusinessTrip;
  const suggestion = suggestTitle({ isBusinessTrip: isTrip, tripDestination: form.tripDestination, tripStartDate: form.tripStartDate || null, category }, items);
  const title = titleTouched ? form.title : suggestion;
  // 지출 사유 초안: 결의서 카테고리를 따른다 — 직원이 아직 안 고쳤으면(descTouched=false, 'isUserModified') 카테고리를 바꿀 때 초안도 바뀌고,
  // 직원이 직접 고쳤으면 그대로 둔다(D-114)
  const purposeDraft = suggestPurpose({ isBusinessTrip: isTrip, tripDestination: form.tripDestination, tripPurpose: form.tripPurpose, category }, items);
  const description = descTouched ? form.description : purposeDraft;
  // 차량: 회사차량 결의서 또는 회사차량으로 간 출장(D-105, D-106)
  const usesVehicle = category === "company_car" || (category === "trip" && form.tripTransport === "company_car");
  const current: ClaimHeaderInput = { ...form, category, isBusinessTrip: isTrip, vehicleId: usesVehicle ? form.vehicleId : null, title, description };
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
  // 확인이 필요한 영수증: 빈 칸·증빙 자료 없음(itemNeedsCheck) / 카테고리 확인
  const needsCheck = items.filter(
    (i) =>
      itemNeedsCheck(i) ||
      (!isOwnCar(i) && !i.category_mismatch_ack && categoryMismatch(form.category ?? initialCategory({ ...claim, is_business_trip: form.isBusinessTrip }, items), i.aiCategory)),
  );
  const badge = claimStatusBadge(claim.status);

  // 정산 미리보기 (§3-4): 서버가 저장한 항목 금액 기준
  const payout = items.filter((i) => i.payment_method === "personal_card").reduce((s, i) => s + (i.company_supported_amount ?? 0), 0);
  const corporateOver = items.filter((i) => i.payment_method === "corporate_card").reduce((s, i) => s + i.personal_burden_amount, 0);

  const set = <K extends keyof ClaimHeaderInput>(k: K, v: ClaimHeaderInput[K]) => setForm((f) => ({ ...f, [k]: v }));

  // 저장은 하나로(D-103): 결의서 칸도 영수증처럼 고치면 0.8초 뒤 자동 저장. 저장은 순서대로 한 줄로 처리하고(겹치지 않게),
  // 상신·영수증 추가·화면 떠나기 전에는 기다렸다가 넘어간다. 펼친 영수증의 남은 수정도 함께 저장한다.
  const [saveState, setSaveState] = useState<"saved" | "saving" | "error">("saved");
  const latest = useRef(current);
  const savedKey = useRef(JSON.stringify(savedForm));
  const queue = useRef<Promise<boolean>>(Promise.resolve(true));
  useEffect(() => {
    latest.current = current;
  });
  const persist = (value?: ClaimHeaderInput): Promise<boolean> => {
    const run = async () => {
      if (!(await flushItems())) return false;
      const next = value ?? latest.current;
      const key = JSON.stringify(next);
      if (!editable || key === savedKey.current) return true;
      setSaveState("saving");
      const res = await measureAction("employee.save_claim", () => saveClaimHeaderAction(claim.id, next));
      if (!res.ok) {
        setSaveState("error");
        setMessage({ kind: "error", text: res.error });
        return false;
      }
      savedKey.current = key;
      setSavedForm(next);
      setSaveState("saved");
      return true;
    };
    const p = queue.current.then(run, run);
    queue.current = p;
    return p;
  };
  const currentKey = JSON.stringify(current);
  useEffect(() => {
    if (!editable || currentKey === savedKey.current) return;
    const t = setTimeout(() => void persist(), 800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- currentKey가 입력 변화를 대표하고 persist는 latest를 읽는다
  }, [currentKey, editable]);
  // 앱을 바꾸거나 탭을 닫기 직전에도 저장. 아직 저장 안 된 내용이 있으면 닫기 전에 한 번 묻는다
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") void persist();
    };
    const onUnload = (e: BeforeUnloadEvent) => {
      if (JSON.stringify(latest.current) !== savedKey.current) {
        void persist();
        e.preventDefault();
      }
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("beforeunload", onUnload);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("beforeunload", onUnload);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 한 번만 등록, persist는 ref를 읽는다
  }, []);

  // 자차 유류비는 출장 영역에서 바로 펼쳐 입력한다(개선사항(2차) 4). 새 경로 칸(carDraft)은 첫 장소를 고를 때 항목을 만들고,
  // 만들어진 항목은 같은 칸(key)에 그대로 이어서 그려 입력 중이던 출발지·도착지가 지워지지 않게 한다
  const ownCarItems = items.filter(isOwnCar);
  const draftSeq = useRef(0);
  const [carDraft, setCarDraft] = useState<{ key: number; id: string | null } | null>(null);
  const newOwnCar = () => {
    if (carDraft && !carDraft.id) return;
    draftSeq.current += 1;
    setCarDraft({ key: draftSeq.current, id: null });
  };
  const ensureOwnCar = async (): Promise<string | null> => {
    // 헤더를 먼저 저장해 출장 시작일이 사용일 기본값이 되게
    if (!(await persist())) return null;
    const res = await measureAction("employee.create_own_car", () => createOwnCarItemAction(claim.id));
    if (!res.ok) {
      setMessage({ kind: "error", text: res.error });
      return null;
    }
    setCarDraft((d) => (d ? { ...d, id: res.itemId } : d));
    return res.itemId;
  };

  const addManual = () =>
    startBusy(async () => {
      setSheet(false);
      if (!(await persist())) return;
      const res = await measureAction("employee.add_manual_item", () => createManualItemAction(claim.id));
      if (!res.ok) return setMessage({ kind: "error", text: res.error });
      // 직접 입력 항목은 그 자리에서 펼쳐 채운다
      router.refresh();
      showItem(res.itemId);
    });

  const removeItem = (itemId: string) =>
    startBusy(async () => {
      const res = await deleteItemAction(itemId);
      if (!res.ok) setMessage({ kind: "error", text: res.error });
      router.refresh();
    });

  // 대표 카테고리를 고르면 바로 저장해 영수증에도 반영한다(D-098). 자차 이동이 있으면 출장비 밖으로 못 바꾼다
  const chooseCategory = (c: ExpenseCategory) => {
    if (c === form.category) return;
    if (c !== "trip" && ownCarItems.length) {
      setMessage({ kind: "error", text: "자차 이동이 있는 출장 결의서예요. 다른 카테고리로 바꾸려면 자차 이동을 먼저 지워 주세요." });
      return;
    }
    const nextForm = { ...form, category: c, isBusinessTrip: c === "trip" };
    const nextTitle = titleTouched ? form.title : suggestTitle({ isBusinessTrip: c === "trip", tripDestination: form.tripDestination, tripStartDate: form.tripStartDate || null, category: c }, items);
    setForm(nextForm);
    setMessage(null);
    void persist({ ...nextForm, vehicleId: c === "company_car" || (c === "trip" && form.tripTransport === "company_car") ? form.vehicleId : null, title: nextTitle, description });
  };

  // 카테고리가 안 맞아 보이는 영수증 (D-104): 이 결의서가 맞음 / 새 결의서로 옮기기
  const [moved, setMoved] = useState<{ claimId: string; label: string } | null>(null);
  const ackItem = (itemId: string) =>
    startBusy(async () => {
      const res = await measureAction("employee.ack_item_category", () => ackItemCategoryAction(itemId));
      if (!res.ok) setMessage({ kind: "error", text: res.error });
    });
  const moveItem = (item: EditorItem) =>
    startBusy(async () => {
      if (!(await persist())) return;
      const res = await measureAction("employee.move_item", () => moveItemToNewClaimAction(item.id));
      if (!res.ok) return setMessage({ kind: "error", text: res.error });
      setMoved({ claimId: res.claimId, label: `${item.merchant_name || "영수증"} → 새 [${item.aiCategory ? CATEGORY_LABEL[item.aiCategory] : "결의서"}] 결의서` });
    });

  const pick = (input: HTMLInputElement | null) => {
    setSheet(false);
    input?.click();
  };

  return (
    // 아래 여백 = 하단 바의 실제 높이 + 여유(안내 문구가 생겨도 [결의서 삭제]가 가려지지 않게, 개선사항(2차) 2)
    <main className="kb-pad mx-auto flex w-full max-w-md flex-col gap-5 px-4 pt-3 md:max-w-2xl" style={{ paddingBottom: Math.max(barHeight + 48, 128) }}>
      <div className="flex items-center justify-between gap-2">
        <Link
          href={base}
          onClick={(e) => {
            // 남은 수정을 저장한 뒤 이동(저장 실패 시 머문다)
            e.preventDefault();
            startBusy(async () => {
              if (await persist()) router.push(base);
            });
          }}
          className="-ml-2 inline-flex min-h-11 items-center gap-1 rounded-xl px-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
        >
          <ArrowLeft className="size-4" />내 결의서
        </Link>
        <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}>{badge.label}</span>
      </div>

      {/* 요약 한 줄(D-109): 몇 장 · 확인할 것 · 합계. [확인 필요]를 누르면 그 영수증으로 */}
      {items.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm" role="status" aria-label="결의서 요약">
          <span>
            영수증 <b className="tabular-nums">{items.length}</b>장
          </span>
          {needsCheck.length > 0 ? (
            <button type="button" onClick={() => showItem(needsCheck[0].id)} className="font-semibold text-amber-700 underline underline-offset-2">
              확인 필요 {needsCheck.length}장
            </button>
          ) : (
            <span className="font-medium text-green-700">✓ 모두 입력 완료</span>
          )}
          <span className="ml-auto font-bold tabular-nums">{formatWon(claim.total_amount)}</span>
        </div>
      )}

      {claim.recurring_payment_id && claim.status === "draft" && (
        <p className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
          🔁 정기 결제로 자동으로 만든 결의서예요. 금액이 달라졌으면 고치고, 아래 영수증에 <b>결제 내역(인보이스·카드 결제 내역) 1장</b>만 붙여 상신해 주세요.
        </p>
      )}

      {claim.status === "rejected" && (
        <section className="rounded-2xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-semibold text-red-700">반려 사유</p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-red-700">{claim.rejection_reason || "사유가 적혀 있지 않아요. 관리자에게 확인해 주세요."}</p>
        </section>
      )}

      <section className="flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-4">
        <h1 className="text-lg font-bold">지출결의서</h1>
        {/* 지출 카테고리: 결의서에 1개 (D-098, 한 전표 = 한 계정과목). 고르면 그 카테고리에 맞는 칸만 나온다 */}
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-zinc-800">
            지출 카테고리<span className="ml-0.5 text-red-600">*</span>
          </span>
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="지출 카테고리">
            {MAIN_CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={category === c}
                disabled={!editable}
                onClick={() => chooseCategory(c)}
                className={categoryChip(category === c)}
              >
                {CATEGORY_ICON[c]} {CATEGORY_LABEL[c]}
              </button>
            ))}
          </div>
          {/* 그 밖의 경비 (D-102): 4대 카테고리 밖의 계정과목용 */}
          <details className="group rounded-xl border border-zinc-200 px-3" open={EXTRA_CATEGORIES.includes(category as ExpenseCategory) || undefined}>
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between text-sm text-zinc-700 [&::-webkit-details-marker]:hidden">
              그 밖의 경비 (회식·경조사·교육 등)
              <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
            </summary>
            {/* 4대 카테고리와 같은 2열 칸(D-115) */}
            <div className="grid grid-cols-2 gap-2 pb-3" role="radiogroup" aria-label="그 밖의 경비">
              {EXTRA_CATEGORIES.map((c) => (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={category === c}
                  disabled={!editable}
                  onClick={() => chooseCategory(c)}
                  className={categoryChip(category === c)}
                >
                  {CATEGORY_ICON[c]} {CATEGORY_LABEL[c]}
                </button>
              ))}
            </div>
          </details>
        </div>
        {/* 제목·지출 사유: 카테고리 바로 아래 고정(D-114) */}
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
        {/* ↓ 카테고리에 따라 바뀌는 영역(D-114): 안내·추가 정보 칸은 모두 제목·지출 사유 아래에 — 카테고리를 바꿔도 제목·사유 칸이 밀리지 않는다 */}
        <div className="flex flex-col gap-1.5 empty:hidden">
          {(category === "team_dinner" || category === "meeting" || category === "meal") && (
            // 식사 영수증은 AI로 구분이 안 돼 고를 때 기준을 보여 준다 (D-107)
            <p className="rounded-lg bg-zinc-50 px-3 py-2 text-xs text-zinc-600">
              {category === "meeting"
                ? "거래처·외부 사람이 함께한 자리예요. 회사 사람끼리만 먹었다면 [일반 식대] 또는 [그 밖의 경비 › 회식비]를 골라 주세요."
                : category === "team_dinner"
                  ? "회사 사람끼리만 한 회식이에요. 거래처·외부 사람이 함께했다면 [외부 미팅비]를 골라 주세요."
                  : "평소 점심·야근 식대예요(1식 한도 적용). 부서 회식은 [그 밖의 경비 › 회식비], 거래처와 함께면 [외부 미팅비]."}
            </p>
          )}
          {!category && <p className="text-xs text-amber-700">이 결의서의 지출 카테고리를 골라 주세요. 모든 영수증이 이 카테고리로 처리돼요.</p>}
          {aiCategory && (
            <p className="flex items-start gap-1.5 text-xs text-brand-700">
              <span className="shrink-0 whitespace-nowrap rounded-full bg-brand-50 px-2 py-0.5 font-semibold">✨ AI 추천</span>
              영수증을 보고 &lsquo;{CATEGORY_LABEL[aiCategory]}&rsquo;로 골라 뒀어요. 다르면 바꿔 주세요.
            </p>
          )}
        </div>
        {(category === "meal" || category === "meeting") && (
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-zinc-800">인원 (기본값)</span>
            <div className="flex items-center gap-3">
              <button type="button" aria-label="기본 인원 줄이기" disabled={(form.headcount ?? 1) <= 1} onClick={() => set("headcount", Math.max(1, (form.headcount ?? 1) - 1))} className="inline-flex size-11 items-center justify-center rounded-xl border border-zinc-300 bg-white disabled:opacity-40">
                <Minus className="size-4" />
              </button>
              <span className="min-w-12 text-center text-lg font-semibold tabular-nums" aria-live="polite">
                {form.headcount ?? 1}명
              </span>
              <button type="button" aria-label="기본 인원 늘리기" disabled={(form.headcount ?? 1) >= 99} onClick={() => set("headcount", Math.min(99, (form.headcount ?? 1) + 1))} className="inline-flex size-11 items-center justify-center rounded-xl border border-zinc-300 bg-white disabled:opacity-40">
                <Plus className="size-4" />
              </button>
            </div>
            <p className="text-xs text-zinc-500">저장하면 모든 영수증 인원에 들어가요. 영수증마다 다르면 펼쳐서 고쳐요.</p>
          </div>
        )}
        {category === "company_car" && (
          <div className="flex flex-col gap-1.5" aria-label="차량">
            <span className="text-sm font-medium text-zinc-800">
              차량{data.vehicles.length > 0 && <span className="ml-0.5 text-red-600">*</span>}
            </span>
            {data.vehicles.length ? (
              <Chips label="차량" options={data.vehicles.map((v) => ({ value: v.id, label: `${v.nickname} · ${v.plate_number}` }))} value={form.vehicleId} onChange={(v) => set("vehicleId", v)} />
            ) : (
              <p className="text-xs text-zinc-500">등록된 회사차량이 없어요. 관리자가 [설정 › 회사차량]에 등록하면 여기서 고를 수 있어요.</p>
            )}
          </div>
        )}
        {category === "meeting" && (
          <div className="flex flex-col gap-3 rounded-xl bg-zinc-50 p-3" aria-label="미팅 정보">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="claim-meeting-purpose" required>
                미팅 목적
              </Label>
              <input id="claim-meeting-purpose" className={inputClass} value={form.meetingPurpose} maxLength={200} placeholder="예: A사 신규 계약 협의" onChange={(e) => set("meetingPurpose", e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="claim-client">거래처명</Label>
              <input id="claim-client" className={inputClass} value={form.clientName} maxLength={100} placeholder="예: (주)에이컴퍼니" onChange={(e) => set("clientName", e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="claim-attendees">참석자</Label>
              <input id="claim-attendees" className={inputClass} value={form.attendees} maxLength={200} placeholder="예: A사 김부장, 우리 회사 박과장" onChange={(e) => set("attendees", e.target.value)} />
            </div>
          </div>
        )}
        {category === "purchase" && (
          <div className="flex flex-col gap-3 rounded-xl bg-zinc-50 p-3" aria-label="구매 정보">
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-zinc-800">
                구매 세부 유형<span className="ml-0.5 text-red-600">*</span>
              </span>
              <Chips label="구매 세부 유형" options={PURCHASE_TYPES.map((t) => ({ value: t, label: PURCHASE_TYPE_LABEL[t] }))} value={form.purchaseType} onChange={(v) => set("purchaseType", v)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="claim-purchase-purpose" required>
                구매 목적
              </Label>
              <input id="claim-purchase-purpose" className={inputClass} value={form.purchasePurpose} maxLength={200} placeholder="예: 탕비실 비품 보충" onChange={(e) => set("purchasePurpose", e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="claim-purchase-items">품목</Label>
              <input id="claim-purchase-items" className={inputClass} value={form.purchaseItems} maxLength={200} placeholder="예: 커피 원두, 생수 2박스" onChange={(e) => set("purchaseItems", e.target.value)} />
            </div>
            <p className="text-xs text-zinc-500">회사 물품은 전액 지원돼요.</p>
          </div>
        )}
        {category === "trip" && (
        <div className="flex flex-col gap-3 rounded-xl bg-zinc-50 p-3" aria-label="출장 정보">
          {(
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
                <div className="grid grid-cols-1 gap-2 min-[380px]:grid-cols-3" role="radiogroup" aria-label="이동 수단">
                  {(
                    [
                      ["own_car", "자차", Car],
                      ["public_transport", "대중교통", TrainFront],
                      ["company_car", "회사차량", Building2],
                    ] as [TripTransport, string, typeof Car][]
                  ).map(([v, label, Icon]) => (
                    <button
                      key={v}
                      type="button"
                      role="radio"
                      aria-checked={form.tripTransport === v}
                      onClick={() => {
                        set("tripTransport", v);
                        // 자차를 고르면 그 자리에서 경로 입력 칸이 펼쳐진다
                        if (v === "own_car" && editable && !data.fuel.blocked && ownCarItems.length === 0) newOwnCar();
                      }}
                      className={`inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border text-sm font-medium ${form.tripTransport === v ? "border-brand-600 bg-brand-50 text-brand-800" : "border-zinc-300 bg-white text-zinc-700"}`}
                    >
                      <Icon className="size-4" />
                      {label}
                    </button>
                  ))}
                </div>
                {form.tripTransport === "public_transport" && <p className="text-xs text-zinc-500">KTX·버스·항공권 영수증을 올리면 출장비 › 대중교통으로 분류돼요.</p>}
                {form.tripTransport === "company_car" && (
                  <div className="flex flex-col gap-1.5 rounded-xl border border-brand-200 bg-white p-2.5 sm:p-3" aria-label="출장에 쓴 회사차량">
                    <span className="text-sm font-medium text-zinc-800">
                      어느 차로 갔나요{data.vehicles.length > 0 && <span className="ml-0.5 text-red-600">*</span>}
                    </span>
                    {data.vehicles.length ? (
                      <Chips label="출장 차량" options={data.vehicles.map((v) => ({ value: v.id, label: `${v.nickname} · ${v.plate_number}` }))} value={form.vehicleId} onChange={(v) => set("vehicleId", v)} />
                    ) : (
                      <p className="text-xs text-zinc-500">등록된 회사차량이 없어요. 관리자가 [설정 › 회사차량]에 등록하면 여기서 고를 수 있어요.</p>
                    )}
                    <p className="text-xs text-zinc-500">주유·통행료·주차 영수증은 회사차량 비용(차량유지비)으로, 숙박·식사·대중교통은 출장비(여비교통비)로 자동으로 나눠요.</p>
                  </div>
                )}
              </div>
              {form.tripTransport === "own_car" && (
                <div className="flex flex-col gap-2 rounded-xl border border-brand-200 bg-white p-2.5 sm:p-3">
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
                      {[
                        ...ownCarItems.map((i) => ({ item: i as EditorItem | null, key: carDraft?.id === i.id ? `draft-${carDraft.key}` : i.id })),
                        ...(carDraft && !(carDraft.id && ownCarItems.some((i) => i.id === carDraft.id)) ? [{ item: null as EditorItem | null, key: `draft-${carDraft.key}` }] : []),
                      ].map(({ item: i, key }) => {
                        const isDraft = key.startsWith("draft-");
                        const open = isDraft || (!!i && openIds.has(i.id));
                        const card = i ? routeCardFrom(i, data.fuel.ratePerKm) : null;
                        return (
                          <div key={key} id={i ? `owncar-${i.id}` : undefined} className={`scroll-mt-4 rounded-xl ${open ? "sm:border sm:border-brand-200 sm:bg-brand-50/40 sm:p-3" : ""}`}>
                            {open ? (
                              <>
                                <OwnCarInline claim={claim} item={i} fuel={data.fuel} ensureItem={ensureOwnCar} register={register} onError={onItemError} />
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (isDraft) setCarDraft(null);
                                    if (i) setOpenIds((s) => {
                                      const n = new Set(s);
                                      n.delete(i.id);
                                      return n;
                                    });
                                  }}
                                  className="mx-auto mt-3 flex min-h-9 items-center gap-1 rounded-xl border border-zinc-200 bg-white px-5 text-xs font-medium text-zinc-600 hover:bg-zinc-100"
                                >
                                  {i ? "접기" : "닫기"}
                                  <ChevronDown className="size-4 rotate-180" />
                                </button>
                              </>
                            ) : (
                              <button type="button" onClick={() => i && toggleItem(i.id)} aria-expanded={false} className="block w-full text-left">
                                {card ? <RouteEvidenceCard card={card} compact /> : <span className="block rounded-lg border border-dashed border-zinc-300 px-3 py-3 text-sm text-zinc-600">경로를 아직 입력하지 않았어요 — 눌러서 입력</span>}
                                <span className="mt-1 flex items-center justify-center gap-1 text-xs text-zinc-500">
                                  펼쳐서 고치기 <ChevronDown className="size-4" />
                                </span>
                              </button>
                            )}
                          </div>
                        );
                      })}
                      {editable && !(carDraft && !carDraft.id) && (
                        <button
                          type="button"
                          onClick={newOwnCar}
                          className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-brand-300 bg-brand-50 px-3 text-sm font-semibold text-brand-800"
                        >
                          <Plus className="size-4" />
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
        )}
        {/* 예외 소명 사유(D-084): 주말·심야 사용이 있을 때만 보인다(가독성, D-109) */}
        {(exceptionText || form.exceptionMemo.trim()) && (
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
        )}
        {/* 결제수단 기본값: 새로 올리는 영수증에 먼저 들어가는 값일 뿐 — 영수증마다 따로 고르고, 카드번호가 보이면 자동으로 고른다. 한 줄로 접어 둔다(D-109) */}
        <div className="flex flex-col gap-2 text-sm">
          <div className="flex items-center justify-between gap-2">
            <span className="text-zinc-700">
              새 영수증 결제수단 <b className="ml-1 whitespace-nowrap text-zinc-900">{form.defaultPaymentMethod === "corporate_card" ? "💳 법인카드" : "🧾 개인(사비)"}</b>
            </span>
            <button type="button" onClick={() => setPayOpen((v) => !v)} className="min-h-11 shrink-0 rounded-lg px-2 text-zinc-600 underline underline-offset-2 hover:bg-zinc-50">
              {payOpen ? "닫기" : "바꾸기"}
            </button>
          </div>
          {payOpen && (
            <>
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
              <p className="text-xs text-zinc-500">영수증마다 따로 고를 수 있고, 영수증에 카드번호가 보이면 등록된 법인카드인지 자동으로 골라요.</p>
            </>
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
        {moved && (
          <p className="flex flex-wrap items-center gap-x-2 rounded-xl bg-sky-50 px-3 py-2 text-sm text-sky-800" role="status">
            {moved.label}로 옮겼어요.
            <Link href={`${base}/claims/${moved.claimId}/edit`} className="font-semibold underline underline-offset-2">
              그 결의서 열기
            </Link>
          </p>
        )}
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
              <ItemRow
                key={item.id}
                item={item}
                href={`${base}/claims/${claim.id}/items/${item.id}`}
                onOpen={() => showItem(item.id)}
                onDelete={() => removeItem(item.id)}
                problem={!!problems?.items.some((p) => p.item_id === item.id)}
                open={openIds.has(item.id)}
                onToggle={() => toggleItem(item.id)}
                mismatch={!isOwnCar(item) && !item.category_mismatch_ack && categoryMismatch(category, item.aiCategory)}
              >
                <ItemInlineForm
                  key={`${item.id}:${item.parse_status}:${item.headcount}:${item.category}:${item.trip_type}:${item.receipt_path ?? ""}`} // AI로 다시 읽은 뒤·결의서 값(인원·카테고리·출장 유형)이 영수증에 반영된 뒤 새 값으로 다시 그린다
                  claim={claim}
                  item={item}
                  cards={data.cards}
                  mealPolicy={data.mealPolicy}
                  mealOverride={data.mealOverride}
                  base={base}
                  deadline={data.deadline}
                  claimCategory={category}
                  tripTransport={form.tripTransport}
                  mismatch={!item.category_mismatch_ack && categoryMismatch(category, item.aiCategory)}
                  busy={busy}
                  onAckCategory={() => ackItem(item.id)}
                  onMoveCategory={() => moveItem(item)}
                  register={register}
                  onError={onItemError}
                />
              </ItemRow>
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
              <button
                key={p.item_id}
                type="button"
                onClick={() => showItem(p.item_id)}
                className="text-left underline-offset-2 hover:underline">
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
                    if (!(await flushItems())) return setConfirmSubmit(false);
                    const res = await measureAction("employee.submit_claim", () => submitClaimAction(claim.id));
                    setConfirmSubmit(false);
                    if (res.ok) {
                      router.push(base);
                      return;
                    }
                    if ("problems" in res) {
                      setProblems(res.problems);
                      // 빠진 칸이 있는 영수증은 펼쳐 둔다
                      setOpenIds((s) => new Set([...s, ...res.problems.items.map((x) => x.item_id)]));
                    }
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
      <div ref={barRef} className="kb-hide fixed inset-x-0 bottom-0 z-30 border-t border-zinc-200 bg-white/95 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur">
        <div className="mx-auto flex max-w-md flex-col gap-2 md:max-w-2xl">
          <UploadSummary rows={uploader.rows} />
          {message && (
            <p className={`rounded-lg px-3 py-2 text-sm ${message.kind === "ok" ? "bg-green-50 text-green-800" : "bg-red-50 text-red-700"}`} role={message.kind === "error" ? "alert" : "status"}>
              {message.text}
            </p>
          )}
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] items-center gap-2">
            {/* 저장은 자동(D-103): 버튼 대신 상태만 */}
            <p className="flex min-h-12 items-center gap-1.5 text-sm text-zinc-600" aria-live="polite">
              {saveState === "saving" || (dirty && saveState !== "error") ? (
                <>
                  <Loader2 className="size-4 shrink-0 animate-spin" /> 저장 중…
                </>
              ) : saveState === "error" ? (
                <button type="button" onClick={() => void persist()} className="font-medium text-red-700 underline underline-offset-2">
                  저장 실패 · 다시 저장
                </button>
              ) : (
                <>✓ 자동 저장됨</>
              )}
            </p>
            <button
              type="button"
              disabled={!editable || submitting || uploader.rows.some((r) => r.phase !== "failed")}
              onClick={() =>
                startSubmit(async () => {
                  setMessage(null);
                  // 펼쳐 고친 영수증과 바뀐 헤더를 먼저 저장하고, 서버에서 빠진 칸을 확인한 뒤 확인 창을 연다
                  if (!(await persist())) return;
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
