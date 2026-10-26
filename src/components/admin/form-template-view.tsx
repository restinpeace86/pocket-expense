"use client";

import { ArrowDown, ArrowUp, Camera, Check, FileUp, Loader2, Plus, RotateCcw, Sparkles, X } from "lucide-react";
import { useMemo, useRef, useState, useTransition } from "react";
import { analyzeFormAction, clearFormLayoutAction, saveFormLayoutAction } from "@/app/workspace/[id]/admin/form-template/actions";
import { ClaimDocument } from "@/components/forms/claim-document";
import { SectionHeading } from "@/components/ui/help";
import { buttonPrimary, buttonSecondary, inputClass } from "@/components/ui/page-shell";
import type { AiFormRead, AiLayoutResult } from "@/lib/forms/ai-layout";
import {
  buildDocModel,
  COLUMN_CATALOG,
  DEFAULT_LAYOUT,
  FIELD_CATALOG,
  PRESET_IDS,
  PRESETS,
  inputFieldsOf,
  isCustom,
  MAX_INPUT_FIELDS,
  newCustomKey,
  type ColumnEntry,
  type CustomField,
  type CustomMode,
  type FormLayout,
  type HeaderEntry,
  type LayoutField,
  type PresetId,
} from "@/lib/forms/layout";
import { processReceiptFile } from "@/lib/receipts/image";
import { createClient } from "@/lib/supabase/client";
import type { ClaimDoc } from "@/lib/tax/claim-docs";

// 지출결의서 양식 설정 (D-118, template-configuration.md): ① 기본 포맷 고르기 또는 종이 양식 찍기 ② 꾸미기 ③ 미리보기 → 저장
// 바뀌는 것은 출력 문서 모양뿐(결의서 상세 PDF·세무 마감 PDF). 직원 입력 화면은 그대로.
type Choice = PresetId | "photo";
export type FormTemplateViewProps = {
  companyId: string;
  companyName: string;
  active: { version: number; createdAt: string } | null;
  initialLayout: FormLayout;
  previewDoc: ClaimDoc;
  previewLabel: string;
  preview?: boolean; // 화면 미리보기(/dev/preview) — 저장·업로드 안 함
};

const clone = (l: FormLayout): FormLayout => JSON.parse(JSON.stringify(l)) as FormLayout;
const chip = (on: boolean) =>
  `flex min-h-11 w-full flex-col items-start rounded-xl border px-3 py-2 text-left text-sm ${on ? "border-brand-600 bg-brand-50 ring-2 ring-brand-500/30" : "border-zinc-300 bg-white hover:bg-zinc-50"}`;

type Entry<K extends string> = LayoutField<K> | CustomField;
const MODE_LABEL: Record<CustomMode, string> = { input: "직원이 작성", fixed: "고정값", blank: "빈칸으로 남기기" };
const MODE_HINT: Record<CustomMode, string> = {
  input: "직원 결의서 맨 아래 [회사 추가 항목]에 이 칸이 생겨요(결의서마다 한 번).",
  fixed: "아래 값이 모든 결의서에 똑같이 찍혀요. 직원 입력 없음.",
  blank: "양식 모양만 남기고 비워 둬요. 직원 입력 없음.",
};

// 회사 추가 칸 한 줄: 칸마다 어떻게 채울지 관리자가 정한다(D-120)
function CustomControls({ it, columnOnly, inputFull, onChange }: { it: CustomField; columnOnly: boolean; inputFull: boolean; onChange: (next: CustomField) => void }) {
  const modes: CustomMode[] = columnOnly ? ["blank"] : ["input", "fixed", "blank"];
  const decided = !it.pending;
  return (
    <div className="mt-1.5 flex flex-col gap-1.5">
      <p className={`text-[11px] ${decided ? "text-zinc-500" : "font-semibold text-amber-800"}`}>
        {decided ? "우리 데이터에 없는 칸 · " + MODE_HINT[it.mode] : columnOnly ? "우리 데이터에 없는 열이에요. 빈 열로 남길지, 오른쪽 ✕로 뺄지 정해 주세요." : "우리 데이터에 없는 칸이에요. 어떻게 할지 정해 주세요(필요 없으면 오른쪽 ✕로 빼기)."}
      </p>
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={`${it.label} 채우는 방법`}>
        {modes.map((m) => {
          const on = decided && it.mode === m;
          const disabled = m === "input" && inputFull && it.mode !== "input";
          return (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={on}
              disabled={disabled}
              title={disabled ? `직원이 쓰는 칸은 ${MAX_INPUT_FIELDS}개까지예요` : undefined}
              onClick={() => onChange({ key: it.key, label: it.label, mode: m, ...(m === "input" ? { required: it.required ?? false, options: it.options } : {}), ...(m === "fixed" ? { value: it.value ?? "" } : {}) })}
              className={`min-h-11 rounded-lg border px-2.5 text-xs font-medium disabled:opacity-40 ${on ? "border-brand-600 bg-brand-600 text-white" : "border-zinc-300 bg-white text-zinc-700"}`}
            >
              {columnOnly ? "빈 열로 남기기" : MODE_LABEL[m]}
            </button>
          );
        })}
      </div>
      {decided && it.mode === "input" && (
        <div className="flex flex-col gap-1.5 rounded-lg bg-zinc-50 p-2">
          <label className="flex min-h-11 items-center gap-2 text-xs text-zinc-800">
            <input type="checkbox" className="size-4 accent-brand-600" checked={!!it.required} onChange={(e) => onChange({ ...it, required: e.target.checked })} /> 꼭 써야 상신 가능(필수)
          </label>
          <input
            className={`${inputClass} lg:min-h-9 lg:text-xs`}
            aria-label={`${it.label} 선택지`}
            placeholder="고를 값(쉼표로 구분, 예: A프로젝트, B프로젝트). 비우면 글자로 입력"
            defaultValue={(it.options ?? []).join(", ")}
            onBlur={(e) => {
              const options = [...new Set(e.target.value.split(",").map((s) => s.trim()).filter(Boolean))].slice(0, 10);
              onChange({ ...it, options: options.length ? options : undefined });
            }}
          />
        </div>
      )}
      {decided && it.mode === "fixed" && (
        <input className={`${inputClass} lg:min-h-9 lg:text-sm`} aria-label={`${it.label} 고정값`} maxLength={100} placeholder="모든 결의서에 찍을 값(예: 5년)" value={it.value ?? ""} onChange={(e) => onChange({ ...it, value: e.target.value })} />
      )}
    </div>
  );
}

function FieldList<K extends string>({
  title,
  hint,
  items,
  catalog,
  onChange,
  min = 0,
  columnOnly = false,
  inputFull = false,
}: {
  title: string;
  hint: string;
  items: Entry<K>[];
  catalog: Record<K, { label: string; hint: string }>;
  onChange: (next: Entry<K>[]) => void;
  min?: number; // 우리 데이터 칸 최소 개수(영수증 표 열)
  columnOnly?: boolean; // 표 열: 회사 추가 칸은 빈 열만
  inputFull?: boolean; // 직원이 쓰는 칸이 이미 3개
}) {
  const unused = (Object.keys(catalog) as K[]).filter((k) => !items.some((i) => i.key === k));
  const dataCount = items.filter((i) => !isCustom(i)).length;
  const move = (i: number, d: -1 | 1) => {
    const next = [...items];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    onChange(next);
  };
  return (
    <fieldset className="flex min-w-0 flex-col gap-2">
      <legend className="text-sm font-semibold text-zinc-900">{title}</legend>
      <p className="-mt-1 text-xs text-zinc-500">{hint}</p>
      {items.length === 0 && <p className="rounded-lg bg-zinc-50 px-3 py-2 text-xs text-zinc-500">칸이 없어요.</p>}
      <ol className="flex flex-col gap-1.5">
        {items.map((it, i) => {
          const custom = isCustom(it);
          return (
            <li key={it.key} className={custom ? `rounded-xl border p-2 ${it.pending ? "border-amber-400 bg-amber-50" : "border-zinc-200 bg-white"}` : ""} data-pending={custom && it.pending ? "1" : undefined}>
              <div className="flex items-center gap-1.5">
                <div className="min-w-0 flex-1">
                  <input
                    className={`${inputClass} lg:min-h-11 lg:text-sm`}
                    value={it.label}
                    maxLength={30}
                    aria-label={`${custom ? it.label : catalog[it.key as K].label} 칸 이름`}
                    onChange={(e) => onChange(items.map((x, k) => (k === i ? { ...x, label: e.target.value } : x)))}
                  />
                  {!custom && <p className="mt-0.5 truncate pl-1 text-[11px] text-zinc-500">채우는 값: {catalog[it.key as K].hint || catalog[it.key as K].label}</p>}
                </div>
                <button type="button" className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg border border-zinc-200 bg-white disabled:opacity-30" aria-label="위로" disabled={i === 0} onClick={() => move(i, -1)}>
                  <ArrowUp className="size-4" />
                </button>
                <button type="button" className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg border border-zinc-200 bg-white disabled:opacity-30" aria-label="아래로" disabled={i === items.length - 1} onClick={() => move(i, 1)}>
                  <ArrowDown className="size-4" />
                </button>
                <button
                  type="button"
                  className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-600 disabled:opacity-30"
                  aria-label={`${it.label} 빼기`}
                  disabled={!custom && dataCount <= min}
                  onClick={() => onChange(items.filter((_, k) => k !== i))}
                >
                  <X className="size-4" />
                </button>
              </div>
              {custom && <CustomControls it={it} columnOnly={columnOnly} inputFull={inputFull} onChange={(next) => onChange(items.map((x, k) => (k === i ? next : x)))} />}
            </li>
          );
        })}
      </ol>
      <label className="flex min-w-0 items-center gap-2">
        <Plus className="size-4 shrink-0 text-brand-700" />
        <span className="sr-only">{title}에 칸 추가</span>
        <select
          className={`${inputClass} min-w-0 lg:min-h-11 lg:text-sm`}
          value=""
          onChange={(e) => {
            const k = e.target.value;
            if (k === "__custom") onChange([...items, { key: newCustomKey(), label: "새 칸", mode: "blank", pending: true }]);
            else if (k) onChange([...items, { key: k as K, label: catalog[k as K].label }]);
          }}
        >
          <option value="">칸 추가</option>
          {unused.map((k) => (
            <option key={k} value={k}>
              {catalog[k].label}
              {catalog[k].hint ? ` — ${catalog[k].hint}` : ""}
            </option>
          ))}
          <option value="__custom">＋ 우리 데이터에 없는 칸({columnOnly ? "빈 열" : "직원 작성·고정값·빈칸"})</option>
        </select>
      </label>
    </fieldset>
  );
}

export function FormTemplateView(p: FormTemplateViewProps) {
  const [layout, setLayout] = useState<FormLayout>(() => clone(p.initialLayout));
  const [choice, setChoice] = useState<Choice>(p.active ? (p.initialLayout.base === "custom" ? "photo" : p.initialLayout.base) : "standard");
  const [dirty, setDirty] = useState(false);
  const [reviewed, setReviewed] = useState(false); // 저장 전 미리보기 확인(필수) — 바꿀 때마다 다시 확인
  const [tab, setTab] = useState<"edit" | "preview">("edit");
  const [source, setSource] = useState<{ path: string; localUrl: string | null } | null>(null);
  const [ai, setAi] = useState<{ result: AiLayoutResult; read: AiFormRead } | null>(null);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [reading, setReading] = useState(false);
  const [saving, startSave] = useTransition();
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  // 아직 안 정한 회사 추가 칸(AI가 찾았거나 새로 넣은 칸) — 다 정해야 저장(D-120)
  const pending = [...layout.header, ...layout.columns, ...layout.footer].filter((e) => isCustom(e) && e.pending).map((e) => e.label);
  const inputCount = inputFieldsOf(layout).length;
  const model = useMemo(() => buildDocModel(layout, p.previewDoc, { companyName: p.companyName }), [layout, p.previewDoc, p.companyName]);

  const edit = (patch: Partial<FormLayout>) => {
    setLayout((l) => ({ ...l, ...patch, base: choice === "photo" ? "custom" : l.base }));
    setDirty(true);
    setReviewed(false);
    setMessage(null);
  };
  const pickPreset = (id: PresetId) => {
    if (dirty && !window.confirm("꾸민 내용이 이 포맷으로 바뀌어요. 계속할까요?")) return;
    setChoice(id);
    setLayout(clone(PRESETS[id].layout));
    setAi(null);
    setSource(null);
    setDirty(id !== (p.active ? p.initialLayout.base : "standard"));
    setReviewed(false);
    setMessage(null);
  };

  async function readForm(file: File) {
    if (p.preview) return;
    setReading(true);
    setMessage(null);
    try {
      const processed = await processReceiptFile(file).catch(() => null);
      if (!processed) return setMessage({ kind: "error", text: "올릴 수 없는 파일이에요. 사진(JPG·PNG) 또는 PDF를 골라 주세요." });
      if (processed.original.size > 10 * 1024 * 1024) return setMessage({ kind: "error", text: "파일이 10MB를 넘어요. 더 작은 파일로 올려 주세요." });
      const pdf = processed.kind === "pdf";
      const path = `${p.companyId}/${crypto.randomUUID()}.${pdf ? "pdf" : "jpg"}`;
      const up = await createClient().storage.from("form-templates").upload(path, processed.original, { contentType: pdf ? "application/pdf" : "image/jpeg" });
      if (up.error) return setMessage({ kind: "error", text: "양식 파일을 올리지 못했어요. 잠시 후 다시 시도해 주세요." });
      setSource({ path, localUrl: pdf ? null : URL.createObjectURL(processed.original) });
      const r = await analyzeFormAction(path);
      if (!r.ok) return setMessage({ kind: "error", text: r.error });
      setChoice("photo");
      setAi({ result: r.result, read: r.aiRead });
      setLayout(r.result.layout);
      setDirty(true);
      setReviewed(false);
      setTab("preview");
    } finally {
      setReading(false);
    }
  }

  const save = () =>
    startSave(async () => {
      if (p.preview) return;
      const r = await saveFormLayoutAction({ layout, sourceFilePath: choice === "photo" ? (source?.path ?? null) : null, aiRead: choice === "photo" ? (ai?.read ?? null) : null });
      if (!r.ok) return setMessage({ kind: "error", text: r.error });
      setDirty(false);
      setReviewed(false);
      setMessage({ kind: "ok", text: "저장했어요. 이제 결의서 PDF와 세무 마감 PDF가 이 양식으로 나가요." });
    });
  const reset = () =>
    startSave(async () => {
      if (p.preview || !window.confirm("기본 양식으로 되돌릴까요? 지금 양식은 기록으로 남아요.")) return;
      const r = await clearFormLayoutAction();
      if (!r.ok) return setMessage({ kind: "error", text: r.error });
      setChoice("standard");
      setLayout(clone(DEFAULT_LAYOUT));
      setAi(null);
      setSource(null);
      setDirty(false);
      setMessage({ kind: "ok", text: "기본 양식으로 되돌렸어요." });
    });

  const activeName = p.active ? (p.initialLayout.base === "custom" ? "우리 회사 맞춤 양식" : PRESETS[p.initialLayout.base].name) : "기본 양식";
  return (
    <div className="flex flex-col gap-5 pb-28">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm">
        <span className="text-zinc-600">지금 쓰는 양식</span>
        <span className="font-semibold text-zinc-900">
          {activeName}
          {p.active && <span className="ml-1 text-xs font-normal text-zinc-500">v{p.active.version}</span>}
        </span>
        {p.active && (
          <button type="button" onClick={reset} disabled={saving} className="ml-auto inline-flex min-h-11 items-center gap-1 rounded-lg border border-zinc-300 px-3 text-sm text-zinc-700 hover:bg-zinc-50">
            <RotateCcw className="size-4" /> 기본 양식으로 되돌리기
          </button>
        )}
      </div>

      <section className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-4 sm:p-5">
        <SectionHeading
          title="① 양식 고르기"
          summary="많이 쓰는 지출결의서 모양 5가지 중에 고르거나, 쓰던 종이 양식을 찍어 올리세요."
          helpId="form-template-choose"
          help={
            <>
              <p>바뀌는 것은 결재·보관용 문서 모양뿐이에요. 직원이 입력하는 화면은 그대로예요.</p>
              <p>칸은 우리 앱에 있는 데이터(직원·부서·제목·사유·영수증 금액·계정과목 등)로만 채워요. 수량·단가처럼 앱에 없는 칸은 만들지 않아요.</p>
              <p>결재란(담당·팀장·대표 도장 칸)은 결재라인대로 결재한 사람 이름과 날짜가 자동으로 들어가요.</p>
            </>
          }
        />
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3" role="radiogroup" aria-label="지출결의서 포맷">
          {PRESET_IDS.map((id) => (
            <button key={id} type="button" role="radio" aria-checked={choice === id} className={chip(choice === id)} onClick={() => pickPreset(id)}>
              <span className="flex items-center gap-1 font-semibold text-zinc-900">
                {choice === id && <Check className="size-4 text-brand-700" />}
                {PRESETS[id].name}
              </span>
              <span className="mt-0.5 text-xs text-zinc-600">{PRESETS[id].desc}</span>
            </button>
          ))}
          <div role="radio" aria-checked={choice === "photo"} className={`${chip(choice === "photo")} gap-2`}>
            <span className="flex items-center gap-1 font-semibold text-zinc-900">
              <Sparkles className="size-4 text-brand-700" /> 우리 회사 양식 찍어서 만들기
            </span>
            <span className="text-xs text-zinc-600">종이 양식을 찍거나 PDF를 올리면 AI가 칸을 읽어 우리 데이터와 맞춰요. 그다음 직접 꾸며요.</span>
            <span className="flex w-full flex-wrap gap-2">
              <button type="button" disabled={reading} onClick={() => cameraRef.current?.click()} className="inline-flex min-h-11 flex-1 items-center justify-center gap-1 rounded-lg bg-brand-600 px-3 text-sm font-semibold text-white disabled:opacity-50">
                <Camera className="size-4" /> 카메라로 찍기
              </button>
              <button type="button" disabled={reading} onClick={() => fileRef.current?.click()} className="inline-flex min-h-11 flex-1 items-center justify-center gap-1 rounded-lg border border-zinc-300 bg-white px-3 text-sm font-medium text-zinc-800 disabled:opacity-50">
                <FileUp className="size-4" /> 파일 고르기
              </button>
            </span>
            <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => e.target.files?.[0] && readForm(e.target.files[0]).finally(() => (e.target.value = ""))} />
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,application/pdf" className="hidden" onChange={(e) => e.target.files?.[0] && readForm(e.target.files[0]).finally(() => (e.target.value = ""))} />
          </div>
        </div>
        {reading && (
          <p className="flex items-center gap-2 rounded-xl bg-brand-50 px-3 py-2 text-sm text-brand-800" role="status">
            <Loader2 className="size-4 animate-spin" /> 양식을 읽고 있어요 (10~20초)…
          </p>
        )}
        {ai && (
          <div className="flex flex-col gap-2 rounded-xl bg-zinc-50 p-3 text-sm text-zinc-700 sm:flex-row" role="status">
            {source?.localUrl && (
              // eslint-disable-next-line @next/next/no-img-element -- 방금 찍은 사진(로컬 미리보기)
              <img src={source.localUrl} alt="올린 원본 양식" className="max-h-40 w-auto self-start rounded-lg border border-zinc-200 bg-white object-contain" />
            )}
            <div className="flex flex-col gap-1">
              <p className="font-medium text-zinc-900">
                AI가 칸 {ai.result.layout.header.length + ai.result.layout.columns.length + ai.result.layout.footer.length - ai.result.pending.length}개를 우리 데이터와 맞췄어요. 아래에서 고치고 미리보기로 확인하세요.
              </p>
              {ai.result.pending.length > 0 && <p className="text-amber-800">우리 데이터로 못 채우는 칸 {ai.result.pending.length}개({ai.result.pending.join(", ")})는 양식에 그대로 두었어요. 칸마다 어떻게 할지 정해 주세요.</p>}
              {ai.result.approvalLabels.length > 0 && <p>결재란({ai.result.approvalLabels.join("·")})은 결재라인대로 자동으로 채워요.</p>}
              {ai.result.tableFallback && <p className="text-amber-800">내역 표를 찾지 못해 기본 표(사용일·사용처·적요·금액)를 넣었어요.</p>}
            </div>
          </div>
        )}
      </section>

      {pending.length > 0 && (
        <div className="flex flex-col gap-1 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900" role="alert" data-testid="pending-fields">
          <p className="font-semibold">정해야 할 칸 {pending.length}개: {pending.join(", ")}</p>
          <p>우리 데이터로 채울 수 없는 칸이에요. [② 꾸미기]의 노란 칸마다 골라 주세요.</p>
          <ul className="list-disc pl-5 text-xs">
            <li><b>직원이 작성</b> — 꼭 필요한 회사 정보(예: 프로젝트명). 직원 결의서 맨 아래에 생겨요. 최대 {MAX_INPUT_FIELDS}개.</li>
            <li><b>고정값</b> — 늘 같은 값(예: 보존 기간 5년). 직원 입력 없음.</li>
            <li><b>빈칸으로 남기기</b> — 모양만 남겨요(도장·수기용). 직원 입력 없음.</li>
            <li><b>빼기(✕)</b> — 필요 없는 칸이면 양식에서 지워요.</li>
          </ul>
        </div>
      )}

      <div className="flex rounded-xl bg-zinc-100 p-1 lg:hidden" role="tablist" aria-label="꾸미기와 미리보기">
        {(
          [
            ["edit", "② 꾸미기"],
            ["preview", "③ 미리보기"],
          ] as const
        ).map(([v, l]) => (
          <button key={v} type="button" role="tab" aria-selected={tab === v} onClick={() => setTab(v)} className={`min-h-11 flex-1 rounded-lg text-sm font-semibold ${tab === v ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-600"}`}>
            {l}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <section className={`flex min-w-0 flex-col gap-5 rounded-xl border border-zinc-200 bg-white p-4 sm:p-5 ${tab === "edit" ? "" : "hidden lg:flex"}`} aria-label="꾸미기">
          <SectionHeading title="② 꾸미기" summary="칸 이름을 회사에서 쓰던 말로 바꾸고, 순서를 바꾸거나 빼세요." />
          <label className="flex flex-col gap-1 text-sm font-semibold text-zinc-900">
            문서 제목
            <input className={inputClass} value={layout.title} maxLength={30} onChange={(e) => edit({ title: e.target.value })} />
          </label>
          <FieldList title="표 위 칸" hint="결의서에 한 번씩 나오는 칸(작성자·부서·날짜·금액 등)" items={layout.header} catalog={FIELD_CATALOG} inputFull={inputCount >= MAX_INPUT_FIELDS} onChange={(header: HeaderEntry[]) => edit({ header })} />
          <FieldList title="영수증 표 열" hint="영수증 한 장이 한 줄. 최소 1개" items={layout.columns} catalog={COLUMN_CATALOG} min={1} columnOnly onChange={(columns: ColumnEntry[]) => edit({ columns })} />
          <label className="flex flex-col gap-1 text-sm font-semibold text-zinc-900">
            합계 줄 이름
            <input className={inputClass} value={layout.totalLabel} maxLength={10} onChange={(e) => edit({ totalLabel: e.target.value })} />
          </label>
          <FieldList title="표 아래 칸" hint="특이사항·비고·입금 정보 등" items={layout.footer} catalog={FIELD_CATALOG} inputFull={inputCount >= MAX_INPUT_FIELDS} onChange={(footer: HeaderEntry[]) => edit({ footer })} />
          <fieldset className="flex min-w-0 flex-col gap-2">
            <legend className="text-sm font-semibold text-zinc-900">맨 아래</legend>
            <label className="flex flex-col gap-1 text-sm text-zinc-700">
              맺음말 (비우면 없음 · {"{기간}"}은 영수증 사용 기간으로 바뀜)
              <textarea className={`${inputClass} min-h-16 py-2`} maxLength={200} value={layout.statement ?? ""} onChange={(e) => edit({ statement: e.target.value || null })} />
            </label>
            <label className="flex min-h-11 items-center gap-2 text-sm text-zinc-800">
              <input type="checkbox" className="size-4 accent-brand-600" checked={layout.showDate} onChange={(e) => edit({ showDate: e.target.checked })} /> 날짜 줄(상신일)
            </label>
            <label className="flex min-h-11 items-center gap-2 text-sm text-zinc-800">
              <input type="checkbox" className="size-4 accent-brand-600" checked={!!layout.signerLabel} onChange={(e) => edit({ signerLabel: e.target.checked ? "작성자" : null })} /> 서명 줄 (○○: 이름 (인))
            </label>
            {layout.signerLabel !== null && (
              <input className={`${inputClass} lg:min-h-11 lg:text-sm`} aria-label="서명 줄 이름" maxLength={10} value={layout.signerLabel} onChange={(e) => edit({ signerLabel: e.target.value })} />
            )}
            <label className="flex min-h-11 items-center gap-2 text-sm text-zinc-800">
              <input type="checkbox" className="size-4 accent-brand-600" checked={layout.showCompany} onChange={(e) => edit({ showCompany: e.target.checked })} /> 회사 이름 줄
            </label>
          </fieldset>
        </section>

        <section className={`flex min-w-0 flex-col gap-2 ${tab === "preview" ? "" : "hidden lg:flex"}`} aria-label="미리보기">
          <SectionHeading title="③ 미리보기" summary={`${p.previewLabel}로 그려 봤어요. PDF도 이 모양으로 나가요.`} />
          <div className="lg:sticky lg:top-4">
            <ClaimDocument model={model} />
            <label className={`mt-3 flex min-h-11 cursor-pointer items-start gap-2 rounded-xl border px-3 py-2.5 text-sm ${reviewed ? "border-emerald-300 bg-emerald-50 text-emerald-900" : "border-amber-300 bg-amber-50 text-amber-900"}`}>
              <input type="checkbox" className="mt-0.5 size-4 shrink-0 accent-brand-600" checked={reviewed} onChange={(e) => setReviewed(e.target.checked)} />
              <span>
                <span className="font-semibold">미리보기를 확인했어요</span> — 칸 이름·순서·숫자가 맞는지 보고 체크해 주세요. 체크해야 저장할 수 있어요{choice === "photo" ? "(AI가 읽은 양식은 특히 꼭 확인)" : ""}.
              </span>
            </label>
          </div>
        </section>
      </div>

      {message && (
        <p className={`rounded-xl px-3 py-2 text-sm ${message.kind === "ok" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`} role={message.kind === "ok" ? "status" : "alert"}>
          {message.text}
        </p>
      )}
      <div className="kb-hide fixed inset-x-0 bottom-0 z-30 border-t border-zinc-200 bg-white/95 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur md:left-64">
        <div className="mx-auto flex max-w-5xl items-center gap-3">
          <p className="hidden flex-1 text-sm text-zinc-600 sm:block">{pending.length ? `정해야 할 칸 ${pending.length}개를 먼저 정해 주세요.` : dirty || !p.active ? (reviewed ? "확인했어요. 저장할 수 있어요." : "미리보기 아래 '확인했어요'를 체크하면 저장할 수 있어요.") : "저장된 양식이에요."}</p>
          <button type="button" className={`${buttonSecondary} sm:w-auto lg:hidden`} onClick={() => setTab(tab === "edit" ? "preview" : "edit")}>
            {tab === "edit" ? "미리보기" : "꾸미기"}
          </button>
          <button type="button" className={`${buttonPrimary} sm:w-auto`} disabled={saving || reading || !reviewed || pending.length > 0 || (!dirty && !!p.active)} onClick={save}>
            {saving ? "저장 중…" : "이 양식으로 저장"}
          </button>
        </div>
      </div>
    </div>
  );
}
