import { BellRing, CalendarPlus, FileText, MousePointerClick, Users } from "lucide-react";
import type { SimDef } from "./sim-player";
import { Btn, Field, Panel, Phone, Say, Show } from "./ui";

// ④ 회의실: 회의실별 시간표에서 빈 시간 누르기 → 참석자·안건·자료 → 참석자 캘린더에 회의 → 10분 전 채팅 [알림]방 카드
const HOURS = ["10", "11", "13", "14", "15", "16"];
const BUSY: Record<string, string[]> = { "큰 회의실": ["10", "11"], "작은 회의실": ["13", "15"] };

export const roomsSim: SimDef = {
  key: "rooms",
  title: "회의실 예약",
  steps: [
    { title: "빈 시간 누르기", who: "직원", icon: MousePointerClick, ticks: 2 },
    { title: "참석자 · 안건", who: "캘린더에 회의", icon: Users, ticks: 4 },
    { title: "10분 전 알림", who: "채팅 [알림]방", icon: BellRing, ticks: 2 },
  ],
  scene: (step, t) => {
    if (step === 0)
      return (
        <div className="flex flex-col items-center gap-3">
          <Panel title="회의실 예약" sub="11/14(금)" className="max-w-[24rem]">
            <div className="grid grid-cols-[4.2rem_repeat(6,minmax(0,1fr))] gap-1 text-center text-[10.5px]">
              <span />
              {HOURS.map((h) => (
                <span key={h} className="text-zinc-500">{h}시</span>
              ))}
              {Object.entries(BUSY).map(([room, busy]) => (
                <div key={room} className="contents">
                  <span className="truncate pt-1.5 text-left font-semibold">{room}</span>
                  {HOURS.map((h) => {
                    const mine = room === "큰 회의실" && h === "14";
                    const taken = busy.includes(h);
                    return (
                      <span key={h} className={`flex h-8 items-center justify-center rounded-md text-[10px] ${taken ? "bg-zinc-300 text-zinc-600" : mine && t >= 1 ? "bg-brand-600 font-bold text-white ring-4 ring-brand-200" : "border border-dashed border-zinc-300 bg-white"}`}>
                        {taken ? "예약" : mine && t >= 1 ? "14:00" : ""}
                      </span>
                    );
                  })}
                </div>
              ))}
            </div>
          </Panel>
          <Say>{t >= 1 ? (t >= 2 ? "큰 회의실 14:00 — 예약 화면이 열려요" : "빈 칸을 눌러요") : "회색은 이미 잡힌 시간 · 겹치는 시간은 잡을 수 없어요"}</Say>
        </div>
      );
    if (step === 1)
      return (
        <Phone title="회의실 예약">
          <Field k="회의실" v="큰 회의실" on />
          <Field k="시간" v="11/14(금) 14:00~15:00" on={t >= 1} />
          <Show when={t >= 2}>
            <p className="text-[11px] text-zinc-500">참석자</p>
            <div className="flex flex-wrap gap-1">
              {["김대표", "박대리", "최직원"].map((n) => (
                <span key={n} className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-800">{n}</span>
              ))}
            </div>
          </Show>
          <Show when={t >= 3}>
            <p className="text-[11px] text-zinc-500">안건 · 자료</p>
            <p className="font-semibold">3분기 견적 검토</p>
            <p className="flex items-center gap-1 text-[11px] text-zinc-600">
              <FileText className="size-3.5 text-red-500" /> 견적서_3분기.pdf
            </p>
          </Show>
          <Btn state={t >= 4 ? "done" : t >= 3 ? "ready" : "idle"} done="예약했어요">
            <CalendarPlus className="size-4" /> 예약
          </Btn>
          <Show when={t >= 4}>
            <Say>참석자 3명의 캘린더에 회의로 잡혔어요</Say>
          </Show>
        </Phone>
      );
    return (
      <Phone title="채팅 · 알림">
        <p className="text-center text-[10px] text-zinc-400">오늘 13:50</p>
        <div className="landing-bubble rounded-2xl border border-brand-200 bg-brand-50 p-2.5" style={{ animationDelay: "0s" }}>
          <p className="flex items-center gap-1 text-[11px] font-semibold text-brand-700">
            <BellRing className="size-3.5" /> 10분 뒤 회의
          </p>
          <p className="mt-0.5 font-bold">3분기 견적 검토</p>
          <p className="text-[11px] text-zinc-600">14:00 · 큰 회의실 · 김대표 외 2명</p>
          <p className="text-[11px] text-zinc-600">안건 · 3분기 견적 검토 · 자료 1개</p>
          <Show when={t >= 1} className="mt-2">
            <span className={`inline-flex min-h-9 w-full items-center justify-center gap-1 rounded-lg bg-white text-[12px] font-semibold ring-brand-300 ${t >= 2 ? "ring-4" : "ring-1"}`}>
              <FileText className="size-3.5 text-red-500" /> 안건·자료 보기
            </span>
          </Show>
        </div>
        <Show when={t >= 2}>
          <Say>휴대폰 알림도 같이 가요 · 자료는 회의실 가면서 바로 열어요</Say>
        </Show>
      </Phone>
    );
  },
};
