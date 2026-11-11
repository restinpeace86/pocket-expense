"use client";

import { ArrowRight, ChevronDown, Loader2, Search, Sparkles } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { askHelpAction, type HelpAnswer } from "@/lib/help/actions";
import { guidePath, guidesFor, HELP_CATEGORIES, type HelpCategory, type HelpFeatures, type HelpGuide } from "@/lib/help/guides";

// AI 도움말 센터(D-251 개선사항 7): 위 검색창(자연어 질문 → 도움말 글로만 답) + 아래 카테고리 탭 · 글 목록(펼쳐 읽기) · [해당 메뉴로 이동]
export function HelpCenter({ companyId, mode, admin, features, initialQ, initialDoc }: { companyId: string; mode: "admin" | "employee"; admin: boolean; features: HelpFeatures; initialQ: string; initialDoc: string | null }) {
  const ws = `/workspace/${companyId}`;
  const list = guidesFor(admin, features);
  const byId = new Map(list.map((g) => [g.id, g]));
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
    if (asked.current || initialQ.trim().length < 2) return;
    asked.current = true;
    start(async () => setAnswer(await askHelpAction(companyId, mode, initialQ)));
  }, [companyId, mode, initialQ]);

  const go = (g: HelpGuide) => {
    const p = guidePath(g, admin);
    return p ? `${ws}${p}` : null;
  };
  const refs = answer && answer.ok ? answer.refs.map((id) => byId.get(id)).filter((g): g is HelpGuide => !!g) : [];
  const cats = HELP_CATEGORIES.filter((c) => list.some((g) => g.cat === c.key));

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
        <input id="help-q" value={q} onChange={(e) => setQ(e.target.value)} maxLength={200} placeholder="예: 영수증 올렸는데 금액은 어떻게 고쳐요?" className="h-11 min-w-0 flex-1 bg-transparent text-[15px] outline-none" data-help-input />
        <button type="submit" disabled={busy || q.trim().length < 2} className="inline-flex h-10 shrink-0 items-center gap-1 rounded-xl bg-brand-600 px-3.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50" data-help-ask>
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
        <section aria-label="AI 답변" className="flex flex-col gap-2 rounded-2xl border border-brand-200 bg-brand-50 px-4 py-3.5" data-help-answer={answer.ok ? (answer.found ? "found" : "none") : "error"}>
          {!answer.ok ? (
            <p className="text-sm font-medium text-red-700">{answer.error}</p>
          ) : (
            <>
              <p className="flex items-center gap-1.5 text-xs font-semibold text-brand-700">
                <Sparkles className="size-3.5" aria-hidden /> AI 답변
              </p>
              {answer.found && answer.answer ? (
                <p className="text-[15px] leading-relaxed text-zinc-900">{answer.answer}</p>
              ) : answer.found ? (
                <p className="text-[15px] text-zinc-900">관련 있는 도움말 글을 찾았어요. 아래 글을 열어 보세요.</p>
              ) : (
                <p className="text-[15px] text-zinc-900">도움말에서 답을 찾지 못했어요. 아래 카테고리에서 찾아보거나 오른쪽 위 [의견 보내기]로 물어봐 주세요.</p>
              )}
              {refs.length > 0 && (
                <div className="flex flex-col gap-1.5 pt-1">
                  <p className="text-xs text-zinc-600">참고한 글</p>
                  <div className="flex flex-wrap gap-2">
                    {refs.map((g) => (
                      <button key={g.id} type="button" onClick={() => (setCat(g.cat), setOpen(g.id))} className="min-h-9 rounded-full border border-brand-300 bg-white px-3 text-[13px] font-medium text-brand-800 hover:bg-brand-100" data-help-ref={g.id}>
                        {g.title}
                      </button>
                    ))}
                  </div>
                  {go(refs[0]) && (
                    <Link href={go(refs[0])!} className="inline-flex min-h-10 items-center gap-1 self-start text-sm font-bold text-brand-700 hover:underline" data-help-go>
                      {refs[0].pathLabel ?? "해당 메뉴로 이동"} <ArrowRight className="size-4" aria-hidden />
                    </Link>
                  )}
                </div>
              )}
              <p className="text-[11px] text-zinc-500">오늘 {answer.remaining}번 더 물어볼 수 있어요 · 답은 도움말 글을 바탕으로 AI가 만들어요</p>
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
        {list
          .filter((g) => g.cat === cat)
          .map((g) => {
            const on = open === g.id;
            const href = go(g);
            return (
              <li key={g.id} id={`help-${g.id}`} className={`overflow-hidden rounded-2xl border bg-white ${on ? "border-brand-300" : "border-zinc-200"}`} data-help-doc={g.id}>
                <button type="button" onClick={() => setOpen(on ? null : g.id)} aria-expanded={on} className="flex min-h-12 w-full items-center gap-2 px-4 py-2.5 text-left hover:bg-zinc-50">
                  <span className="min-w-0 flex-1 text-[15px] font-semibold">{g.title}</span>
                  {g.audience === "admin" && <span className="shrink-0 rounded-md bg-zinc-100 px-1.5 py-0.5 text-[11px] text-zinc-600">관리자</span>}
                  <ChevronDown className={`size-4 shrink-0 text-zinc-400 transition-transform ${on ? "rotate-180" : ""}`} aria-hidden />
                </button>
                {on && (
                  <div className="flex flex-col gap-1.5 border-t border-zinc-100 px-4 pb-3.5 pt-2.5 text-[14px] leading-relaxed text-zinc-800">
                    {g.body.map((line, i) =>
                      line.startsWith("- ") ? (
                        <p key={i} className="flex gap-1.5 pl-1">
                          <span aria-hidden className="text-zinc-400">•</span>
                          <span>{line.slice(2)}</span>
                        </p>
                      ) : (
                        <p key={i}>{line}</p>
                      ),
                    )}
                    {href && (
                      <Link href={href} className="mt-1 inline-flex min-h-10 items-center gap-1 self-start rounded-xl bg-brand-600 px-3.5 text-sm font-semibold text-white hover:bg-brand-700" data-help-doc-go>
                        {g.pathLabel ?? "해당 메뉴로 이동"} <ArrowRight className="size-4" aria-hidden />
                      </Link>
                    )}
                  </div>
                )}
              </li>
            );
          })}
      </ul>
    </div>
  );
}
