"use client";

import { ArrowRight, ChevronDown, Loader2, Search, Sparkles } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { askHelpAction, type HelpAnswer } from "@/lib/help/actions";
import { guidePath, HELP_CATEGORIES, type HelpCategory, type HelpGuide } from "@/lib/help/guides";

// AI 도움말 센터(D-251 → D-255): 검색창(문장 → AI 답 + 가장 가까운 글 펼침, 단어 하나 → 맞는 글 바로) + 카테고리 탭 · 글(단계 + 화면 그림 + 이동)
// renderSim: 글에 시뮬레이션 키가 있으면 [▶ 화면으로 보기]로 그 자리에서 재생(시뮬레이션 단계에서 채움)
export function HelpCenter({
  companyId,
  mode,
  admin,
  guides,
  initialQ,
  initialDoc,
  renderSim,
}: {
  companyId: string;
  mode: "admin" | "employee";
  admin: boolean;
  guides: HelpGuide[];
  initialQ: string;
  initialDoc: string | null;
  renderSim?: (sim: string) => ReactNode;
}) {
  const ws = `/workspace/${companyId}`;
  const byId = new Map(guides.map((g) => [g.id, g]));
  const firstCat = (initialDoc && byId.get(initialDoc)?.cat) || "basic";
  const [cat, setCat] = useState<HelpCategory>(firstCat);
  const [open, setOpen] = useState<string | null>(initialDoc);
  const [q, setQ] = useState(initialQ);
  const [answer, setAnswer] = useState<HelpAnswer | null>(null);
  const [busy, start] = useTransition();
  const asked = useRef(false);

  const ask = (text: string) =>
    start(async () => {
      setAnswer(await askHelpAction(companyId, mode, text));
    });
  // 홈 검색창에서 넘어온 질문은 바로 묻는다(한 번만)
  useEffect(() => {
    if (asked.current || initialQ.trim().length < 1) return;
    asked.current = true;
    start(async () => setAnswer(await askHelpAction(companyId, mode, initialQ)));
  }, [companyId, mode, initialQ]);

  const href = (g: HelpGuide) => {
    const p = guidePath(g, admin);
    return p ? `${ws}${p}` : null;
  };
  const refs = answer && answer.ok ? answer.refs.map((id) => byId.get(id)).filter((g): g is HelpGuide => !!g) : [];
  const cats = HELP_CATEGORIES.filter((c) => guides.some((g) => g.cat === c.key));
  const word = answer?.ok && answer.remaining === null; // 단어 검색(AI 없음)
  const aiText = !!(answer?.ok && answer.answer); // AI가 답을 만들었을 때만 "AI 답변"

  return (
    <div className="flex w-full max-w-3xl flex-col gap-4" data-help-center>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(q);
        }}
        className="flex items-center gap-2 rounded-2xl border-2 border-brand-500 bg-white px-3 py-1.5 shadow-sm"
        role="search"
      >
        <Search className="size-5 shrink-0 text-brand-600" aria-hidden />
        <label htmlFor="help-q" className="sr-only">
          궁금한 것
        </label>
        <input id="help-q" value={q} onChange={(e) => setQ(e.target.value)} maxLength={200} placeholder="예: 퇴근을 안 찍었어요 · 연차" className="h-11 min-w-0 flex-1 bg-transparent text-[15px] outline-none" data-help-input />
        <button type="submit" disabled={busy || q.trim().length < 1} className="inline-flex h-10 shrink-0 items-center gap-1 rounded-xl bg-brand-600 px-3.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50" data-help-ask>
          {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Sparkles className="size-4" aria-hidden />}
          물어보기
        </button>
      </form>

      {busy && (
        <p className="flex items-center gap-2 rounded-2xl bg-brand-50 px-4 py-3 text-sm text-brand-900">
          <Loader2 className="size-4 animate-spin" aria-hidden /> 도움말에서 찾는 중…
        </p>
      )}
      {!busy && answer && (
        <section aria-label="AI 답변" className="flex flex-col gap-3" data-help-answer={answer.ok ? (answer.found ? "found" : "none") : "error"} data-help-word={word ? "" : undefined}>
          {!answer.ok ? (
            <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{answer.error}</p>
          ) : (
            <>
              <div className="flex flex-col gap-2 rounded-2xl border border-brand-200 bg-brand-50 px-4 py-3.5">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-brand-700">
                  <Sparkles className="size-3.5" aria-hidden /> {aiText ? "AI 답변" : "찾은 글"}
                </p>
                {answer.found && answer.answer ? (
                  <p className="text-[15px] leading-relaxed text-zinc-900">{answer.answer}</p>
                ) : answer.found ? (
                  <p className="text-[15px] text-zinc-900">{word ? `"${q.trim()}"와 맞는 글이에요.` : "AI 답을 만들지 못해 가까운 도움말 글을 보여 드려요."} 아래에서 단계별로 보세요.</p>
                ) : (
                  <p className="text-[15px] text-zinc-900">도움말에서 찾지 못했어요. 다른 말로 물어보거나 아래 카테고리에서 찾아보세요. 그래도 없으면 머리글 경광등 아이콘(의견 보내기)으로 알려 주세요.</p>
                )}
                {answer.remaining !== null && <p className="text-[11px] text-zinc-500">오늘 {answer.remaining}번 더 물어볼 수 있어요 · 답은 도움말 글을 바탕으로 AI가 만들어요</p>}
              </div>
              {refs[0] && (
                <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white" data-help-top={refs[0].id}>
                  <div className="border-b border-zinc-100 px-4 py-3">
                    <p className="text-xs text-zinc-500">참고한 글 · {HELP_CATEGORIES.find((c) => c.key === refs[0].cat)?.label}</p>
                    <p className="text-base font-bold">{refs[0].title}</p>
                  </div>
                  <ArticleBody g={refs[0]} href={href(refs[0])} renderSim={renderSim} />
                </div>
              )}
              {refs.length > 1 && (
                <div className="flex flex-wrap gap-2">
                  <span className="w-full text-xs text-zinc-600">함께 볼 만한 글</span>
                  {refs.slice(1).map((g) => (
                    <button key={g.id} type="button" onClick={() => (setCat(g.cat), setOpen(g.id))} className="min-h-9 rounded-full border border-brand-300 bg-white px-3 text-[13px] font-medium text-brand-800 hover:bg-brand-100" data-help-ref={g.id}>
                      {g.title}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </section>
      )}

      <nav aria-label="도움말 카테고리" className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
        <ul className="flex min-w-max gap-1 border-b border-zinc-200">
          {cats.map((c) => (
            <li key={c.key}>
              <button type="button" onClick={() => setCat(c.key)} aria-current={cat === c.key ? "page" : undefined} className={`-mb-px inline-flex min-h-11 items-center whitespace-nowrap border-b-2 px-3 text-sm ${cat === c.key ? "border-brand-600 font-semibold text-brand-700" : "border-transparent text-zinc-600 hover:text-zinc-900"}`} data-help-cat={c.key}>
                {c.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <ul className="flex flex-col gap-2" aria-label="도움말 글">
        {guides
          .filter((g) => g.cat === cat)
          .map((g) => {
            const on = open === g.id;
            return (
              <li key={g.id} id={`help-${g.id}`} className={`overflow-hidden rounded-2xl border bg-white ${on ? "border-brand-300" : "border-zinc-200"}`} data-help-doc={g.id}>
                <button type="button" onClick={() => setOpen(on ? null : g.id)} aria-expanded={on} className="flex min-h-12 w-full items-center gap-2 px-4 py-2.5 text-left hover:bg-zinc-50">
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-semibold">{g.title}</span>
                    {!on && g.summary && <span className="block truncate text-xs text-zinc-500">{g.summary}</span>}
                  </span>
                  {g.sim && renderSim && <span className="shrink-0 text-[11px] font-semibold text-brand-700">▶ 미리 보기</span>}
                  {g.audience === "admin" && <span className="shrink-0 rounded-md bg-zinc-100 px-1.5 py-0.5 text-[11px] text-zinc-600">관리자</span>}
                  <ChevronDown className={`size-4 shrink-0 text-zinc-400 transition-transform ${on ? "rotate-180" : ""}`} aria-hidden />
                </button>
                {on && (
                  <div className="border-t border-zinc-100">
                    <ArticleBody g={g} href={href(g)} renderSim={renderSim} />
                  </div>
                )}
              </li>
            );
          })}
      </ul>
    </div>
  );
}

// 글 본문: 단계(번호 + 글 + 화면 그림) · [▶ 화면으로 보기] · [이동]
function ArticleBody({ g, href, renderSim }: { g: HelpGuide; href: string | null; renderSim?: (sim: string) => ReactNode }) {
  const [sim, setSim] = useState(false);
  return (
    <div className="flex flex-col gap-3.5 px-4 pb-4 pt-3" data-help-body={g.id}>
      <ol className="flex flex-col gap-3.5">
        {g.steps.map((s, i) => (
          <li key={i} className="flex gap-2.5" data-help-step={i + 1}>
            <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">{i + 1}</span>
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <p className="text-[14px] leading-relaxed text-zinc-800">{s.body}</p>
              {s.image && (
                <a href={s.image} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50" data-help-image>
                  {/* 공개 버킷의 화면 그림(예시 회사) */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={s.image} alt={s.alt ?? `${g.title} ${i + 1}단계 화면`} loading="lazy" className="block max-h-80 w-full object-cover object-top" />
                </a>
              )}
            </div>
          </li>
        ))}
      </ol>
      {g.sim && renderSim && sim && <div data-help-sim={g.sim}>{renderSim(g.sim)}</div>}
      <div className="flex flex-wrap gap-2">
        {g.sim && renderSim && (
          <button type="button" onClick={() => setSim((v) => !v)} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-brand-200 bg-brand-50 px-3 text-sm font-semibold text-brand-800 hover:bg-brand-100" data-help-sim-open>
            {sim ? "■ 닫기" : "▶ 화면으로 보기"}
          </button>
        )}
        {href && (
          <Link href={href} className="inline-flex min-h-10 items-center gap-1 rounded-xl bg-brand-600 px-3.5 text-sm font-semibold text-white hover:bg-brand-700" data-help-go>
            {g.pathLabel ?? "해당 메뉴로 이동"} <ArrowRight className="size-4" aria-hidden />
          </Link>
        )}
      </div>
    </div>
  );
}
