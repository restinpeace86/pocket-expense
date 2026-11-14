"use client";

import { ArrowDown, ArrowUp, ImagePlus, Loader2, Plus, Trash2 } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { deleteHelpArticleAction as deleteHelpArticleActionRaw, saveHelpArticleAction as saveHelpArticleActionRaw, uploadHelpImageAction as uploadHelpImageActionRaw, type AdminArticle } from "@/app/app-admin/help/actions";
import { HELP_CATEGORIES } from "@/lib/help/guides";
import { guarded } from "@/lib/action-guard";

// 인터넷 끊김·서버 응답 없음에도 화면 전체가 오류로 바뀌지 않게(비정상 사용 점검 2026-11-14)
const deleteHelpArticleAction = guarded(deleteHelpArticleActionRaw);
const saveHelpArticleAction = guarded(saveHelpArticleActionRaw);
const uploadHelpImageAction = guarded(uploadHelpImageActionRaw);

// 운영자 도움말 글 고치기(D-255 §A-5, 시안 ③): 왼쪽 목록(카테고리 필터) + 오른쪽 글 고치기(기본 정보 · 단계 글/그림 · 공개)
const FEATURES = [
  ["", "없음(모든 회사)"],
  ["attendance", "근태"],
  ["calendar", "캘린더"],
  ["chat", "채팅"],
  ["bus", "주변 버스"],
] as const;
const SIMS = [
  ["", "없음"],
  ["receipt", "영수증 → 승인"],
  ["qr", "QR 출퇴근"],
  ["leave", "휴가 → 회사 양식"],
  ["convert", "서류 → 엑셀"],
  ["rooms", "회의실"],
  ["chat", "채팅·보관"],
  ["closing", "월말 마감"],
] as const;
const input = "h-10 w-full rounded-lg border border-zinc-300 bg-white px-2.5 text-sm";
const blank = (): AdminArticle => ({ id: "", category: "basic", audience: "all", needs: null, title: "", summary: "", keywords: [], path: null, admin_path: null, path_label: null, sim: null, published: false, steps: [{ body: "", image_path: null }] });

export function HelpAdmin({ articles, imageBase }: { articles: AdminArticle[]; imageBase: string }) {
  const [cat, setCat] = useState<string>("all");
  const [sel, setSel] = useState<string | null>(articles[0]?.id ?? null);
  const [draft, setDraft] = useState<AdminArticle | null>(articles[0] ? structuredClone(articles[0]) : null);
  const [isNew, setIsNew] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, start] = useTransition();
  const [uploading, setUploading] = useState<number | null>(null);
  const list = useMemo(() => articles.filter((a) => cat === "all" || a.category === cat), [articles, cat]);

  const pick = (a: AdminArticle) => {
    setSel(a.id);
    setDraft(structuredClone(a));
    setIsNew(false);
    setMsg(null);
  };
  const set = <K extends keyof AdminArticle>(k: K, v: AdminArticle[K]) => setDraft((d) => (d ? { ...d, [k]: v } : d));
  const setStep = (i: number, patch: Partial<AdminArticle["steps"][number]>) => setDraft((d) => (d ? { ...d, steps: d.steps.map((s, j) => (j === i ? { ...s, ...patch } : s)) } : d));
  const move = (i: number, by: -1 | 1) =>
    setDraft((d) => {
      if (!d) return d;
      const s = [...d.steps];
      const j = i + by;
      if (j < 0 || j >= s.length) return d;
      [s[i], s[j]] = [s[j], s[i]];
      return { ...d, steps: s };
    });
  const save = () =>
    draft &&
    start(async () => {
      const r = await saveHelpArticleAction(draft);
      setMsg(r.error ? { ok: false, text: r.error } : { ok: true, text: "저장했어요." });
      if (!r.error) {
        setSel(draft.id);
        setIsNew(false);
      }
    });
  const remove = () =>
    draft &&
    !isNew &&
    start(async () => {
      const r = await deleteHelpArticleAction(draft.id);
      setMsg(r.error ? { ok: false, text: r.error } : { ok: true, text: "지웠어요." });
      if (!r.error) {
        setDraft(null);
        setSel(null);
      }
    });
  const upload = async (i: number, file: File) => {
    if (!draft?.id) return setMsg({ ok: false, text: "글 키를 먼저 정해 주세요." });
    setUploading(i);
    const fd = new FormData();
    fd.set("file", file);
    fd.set("id", draft.id);
    const r = await uploadHelpImageAction(fd);
    setUploading(null);
    if ("error" in r) return setMsg({ ok: false, text: r.error });
    setStep(i, { image_path: r.path });
    setMsg({ ok: true, text: "그림을 올렸어요. [저장]을 눌러야 글에 들어가요." });
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[340px_minmax(0,1fr)]" data-help-admin>
      <section className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-4">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold">도움말 글 {articles.length}편</h1>
          <button type="button" onClick={() => (setDraft(blank()), setSel(null), setIsNew(true), setMsg(null))} className="inline-flex h-9 items-center gap-1 rounded-lg bg-brand-600 px-3 text-sm font-semibold text-white">
            <Plus className="size-4" aria-hidden /> 새 글
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5 text-xs">
          {[["all", "전체"] as const, ...HELP_CATEGORIES.map((c) => [c.key, c.label] as const)].map(([k, l]) => (
            <button key={k} type="button" onClick={() => setCat(k)} className={`rounded-full border px-2.5 py-1 ${cat === k ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-300"}`}>
              {l}
            </button>
          ))}
        </div>
        <ul className="flex max-h-[70vh] flex-col gap-1.5 overflow-y-auto">
          {list.map((a) => (
            <li key={a.id}>
              <button type="button" onClick={() => pick(a)} className={`w-full rounded-xl border px-3 py-2 text-left text-sm ${sel === a.id ? "border-brand-500 bg-brand-50" : "border-zinc-200 hover:bg-zinc-50"} ${a.published ? "" : "border-dashed text-zinc-500"}`} data-help-admin-item={a.id}>
                <b className="block">{a.title}</b>
                <span className="text-xs text-zinc-500">
                  {HELP_CATEGORIES.find((c) => c.key === a.category)?.label} · {a.audience === "admin" ? "관리자" : "직원·관리자"} · 단계 {a.steps.length} · 그림 {a.steps.filter((s) => s.image_path).length}
                  {a.sim ? ` · ▶ ${a.sim}` : ""}
                  {a.published ? "" : " · 숨김"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      {draft ? (
        <section className="flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-4 md:p-5" data-help-admin-edit>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-bold">{isNew ? "새 글" : "글 고치기"}</h2>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1.5 text-sm">
                <input type="checkbox" checked={draft.published} onChange={(e) => set("published", e.target.checked)} className="size-4" /> 공개
              </label>
              {!isNew && (
                <button type="button" onClick={remove} disabled={busy} className="inline-flex h-9 items-center gap-1 rounded-lg border border-zinc-300 px-3 text-sm text-zinc-700">
                  <Trash2 className="size-4" aria-hidden /> 지우기
                </button>
              )}
              <button type="button" onClick={save} disabled={busy} className="inline-flex h-9 items-center gap-1 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white disabled:opacity-60" data-help-admin-save>
                {busy && <Loader2 className="size-4 animate-spin" aria-hidden />} 저장
              </button>
            </div>
          </div>
          {msg && <p className={`rounded-lg px-3 py-2 text-sm ${msg.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>{msg.text}</p>}
          <div className="grid gap-3 md:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              글 키(영어·숫자·-)
              <input className={input} value={draft.id} disabled={!isNew} onChange={(e) => set("id", e.target.value.toLowerCase())} placeholder="예: leave-request" />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              제목
              <input className={input} value={draft.title} onChange={(e) => set("title", e.target.value)} />
            </label>
            <label className="flex flex-col gap-1 text-sm md:col-span-2">
              한 줄 요약
              <input className={input} value={draft.summary} maxLength={200} onChange={(e) => set("summary", e.target.value)} />
            </label>
            <label className="flex flex-col gap-1 text-sm md:col-span-2">
              찾는 말(쉼표로 나눔)
              <input className={input} value={draft.keywords.join(", ")} onChange={(e) => set("keywords", e.target.value.split(","))} />
            </label>
            <div className="grid grid-cols-2 gap-2 md:col-span-2 md:grid-cols-4">
              <label className="flex flex-col gap-1 text-sm">
                카테고리
                <select className={input} value={draft.category} onChange={(e) => set("category", e.target.value)}>
                  {HELP_CATEGORIES.map((c) => (
                    <option key={c.key} value={c.key}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm">
                대상
                <select className={input} value={draft.audience} onChange={(e) => set("audience", e.target.value === "admin" ? "admin" : "all")}>
                  <option value="all">직원·관리자</option>
                  <option value="admin">관리자만</option>
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm">
                필요 기능
                <select className={input} value={draft.needs ?? ""} onChange={(e) => set("needs", e.target.value || null)}>
                  {FEATURES.map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm">
                시뮬레이션
                <select className={input} value={draft.sim ?? ""} onChange={(e) => set("sim", e.target.value || null)}>
                  {SIMS.map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="flex flex-col gap-1 text-sm">
              [이동] 주소(직원)
              <input className={input} value={draft.path ?? ""} onChange={(e) => set("path", e.target.value)} placeholder="/employee/vacation" />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              [이동] 주소(관리자, 다르면)
              <input className={input} value={draft.admin_path ?? ""} onChange={(e) => set("admin_path", e.target.value)} placeholder="/admin/..." />
            </label>
            <label className="flex flex-col gap-1 text-sm md:col-span-2">
              [이동] 글자
              <input className={input} value={draft.path_label ?? ""} onChange={(e) => set("path_label", e.target.value)} placeholder="휴가 및 근태 신청으로 이동" />
            </label>
          </div>

          <div className="flex flex-col gap-2">
            <b className="text-sm">단계</b>
            {draft.steps.map((s, i) => (
              <div key={i} className="grid gap-2 rounded-xl border border-zinc-200 p-2.5 md:grid-cols-[28px_minmax(0,1fr)_160px_auto]" data-help-admin-step={i + 1}>
                <b className="pt-2 text-center">{i + 1}</b>
                <textarea value={s.body} onChange={(e) => setStep(i, { body: e.target.value })} rows={2} maxLength={500} className="rounded-lg border border-zinc-300 px-2.5 py-2 text-sm" />
                <div className="flex flex-col items-start gap-1">
                  {s.image_path ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={`${imageBase}${s.image_path}`} alt="" className="h-20 w-full rounded-lg border border-zinc-200 object-cover object-top" />
                  ) : (
                    <span className="flex h-20 w-full items-center justify-center rounded-lg border border-dashed border-zinc-300 text-xs text-zinc-500">그림 없음</span>
                  )}
                  <div className="flex gap-2 text-xs">
                    <label className="inline-flex cursor-pointer items-center gap-1 text-brand-700">
                      {uploading === i ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <ImagePlus className="size-3.5" aria-hidden />} 올리기
                      <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => e.target.files?.[0] && void upload(i, e.target.files[0])} />
                    </label>
                    {s.image_path && (
                      <button type="button" onClick={() => setStep(i, { image_path: null })} className="text-zinc-600">
                        빼기
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex gap-1 md:flex-col">
                  <button type="button" aria-label="위로" onClick={() => move(i, -1)} className="inline-flex size-8 items-center justify-center rounded-lg border border-zinc-300">
                    <ArrowUp className="size-4" />
                  </button>
                  <button type="button" aria-label="아래로" onClick={() => move(i, 1)} className="inline-flex size-8 items-center justify-center rounded-lg border border-zinc-300">
                    <ArrowDown className="size-4" />
                  </button>
                  <button type="button" aria-label="단계 빼기" onClick={() => setDraft((d) => (d ? { ...d, steps: d.steps.filter((_, j) => j !== i) } : d))} className="inline-flex size-8 items-center justify-center rounded-lg border border-zinc-300">
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
            ))}
            <button type="button" onClick={() => setDraft((d) => (d ? { ...d, steps: [...d.steps, { body: "", image_path: null }] } : d))} className="self-start text-sm font-semibold text-brand-700">
              + 단계 추가
            </button>
          </div>
        </section>
      ) : (
        <p className="rounded-2xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500">왼쪽에서 글을 고르거나 [새 글]을 눌러요.</p>
      )}
    </div>
  );
}
