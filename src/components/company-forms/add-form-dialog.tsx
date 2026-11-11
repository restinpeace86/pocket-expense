"use client";

import { AlertTriangle, FileUp, Loader2, Sparkles, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { formDialogDataAction, readFormAction, requestSlotAction, startFormAction, type FormDialogData } from "@/app/workspace/[id]/admin/company-forms/actions";
import { KIND_LABEL, type FormKind } from "@/lib/company-forms/model";
import { CONVERT_MIMES, isConvertible } from "@/lib/doc-convert/model";
import { createClient } from "@/lib/supabase/client";

const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf" };

export type AddFormSource =
  | { type: "pick" } // 기기에서 고르기(관리자 설정 › 회사 양식)
  | { type: "chat"; messageId: string; name: string } // 채팅 사진·PDF
  | { type: "held"; id: string; name: string; group: string | null }; // 등록 대기(휴대폰에서 담아 둔 파일)

// B① 회사 양식으로 등록 · 어떤 문서인가요 (PC 창). 칸이 다 찼으면 B-4 안내 + [추가 신청] / [등록된 양식 바꾸기]
export function AddFormDialog({
  ws,
  companyId,
  me,
  source,
  group: initialGroup,
  onClose,
}: {
  ws: string;
  companyId: string;
  me: string;
  source: AddFormSource;
  group?: { id: string; name: string; kind: FormKind } | null; // [새 버전 올리기]
  onClose: () => void;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [data, setData] = useState<FormDialogData | null>(null);
  const [kind, setKind] = useState<FormKind>(initialGroup?.kind ?? "leave");
  const [group, setGroup] = useState<{ id: string; name: string; kind: FormKind } | null>(initialGroup ?? null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requested, setRequested] = useState(false);
  const picker = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void formDialogDataAction().then((r) => (r.ok ? (setData(r.data), setRequested(r.data.requested)) : setError(r.error)));
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !busy && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, busy]);

  const leave = data?.forms.find((f) => f.kind === "leave") ?? null;
  const heldGroup = source.type === "held" ? source.group : null;
  // 이 파일이 들어갈 양식: 새 버전 대상 / 이미 있는 휴가신청서(휴가는 하나) / 새 양식(칸 하나 씀)
  const held = heldGroup ? data?.forms.find((f) => f.group_id === heldGroup) : undefined;
  const target = group ?? (held ? { id: held.group_id, name: held.name, kind: held.kind } : null) ?? (kind === "leave" && leave ? { id: leave.group_id, name: leave.name, kind: "leave" as const } : null);
  const full = !!data && !target && data.used >= data.limit;
  const sourceName = source.type === "pick" ? (file?.name ?? null) : source.name;

  const pick = (f: File | undefined) => {
    setError(null);
    if (!f) return;
    if (!isConvertible(f.type)) return setError("사진(JPG·PNG)이나 PDF만 양식으로 등록할 수 있어요.");
    if (f.size > 20 * 1024 * 1024) return setError("20MB보다 작은 파일만 올릴 수 있어요.");
    setFile(f);
  };

  const go = async () => {
    setBusy(true);
    setError(null);
    try {
      const g = target?.id ?? null;
      let r: { ok: true; id: string } | { ok: false; error: string; id?: string };
      if (source.type === "held") r = await readFormAction(source.id, kind);
      else if (source.type === "chat") r = await startFormAction({ chat: source.messageId }, g, kind);
      else {
        const f = file!;
        const id = crypto.randomUUID();
        const { error: up } = await supabase.storage.from("doc-files").upload(`${companyId}/${me}/${id}.${EXT[f.type]}`, f, { contentType: f.type });
        if (up) r = { ok: false, error: "파일을 올리지 못했어요. 잠시 후 다시 시도해 주세요." };
        else r = await startFormAction({ upload: { id, name: f.name, mime: f.type } }, g, kind);
      }
      if (r.ok) {
        // 목록 화면은 이동 뒤에도 상태가 남으므로(돌아오면 창이 다시 열리지 않게) 먼저 닫는다
        onClose();
        return router.push(`${ws}/admin/company-forms/${r.id}`);
      }
      setError("id" in r && r.id ? `${r.error} 파일은 [회사 양식 › 등록 대기]에 남겨 뒀어요.` : r.error);
    } catch {
      setError("잠시 후 다시 시도해 주세요.");
    }
    setBusy(false);
  };

  const option = (k: FormKind | "expense", title: string, desc: string, badge?: string) => {
    const on = k === kind;
    const locked = !!group && k !== group.kind;
    if (k === "expense")
      return (
        <Link href={`${ws}/admin/form-template`} className="flex items-start gap-3 rounded-2xl border border-zinc-200 p-3.5 hover:bg-zinc-50" data-kind="expense">
          <span className="mt-0.5 size-5 shrink-0 rounded-full border-2 border-zinc-300" aria-hidden />
          <span>
            <b className="block text-[15px]">{title}</b>
            <span className="text-[13px] text-zinc-600">{desc}</span>
          </span>
        </Link>
      );
    return (
      <button
        type="button"
        role="radio"
        aria-checked={on}
        disabled={locked || busy}
        onClick={() => setKind(k)}
        className={`flex items-start gap-3 rounded-2xl p-3.5 text-left disabled:opacity-40 ${on ? "border-2 border-brand-600 bg-brand-50" : "border border-zinc-200 hover:bg-zinc-50"}`}
        data-kind={k}
      >
        <span className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-2 ${on ? "border-brand-600" : "border-zinc-300"}`} aria-hidden>
          {on && <span className="size-2.5 rounded-full bg-brand-600" />}
        </span>
        <span>
          <b className="flex items-center gap-1.5 text-[15px]">
            {title}
            {badge && <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium text-amber-900">{badge}</span>}
          </b>
          <span className="text-[13px] text-zinc-600">{desc}</span>
        </span>
      </button>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 md:items-center" onClick={() => !busy && onClose()}>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-form-title"
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92dvh] w-full max-w-[560px] flex-col gap-3.5 overflow-y-auto rounded-t-3xl bg-white px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-5 md:rounded-3xl"
        data-add-form
      >
        <div className="flex items-center">
          <h2 id="add-form-title" className="text-lg font-bold">
            {group ? `'${group.name}' 새 버전 올리기` : "회사 양식으로 등록"}
          </h2>
          <button type="button" onClick={onClose} disabled={busy} aria-label="닫기" className="ml-auto flex size-10 items-center justify-center rounded-lg text-zinc-600 hover:bg-zinc-100 disabled:opacity-40">
            <X className="size-5" />
          </button>
        </div>

        <div className="flex items-center justify-between rounded-xl bg-zinc-100 px-3.5 py-2.5 text-[13px]">
          <span className="text-zinc-700">회사 양식 칸</span>
          {data ? (
            <b data-slots={`${data.used}/${data.limit}`}>
              {data.used} / {data.limit}장 사용
            </b>
          ) : (
            <span className="h-4 w-16 animate-pulse rounded bg-zinc-200" />
          )}
        </div>

        {!group && (
          <div role="radiogroup" aria-label="어떤 문서인가요?" className="flex flex-col gap-2">
            <b className="text-[14px]">어떤 문서인가요?</b>
            {option("leave", "휴가신청서", leave ? `이미 등록된 '${leave.name}'의 새 버전으로 올려요(무료, 칸 그대로).` : "직원은 지금 휴가 신청 화면 그대로, 결재 뒤 이 모양으로 나와요.")}
            {option("general", "일반 결재 문서", "품의서·구매요청서·시말서 등 — 양식으로 입력 화면을 만들어요(쓰기는 다음 단계에서 열려요).", "2단계")}
            {option("expense", "지출결의서", "지출결의서는 [설정 › 양식·결재 › 지출결의서 양식]에서 따로 등록해요(칸 안 씀).")}
          </div>
        )}
        {target && !group && kind === "leave" && (
          <p className="rounded-xl bg-brand-50 px-3 py-2 text-[13px] text-brand-900" data-new-version>
            휴가신청서는 회사에 하나예요. &lsquo;{target.name}&rsquo;의 새 버전으로 올려요(무료). 이미 낸 신청서는 그때 버전 모양으로 나와요.
          </p>
        )}

        {full && (
          <SlotFull
            used={data!.used}
            limit={data!.limit}
            requested={requested}
            onRequested={() => setRequested(true)}
            forms={data!.forms}
            // 등록 대기 파일은 휴가신청서만 새 버전으로 옮겨진다(휴가를 고르면 자동) — 고르기·채팅 파일만 다른 양식으로 바꾸기
            onReplace={source.type === "held" ? undefined : (f) => (setGroup({ id: f.group_id, name: f.name, kind: f.kind }), setKind(f.kind))}
          />
        )}

        {source.type === "pick" && !full && (
          <div className="flex flex-col gap-1.5">
            <button type="button" onClick={() => picker.current?.click()} disabled={busy} className="flex h-12 items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-400 text-[14px] font-semibold text-zinc-800 hover:bg-zinc-50" data-form-pick>
              <FileUp className="size-4" aria-hidden /> {file ? "다른 파일 고르기" : "양식 사진·PDF 고르기"}
            </button>
            <input ref={picker} type="file" accept={CONVERT_MIMES.join(",")} hidden onChange={(e) => (pick(e.target.files?.[0]), (e.target.value = ""))} data-form-pick-input />
          </div>
        )}
        {sourceName && !full && (
          <p className="truncate rounded-xl border border-zinc-200 px-3 py-2 text-[13px] text-zinc-700" data-form-file>
            파일: <b>{sourceName}</b>
          </p>
        )}

        {busy && (
          <p role="status" className="flex items-center gap-2 rounded-2xl bg-brand-50 px-3.5 py-3 text-[14px] text-brand-900" data-form-busy>
            <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
            AI가 양식을 읽는 중이에요. 20~40초쯤 걸려요.
          </p>
        )}
        {error && (
          <p role="alert" className="rounded-xl bg-red-50 px-3 py-2.5 text-[13px] text-red-800" data-form-error>
            {error}
          </p>
        )}
        {!full && (
          <>
            <p className="flex items-center gap-1.5 text-[12.5px] text-zinc-600">
              <Sparkles className="size-3.5 shrink-0" aria-hidden /> 양식 등록은 크레딧이 들지 않아요. AI 다시 읽기는 1장당 2번까지.
            </p>
            <button
              type="button"
              onClick={() => void go()}
              disabled={busy || !data || (source.type === "pick" && !file)}
              className="flex h-12 items-center justify-center gap-2 rounded-xl bg-brand-600 text-[15px] font-bold text-white hover:bg-brand-700 disabled:opacity-50"
              data-form-go
            >
              {busy ? "읽는 중…" : "AI로 양식 읽기"}
            </button>
          </>
        )}
      </section>
    </div>
  );
}

// B-4: 칸을 다 썼을 때
export function SlotFull({
  used,
  limit,
  requested,
  onRequested,
  forms,
  onReplace,
}: {
  used: number;
  limit: number;
  requested: boolean;
  onRequested: () => void;
  forms: { group_id: string; name: string; kind: FormKind }[];
  onReplace?: (f: { group_id: string; name: string; kind: FormKind }) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [replacing, setReplacing] = useState(false);
  const ask = async () => {
    setBusy(true);
    const r = await requestSlotAction();
    setBusy(false);
    if (r.ok) onRequested();
    else setErr(r.error ?? "신청하지 못했어요.");
  };
  return (
    <div className="flex flex-col gap-2.5 rounded-2xl border border-amber-300 bg-amber-50 p-3.5" data-slot-full>
      <p className="flex items-start gap-2 text-[14px] font-semibold text-amber-950">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
        회사 양식 등록 횟수를 다 썼어요({used}/{limit}장).
      </p>
      <p className="text-[13px] leading-relaxed text-amber-950">
        양식을 더 등록하려면 추가 결제가 필요해요(1장 2만 원, 한 번 결제). 이미 등록한 양식을 고치거나 새 버전으로 바꾸는 것은 무료예요.
      </p>
      {requested ? (
        <p className="rounded-xl bg-white px-3 py-2 text-[13px] text-zinc-800" data-slot-requested>
          추가 신청을 받았어요. 지금은 결제를 받지 않는 기간이라 운영자가 확인한 뒤 칸을 늘려 드려요.
        </p>
      ) : (
        <p className="text-[12.5px] text-amber-900">지금은 결제를 받지 않는 기간이에요. [추가 신청]을 누르면 운영자가 칸을 늘려 드려요.</p>
      )}
      {err && <p className="text-[13px] text-red-800">{err}</p>}
      <div className="flex flex-wrap gap-2">
        {!requested && (
          <button type="button" onClick={() => void ask()} disabled={busy} className="h-10 rounded-xl bg-amber-900 px-4 text-sm font-bold text-white hover:bg-amber-950 disabled:opacity-60" data-slot-request>
            추가 신청
          </button>
        )}
        {onReplace && forms.length > 0 && (
          <button type="button" onClick={() => setReplacing((v) => !v)} className="h-10 rounded-xl border border-amber-400 bg-white px-4 text-sm font-semibold text-amber-950 hover:bg-amber-100" data-slot-replace>
            등록된 양식 바꾸기
          </button>
        )}
      </div>
      {replacing && onReplace && (
        <ul className="flex flex-col gap-1.5" aria-label="새 버전으로 바꿀 양식">
          {forms.map((f) => (
            <li key={f.group_id}>
              <button type="button" onClick={() => onReplace(f)} className="flex w-full items-center justify-between rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-left text-[14px] hover:bg-zinc-50" data-replace={f.name}>
                <span>
                  <b>{f.name}</b> <span className="text-[12px] text-zinc-600">· {KIND_LABEL[f.kind]}</span>
                </span>
                <span className="text-[12px] font-semibold text-brand-700">이 파일로 새 버전(무료)</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
