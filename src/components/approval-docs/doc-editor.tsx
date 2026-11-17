"use client";

import { Loader2, Paperclip, Trash2, X } from "lucide-react";
import { uploadFailText } from "@/lib/storage/room";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { addDocFileAction, deleteDocAction, removeDocFileAction, saveDocAction, submitDocAction } from "@/app/workspace/[id]/employee/docs/actions";
import { guarded } from "@/lib/action-guard";
import { processProof } from "@/lib/attendance/proof-image";
import { proofPath } from "@/lib/attendance/vacation";
import { inputFields, missingFields, type DocFile, type Payload } from "@/lib/approval-docs/model";
import { cleanRows } from "@/lib/company-forms/table";
import type { Field } from "@/lib/company-forms/model";
import { createClient } from "@/lib/supabase/client";
import { DocFields } from "./doc-fields";
import { DocFileList, DocFormButtons } from "./doc-shared";

// [결재 문서] 쓰기(9-33e3): 양식의 직원 입력 칸만 · 자동 저장 · 첨부(사진·PDF 5개) · 미리보기(회사 양식) · 올리기 확인 창에 결재선
const save = guarded(saveDocAction);
const submit = guarded(submitDocAction);
const MAX_FILES = 5;

export type LinePreview = { self: boolean; reviewers: string[] };

export function DocEditor({
  companyId,
  memberId,
  doc,
  fields,
  members,
  files,
  line,
  canDelete,
  formActive,
}: {
  companyId: string;
  memberId: string;
  doc: { id: string; title: string; doc_type: string; payload: Payload; status: string; rejection_reason: string | null; form_name: string };
  fields: Field[];
  members: { id: string; name: string }[];
  files: DocFile[];
  line: LinePreview;
  canDelete: boolean;
  formActive: boolean;
}) {
  const router = useRouter();
  const inputs = inputFields(fields);
  const [title, setTitle] = useState(doc.title);
  const [values, setValues] = useState<Payload>(doc.payload);
  const [state, setState] = useState<"saved" | "dirty" | "saving" | "error">("saved");
  const [error, setError] = useState<string | null>(null);
  const [invalid, setInvalid] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState<"submit" | "delete" | "file" | null>(null);
  // 자동 저장이 쓸 최신 값: 입력할 때(이벤트) 바로 넣는다(렌더 중엔 안 건드림)
  const latest = useRef({ title, values });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = async (): Promise<boolean> => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const t = latest.current.title.trim();
    if (!t) {
      setError("제목을 적어 주세요.");
      return false;
    }
    setState("saving");
    const r = await save(doc.id, t, forSave(latest.current.values));
    if (!r.ok) {
      setState("error");
      setError(r.error);
      return false;
    }
    setState("saved");
    setError(null);
    return true;
  };

  const changed = () => {
    setState("dirty");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), 1200);
  };
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);
  // 저장 안 된 채 나가려 하면 브라우저가 물어본다
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (state === "dirty" || state === "saving") e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [state]);

  // 양식의 제목 칸(건명 등, 표준 칸 title)을 쓰면 문서 제목도 따라감 — 제목을 따로 고치기 전까지
  const titleKey = inputs.find((f) => f.b.k === "input" && f.b.std === "title")?.key;
  // 저장할 값(9-33e7): 표는 빈 줄을 빼고, 첨부 칸에는 지금 붙인 파일 이름들
  const forSave = (v: Payload): Payload => {
    const out: Payload = { ...v };
    for (const f of inputs) {
      if (f.b.k !== "input") continue;
      if (f.b.type === "table") out[f.key] = cleanRows(Array.isArray(v[f.key]) ? (v[f.key] as string[][]) : []);
      if (f.b.type === "attach") out[f.key] = files.map((x) => x.name);
    }
    return out;
  };
  const onField = (key: string, v: string | string[][]) => {
    const next = { ...latest.current.values, [key]: v };
    const prevTitleField = typeof latest.current.values[key] === "string" ? (latest.current.values[key] as string) : "";
    const t = typeof v === "string" ? v : "";
    const follow = key === titleKey && (latest.current.title === doc.form_name || latest.current.title === prevTitleField || !latest.current.title.trim());
    latest.current = { title: follow && t.trim() ? t.slice(0, 100) : latest.current.title, values: next };
    if (follow && t.trim()) setTitle(t.slice(0, 100));
    setValues(next);
    if (invalid === key) setInvalid(null);
    changed();
  };

  // 첨부를 붙이거나 빼면 화면을 새로 읽는다 — 그 전에 아직 저장 안 된 입력을 먼저 저장(안 그러면 방금 쓴 내용이 사라짐)
  const saveFirst = async () => (timer.current || state === "dirty" ? flush() : true);
  const pickFiles = async (list: FileList | null) => {
    if (!list?.length) return;
    setBusy("file");
    setError(null);
    if (!(await saveFirst())) return setBusy(null);
    const supabase = createClient();
    let left = MAX_FILES - files.length;
    for (const file of Array.from(list)) {
      if (left <= 0) {
        setError(`첨부는 ${MAX_FILES}개까지예요.`);
        break;
      }
      try {
        const p = await processProof(file); // 사진은 줄이고 위치정보 지움, PDF는 그대로(10MB까지)
        const path = proofPath(companyId, memberId, doc.id, p.ext);
        const up = await supabase.storage.from("approval-files").upload(path, p.blob, { contentType: p.mime, upsert: false });
        if (up.error) throw new Error(await uploadFailText("파일을 올리지 못했어요. 다시 해 주세요."));
        const r = await addDocFileAction(doc.id, { path, name: p.name, mime: p.mime, size: p.after });
        if (!r.ok) throw new Error(r.error);
        left--;
      } catch (e) {
        setError(e instanceof Error ? e.message : "파일을 올리지 못했어요.");
      }
    }
    setBusy(null);
    router.refresh();
  };

  const tryOpenConfirm = async () => {
    const miss = missingFields(fields, forSave(values));
    if (!title.trim()) return setError("제목을 적어 주세요.");
    if (miss.length) {
      setInvalid(miss[0].key);
      setError(`꼭 적어야 하는 칸이 비어 있어요: ${miss.map((f) => f.label).join(", ")}`);
      document.querySelector(`[data-doc-field="${miss[0].key}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    if (await flush()) setConfirm(true);
  };

  const doSubmit = async () => {
    setBusy("submit");
    const r = await submit(doc.id, title.trim(), forSave(values));
    setBusy(null);
    if (!r.ok) {
      setConfirm(false);
      setError("missing" in r && r.missing ? `${r.error} (${r.missing})` : r.error);
      return;
    }
    setConfirm(false);
    router.refresh();
  };

  const doDelete = async () => {
    if (!window.confirm("이 문서를 지울까요? 첨부도 함께 지워져요.")) return;
    setBusy("delete");
    const r = await guarded(deleteDocAction)(companyId, doc.id);
    setBusy(null);
    if (r && !r.ok) setError(r.error);
  };

  const saveText = { saved: "자동 저장됨 ✓", dirty: "저장 기다리는 중…", saving: "저장 중…", error: "저장 못 했어요" }[state];
  return (
    <div className="flex flex-col gap-4" data-doc-editor={doc.id}>
      {doc.status === "rejected" && doc.rejection_reason && (
        <p role="status" className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-800">
          <b>반려됐어요</b> · {doc.rejection_reason}
          <span className="block text-[13px]">고쳐서 다시 올리면 결재가 처음부터 다시 시작돼요.</span>
        </p>
      )}
      {!formActive && <p className="rounded-xl bg-amber-50 px-3.5 py-2.5 text-[13px] text-amber-900">회사가 이 양식을 새로 고쳤어요. 이 문서는 쓰던 양식 그대로 올라가요.</p>}
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] text-zinc-600">{doc.form_name}</span>
        <span className={`text-xs ${state === "error" ? "font-semibold text-red-700" : state === "saved" ? "text-green-700" : "text-zinc-500"}`} data-save-state={state}>
          {saveText}
        </span>
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="doc-title" className="text-sm font-medium">
          문서 제목<span className="ml-0.5 text-red-600">*</span> <span className="text-xs font-normal text-zinc-500">목록에서 이 이름으로 보여요</span>
        </label>
        <input
          id="doc-title"
          maxLength={100}
          value={title}
          onChange={(e) => {
            latest.current = { ...latest.current, title: e.target.value };
            setTitle(e.target.value);
            changed();
          }}
          className="h-12 w-full rounded-xl border border-zinc-300 bg-white px-3 text-[15px] outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20"
        />
      </div>
      {inputs.length ? (
        <DocFields docType={doc.doc_type} fields={inputs} values={values} onChange={onField} members={members} invalid={invalid} files={files.map((x) => x.name)} />
      ) : (
        <p className="rounded-xl bg-zinc-50 px-3.5 py-3 text-[13px] text-zinc-600">이 양식은 직원이 적을 칸이 없어요. 이름·날짜 같은 칸은 자동으로 채워져요. 첨부만 붙여 올리면 돼요.</p>
      )}

      <section aria-label="첨부" className="flex flex-col gap-2" data-doc-attach>
        <span className="text-sm font-medium">
          첨부 <span className="text-xs font-normal text-zinc-500">(선택 · 사진·PDF {MAX_FILES}개까지, 사진은 자동으로 작게 줄여요)</span>
        </span>
        <DocFileList
          files={files}
          onRemove={async (f) => {
            if (!(await saveFirst())) return;
            const r = await guarded(removeDocFileAction)(f.id);
            if (!r.ok) setError(r.error);
          }}
        />
        {files.length < MAX_FILES && (
          <label className="inline-flex h-11 w-fit cursor-pointer items-center gap-1.5 rounded-xl border border-dashed border-zinc-400 px-3.5 text-sm text-zinc-700 hover:bg-zinc-50">
            {busy === "file" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Paperclip className="size-4" aria-hidden />}
            파일 붙이기
            <input type="file" accept="image/*,application/pdf" multiple hidden disabled={busy === "file"} onChange={(e) => void pickFiles(e.target.files).then(() => (e.target.value = ""))} data-doc-file-input />
          </label>
        )}
      </section>

      {error && (
        <p role="alert" className="text-sm font-semibold text-red-700" data-doc-error>
          {error}
        </p>
      )}

      <DocFormButtons companyId={companyId} docId={doc.id} before={flush} xlsx={false} />
      <div className="flex gap-2">
        {canDelete && (
          <button type="button" onClick={() => void doDelete()} disabled={!!busy} className="flex h-12 items-center justify-center gap-1.5 rounded-xl border border-zinc-300 px-4 text-sm text-zinc-700 hover:bg-zinc-50" data-doc-delete>
            {busy === "delete" ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" aria-hidden />}
            지우기
          </button>
        )}
        <button type="button" onClick={() => void tryOpenConfirm()} disabled={!!busy} className="flex h-12 flex-1 items-center justify-center gap-1.5 rounded-xl bg-brand-600 text-[15px] font-semibold text-white hover:bg-brand-700 disabled:opacity-70" data-doc-submit>
          {doc.status === "rejected" ? "고쳐서 다시 올리기" : "결재 올리기"}
        </button>
      </div>

      {confirm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 md:items-center" onClick={() => setConfirm(false)}>
          <section role="dialog" aria-modal="true" aria-labelledby="doc-submit-title" onClick={(e) => e.stopPropagation()} className="flex w-full max-w-md flex-col gap-3 rounded-t-3xl bg-white px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-5 md:rounded-3xl" data-doc-confirm>
            <div className="flex items-center">
              <h2 id="doc-submit-title" className="text-lg font-bold">
                결재 올리기
              </h2>
              <button type="button" onClick={() => setConfirm(false)} aria-label="닫기" className="ml-auto flex size-10 items-center justify-center rounded-lg text-zinc-600 hover:bg-zinc-100">
                <X className="size-5" />
              </button>
            </div>
            {line.self ? (
              <p className="text-sm text-zinc-700">대표 본인 문서라 올리면 바로 승인돼요.</p>
            ) : (
              <>
                <p className="text-sm text-zinc-700">이 순서로 결재가 진행돼요.</p>
                <ol className="flex flex-wrap items-center gap-1.5 text-[13px]" data-doc-line>
                  <li className="rounded-lg border border-zinc-200 px-2 py-1">나</li>
                  {line.reviewers.map((r, i) => (
                    <li key={i} className="flex items-center gap-1.5">
                      <span className="text-zinc-400">→</span>
                      <span className="rounded-lg border border-zinc-200 px-2 py-1">{r} 검토</span>
                    </li>
                  ))}
                  <li className="flex items-center gap-1.5">
                    <span className="text-zinc-400">→</span>
                    <span className="rounded-lg border border-brand-300 bg-brand-50 px-2 py-1 text-brand-800">관리자 최종 승인</span>
                  </li>
                </ol>
                <p className="text-xs text-zinc-500">결재라인은 관리자가 [설정 › 결재라인]에서 정해요. 첫 결재자가 보기 전까지는 회수할 수 있어요.</p>
              </>
            )}
            <div className="mt-1 flex gap-2">
              <button type="button" onClick={() => setConfirm(false)} className="h-12 flex-1 rounded-xl border border-zinc-300 text-sm">
                취소
              </button>
              <button type="button" onClick={() => void doSubmit()} disabled={busy === "submit"} className="flex h-12 flex-1 items-center justify-center gap-1.5 rounded-xl bg-brand-600 text-sm font-semibold text-white disabled:opacity-70" data-doc-submit-confirm>
                {busy === "submit" && <Loader2 className="size-4 animate-spin" />}
                올리기
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
