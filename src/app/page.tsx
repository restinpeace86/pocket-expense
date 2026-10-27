import { Building2, FileSpreadsheet, MessageCircle, ScanLine } from "lucide-react";
import Link from "next/link";
import { HeroMockup } from "@/components/landing/hero-mockup";
import { Pricing } from "@/components/landing/pricing";

// 랜딩 페이지 (spec/screens/landing-page.md). 정적 화면 — 세션을 읽지 않는다.
// CTA는 로그인 후 회사 생성 위저드로 간다. 이미 소속이 있으면 /login이 본인 워크스페이스로 보낸다.
const START_HREF = `/login?next=${encodeURIComponent("/onboarding/create-company")}`;

const FEATURES = [
  {
    icon: ScanLine,
    title: "우리 회사 양식 그대로",
    body: "쓰던 지출결의서 사진 한 장이면 웹 양식으로 자동 변환. 영수증을 찍으면 그 양식에 알아서 채워집니다.",
  },
  {
    icon: MessageCircle,
    title: "카카오톡 원클릭 결재",
    body: "앱 설치 없이 알림톡 링크로 영수증 원본과 내역을 보고 바로 승인합니다.",
  },
  {
    icon: FileSpreadsheet,
    title: "월말 마감 원클릭",
    body: "세무사무소에 넘길 지출내역 엑셀 + 영수증 원본 + 지출결의서 PDF를 한 번에 내려받습니다.",
  },
];

export default function LandingPage() {
  return (
    <div className="flex-1 overflow-x-clip bg-gradient-to-b from-zinc-950 via-slate-900 to-zinc-950 text-white">
      <nav className="sticky top-0 z-10 border-b border-white/10 bg-zinc-950/70 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="whitespace-nowrap text-lg font-bold">PocketExpense</span>
            <span className="hidden whitespace-nowrap rounded-full border border-white/20 px-2 py-0.5 text-xs text-zinc-300 md:inline">for Startups &amp; SMBs</span>
          </div>
          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            <Link href="/login" className="inline-flex min-h-11 items-center whitespace-nowrap rounded-xl px-2 text-sm text-zinc-200 hover:text-white sm:px-3">
              로그인
            </Link>
            <Link href={START_HREF} className="inline-flex min-h-11 items-center whitespace-nowrap rounded-xl bg-blue-500 px-3 text-sm font-semibold hover:bg-blue-400 sm:px-4">
              <Building2 className="mr-1.5 hidden size-4 sm:inline" />
              <span className="hidden sm:inline">우리 회사&nbsp;</span>무료로 시작하기
            </Link>
          </div>
        </div>
      </nav>

      <header className="mx-auto grid max-w-5xl items-center gap-12 px-4 pb-24 pt-12 sm:pt-16 lg:grid-cols-2 lg:gap-16 lg:pt-24">
        <div>
          <p className="inline-flex rounded-full border border-blue-300/30 bg-blue-400/10 px-3 py-1 text-sm font-medium text-blue-200">
            소기업·스타트업을 위한 AI 경비 정산
          </p>
          {/* 메인 카피는 두 줄로 고정(휴대폰에서도 어절 중간에서 끊기지 않게 break-keep) */}
          <h1 className="mt-5 break-keep text-[2.5rem] font-extrabold leading-[1.15] tracking-tight sm:text-6xl lg:text-[3.5rem]">
            복잡한 경비처리,
            <br />
            <span className="text-blue-400">사진 한 장</span>으로 끝.
          </h1>
          <p className="mt-5 max-w-md text-balance break-keep text-lg leading-relaxed text-zinc-300 sm:text-xl">
            영수증 등록부터 월말 세무회계용 엑셀 정리까지 한 번에.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link href={START_HREF} className="inline-flex min-h-12 items-center justify-center whitespace-nowrap rounded-xl bg-blue-500 px-6 font-semibold hover:bg-blue-400">
              🏢 우리 회사 무료로 시작하기
            </Link>
            <a href="#pricing" className="inline-flex min-h-12 items-center justify-center whitespace-nowrap rounded-xl border border-white/20 px-6 text-zinc-200 hover:bg-white/5">
              요금제 보기
            </a>
          </div>
          <p className="mt-3 text-sm text-zinc-400">가입 즉시 영수증 100장 무료 · 결제 정보 필요 없음</p>
        </div>
        <HeroMockup />
      </header>

      <section className="mx-auto max-w-5xl px-4 py-16">
        <ul className="grid gap-4 md:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <li key={title} className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur">
              <Icon className="size-7 text-blue-300" />
              <h3 className="mt-4 text-lg font-semibold">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-300">{body}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="mx-auto max-w-3xl px-4 py-16 text-center">
        <p className="text-balance text-2xl font-semibold leading-snug">&ldquo;팀장 결재, 복잡한 조직도… 5인 회사에 과하지 않나요?&rdquo;</p>
        <p className="mt-4 text-zinc-300">
          기본은 사장님 직통 승인. 필요할 때만 팀장 사전 검토를 추가하세요. 개인카드·법인카드 모두 지원하고, 일반 식대 한도
          초과분은 자동으로 나눠 계산하며 출장 중 비용은 출장비로 따로 묶입니다.
        </p>
      </section>

      <Pricing />

      <section className="mx-auto max-w-3xl px-4 pb-28 pt-8 text-center">
        <h2 className="text-balance text-3xl font-bold tracking-tight">엑셀과 영수증 지옥에서 벗어날 준비가 되셨나요?</h2>
        <Link href={START_HREF} className="mt-8 inline-flex min-h-14 items-center justify-center whitespace-nowrap rounded-xl bg-blue-500 px-8 text-lg font-semibold hover:bg-blue-400">
          🏢 우리 회사 무료로 시작하기
        </Link>
      </section>

      <footer className="flex flex-col items-center gap-2 border-t border-white/10 py-8 text-xs text-zinc-500">
        <nav className="flex gap-4">
          <Link href="/terms" className="inline-flex min-h-11 items-center hover:text-zinc-300">이용약관</Link>
          <Link href="/privacy" className="inline-flex min-h-11 items-center font-semibold hover:text-zinc-300">개인정보 처리방침</Link>
        </nav>
        <p>© PocketExpense</p>
      </footer>
    </div>
  );
}
