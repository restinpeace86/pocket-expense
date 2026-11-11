import { Search, Sparkles } from "lucide-react";

// 직원 홈 맨 아래 도움말 검색창(D-251 개선사항 7): 메뉴 → 나의 신청함 → 도움말 순서. 물어보면 도움말 화면으로 넘어가 바로 답한다
export function HelpSearchBox({ action }: { action: string }) {
  return (
    <section aria-labelledby="help-box-title" className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 shadow-sm md:px-5" data-help-box>
      <h2 id="help-box-title" className="flex items-center gap-1.5 pb-2 text-[15px] font-bold">
        <Sparkles className="size-4 text-brand-600" aria-hidden />
        AI 도움말
      </h2>
      <form action={action} method="get" role="search" className="flex items-center gap-2 rounded-xl border border-zinc-300 bg-white px-3 focus-within:border-brand-500">
        <Search className="size-4 shrink-0 text-zinc-400" aria-hidden />
        <label htmlFor="help-box-q" className="sr-only">
          궁금한 것
        </label>
        <input id="help-box-q" name="q" maxLength={200} placeholder="궁금한 걸 물어보세요 (예: 휴가 취소는 어떻게 해요?)" className="h-11 min-w-0 flex-1 bg-transparent text-[15px] outline-none" />
        <button type="submit" className="shrink-0 rounded-lg px-2 py-1.5 text-sm font-semibold text-brand-700 hover:bg-brand-50">
          물어보기
        </button>
      </form>
      <a href={action} className="mt-1.5 inline-flex min-h-9 items-center text-[13px] text-zinc-600 hover:underline">
        도움말 글 모두 보기 ›
      </a>
    </section>
  );
}
