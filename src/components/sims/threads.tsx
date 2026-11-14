import { ChevronDown, ListTree, MessagesSquare, Sparkles, SplitSquareHorizontal } from "lucide-react";
import type { ReactNode } from "react";
import type { SimDef } from "./sim-player";
import { Phone, Say, Show } from "./ui";

// ⑧ 서브 대화(D-246·D-264, 9-28): 카톡처럼 편하게, 대화는 섞이지 않게 — 메인 방에서 한 주제를 서브 대화로 떼어 내고,
// 끝나면 AI 요약 카드만 메인에 남는다. 내가 낀 서브 대화는 채팅 목록 맨 위 [내 서브 대화]에서 모아 본다
function Bubble({ me, who, dim, children }: { me?: boolean; who?: string; dim?: boolean; children: ReactNode }) {
  return (
    <div className={`landing-row flex flex-col ${me ? "items-end" : "items-start"} ${dim ? "opacity-40" : ""}`} style={{ animationDelay: "0s" }}>
      {who && <span className="text-[10px] text-zinc-500">{who}</span>}
      <span className={`max-w-[85%] break-keep rounded-2xl px-2.5 py-1.5 text-[12px] ${me ? "bg-brand-600 text-white" : "bg-zinc-100 text-zinc-900"}`}>{children}</span>
    </div>
  );
}

function ThreadCard({ title, count, summary }: { title: string; count: number; summary?: string }) {
  return (
    <div className="landing-row rounded-xl border border-brand-200 bg-brand-50/70 p-2" style={{ animationDelay: "0s" }}>
      <p className="flex items-center gap-1 text-[10.5px] font-semibold text-brand-800">
        <MessagesSquare className="size-3.5" /> 서브 대화 · 글 {count}
      </p>
      <p className="text-[12px] font-semibold text-zinc-900">{title}</p>
      {summary && (
        <p className="mt-1 flex items-start gap-1 rounded-lg bg-white px-2 py-1 text-[11.5px] text-zinc-800">
          <Sparkles className="mt-0.5 size-3 shrink-0 text-violet-600" /> 요약 · {summary}
        </p>
      )}
    </div>
  );
}

export const threadsSim: SimDef = {
  key: "threads",
  title: "서브 대화",
  steps: [
    { title: "섞이는 대화", who: "주제가 여러 개", icon: SplitSquareHorizontal, ticks: 3 },
    { title: "서브 대화로", who: "한 주제만 따로", icon: MessagesSquare, ticks: 4 },
    { title: "AI 요약", who: "메인엔 카드만", icon: Sparkles, ticks: 3 },
    { title: "모아 보기", who: "내 서브 대화", icon: ListTree, ticks: 3 },
  ],
  tickMs: 900,
  scene: (step, t) => {
    if (step === 0)
      return (
        <Phone title="채팅 · 영업팀 6">
          <Bubble who="이대리">오늘 점심 김치찌개 어때요?</Bubble>
          {t >= 1 && <Bubble who="박팀장">예시상사 견적 단가가 지난달이랑 달라요. 누가 확인했어요?</Bubble>}
          {t >= 1 && <Bubble who="김사원">금요일 회식 장소 투표 올렸어요</Bubble>}
          <Show when={t >= 2}>
            <div className="ml-6 w-44 overflow-hidden rounded-xl border border-zinc-200 bg-white text-[12px] shadow-lg">
              <p className="border-b border-zinc-100 px-3 py-1.5 text-[10.5px] text-zinc-500">박팀장 글 길게 눌러</p>
              <p className="bg-brand-50 px-3 py-2 font-semibold text-brand-800">서브 대화 만들기</p>
            </div>
          </Show>
          <Say>점심·견적·회식이 한 방에 섞여요</Say>
        </Phone>
      );
    if (step === 1)
      return t < 2 ? (
        <Phone title="서브 대화 · 예시상사 견적 단가">
          <p className="text-[10px] text-zinc-500">메인 대화와 섞이지 않게 이 주제만</p>
          <Bubble who="박팀장">예시상사 견적 단가가 지난달이랑 달라요</Bubble>
          {t >= 1 && <Bubble who="최직원">원자재 인상분이라고 메일 왔어요. 5% 올랐어요</Bubble>}
        </Phone>
      ) : (
        <Phone title="채팅 · 영업팀 6">
          <Bubble who="이대리" dim>
            오늘 점심 김치찌개 어때요?
          </Bubble>
          <ThreadCard title="예시상사 견적 단가" count={t >= 3 ? 4 : 2} />
          <Bubble who="김사원">금요일 회식 장소 투표 올렸어요</Bubble>
          <Say>메인에는 카드 한 장 — 글은 서브 대화 안에</Say>
        </Phone>
      );
    if (step === 2)
      return (
        <Phone title="채팅 · 영업팀 6">
          <Bubble who="김사원">금요일 회식 장소 투표 올렸어요</Bubble>
          <ThreadCard title="예시상사 견적 단가" count={4} summary={t >= 1 ? "원자재 인상분 5% 반영, 이번 견적부터 새 단가" : undefined} />
          <Show when={t >= 2}>
            <p className="rounded-lg bg-zinc-100 px-2 py-1 text-center text-[11px] text-zinc-600">종결됨 · 박팀장 — 나중에 들어온 사람도 요약만 보면 돼요</p>
          </Show>
        </Phone>
      );
    return (
      <Phone title="채팅">
        <div className="overflow-hidden rounded-xl border border-zinc-200">
          <p className="flex items-center justify-between bg-brand-50 px-2.5 py-2 text-[12px] font-semibold">
            <span className="flex items-center gap-1.5">
              <MessagesSquare className="size-4 text-brand-700" /> 내 서브 대화 <span className="rounded-full bg-red-500 px-1.5 text-[10px] text-white">3</span>
            </span>
            <ChevronDown className={`size-4 transition-transform ${t >= 1 ? "rotate-180" : ""}`} />
          </p>
          <Show when={t >= 1}>
            <div className="flex flex-col text-[12px]">
              {[
                ["11월 출장비 기준", "경영지원팀 · 10분 전", 2],
                ["부산 현장 자재 견적", "현장팀 · 1시간 전", 1],
                ["예시상사 견적 단가 · 요약됨", "영업팀 · 어제", 0],
              ].map(([a, b, n]) => (
                <p key={a as string} className={`flex items-center justify-between border-t border-zinc-100 px-2.5 py-1.5 ${n === 0 ? "opacity-50" : ""}`}>
                  <span>
                    <b className="block">{a}</b>
                    <span className="text-[10.5px] text-zinc-500">{b}</span>
                  </span>
                  {(n as number) > 0 && <span className="rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">{n}</span>}
                </p>
              ))}
            </div>
          </Show>
        </div>
        <Show when={t >= 2}>
          <Say>여러 방에 흩어진 내 서브 대화를 맨 위에서 한 번에</Say>
        </Show>
      </Phone>
    );
  },
};
