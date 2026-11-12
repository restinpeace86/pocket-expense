"use client";

import { Archive, CalendarCheck, DoorOpen, FileSpreadsheet, Landmark, ReceiptText, ScanLine, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Sim } from "@/components/sims";

// 랜딩 [기능 미리 보기](D-255 §C): 탭 7개(영수증 + 새 6개), 탭을 누르면 그 시뮬레이션 재생. 도움말과 같은 components/sims를 쓴다.
// 다섯 기둥 카드의 [▶ 화면으로 보기]는 #preview-{키}로 와서 그 탭을 연다
const TABS: { key: string; label: string; icon: LucideIcon; head: string; sub: string }[] = [
  { key: "receipt", label: "영수증", icon: ReceiptText, head: "구겨진 영수증도 AI가 읽어 결의서를 채워요", sub: "단순 글자 인식이 아니라 AI LLM이 거래 맥락까지 읽어요. 직원은 찍고 올리기만, 결재자는 알림 받고 승인만." },
  { key: "qr", label: "QR 출퇴근", icon: ScanLine, head: "입구 QR을 휴대폰으로 찍으면 출근", sub: "30초마다 바뀌는 QR이라 대리 출근이 어려워요. 찍는 순간 월 근태에 쌓여요." },
  { key: "leave", label: "휴가 · 회사 양식", icon: CalendarCheck, head: "휴가 신청부터 우리 회사 휴가신청서까지", sub: "남은 연차를 미리 보고 신청, 대표는 휴대폰으로 승인. 결재란까지 채운 회사 양식이 PDF·엑셀로 나와요." },
  { key: "convert", label: "서류 → 엑셀", icon: FileSpreadsheet, head: "종이 표 사진 한 장이 엑셀로", sub: "칸·합친 칸·굵은 글씨까지 표 모양 그대로. 잘못 읽은 글자는 앱에서 바로 고쳐요." },
  { key: "rooms", label: "회의실", icon: DoorOpen, head: "빈 시간을 누르면 회의실 예약 끝", sub: "참석자 캘린더에 회의로 잡히고, 안건·자료가 붙고, 10분 전에 채팅 알림 카드가 와요." },
  { key: "chat", label: "채팅 · 보관", icon: Archive, head: "업무 대화는 그 건에 붙여서", sub: "결의서에서 바로 대화, 한 주제는 서브 대화로, 중요한 파일은 영구 보관." },
  { key: "closing", label: "월말 마감", icon: Landmark, head: "월말 마감 파일이 세무사무소로 바로", sub: "카드 내역 대조로 빠진 영수증을 찾고, 장부·증빙·결의서 PDF를 한 번에 넘겨요." },
];

export function FeaturePreview({ startHref }: { startHref: string }) {
  const [tab, setTab] = useState("receipt");
  // #preview-{키}로 오면 그 탭
  useEffect(() => {
    const sync = () => {
      const k = window.location.hash.replace("#preview-", "");
      if (TABS.some((t) => t.key === k)) {
        setTab(k);
        document.getElementById("preview")?.scrollIntoView({ block: "start" });
      }
    };
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);
  const cur = TABS.find((t) => t.key === tab) ?? TABS[0];

  return (
    <section id="preview" className="scroll-mt-16 bg-zinc-950 py-16 text-white sm:py-20" aria-labelledby="preview-title" data-feature-preview>
      <div className="mx-auto max-w-5xl px-4">
        <div className="text-center">
          <span className="inline-flex rounded-full border border-indigo-300/30 bg-indigo-400/10 px-3 py-1 text-sm font-medium text-indigo-200">기능 미리 보기</span>
          <h2 id="preview-title" className="mx-auto mt-4 max-w-2xl text-balance break-keep text-3xl font-bold tracking-tight sm:text-4xl">
            말보다 화면으로 보세요
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-balance break-keep text-zinc-400">가입 전에 실제 쓰는 모습을 그대로 재생해 봐요. 탭을 누르면 그 기능이 처음부터 움직여요.</p>
        </div>

        <div className="-mx-4 mt-8 overflow-x-auto px-4 [scrollbar-width:none]">
          <ul className="mx-auto flex w-max gap-1.5" role="tablist" aria-label="미리 볼 기능">
            {TABS.map(({ key, label, icon: Icon }) => {
              const on = key === tab;
              return (
                <li key={key}>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={on}
                    onClick={() => setTab(key)}
                    className={`inline-flex min-h-11 items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 text-sm font-semibold transition ${on ? "border-indigo-400 bg-gradient-to-r from-indigo-500 to-violet-500 text-white" : "border-white/15 bg-white/5 text-zinc-300 hover:bg-white/10"}`}
                    data-preview-tab={key}
                  >
                    <Icon className="size-4" aria-hidden /> {label}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="mx-auto mt-6 max-w-3xl" role="tabpanel" aria-label={cur.label}>
          <h3 className="text-balance break-keep text-center text-xl font-bold sm:text-2xl">{cur.head}</h3>
          <p className="mx-auto mt-2 max-w-xl text-balance break-keep text-center text-sm leading-relaxed text-zinc-400">{cur.sub}</p>
          <div className="mt-5">
            <Sim simKey={cur.key} tone="dark" />
          </div>
        </div>

        <div className="mt-10 text-center">
          <Link href={startHref} className="inline-flex min-h-14 max-w-full items-center justify-center rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-6 text-center text-base font-semibold text-balance break-keep shadow-lg shadow-indigo-500/30 hover:from-indigo-400 hover:to-violet-400 sm:text-lg">
            우리 회사로 무료 체험하기 (첫 월말 마감까지 무료)
          </Link>
        </div>
      </div>
    </section>
  );
}
