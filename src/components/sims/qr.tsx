import { CalendarCheck, QrCode, ScanLine, Smartphone, Tablet } from "lucide-react";
import type { SimDef } from "./sim-player";
import { Duo, FakeQr, Phone, Panel, Say, Show } from "./ui";

// ① QR 출퇴근: 출근 단말 QR(30초마다 바뀜) → 휴대폰 가운데 [QR 출퇴근]으로 찍기 → 출근 기록(단말 인사 · 월 근태)
export const qrSim: SimDef = {
  key: "qr",
  title: "QR 출퇴근",
  steps: [
    { title: "QR 띄우기", who: "입구 태블릿", icon: Tablet, ticks: 2 },
    { title: "휴대폰으로 찍기", who: "직원", icon: Smartphone, ticks: 3 },
    { title: "출근 기록", who: "자동", icon: CalendarCheck, ticks: 2 },
  ],
  scene: (step, t) => {
    const terminal = (seed: number, hello?: boolean) => (
      <Panel title="예시 회사 · 출근 단말" sub="입구 태블릿" className="max-w-[17.5rem]">
        <p className="text-center text-[13px] font-bold">앱 가운데 [QR 출퇴근]으로 찍으세요</p>
        <div className="relative mx-auto w-36">
          <FakeQr key={seed} seed={seed} className="landing-row block w-36 rounded-lg border border-zinc-200 p-1.5" />
          {hello && (
            <div className="landing-bubble absolute inset-0 flex flex-col items-center justify-center rounded-lg bg-emerald-500/95 text-white" style={{ animationDelay: "0s" }}>
              <b className="text-base">최직원 출근</b>
              <span className="text-[12px]">08:52</span>
            </div>
          )}
        </div>
        <div className="h-1 overflow-hidden rounded-full bg-zinc-100">
          <div key={seed} className="h-full animate-[pe-fill_3s_linear_forwards] rounded-full bg-brand-500" />
        </div>
        <p className="text-center text-[11px] text-zinc-500">30초마다 바뀌어요 · 처음 찍으면 출근, 퇴근할 때 한 번 더</p>
      </Panel>
    );
    if (step === 0)
      return (
        <div className="flex flex-col items-center gap-3">
          {terminal(t >= 1 ? 2 : 1)}
          <Show when={t >= 1}>
            <Say>새 QR로 바뀌었어요. 직원은 자기 휴대폰으로 이 QR을 찍어요</Say>
          </Show>
        </div>
      );
    if (step === 1)
      return (
        <Duo>
          {terminal(2)}
          <Phone title={t >= 1 ? "QR 출퇴근" : "예시 회사"}>
            {t < 1 ? (
              <>
                <p className="text-zinc-500">오늘 · 아직 출근 전이에요</p>
                <div className="mt-24 flex justify-center">
                  <span className="inline-flex flex-col items-center gap-1 rounded-2xl bg-brand-600 px-4 py-2 text-[11px] font-semibold text-white ring-4 ring-brand-200">
                    <QrCode className="size-5" /> QR 출퇴근
                  </span>
                </div>
                <p className="text-center text-[11px] text-zinc-500">아래 가운데 버튼을 눌러요</p>
              </>
            ) : (
              <>
                <div className="relative mx-auto mt-2 flex size-44 items-center justify-center overflow-hidden rounded-2xl bg-zinc-900">
                  <FakeQr seed={2} className="w-24 opacity-90" />
                  <span className="absolute inset-4 rounded-xl border-2 border-white/70" />
                  {t < 2 && <span className="absolute inset-x-0 h-8 animate-[pe-scan_1.4s_ease-in-out_infinite] bg-gradient-to-b from-transparent via-brand-400/50 to-transparent" />}
                  {t >= 2 && (
                    <span className="landing-bubble absolute inset-0 flex items-center justify-center bg-emerald-500/80 text-[14px] font-bold text-white" style={{ animationDelay: "0s" }}>
                      확인됐어요 ✓
                    </span>
                  )}
                </div>
                <Show when={t >= 3}>
                  <p className="rounded-xl bg-emerald-50 px-3 py-2 text-center font-semibold text-emerald-800">출근 08:52 기록했어요</p>
                </Show>
                {t < 3 && (
                  <p className="flex items-center justify-center gap-1 text-[11px] text-zinc-500">
                    <ScanLine className="size-3.5" /> 단말 QR을 네모 안에 맞춰요
                  </p>
                )}
              </>
            )}
          </Phone>
        </Duo>
      );
    const days = Array.from({ length: 14 }, (_, i) => i + 1);
    return (
      <Duo>
        {terminal(3, true)}
        <Phone title="출퇴근 기록">
          <Show when={t >= 1}>
            <div className="rounded-xl border border-zinc-200 p-2.5">
              <p className="text-[11px] text-zinc-500">오늘</p>
              <p className="flex justify-between font-semibold">
                <span>출근 08:52</span>
                <span className="text-zinc-400">퇴근 —</span>
              </p>
              <p className="mt-1 text-[11px] text-zinc-500">퇴근도 똑같이 찍어요. 다시 찍으면 퇴근을 한 번 확인해요</p>
            </div>
          </Show>
          <Show when={t >= 2}>
            <p className="text-[11px] font-semibold text-zinc-600">이번 달</p>
            <div className="grid grid-cols-7 gap-1 text-center text-[10px]">
              {days.map((d) => (
                <span key={d} className={`rounded-md py-1 ${d === 14 ? "bg-brand-600 font-bold text-white" : d % 7 === 6 || d % 7 === 0 ? "text-zinc-300" : "bg-emerald-50 text-emerald-700"}`}>
                  {d}
                </span>
              ))}
            </div>
            <p className="text-[11px] text-zinc-500">초록 = 출근한 날 · 월 근태에 바로 쌓여요</p>
          </Show>
        </Phone>
      </Duo>
    );
  },
};
