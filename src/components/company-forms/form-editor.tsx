"use client";

import { AlertTriangle, Check, ChevronLeft, Loader2, Minus, Monitor, Plus, RotateCw, Trash2, Undo2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { deleteFormAction, publishFormAction, readFormAction, saveFormAction } from "@/app/workspace/[id]/admin/company-forms/actions";
import {
  bindingSummary,
  cellHint,
  DATA_LABEL,
  dataKeysFor,
  INPUT_LABEL,
  inputCount,
  KIND_LABEL,
  MAX_INPUTS,
  MAX_LABEL,
  MAX_OPTIONS,
  MAX_READS,
  newKey,
  pendingCount,
  shiftFieldsAddRow,
  shiftFieldsDeleteRow,
  type Binding,
  type DataKey,
  type Field,
  type FormKind,
  type InputType,
} from "@/lib/company-forms/model";
import { addRowBelow, cellAddress, deleteRow, mergeAt, type DocModel, type Sheet } from "@/lib/doc-convert/model";
import { useSheetGrid, type CellLook } from "@/components/doc-convert/use-sheet-grid";
import { SheetView } from "./sheet-view";

export type EditorForm = { id: string; group_id: string; name: string; kind: FormKind; sheets: DocModel; fields: Field[]; reads: number; mime: string; replaces: string | null };
type State = { doc: DocModel; fields: Field[] };

// B② PC 회사 양식 등록: [레이아웃] 글자·행 고치기 / [칸 연결] 칸마다 채우는 방법 정하기 → 이름 → [등록하기]
export function FormEditor({ ws, form, src }: { ws: string; form: EditorForm; src: string | null }) {
  const router = useRouter();
  const [st, setSt] = useState<State>({ doc: form.sheets, fields: form.fields });
  const [history, setHistory] = useState<State[]>([]);
  const [name, setName] = useState(form.name);
  const [step, setStep] = useState<"layout" | "fields">("fields");
  const [tab, setTab] = useState(0);
  const [picked, setPicked] = useState<{ r: number; c: number } | null>(null);
  const [setting, setSetting] = useState<string | null>(null);
  const [save, setSave] = useState<"saved" | "saving" | "error">("saved");
  const [busy, setBusy] = useState<"publish" | "reread" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const pending = useRef<{ s: State; name: string } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sheet = st.doc.sheets[Math.min(tab, st.doc.sheets.length - 1)];
  const [pc, setPc] = useState(true);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const on = () => setPc(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  const flush = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const p = pending.current;
    if (!p) return true;
    pending.current = null;
    setSave("saving");
    const r = await saveFormAction(form.id, p.name, p.s.doc, p.s.fields);
    setSave(r.ok ? "saved" : "error");
    if (!r.ok) setNotice(r.error ?? "저장하지 못했어요.");
    return r.ok;
  }, [form.id]);
  const queue = (s: State, n: string) => {
    pending.current = { s, name: n };
    setSave("saving");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), 800);
  };
  const change = (next: State) => {
    setHistory((h) => [...h.slice(-49), st]);
    setSt(next);
    queue(next, name);
  };
  const undo = () => {
    const prev = history[history.length - 1];
    if (!prev) return;
    setHistory((h) => h.slice(0, -1));
    setSt(prev);
    queue(prev, name);
  };
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (pending.current) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  const updateSheet = (fn: (s: Sheet) => Sheet) => {
    const ns = fn(sheet);
    if (ns === sheet) return;
    change({ ...st, doc: { ...st.doc, sheets: st.doc.sheets.map((s, i) => (i === tab ? ns : s)) } });
  };
  const layoutMode = step === "layout" && pc;
  const grid = useSheetGrid({ sheet, editable: layoutMode, onChange: updateSheet, onUndo: undo });
  const fieldAt = useMemo(() => new Map(st.fields.filter((f) => f.s === tab).map((f) => [`${f.r}:${f.c}`, f])), [st.fields, tab]);
  const look = (r: number, c: number): CellLook | undefined => {
    const f = fieldAt.get(`${r}:${c}`);
    if (!f) return undefined;
    const on = setting === f.key || (picked && picked.r === r && picked.c === c);
    return {
      className: on ? "bg-brand-50" : f.b.k === "pending" ? "bg-amber-50 shadow-[inset_0_0_0_2px_#f59e0b]" : f.b.k === "drop" ? "bg-zinc-100 text-zinc-400 line-through" : "bg-emerald-50 shadow-[inset_0_0_0_2px_#10b981]",
      hint: cellHint(f.b, f.label),
      attrs: { "data-field": f.key, "data-field-state": f.b.k },
    };
  };

  const pendingN = pendingCount(st.fields);
  const inputsN = inputCount(st.fields);
  const tooMany = inputsN > MAX_INPUTS[form.kind];
  const readsLeft = MAX_READS - form.reads;
  const current = setting ? st.fields.find((f) => f.key === setting) ?? null : null;
  const pickedField = picked ? fieldAt.get(`${picked.r}:${picked.c}`) ?? null : null;
  const ordered = [...st.fields].sort((a, b) => Number(isPendingFirst(b)) - Number(isPendingFirst(a)) || a.s - b.s || a.r - b.r || a.c - b.c);

  const setField = (key: string, patch: Partial<Field>) => change({ ...st, fields: st.fields.map((f) => (f.key === key ? { ...f, ...patch } : f)) });
  const addField = (r: number, c: number) => {
    // 왼쪽 라벨 칸 글자를 이름으로
    let label = "";
    let lab: { lr?: number; lc?: number } = {};
    for (let x = c - 1; x >= 0; x--) {
      const t = sheet.cells[r]?.[x]?.t.trim();
      if (t) {
        label = t.replace(/\s+/g, " ").slice(0, MAX_LABEL);
        lab = { lr: r, lc: x };
        break;
      }
    }
    const f: Field = { key: newKey(st.fields), label: label || cellAddress(r, c), s: tab, r, c, ...lab, b: { k: "pending" } };
    change({ ...st, fields: [...st.fields, f] });
    setSetting(f.key);
  };

  const rowAdd = () => {
    grid.commit();
    const at = grid.sel.r + (mergeAt(sheet, grid.sel.r, grid.sel.c)?.rs ?? 1) - 1;
    const ns = addRowBelow(sheet, at);
    if (ns === sheet) return;
    change({ doc: { ...st.doc, sheets: st.doc.sheets.map((s, i) => (i === tab ? ns : s)) }, fields: shiftFieldsAddRow(st.fields, tab, at) });
    grid.setSel({ r: at + 1, c: 0 });
  };
  const rowDelete = () => {
    grid.commit();
    const r = grid.sel.r;
    const ns = deleteRow(sheet, r);
    if (ns === sheet) return;
    const multi = new Set(sheet.merges.filter((g) => g.r === r && g.rs > 1).map((g) => g.c));
    change({ doc: { ...st.doc, sheets: st.doc.sheets.map((s, i) => (i === tab ? ns : s)) }, fields: shiftFieldsDeleteRow(st.fields, tab, r, (f) => multi.has(f.c)) });
  };

  const reread = async () => {
    if (!window.confirm(`AI가 양식을 다시 읽을까요? 지금까지 고친 표와 칸 연결이 모두 바뀌어요(다시 읽기 ${readsLeft}번 남음).`)) return;
    setBusy("reread");
    pending.current = null;
    const r = await readFormAction(form.id, form.kind);
    setBusy(null);
    if (!r.ok) return setNotice(r.error);
    router.refresh();
  };
  const publish = async () => {
    grid.commit();
    if (!(await flush())) return;
    setBusy("publish");
    const r = await publishFormAction(form.id, name, st.doc, st.fields);
    setBusy(null);
    if (!r.ok) return setNotice(r.error ?? "등록하지 못했어요.");
    router.push(`${ws}/admin/company-forms`);
  };
  const remove = async () => {
    if (!window.confirm("등록 중인 양식을 지울까요?")) return;
    pending.current = null;
    const r = await deleteFormAction(form.id);
    if (!r.ok) return setNotice(r.error);
    router.push(`${ws}/admin/company-forms`);
  };

  if (!pc)
    return (
      <div className="flex flex-col items-start gap-3 rounded-2xl border border-zinc-200 bg-white p-5" data-pc-only>
        <Monitor className="size-8 text-brand-700" aria-hidden />
        <h1 className="text-lg font-bold">양식 등록은 PC에서 해 주세요</h1>
        <p className="text-[14px] leading-relaxed text-zinc-700">칸을 하나하나 연결해야 해서 큰 화면이 필요해요. 지금까지 한 내용은 저장돼 있어요 — PC에서 [설정 › 회사 양식 › 등록 대기]를 열어 이어 하세요.</p>
        <Link href={`${ws}/admin/company-forms`} className="flex h-11 items-center rounded-xl bg-zinc-900 px-4 text-sm font-bold text-white">
          회사 양식 목록
        </Link>
      </div>
    );

  return (
    <div className="flex min-w-0 flex-col gap-3" data-form-editor>
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border border-zinc-200 bg-white px-3 py-2.5">
        <Link href={`${ws}/admin/company-forms`} aria-label="회사 양식 목록으로" className="flex size-9 items-center justify-center rounded-lg text-zinc-700 hover:bg-zinc-100">
          <ChevronLeft className="size-5" />
        </Link>
        <h1 className="text-base font-bold">
          회사 양식 등록 · {KIND_LABEL[form.kind]}
          {form.replaces && <span className="ml-1 text-sm font-normal text-zinc-600">(&lsquo;{form.replaces}&rsquo; 새 버전)</span>}
        </h1>
        <nav aria-label="단계" className="flex items-center gap-1 text-[13px]">
          {(
            [
              ["layout", "① 레이아웃"],
              ["fields", "② 칸 연결"],
            ] as const
          ).map(([k, label]) => (
            <button key={k} type="button" onClick={() => (grid.commit(), setStep(k), setPicked(null))} aria-current={step === k ? "step" : undefined} className={`h-8 rounded-lg px-2.5 ${step === k ? "bg-brand-100 font-bold text-brand-900" : "text-zinc-600 hover:bg-zinc-100"}`} data-step={k}>
              {label}
            </button>
          ))}
        </nav>
        <label className="ml-auto flex items-center gap-2 text-[13px]">
          <span className="text-zinc-600">③ 이름</span>
          <input
            value={name}
            maxLength={60}
            onChange={(e) => {
              setName(e.target.value);
              if (e.target.value.trim()) queue(st, e.target.value);
            }}
            className="h-9 w-44 rounded-lg border border-zinc-300 px-2.5 text-[14px]"
            aria-label="양식 이름"
            data-form-name
          />
        </label>
        <span className="text-xs text-zinc-500" aria-live="polite" data-save={save}>
          {save === "saving" ? "저장 중…" : save === "error" ? "저장 못 함" : "저장됨"}
        </span>
      </header>

      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-zinc-200 bg-white px-3 py-2">
        {pendingN > 0 ? (
          <span className="flex items-center gap-1.5 text-[13px] font-semibold text-amber-800" data-pending={pendingN}>
            <AlertTriangle className="size-4" aria-hidden /> 정할 칸 {pendingN}개 남음
          </span>
        ) : (
          <span className="flex items-center gap-1.5 text-[13px] font-semibold text-emerald-800" data-pending="0">
            <Check className="size-4" aria-hidden /> 모든 칸을 정했어요
          </span>
        )}
        <span className={`text-[13px] ${tooMany ? "font-semibold text-red-700" : "text-zinc-600"}`}>
          직원 입력 칸 {inputsN} / {MAX_INPUTS[form.kind]}개
        </span>
        <span className="ml-auto flex items-center gap-1.5">
          {readsLeft > 0 && (
            <button type="button" onClick={() => void reread()} disabled={!!busy} className="flex h-9 items-center gap-1 rounded-lg px-2.5 text-[13px] text-zinc-700 hover:bg-zinc-100 disabled:opacity-50" data-reread>
              {busy === "reread" ? <Loader2 className="size-4 animate-spin" /> : <RotateCw className="size-4" />} AI로 다시 읽기({readsLeft}번 남음)
            </button>
          )}
          <button type="button" onClick={() => void remove()} aria-label="등록 중인 양식 지우기" className="flex size-9 items-center justify-center rounded-lg text-zinc-600 hover:bg-red-50 hover:text-red-700" data-form-remove>
            <Trash2 className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => void publish()}
            disabled={!!busy || pendingN > 0 || tooMany || !name.trim()}
            title={pendingN > 0 ? "'정해 주세요' 칸을 모두 정해야 등록할 수 있어요" : undefined}
            className="flex h-10 items-center gap-1.5 rounded-xl bg-brand-600 px-4 text-sm font-bold text-white hover:bg-brand-700 disabled:opacity-50"
            data-publish
          >
            {busy === "publish" ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} 등록하기
          </button>
        </span>
      </div>

      {step === "layout" ? (
        <div className="flex min-h-[60vh] gap-3">
          <section aria-label="원본" className="flex w-[34%] min-w-0 flex-col gap-2 rounded-2xl border border-zinc-200 bg-white p-3">
            <b className="text-[13px]">원본</b>
            <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-zinc-100 bg-zinc-50">
              {!src ? (
                <p className="p-3 text-[13px] text-zinc-500">원본을 불러오지 못했어요.</p>
              ) : form.mime === "application/pdf" ? (
                <iframe src={src} title="원본 PDF" className="h-full min-h-[60vh] w-full" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={src} alt="원본" className="w-full" data-source-img />
              )}
            </div>
          </section>
          <section aria-label="양식 표" className="flex min-w-0 flex-1 flex-col rounded-2xl border border-zinc-200 bg-white">
            <div className="flex flex-wrap items-center gap-2 border-b border-zinc-100 px-3 py-2 text-[13px]">
              <span className="rounded-lg border border-zinc-200 px-2.5 py-1 font-semibold">{cellAddress(grid.sel.r, grid.sel.c)}</span>
              <span className="min-w-0 flex-1 truncate rounded-lg border border-brand-200 bg-brand-50 px-2.5 py-1 text-zinc-800">{grid.editing ? grid.value : grid.cur.t || " "}</span>
              <button type="button" onClick={undo} disabled={!history.length} className="flex h-8 items-center gap-1 rounded-lg px-2 text-zinc-700 hover:bg-zinc-100 disabled:opacity-40" data-undo>
                <Undo2 className="size-4" /> 되돌리기
              </button>
              <button type="button" onClick={rowAdd} className="flex h-8 items-center gap-1 rounded-lg px-2 text-zinc-700 hover:bg-zinc-100" data-row-add>
                <Plus className="size-4" /> 행 추가
              </button>
              <button type="button" onClick={rowDelete} disabled={grid.R <= 1} className="flex h-8 items-center gap-1 rounded-lg px-2 text-zinc-700 hover:bg-zinc-100 disabled:opacity-40" data-row-delete>
                <Minus className="size-4" /> 행 삭제
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-auto p-3">{grid.renderTable({ editable: true, look })}</div>
            {sheetTabs()}
          </section>
        </div>
      ) : (
        <div className="flex min-h-[60vh] gap-3">
          <section aria-label="양식 미리보기" className="flex min-w-0 flex-1 flex-col gap-2 rounded-2xl border border-zinc-200 bg-white p-3">
            <p className="flex flex-wrap items-center gap-3 text-[12.5px] text-zinc-600">
              <span className="flex items-center gap-1">
                <i className="inline-block size-3 rounded-sm bg-emerald-50 shadow-[inset_0_0_0_2px_#10b981]" /> 정해진 칸
              </span>
              <span className="flex items-center gap-1">
                <i className="inline-block size-3 rounded-sm bg-amber-50 shadow-[inset_0_0_0_2px_#f59e0b]" /> 정해 주세요
              </span>
              <span className="flex items-center gap-1">
                <i className="inline-block size-3 rounded-sm outline outline-2 outline-brand-600" /> 선택한 칸
              </span>
            </p>
            <div className="min-h-0 flex-1 overflow-auto">
              <SheetView
                sheet={sheet}
                look={look}
                picked={picked}
                onPick={(r, c) => {
                  setPicked({ r, c });
                  const f = fieldAt.get(`${r}:${c}`);
                  if (f) setSetting(f.key);
                }}
              />
            </div>
            {sheetTabs()}
            <p className="text-[12.5px] text-zinc-600">칸을 누르면 채우는 방법을 고를 수 있어요. AI가 놓친 칸은 눌러서 [값 칸으로 만들기]. 글자·행은 ① 레이아웃에서 고쳐요.</p>
          </section>
          <aside aria-label="칸 목록" className="flex w-[380px] shrink-0 flex-col gap-2 rounded-2xl border border-zinc-200 bg-white p-3">
            <div className="flex items-center justify-between">
              <b className="text-[15px]">칸 {st.fields.length}개</b>
              <span className="text-[12.5px] text-zinc-600">
                정함 {st.fields.length - pendingN} · 정할 칸 {pendingN}
              </span>
            </div>
            {picked && !pickedField && (
              <div className="flex flex-col gap-2 rounded-xl border border-dashed border-brand-300 bg-brand-50/50 p-3" data-picked-cell>
                <p className="text-[13px] text-zinc-700">
                  {cellAddress(picked.r, picked.c)} 칸은 값 칸이 아니에요(양식 글자 그대로 나와요).
                </p>
                <button type="button" onClick={() => addField(picked.r, picked.c)} className="h-9 rounded-lg border border-brand-300 bg-white text-[13px] font-semibold text-brand-800 hover:bg-brand-50" data-field-add>
                  이 칸을 값 칸으로 만들기
                </button>
              </div>
            )}
            <ul className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto" data-field-list>
              {ordered.map((f) => (
                <li key={f.key}>
                  <button
                    type="button"
                    onClick={() => {
                      setTab(f.s);
                      setPicked({ r: f.r, c: f.c });
                      setSetting(f.key);
                    }}
                    className={`flex w-full items-center gap-2 rounded-xl border px-3 py-2.5 text-left ${picked && picked.r === f.r && picked.c === f.c && tab === f.s ? "border-2 border-brand-600" : "border-zinc-200 hover:bg-zinc-50"}`}
                    data-field-item={f.label}
                  >
                    <span className="min-w-0 flex-1">
                      <b className="block truncate text-[14px]">{f.label}</b>
                      <span className="block truncate text-[12px] text-zinc-600">{bindingSummary(f.b)}</span>
                    </span>
                    {f.b.k === "pending" ? (
                      <span className="flex shrink-0 items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11.5px] font-medium text-amber-900">
                        <AlertTriangle className="size-3" aria-hidden /> 정해 주세요
                      </span>
                    ) : (
                      <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[11.5px] font-medium text-emerald-800">✓ {f.b.k === "data" ? "연결됨" : f.b.k === "drop" ? "빼기" : "정함"}</span>
                    )}
                  </button>
                </li>
              ))}
              {st.fields.length === 0 && <li className="rounded-xl border border-dashed border-zinc-300 px-3 py-6 text-center text-[13px] text-zinc-600">AI가 값 칸을 찾지 못했어요. 왼쪽 표에서 칸을 눌러 값 칸으로 만들어 주세요.</li>}
            </ul>
            <p className="text-[12px] text-zinc-500">결재란은 결재라인 순서대로 이름·직급·날짜가 들어가요(서명·도장 이미지는 아직 없어요).</p>
          </aside>
        </div>
      )}

      {current && (
        <FieldSetDialog
          field={current}
          kind={form.kind}
          othersInputs={st.fields.filter((f) => f.key !== current.key && f.b.k === "input").length}
          onClose={() => setSetting(null)}
          onSave={(label, b) => {
            setField(current.key, { label, b });
            setSetting(null);
          }}
          onRemove={() => {
            change({ ...st, fields: st.fields.filter((f) => f.key !== current.key) });
            setSetting(null);
          }}
        />
      )}
      {notice && (
        <div role="status" className="fixed inset-x-4 bottom-6 z-[60] mx-auto flex max-w-md items-center gap-2 rounded-xl bg-zinc-800 px-3 py-2 text-sm text-white shadow" data-notice>
          <span className="flex-1">{notice}</span>
          <button type="button" onClick={() => setNotice(null)} aria-label="닫기">
            <X className="size-4" />
          </button>
        </div>
      )}
    </div>
  );

  function sheetTabs() {
    if (st.doc.sheets.length < 2) return null;
    return (
      <div role="tablist" aria-label="쪽" className="flex gap-1 overflow-x-auto px-3 pb-2">
        {st.doc.sheets.map((s, i) => (
          <button key={i} type="button" role="tab" aria-selected={i === tab} onClick={() => (grid.commit(), setTab(i), grid.setSel({ r: 0, c: 0 }), setPicked(null))} className={`h-8 shrink-0 rounded-lg px-3 text-[13px] ${i === tab ? "bg-zinc-900 font-semibold text-white" : "bg-zinc-100 text-zinc-700"}`}>
            {s.name}
          </button>
        ))}
      </div>
    );
  }
}

const isPendingFirst = (f: Field) => f.b.k === "pending";

// B③ 칸 하나 정하기: 우리 데이터 / 직원 입력 / 고정 값 / 비워 두기 / 빼기
function FieldSetDialog({
  field,
  kind,
  othersInputs,
  onClose,
  onSave,
  onRemove,
}: {
  field: Field;
  kind: FormKind;
  othersInputs: number;
  onClose: () => void;
  onSave: (label: string, b: Binding) => void;
  onRemove: () => void;
}) {
  const b0 = field.b;
  const [label, setLabel] = useState(field.label);
  const [k, setK] = useState<Binding["k"]>(b0.k === "pending" ? "input" : b0.k);
  const [src, setSrc] = useState<DataKey>(b0.k === "data" ? b0.src : dataKeysFor(kind)[0]);
  const [type, setType] = useState<InputType>(b0.k === "input" ? b0.type : "text");
  const [required, setRequired] = useState(b0.k === "input" ? b0.required : true);
  const [options, setOptions] = useState((b0.k === "input" && b0.options?.join("\n")) || "");
  const [fixed, setFixed] = useState(b0.k === "fixed" ? b0.value : "");
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const opts = options
    .split("\n")
    .map((o) => o.trim())
    .filter(Boolean)
    .slice(0, MAX_OPTIONS);
  const max = MAX_INPUTS[kind];
  const inputFull = k === "input" && b0.k !== "input" && othersInputs >= max;
  const invalid = !label.trim() || inputFull || (k === "input" && type === "choice" && opts.length < 2) || (k === "fixed" && !fixed.trim());
  const build = (): Binding =>
    k === "data" ? { k, src } : k === "input" ? { k, type, required, ...(type === "choice" ? { options: opts.map((o) => o.slice(0, 40)) } : {}) } : k === "fixed" ? { k, value: fixed.trim() } : k === "blank" ? { k } : { k: "drop" };

  const radio = (v: Binding["k"], title: string, desc: string, extra?: React.ReactNode) => (
    <div className={`rounded-2xl p-3.5 ${k === v ? "border-2 border-brand-600 bg-brand-50/60" : "border border-zinc-200"}`}>
      <button type="button" role="radio" aria-checked={k === v} onClick={() => setK(v)} className="flex w-full items-start gap-3 text-left" data-binding={v}>
        <span className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-2 ${k === v ? "border-brand-600" : "border-zinc-300"}`} aria-hidden>
          {k === v && <span className="size-2.5 rounded-full bg-brand-600" />}
        </span>
        <span>
          <b className="block text-[15px]">{title}</b>
          <span className="text-[13px] text-zinc-600">{desc}</span>
        </span>
      </button>
      {k === v && extra && <div className="mt-2.5 pl-8">{extra}</div>}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <section role="dialog" aria-modal="true" aria-labelledby="field-set-title" onClick={(e) => e.stopPropagation()} className="flex max-h-[92dvh] w-full max-w-[520px] flex-col gap-3 overflow-y-auto rounded-3xl bg-white p-5" data-field-dialog>
        <div className="flex items-center">
          <h2 id="field-set-title" className="text-lg font-bold">
            &lsquo;{field.label}&rsquo; 칸
          </h2>
          <button type="button" onClick={onClose} aria-label="닫기" className="ml-auto flex size-10 items-center justify-center rounded-lg text-zinc-600 hover:bg-zinc-100">
            <X className="size-5" />
          </button>
        </div>
        {b0.k === "pending" && (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-[13px] text-amber-950">
            우리 앱 데이터에는 <b>{field.label}</b>이(가) 없어요. 이 칸을 어떻게 채울지 골라 주세요.
          </p>
        )}
        <label className="flex items-center gap-2 text-[13px]">
          <span className="shrink-0 text-zinc-600">칸 이름</span>
          <input value={label} maxLength={MAX_LABEL} onChange={(e) => setLabel(e.target.value)} className="h-9 min-w-0 flex-1 rounded-lg border border-zinc-300 px-2.5 text-[14px]" data-field-label />
        </label>
        <div role="radiogroup" aria-label="채우는 방법" className="flex flex-col gap-2">
          {radio(
            "data",
            "우리 데이터로 채움",
            "신청 내용·직원 정보·결재란에서 자동으로 넣어요",
            <select value={src} onChange={(e) => setSrc(e.target.value as DataKey)} className="h-10 w-full rounded-lg border border-zinc-300 px-2 text-[14px]" data-data-src>
              {dataKeysFor(kind).map((key) => (
                <option key={key} value={key}>
                  {DATA_LABEL[key]}
                </option>
              ))}
            </select>,
          )}
          {radio(
            "input",
            "신청할 때 직원이 입력",
            kind === "leave" ? "휴가 신청 화면 아래 [회사 추가 항목]에 칸이 생겨요" : "결재 문서 입력 화면에 칸이 생겨요",
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap gap-1.5">
                {(Object.keys(INPUT_LABEL) as InputType[]).map((t) => (
                  <button key={t} type="button" onClick={() => setType(t)} className={`h-8 rounded-full px-3 text-[13px] ${type === t ? "bg-zinc-900 font-semibold text-white" : "border border-zinc-300 bg-white text-zinc-700"}`} data-input-type={t}>
                    {INPUT_LABEL[t]}
                  </button>
                ))}
              </div>
              {type === "choice" && (
                <textarea value={options} onChange={(e) => setOptions(e.target.value)} rows={3} placeholder={"한 줄에 하나씩(2~10개)\n예: 오전\n오후"} className="rounded-lg border border-zinc-300 px-2.5 py-1.5 text-[14px]" data-input-options />
              )}
              <label className="flex items-center justify-between text-[14px]">
                필수
                <input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} className="size-5 accent-brand-600" data-input-required />
              </label>
              <p className={`text-[12.5px] ${inputFull ? "font-semibold text-red-700" : "text-zinc-600"}`}>
                직원 추가 칸 {othersInputs + 1} / {max}개 사용{inputFull ? " — 더 넣을 수 없어요" : ""}
              </p>
            </div>,
          )}
          {radio(
            "fixed",
            "고정 값",
            "모든 문서에 같은 글자를 넣어요(예: 회사 공통 문구)",
            <input value={fixed} maxLength={200} onChange={(e) => setFixed(e.target.value)} placeholder="넣을 글자" className="h-10 w-full rounded-lg border border-zinc-300 px-2.5 text-[14px]" data-fixed-value />,
          )}
          {radio("blank", "비워 두기", "출력한 뒤 손으로 써요(수기 작성)")}
          {radio("drop", "빼기", "등록할 때 양식에서 이 칸(과 라벨)을 지워요")}
        </div>
        <button type="button" onClick={() => onSave(label.trim(), build())} disabled={invalid} className="h-12 rounded-xl bg-brand-600 text-[15px] font-bold text-white hover:bg-brand-700 disabled:opacity-50" data-field-save>
          이렇게 정하기
        </button>
        <button type="button" onClick={onRemove} className="h-9 text-[13px] text-zinc-600 hover:text-zinc-900" data-field-unmark>
          값 칸이 아니에요(목록에서 빼고 양식 글자 그대로)
        </button>
      </section>
    </div>
  );
}
