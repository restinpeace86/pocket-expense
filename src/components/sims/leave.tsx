import { FileDown, FileSpreadsheet, FileText, Send, UserCheck } from "lucide-react";
import type { SimDef } from "./sim-player";
import { Btn, Duo, Field, Notice, Phone, Say, Show } from "./ui";

// ② 휴가 신청 → 회사 양식: 신청(종류·날짜·남은 연차·회사 추가 항목) → 대표 승인(알림 → 연 화면) → 회사 휴가신청서(결재란 채움) PDF·엑셀
export const leaveSim: SimDef = {
  key: "leave",
  title: "휴가 신청 → 회사 양식",
  steps: [
    { title: "휴가 신청", who: "직원", icon: Send, ticks: 5 },
    { title: "승인", who: "대표", icon: UserCheck, ticks: 3 },
    { title: "회사 휴가신청서", who: "PDF · 엑셀", icon: FileText, ticks: 3 },
  ],
  tickMs: 800,
  scene: (step, t) => {
    if (step === 0)
      return (
        <Phone title="휴가 신청">
          <div className="flex flex-col">
            <Field k="휴가 종류" v="연차" on={t >= 1} />
            <Field k="날짜" v="11/14(금) · 하루" on={t >= 2} />
            <Field k="이번 신청" v="근무일 1일" on={t >= 2} />
            <Field k="남은 연차" v={<><span className="text-zinc-400 line-through">4일</span> → 3일</>} on={t >= 3} tag="미리 보기" />
          </div>
          <Show when={t >= 4}>
            <div className="rounded-xl border border-dashed border-brand-300 bg-brand-50/60 p-2">
              <p className="text-[11px] font-semibold text-brand-800">회사 추가 항목</p>
              <Field k="업무 대행자" v="박대리" on />
              <Field k="비상 연락처" v="010-****-1234" on />
            </div>
          </Show>
          <Btn state={t >= 5 ? "done" : t >= 4 ? "ready" : "idle"} done="신청했어요">
            신청
          </Btn>
          <Show when={t >= 5}>
            <Say>대표님께 승인 요청 알림이 가요</Say>
          </Show>
        </Phone>
      );
    if (step === 1)
      return (
        <Phone title="대표 휴대폰">
          <Notice title="휴가 승인 요청" body="최직원님이 11/14(금) 연차 하루를 신청했어요" />
          <Show when={t >= 1}>
            <div className="rounded-xl border border-zinc-200 p-2.5">
              <p className="text-[11px] text-zinc-500">알림을 눌러 연 화면</p>
              <p className="font-semibold">최직원 · 연차 11/14(금) 1일</p>
              <p className="text-[11px] text-zinc-500">승인하면 남은 연차 4일 → 3일 · 업무 대행자 박대리</p>
              <div className="mt-2">
                <Btn state={t >= 3 ? "done" : t >= 2 ? "ready" : "idle"} done="승인 완료">
                  승인
                </Btn>
              </div>
            </div>
          </Show>
          <Show when={t >= 3}>
            <Say>직원에게 승인 알림 · 휴가신청서 결재란이 채워져요</Say>
          </Show>
        </Phone>
      );
    return (
      <Duo>
        <div className="w-full max-w-[19rem] rounded-md bg-white p-4 font-serif text-[11px] text-zinc-800 shadow-xl ring-1 ring-zinc-200">
          <div className="flex items-start justify-between gap-2">
            <p className="pt-3 text-[17px] font-bold tracking-[0.3em]">휴가신청서</p>
            <table className="border-collapse text-center text-[10px]">
              <thead>
                <tr>
                  <th className="w-14 border border-zinc-400 bg-zinc-50 py-0.5 font-medium">신청</th>
                  <th className="w-14 border border-zinc-400 bg-zinc-50 py-0.5 font-medium">대표</th>
                </tr>
              </thead>
              <tbody>
                <tr className="h-10">
                  <td className="border border-zinc-400">{t >= 1 && <span className="landing-row block" style={{ animationDelay: "0s" }}>최직원<br />11/10</span>}</td>
                  <td className="border border-zinc-400">{t >= 2 ? <span className="landing-row block font-semibold text-red-700" style={{ animationDelay: "0s" }}>김대표<br />11/11</span> : <span className="text-zinc-400">결재 전</span>}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <table className="mt-3 w-full border-collapse">
            <tbody>
              {[
                ["소속 · 성명", "예시 회사 · 최직원"],
                ["휴가 종류", "연차"],
                ["기간", "2026.11.14(금) 1일"],
                ["남은 연차", "3일"],
                ["업무 대행자", "박대리"],
                ["비상 연락처", "010-****-1234"],
              ].map(([k, v]) => (
                <tr key={k}>
                  <th className="w-24 border border-zinc-400 bg-zinc-50 px-1.5 py-1 text-left font-medium">{k}</th>
                  <td className="border border-zinc-400 px-1.5 py-1">{t >= 1 ? v : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-center text-[10px] text-zinc-500">위와 같이 휴가를 신청합니다.</p>
        </div>
        <div className="flex w-full max-w-[15rem] flex-col gap-2 sm:pt-6">
          <Say>회사가 올린 양식 그대로 칸과 결재란이 채워져요</Say>
          <Show when={t >= 3} className="flex flex-col gap-2">
            <span className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-brand-600 text-[13px] font-semibold text-white">
              <FileDown className="size-4" /> 휴가신청서 PDF
            </span>
            <span className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-zinc-300 bg-white text-[13px] font-semibold text-zinc-800">
              <FileSpreadsheet className="size-4 text-emerald-600" /> 엑셀
            </span>
          </Show>
        </div>
      </Duo>
    );
  },
};
