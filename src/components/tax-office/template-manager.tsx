"use client";

import { FileSpreadsheet, Pencil, Trash2, Upload } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { deleteTemplateAction, saveTemplateAction, uploadTemplateFileAction } from "@/app/tax-office/templates/actions";
import { FormError } from "@/components/onboarding/field";
import { inputClass } from "@/components/ui/page-shell";
import { thrownActionMessage } from "@/lib/action-guard";
import { FIELDS, fieldLabel, PRESETS, TARGET_LABEL, type FieldKey, type TemplateColumn, type TemplateTarget } from "@/lib/tax-office/template-fields";

export type OfficeTemplate = {
  id: string;
  name: string;
  target: TemplateTarget;
  file_name: string | null;
  sheet_name: string | null;
  header_row: number;
  columns: TemplateColumn[];
  updated_at: string;
};
type Draft = {
  id: string | null;
  name: string;
  target: TemplateTarget;
  filePath: string | null;
  fileName: string | null;
  sheetName: string | null;
  headerRow: number;
  columns: TemplateColumn[];
  note?: string;
};

const card = "rounded-xl border border-zinc-200 bg-white p-5 shadow-sm";
const primary =
  "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-brand-600 px-4 font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50";
const secondary =
  "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-zinc-300 bg-white px-4 text-sm font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-50";
const colLetter = (n: number) => {
  let s = "";
  for (let x = n; x > 0; x = Math.floor((x - 1) / 26)) s = String.fromCharCode(65 + ((x - 1) % 26)) + s;
  return s;
};

// 결산 양식 목록 + 올리기·초안·칸 연결 (D-150). 세무사(관리자 아님)는 목록만
export function TemplateManager({ templates, canEdit }: { templates: OfficeTemplate[]; canEdit: boolean }) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  function upload(file: File) {
    setError(null);
    setNotice(null);
    const fd = new FormData();
    fd.set("file", file);
    startTransition(async () => {
      try {
        const r = await uploadTemplateFileAction(fd);
        if (!r.ok) return setError(r.error);
        setDraft({ id: null, name: file.name.replace(/\.xlsx?$/i, "").slice(0, 50), target: "all", filePath: r.filePath, fileName: r.fileName, sheetName: r.sheetName, headerRow: r.headerRow, columns: r.columns });
      } catch {
        setError(thrownActionMessage());
      }
    });
  }

  function save() {
    if (!draft) return;
    setError(null);
    startTransition(async () => {
      try {
        const r = await saveTemplateAction(draft);
        if (!r.ok) return setError(r.error);
        setDraft(null);
        setNotice("저장했어요. 고객사 세무 자료 화면과 고객사 관리자의 세무 마감 화면에서 이 양식으로 받을 수 있어요.");
      } catch {
        setError(thrownActionMessage());
      }
    });
  }

  function remove(t: OfficeTemplate) {
    if (!confirm(`'${t.name}' 양식을 지울까요? 고객사도 이 양식으로 더 받을 수 없어요.`)) return;
    setError(null);
    startTransition(async () => {
      try {
        const r = await deleteTemplateAction(t.id);
        if (!r.ok) setError(r.error);
      } catch {
        setError(thrownActionMessage());
      }
    });
  }

  if (draft) return <Editor draft={draft} onChange={setDraft} onSave={save} onCancel={() => setDraft(null)} pending={pending} error={error} />;

  return (
    <div className="flex flex-col gap-4">
      {canEdit && (
        <section className={card} aria-label="양식 추가">
          <h2 className="font-semibold">양식 추가</h2>
          <p className="mt-1 break-keep text-sm text-zinc-600">
            회계 프로그램에서 받은 엑셀 업로드 양식(.xlsx 또는 예전 .xls)을 그대로 올리세요. .xls로 올린 양식은 받을 때도 .xls로 드려요. 칸 이름(거래일자·거래처명·공급가액 등)을 보고 어떤 값을 넣을지 자동으로 맞춰 드려요.
          </p>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
            className="hidden"
            aria-label="양식 파일"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) upload(f);
            }}
          />
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <button type="button" disabled={pending || templates.length >= 10} onClick={() => fileRef.current?.click()} className={primary}>
              <Upload className="size-4" aria-hidden />
              {pending ? "읽는 중..." : "양식 파일 올리기"}
            </button>
          </div>
          <p className="mt-4 text-sm font-medium text-zinc-700">양식 파일이 없으면 초안으로 시작</p>
          <ul className="mt-2 flex flex-col gap-2">
            {PRESETS.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  disabled={pending || templates.length >= 10}
                  onClick={() =>
                    setDraft({ id: null, name: p.name, target: p.target, filePath: null, fileName: null, sheetName: null, headerRow: 1, note: p.note, columns: p.columns.map((c, i) => ({ ...c, index: i + 1 })) })
                  }
                  className="flex w-full flex-col items-start gap-0.5 rounded-xl border border-zinc-200 px-4 py-3 text-left hover:border-brand-600 disabled:opacity-50"
                >
                  <span className="font-medium text-zinc-900">{p.name}</span>
                  <span className="break-keep text-xs text-zinc-500">{p.note}</span>
                </button>
              </li>
            ))}
          </ul>
          {templates.length >= 10 && <p className="mt-2 text-xs text-zinc-500">양식은 10개까지예요. 안 쓰는 양식을 지우고 추가해 주세요.</p>}
        </section>
      )}

      <section className={card} aria-label="우리 사무소 양식">
        <h2 className="font-semibold">우리 사무소 양식 {templates.length}개</h2>
        {templates.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">아직 없어요. {canEdit ? "위에서 양식을 추가하세요." : "사무소 관리자가 추가할 수 있어요."}</p>
        ) : (
          <ul className="mt-3 flex flex-col divide-y divide-zinc-100">
            {templates.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center gap-3 py-3">
                <FileSpreadsheet className="size-5 shrink-0 text-emerald-700" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="break-keep font-medium text-zinc-900">{t.name}</p>
                  <p className="break-all text-xs text-zinc-500">
                    {TARGET_LABEL[t.target]} · 칸 {t.columns.length}개 · {t.file_name ? `파일 ${t.file_name}${t.sheet_name ? ` (${t.sheet_name})` : ""}` : "초안(칸 구성만)"}
                  </p>
                </div>
                {canEdit && (
                  <div className="flex gap-1">
                    <button
                      type="button"
                      disabled={pending}
                      aria-label={`${t.name} 고치기`}
                      onClick={() => setDraft({ id: t.id, name: t.name, target: t.target, filePath: null, fileName: t.file_name, sheetName: t.sheet_name, headerRow: t.header_row, columns: t.columns })}
                      className="inline-flex size-11 items-center justify-center rounded-xl text-zinc-600 hover:bg-zinc-100"
                    >
                      <Pencil className="size-4" />
                    </button>
                    <button type="button" disabled={pending} aria-label={`${t.name} 지우기`} onClick={() => remove(t)} className="inline-flex size-11 items-center justify-center rounded-xl text-zinc-600 hover:bg-zinc-100 hover:text-red-600">
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
      <FormError message={error} />
      {notice && (
        <p role="status" className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {notice}
        </p>
      )}
    </div>
  );
}

// 칸 연결: 양식의 칸(머리글)마다 넣을 값을 고른다
function Editor({ draft, onChange, onSave, onCancel, pending, error }: { draft: Draft; onChange: (d: Draft) => void; onSave: () => void; onCancel: () => void; pending: boolean; error: string | null }) {
  const set = (i: number, patch: Partial<TemplateColumn>) => onChange({ ...draft, columns: draft.columns.map((c, k) => (k === i ? { ...c, ...patch } : c)) });
  const filled = draft.columns.filter((c) => c.field !== "empty").length;
  return (
    <section className={card} aria-label="양식 칸 연결">
      <h2 className="font-semibold">{draft.id ? "양식 고치기" : "새 양식 — 칸 연결 확인"}</h2>
      <p className="mt-1 break-keep text-sm text-zinc-600">
        {draft.fileName
          ? `${draft.fileName}${draft.sheetName ? ` › ${draft.sheetName}` : ""}의 ${draft.headerRow}번째 줄을 머리글로 읽었어요. 칸마다 넣을 값을 확인해 주세요. 머리글 아래부터 채워요.`
          : "초안 양식이에요. 실제 회계 프로그램 양식과 칸 이름·순서가 다를 수 있으니 확인해 주세요."}
      </p>
      {draft.note && <p className="mt-2 break-keep rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">{draft.note}</p>}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-800">
          양식 이름
          <input value={draft.name} onChange={(e) => onChange({ ...draft, name: e.target.value })} maxLength={50} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-800">
          넣을 지출
          <select value={draft.target} onChange={(e) => onChange({ ...draft, target: e.target.value as TemplateTarget })} className={inputClass}>
            {(Object.keys(TARGET_LABEL) as TemplateTarget[]).map((t) => (
              <option key={t} value={t}>
                {TARGET_LABEL[t]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="mt-4 text-sm text-zinc-600">
        칸 {draft.columns.length}개 중 {filled}개에 값을 넣어요.
      </p>
      <ul className="mt-2 flex flex-col divide-y divide-zinc-100 rounded-xl border border-zinc-200">
        {draft.columns.map((c, i) => (
          <li key={c.index} className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center">
            <span className="min-w-0 sm:w-56">
              <span className="mr-1.5 inline-flex min-w-7 justify-center rounded bg-zinc-100 px-1 font-mono text-xs text-zinc-500">{colLetter(c.index)}</span>
              <span className="break-all text-sm font-medium text-zinc-900">{c.header || "(이름 없음)"}</span>
            </span>
            <select
              aria-label={`${c.header} 칸에 넣을 값`}
              value={c.field}
              onChange={(e) => set(i, { field: e.target.value as FieldKey })}
              className={`${inputClass} sm:flex-1 ${c.field === "empty" ? "text-zinc-400" : ""}`}
            >
              {FIELDS.map((f) => (
                <option key={f.key} value={f.key}>
                  {fieldLabel(f.key)}
                </option>
              ))}
            </select>
            {c.field === "fixed" && (
              <input aria-label={`${c.header} 고정값`} value={c.fixed ?? ""} onChange={(e) => set(i, { fixed: e.target.value })} maxLength={100} className={`${inputClass} sm:w-32`} placeholder="예: 57" />
            )}
          </li>
        ))}
      </ul>
      <p className="mt-2 break-keep text-xs text-zinc-500">거래처코드는 우리 데이터에 없어 빈칸으로 넣어요(사업자등록번호로 맞춰 주세요). 금액은 숫자, 날짜는 엑셀 날짜로 넣어요.</p>
      <div className="mt-2">
        <FormError message={error} />
      </div>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row-reverse">
        <button type="button" onClick={onSave} disabled={pending || !draft.name.trim() || filled === 0} className={`${primary} sm:min-w-40`}>
          {pending ? "저장하는 중..." : "양식 저장"}
        </button>
        <button type="button" onClick={onCancel} disabled={pending} className={secondary}>
          취소
        </button>
      </div>
    </section>
  );
}
