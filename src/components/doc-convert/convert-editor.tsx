"use client";

import { Check, ChevronLeft, Download, Loader2, Lock, Minus, Plus, Trash2, Undo2, Users, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { confirmConversionAction, deleteConversionAction, saveConversionAction } from "@/app/workspace/[id]/employee/convert/actions";
import { addRowBelow, baseName, cellAddress, deleteRow, draftDaysLeft, mergeAt, type DocModel, type Sheet } from "@/lib/doc-convert/model";
import { useSheetGrid } from "./use-sheet-grid";
import { createClient } from "@/lib/supabase/client";

export type Conversion = {
  id: string;
  member_id: string;
  name: string;
  mime: string;
  source_path: string;
  status: "draft" | "confirmed" | "reading";
  scope: "private" | "company";
  created_at: string;
  sheets: DocModel;
};

// 서류 → 엑셀 결과 보기·고치기(8-104 A③·A④). PC: 왼쪽 원본, 오른쪽 엑셀 같은 표(글자 고치기·행 추가/삭제·되돌리기) / 휴대폰: 미리보기 + 받기 + 확정
export function ConvertEditor({ ws, conv, mine, canDelete, ownerName }: { ws: string; conv: Conversion; mine: boolean; canDelete: boolean; ownerName: string }) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [doc, setDoc] = useState<DocModel>(conv.sheets);
  const [history, setHistory] = useState<DocModel[]>([]);
  const [tab, setTab] = useState(0);
  const [save, setSave] = useState<"saved" | "saving" | "error">("saved");
  const [busy, setBusy] = useState<"pdf" | "xlsx" | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [src, setSrc] = useState<string | null>(null);
  const pending = useRef<DocModel | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sheet = doc.sheets[Math.min(tab, doc.sheets.length - 1)];
  // 고치기는 PC(md 이상)에서만 — 휴대폰에서는 편집 표를 아예 그리지 않는다
  const [pcView, setPcView] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const on = () => setPcView(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  const editable = mine && pcView;

  useEffect(() => {
    void supabase.storage
      .from("doc-files")
      .createSignedUrl(conv.source_path, 600)
      .then(({ data }) => data && setSrc(data.signedUrl));
  }, [supabase, conv.source_path]);

  // 고친 표는 0.8초 뒤 저장(받기 전에는 바로 저장)
  const flush = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const d = pending.current;
    if (!d) return true;
    pending.current = null;
    setSave("saving");
    const r = await saveConversionAction(conv.id, d);
    setSave(r.ok ? "saved" : "error");
    if (!r.ok) setNotice(r.error ?? "저장하지 못했어요.");
    return r.ok;
  }, [conv.id]);
  const change = (next: DocModel) => {
    setHistory((h) => [...h.slice(-49), doc]);
    setDoc(next);
    pending.current = next;
    setSave("saving");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), 800);
  };
  const updateSheet = (fn: (s: Sheet) => Sheet) => {
    const ns = fn(sheet);
    if (ns === sheet) return;
    change({ ...doc, sheets: doc.sheets.map((s, i) => (i === tab ? ns : s)) });
  };
  const undo = () => {
    const prev = history[history.length - 1];
    if (!prev) return;
    setHistory((h) => h.slice(0, -1));
    setDoc(prev);
    pending.current = prev;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), 800);
  };
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (pending.current) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  const { sel, setSel, editing, value, cur, commit, renderTable, R } = useSheetGrid({ sheet, editable, onChange: updateSheet, onUndo: undo });

  const download = async (kind: "pdf" | "xlsx") => {
    commit();
    setBusy(kind);
    try {
      const latest = pending.current ?? doc;
      if (mine && !(await flush())) return;
      if (kind === "xlsx") {
        window.location.href = `${ws}/employee/convert/${conv.id}/xlsx`;
      } else {
        const { buildDocPdf } = await import("@/lib/doc-convert/pdf-client");
        const bytes = await buildDocPdf(latest);
        const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/pdf" }));
        const a = document.createElement("a");
        a.href = url;
        a.download = `${baseName(conv.name)}.pdf`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 10_000);
      }
    } catch {
      setNotice("파일을 만들지 못했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setBusy(null);
    }
  };
  const remove = async () => {
    if (!window.confirm(`'${conv.name}' 변환을 지울까요? 원본 사본과 고친 내용이 모두 지워져요.`)) return;
    const r = await deleteConversionAction(conv.id);
    if (!r.ok) return setNotice(r.error);
    pending.current = null;
    router.push(`${ws}/employee/convert`);
  };

  const badge =
    conv.status === "draft" ? (
      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900" data-badge="draft">
        초안 · {draftDaysLeft(conv.created_at)}일 뒤 삭제
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-900" data-badge="confirmed">
        {conv.scope === "company" ? <Users className="size-3" aria-hidden /> : <Lock className="size-3" aria-hidden />}
        확정 · {conv.scope === "company" ? "회사 공유" : "나만 보기"}
      </span>
    );

  const tabs = doc.sheets.length > 1 && (
    <div role="tablist" aria-label="쪽" className="flex gap-1 overflow-x-auto">
      {doc.sheets.map((s, i) => (
        <button
          key={i}
          type="button"
          role="tab"
          aria-selected={i === tab}
          onClick={() => {
            commit();
            setTab(i);
            setSel({ r: 0, c: 0 });
          }}
          className={`h-8 shrink-0 rounded-lg px-3 text-[13px] ${i === tab ? "bg-zinc-900 font-semibold text-white" : "bg-zinc-100 text-zinc-700"}`}
        >
          {s.name}
        </button>
      ))}
    </div>
  );

  const dlButtons = (cls: string) => (
    <>
      <button type="button" onClick={() => void download("pdf")} disabled={!!busy} className={`flex items-center justify-center gap-1.5 rounded-xl border border-zinc-300 bg-white font-semibold hover:bg-zinc-50 disabled:opacity-60 ${cls}`} data-dl="pdf">
        {busy === "pdf" ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />} PDF 받기
      </button>
      <button type="button" onClick={() => void download("xlsx")} disabled={!!busy} className={`flex items-center justify-center gap-1.5 rounded-xl border border-zinc-300 bg-white font-semibold hover:bg-zinc-50 disabled:opacity-60 ${cls}`} data-dl="xlsx">
        {busy === "xlsx" ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />} 엑셀 받기
      </button>
    </>
  );

  return (
    <main className="flex min-h-[calc(100dvh-4rem)] w-full flex-col bg-zinc-50 md:min-h-[calc(100dvh-3.5rem)]">
      <header className="flex flex-wrap items-center gap-2 border-b border-zinc-200 bg-white px-2 py-2 md:px-5">
        <Link href={`${ws}/employee/convert`} aria-label="변환 목록으로" className="flex size-10 items-center justify-center rounded-lg text-zinc-700 hover:bg-zinc-100">
          <ChevronLeft className="size-6" />
        </Link>
        <h1 className="min-w-0 flex-1 truncate text-base font-bold md:flex-none md:text-lg">{conv.name}</h1>
        {badge}
        {!mine && <span className="text-xs text-zinc-600">{ownerName} 님이 공유</span>}
        <span className="ml-auto hidden items-center gap-2 md:flex">
          {mine && (
            <span className="text-xs text-zinc-500" aria-live="polite" data-save={save}>
              {save === "saving" ? "저장 중…" : save === "error" ? "저장 못 함" : "저장됨"}
            </span>
          )}
          {dlButtons("h-10 px-3 text-sm")}
          {mine && (
            <button type="button" onClick={() => setConfirming(true)} className="flex h-10 items-center gap-1.5 rounded-xl bg-brand-600 px-4 text-sm font-bold text-white hover:bg-brand-700" data-confirm-open>
              <Check className="size-4" /> {conv.status === "confirmed" ? "공개 범위" : "확정하기"}
            </button>
          )}
          {canDelete && (
            <button type="button" onClick={() => void remove()} aria-label="변환 지우기" className="flex size-10 items-center justify-center rounded-xl text-zinc-600 hover:bg-red-50 hover:text-red-700" data-delete>
              <Trash2 className="size-4" />
            </button>
          )}
        </span>
      </header>

      {/* PC: 원본 ↔ 표 */}
      {pcView && (
      <div className="hidden min-h-0 flex-1 gap-4 p-4 md:flex lg:px-5">
        <section aria-label="원본" className="flex w-[38%] min-w-0 flex-col gap-2 rounded-2xl border border-zinc-200 bg-white p-3">
          <b className="text-[13px]">원본</b>
          <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-zinc-100 bg-zinc-50">
            {!src ? (
              <div className="h-full min-h-64 animate-pulse bg-zinc-100" />
            ) : conv.mime === "application/pdf" ? (
              <iframe src={src} title="원본 PDF" className="h-full min-h-[60vh] w-full" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={src} alt="원본" className="w-full" data-source-img />
            )}
          </div>
        </section>
        <section aria-label="엑셀로 바꾼 표" className="flex min-w-0 flex-1 flex-col rounded-2xl border border-zinc-200 bg-white">
          {mine ? (
            <div className="flex flex-wrap items-center gap-2 border-b border-zinc-100 px-3 py-2 text-[13px]">
              <span className="rounded-lg border border-zinc-200 px-2.5 py-1 font-semibold" data-address>
                {cellAddress(sel.r, sel.c)}
              </span>
              <span className="min-w-0 flex-1 truncate rounded-lg border border-brand-200 bg-brand-50 px-2.5 py-1 text-zinc-800" title={cur.t}>
                {editing ? value : cur.t || " "}
              </span>
              <button type="button" onClick={undo} disabled={!history.length} className="flex h-8 items-center gap-1 rounded-lg px-2 text-zinc-700 hover:bg-zinc-100 disabled:opacity-40" data-undo>
                <Undo2 className="size-4" /> 되돌리기
              </button>
              <button type="button" onClick={() => {
                  commit();
                  const at = sel.r + (mergeAt(sheet, sel.r, sel.c)?.rs ?? 1) - 1;
                  updateSheet((s) => addRowBelow(s, at));
                  setSel({ r: at + 1, c: 0 }); // 새 줄로(엑셀처럼) — 바로 [행 삭제]하면 새 줄이 지워진다
                }} className="flex h-8 items-center gap-1 rounded-lg px-2 text-zinc-700 hover:bg-zinc-100" data-row-add>
                <Plus className="size-4" /> 행 추가
              </button>
              <button type="button" onClick={() => (commit(), updateSheet((s) => deleteRow(s, sel.r)))} disabled={R <= 1} className="flex h-8 items-center gap-1 rounded-lg px-2 text-zinc-700 hover:bg-zinc-100 disabled:opacity-40" data-row-delete>
                <Minus className="size-4" /> 행 삭제
              </button>
            </div>
          ) : (
            <p className="border-b border-zinc-100 px-3 py-2 text-[13px] text-zinc-600">회사에 공유된 변환이에요. 고치기는 만든 사람만 할 수 있어요.</p>
          )}
          <div className="min-h-0 flex-1 overflow-auto p-3">{renderTable({ editable })}</div>
          <div className="flex items-center gap-2 border-t border-zinc-100 px-3 py-2">{tabs}</div>
        </section>
      </div>
      )}
      <p className="hidden px-5 pb-4 text-[12.5px] leading-relaxed text-zinc-600 md:block">
        AI가 만든 표예요. 숫자·글자를 꼭 확인해 주세요. 여기서는 <b>글자 고치기·행 추가/삭제</b>까지 돼요(칸을 누르고 바로 입력, Enter·Tab으로 이동, 칸 안 줄바꿈은 Alt+Enter) → 바로 [PDF 받기]. 칸 합치기·글꼴·색 등 더 손보려면{" "}
        <b>[엑셀 받기]</b> 후 엑셀에서 고쳐 주세요.
      </p>

      {/* 휴대폰: 미리보기 + 받기 + 확정 */}
      {!pcView && (
      <div className="flex flex-1 flex-col gap-3 p-3 pb-28 md:hidden">
        {tabs}
        <div className="overflow-auto rounded-2xl border border-zinc-200 bg-white p-2" data-mobile-preview>
          {renderTable({ editable: false })}
        </div>
        <p className="text-[12.5px] leading-relaxed text-zinc-600">← 옆으로 밀어서 보기 · 고치기는 PC에서 할 수 있어요. AI가 만든 표라 숫자·글자를 꼭 확인해 주세요.</p>
        <div className="mt-auto flex flex-col gap-2 border-t border-zinc-200 pt-3 pb-[env(safe-area-inset-bottom)]">
          <div className="grid grid-cols-2 gap-2">{dlButtons("h-12 text-[15px]")}</div>
          {mine && conv.status === "draft" && (
            <>
              <button type="button" onClick={() => void doConfirm("company")} className="h-12 rounded-xl bg-brand-600 text-[15px] font-bold text-white hover:bg-brand-700" data-confirm-mobile>
                회사에 공유하고 확정
              </button>
              <button type="button" onClick={() => void doConfirm("private")} className="h-10 text-sm font-semibold text-brand-700">
                나만 보기로 확정
              </button>
            </>
          )}
          {canDelete && (
            <button type="button" onClick={() => void remove()} className="h-10 text-sm text-red-700">
              지우기
            </button>
          )}
        </div>
      </div>
      )}

      {confirming && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 md:items-center" onClick={() => setConfirming(false)}>
          <section role="dialog" aria-modal="true" aria-labelledby="confirm-title" onClick={(e) => e.stopPropagation()} className="flex w-full max-w-md flex-col gap-3 rounded-t-3xl bg-white px-5 pb-6 pt-5 md:rounded-3xl" data-confirm-sheet>
            <div className="flex items-center">
              <h2 id="confirm-title" className="text-lg font-bold">
                {conv.status === "confirmed" ? "공개 범위" : "확정하기"}
              </h2>
              <button type="button" onClick={() => setConfirming(false)} aria-label="닫기" className="ml-auto flex size-10 items-center justify-center rounded-lg text-zinc-600 hover:bg-zinc-100">
                <X className="size-5" />
              </button>
            </div>
            <p className="text-[14px] leading-relaxed text-zinc-700">확정하면 30일 뒤에도 지워지지 않고 [서류 → 엑셀] 목록에 남아요. 확정한 뒤에도 고칠 수 있어요.</p>
            <button type="button" onClick={() => void doConfirm("company")} className="flex items-start gap-3 rounded-2xl border-2 border-brand-600 bg-brand-50 p-3 text-left" data-scope="company">
              <Users className="mt-0.5 size-5 text-brand-700" />
              <span>
                <b className="block text-[15px]">회사에 공유하고 확정</b>
                <span className="text-[13px] text-zinc-600">같은 회사 사람이 보고 받을 수 있어요(고치기는 나만)</span>
              </span>
            </button>
            <button type="button" onClick={() => void doConfirm("private")} className="flex items-start gap-3 rounded-2xl border border-zinc-200 p-3 text-left" data-scope="private">
              <Lock className="mt-0.5 size-5 text-zinc-700" />
              <span>
                <b className="block text-[15px]">나만 보기로 확정</b>
                <span className="text-[13px] text-zinc-600">나만 볼 수 있어요</span>
              </span>
            </button>
          </section>
        </div>
      )}
      {notice && (
        <div role="status" className="fixed inset-x-4 bottom-24 z-40 mx-auto flex max-w-md items-center gap-2 rounded-xl bg-zinc-800 px-3 py-2 text-sm text-white shadow" data-notice>
          <span className="flex-1">{notice}</span>
          <button type="button" onClick={() => setNotice(null)} aria-label="닫기">
            <X className="size-4" />
          </button>
        </div>
      )}
    </main>
  );

  async function doConfirm(scope: "private" | "company") {
    commit();
    if (!(await flush())) return;
    const r = await confirmConversionAction(conv.id, scope);
    setConfirming(false);
    setNotice(r.ok ? (scope === "company" ? "회사에 공유하고 확정했어요." : "나만 보기로 확정했어요.") : (r.error ?? "확정하지 못했어요."));
  }
}
