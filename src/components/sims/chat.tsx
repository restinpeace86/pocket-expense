import { Archive, FileText, MessagesSquare, MessageSquareText, Receipt } from "lucide-react";
import type { ReactNode } from "react";
import type { SimDef } from "./sim-player";
import { Btn, Phone, Say, Show } from "./ui";

// ⑤ 채팅·보관: 결의서에서 [이 건으로 대화] → 서브 대화(한 주제만, 종결 + 요약) → 파일 길게 눌러 [영구 보관](파일 보관함)
function Bubble({ me, who, children }: { me?: boolean; who?: string; children: ReactNode }) {
  return (
    <div className={`landing-row flex flex-col ${me ? "items-end" : "items-start"}`} style={{ animationDelay: "0s" }}>
      {who && <span className="text-[10px] text-zinc-500">{who}</span>}
      <span className={`max-w-[85%] break-keep rounded-2xl px-2.5 py-1.5 text-[12px] ${me ? "bg-brand-600 text-white" : "bg-zinc-100 text-zinc-900"}`}>{children}</span>
    </div>
  );
}

export const chatSim: SimDef = {
  key: "chat",
  title: "채팅 · 파일 보관",
  steps: [
    { title: "결의서로 대화", who: "그 건으로 바로", icon: Receipt, ticks: 3 },
    { title: "서브 대화", who: "한 주제만 따로", icon: MessagesSquare, ticks: 4 },
    { title: "영구 보관", who: "파일 보관함", icon: Archive, ticks: 3 },
  ],
  tickMs: 850,
  scene: (step, t) => {
    if (step === 0)
      return t < 1 ? (
        <Phone title="지출결의서">
          <p className="font-semibold">부산 출장 · 186,000원</p>
          <p className="text-[11px] text-zinc-500">최직원 · 영수증 3장 · 결재 대기</p>
          <div className="mt-24" />
          <Btn state="ready">
            <MessageSquareText className="size-4" /> 이 건으로 대화
          </Btn>
          <Say>영수증을 캡처해서 보낼 필요가 없어요</Say>
        </Phone>
      ) : (
        <Phone title="채팅 · 경리팀">
          <div className="landing-row rounded-xl border border-zinc-200 bg-zinc-50 p-2" style={{ animationDelay: "0s" }}>
            <p className="text-[10px] text-zinc-500">지출결의서</p>
            <p className="font-semibold">부산 출장 · 186,000원</p>
          </div>
          {t >= 2 && <Bubble who="박경리">숙박 영수증이 빠졌어요. 한 장 더 올려 주세요</Bubble>}
          {t >= 3 && <Bubble me>네, 지금 올릴게요!</Bubble>}
        </Phone>
      );
    if (step === 1)
      return (
        <Phone title="서브 대화 · 법인카드 한도">
          <p className="text-[10px] text-zinc-500">방 안 대화와 섞이지 않게 이 주제만 따로</p>
          {t >= 1 && <Bubble who="최직원">다음 주 출장 법인카드 한도가 얼마예요?</Bubble>}
          {t >= 2 && <Bubble who="박경리">한 번에 50만 원까지예요</Bubble>}
          {t >= 3 && <Bubble who="최직원">확인했어요, 감사합니다</Bubble>}
          <Show when={t >= 4}>
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-2">
              <p className="text-[11px] font-semibold text-zinc-600">종결된 대화예요 · 박경리</p>
              <p className="mt-1 rounded-lg bg-zinc-100 px-2 py-1 text-[11.5px]">요약 · 출장 법인카드 한도는 한 번에 50만 원</p>
            </div>
          </Show>
        </Phone>
      );
    return (
      <Phone title="채팅 · 경리팀">
        <Bubble who="박경리">
          <span className="flex items-center gap-1.5">
            <FileText className="size-4 text-red-500" /> 거래처 계약서.pdf
          </span>
        </Bubble>
        <Show when={t >= 1}>
          <div className="ml-auto w-48 overflow-hidden rounded-xl border border-zinc-200 bg-white text-[12px] shadow-lg">
            <p className="border-b border-zinc-100 px-3 py-2 text-zinc-500">길게 눌러 연 메뉴</p>
            <p className="px-3 py-2">엑셀로 변환</p>
            <p className={`px-3 py-2 font-semibold ${t >= 2 ? "bg-brand-50 text-brand-800" : ""}`}>영구 보관</p>
          </div>
        </Show>
        <Show when={t >= 3}>
          <div className="flex items-start gap-2 rounded-xl bg-emerald-50 p-2.5 text-emerald-900">
            <Archive className="mt-0.5 size-4 shrink-0" />
            <span className="text-[12px]">
              <b className="block">파일 보관함에 남겼어요</b>보관 기간이 지나도 지워지지 않아요
            </span>
          </div>
        </Show>
      </Phone>
    );
  },
};
