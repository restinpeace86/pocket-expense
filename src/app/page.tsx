import { Briefcase, Building2, CalendarDays, Camera, CheckCircle2, CreditCard, Crown, DoorOpen, FileSpreadsheet, Landmark, Link2, MessageCircle, MessagesSquare, ReceiptText, ScanLine, Smartphone, Wallet } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { AiSimulator } from "@/components/landing/ai-simulator";
import { Faq } from "@/components/landing/faq";
import { HeroMockup } from "@/components/landing/hero-mockup";
import { Pricing } from "@/components/landing/pricing";
import { Testimonials } from "@/components/landing/testimonials";
import { OPERATOR, SHOW_FULL_BUSINESS_INFO } from "@/components/legal/documents";
import { ADMIN_FEEDBACK_URL } from "@/lib/feedback";
import { Wordmark } from "@/components/brand/logo";

// 랜딩 페이지 (spec/screens/landing-page.md). 정적 화면 — 세션을 읽지 않는다.
// CTA는 로그인 후 회사 생성 위저드로 간다. 이미 소속이 있으면 /login이 본인 워크스페이스로 보낸다.
// 검색 결과에 대표 주소로 잡히게(7차 개선사항 6) — 제목·설명·공유 이미지는 루트 layout 기본값
export const metadata: Metadata = { alternates: { canonical: "/" } };

// 상단 메뉴 바로 가기(D-143) — PC(lg 이상)에서만 보인다(휴대폰·태블릿은 자리가 없어 로그인·시작 버튼만)
const SECTION_LINKS = [
  { href: "#pillars", label: "기능" },
  { href: "#preview", label: "미리보기" },
  { href: "#pricing", label: "요금제" },
  { href: "#faq", label: "자주 묻는 질문" },
];

const START_HREF = `/login?next=${encodeURIComponent("/onboarding/create-company")}`;

// WORKON(D-220): 작은 회사 통합 운영관리 — 세 기둥. 지금 있는 기능만 쓴다(D-200 원칙)
const PILLARS = [
  {
    icon: ReceiptText,
    title: "경비·결재",
    points: ["영수증 사진 → AI가 지출결의서 채움", "카카오톡 알림으로 휴대폰 결재", "직원 사비 정산 · 법인카드 내역 대조"],
  },
  {
    icon: MessagesSquare,
    title: "사내 협업",
    points: ["우리 회사 직원끼리 사내 채팅", "일정 공유 캘린더 · 출장·외근 일정", "회의실 예약 · 안건·자료 · 10분 전 알림"],
  },
  {
    icon: Landmark,
    title: "세무사무소 연계",
    points: ["월말 마감 파일(장부·영수증·결의서 PDF)", "세무사무소는 무료 전용 화면에서 받음", "더존 위하고 일반전표 엑셀 그대로"],
  },
];

// 따로 쓰던 도구를 묶으면 생기는 것 — 기능끼리 이어진 부분(D-210·D-216·D-217·D-203)
const LINKS = [
  { icon: CalendarDays, title: "출장 일정 → 결의서 자동 채움", body: "캘린더에 적어 둔 출장을 결의서에서 누르면 출장지·기간·목적이 들어가요. 두 번 적지 않아요." },
  { icon: DoorOpen, title: "회의실 예약 = 참석자 일정", body: "예약하면 참석자 캘린더에 회의로 잡히고, 안건·자료가 붙고, 10분 전에 채팅 알림이 가요." },
  { icon: MessageCircle, title: "결의서마다 바로 대화", body: "궁금한 결의서는 그 자리에서 [이 건으로 대화] — 카톡에 캡처해 보낼 필요가 없어요." },
  { icon: Link2, title: "승인된 경비는 세무사무소로", body: "대표가 승인한 지출만 모여 월말에 세무사무소 화면으로 넘어가요. 메일·압축 파일이 없어요." },
];

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
    title: "월말 마감, 세무사무소에 바로",
    body: "지출내역 엑셀 + 영수증 원본 + 지출결의서 PDF를 한 번에. 압축해서 이메일로 보낼 필요 없이, 세무사무소는 무료 전용 화면에서 바로 보고 내려받습니다.",
  },
  // 법인카드 내역 대조(D-111·D-154). 홈택스 파일 대조는 아직 아니라(8-12 보류) '카드사 사용 내역'이라고만 쓴다(D-181)
  {
    icon: CreditCard,
    title: "법인카드 내역 자동 대조",
    body: "월말에 카드사 사용 내역 파일(엑셀·CSV)만 올리세요. 직원이 올린 영수증과 날짜·금액·카드 끝 4자리로 맞춰, 결의서 없는 카드 결제와 사비로 잘못 올린 법인카드 결제를 찾아냅니다.",
  },
];

// 한 달이 이렇게 흘러가요(D-200) — 지금 있는 기능만. 알림톡은 연결을 전제로 쓴다(사용자 결정 2026-11-05, B-3)
const FLOW = [
  { icon: Camera, when: "매일", who: "직원", title: "영수증을 찍으면 결의서가 채워져요", body: "AI가 가맹점·금액·부가세·계정과목을 읽어 결의서에 넣어요. 직원은 확인하고 결재만 올리면 돼요." },
  { icon: CheckCircle2, when: "수시로", who: "대표·팀장", title: "알림 받고 휴대폰에서 바로 승인", body: "카카오톡·앱 알림을 누르면 영수증 원본과 내역이 열려요. 기본은 대표 직통 승인, 필요하면 팀장 사전 검토만 더해요." },
  { icon: Wallet, when: "월말", who: "경리·관리자", title: "정산·카드 대조·마감을 한 화면에서", body: "직원별 정산 지급, 법인카드 내역 대조, 세무 마감 파일(엑셀 장부·영수증·지출결의서 PDF)을 한 번에 끝내요." },
  { icon: Landmark, when: "마감 뒤", who: "세무사무소", title: "세무사무소가 바로 받아요", body: "무료 전용 화면에서 장부와 영수증을 보고, 더존 위하고 일반전표 엑셀로 그대로 올려요. 메일로 압축 파일을 보낼 필요가 없어요." },
];

// 누구에게 좋은가(D-200) — 예전 "5인 회사에 과하지 않나요?" 문단을 대표 카드로 흡수
const ROLES = [
  { icon: Crown, who: "대표", body: "결재는 휴대폰으로 몇 초. 이번 달 지출은 계정과목별로, 직원 일정·회의실은 캘린더에서 한눈에 봐요. 도구 여러 개를 따로 결제하지 않아도 돼요." },
  { icon: Briefcase, who: "경리·관리자", body: "영수증 풀칠·엑셀 취합 없이 승인된 것만 모여요. 정산 지급 목록과 세무 마감 파일이 자동으로 만들어져요." },
  { icon: Smartphone, who: "직원", body: "앱 설치 없이 링크로 가입해요. 영수증은 찍기만, 동료와는 사내 채팅으로, 일정·회의실 예약도 같은 곳에서 해요." },
  { icon: Landmark, who: "세무사무소", body: "고객사 자료를 무료 전용 화면에서 바로 받아요. 확인할 영수증은 표시되어 오고, 궁금한 건 영수증에 바로 물어봐요." },
];

export default function LandingPage() {
  return (
    <div className="flex-1 overflow-x-clip bg-gradient-to-b from-zinc-950 via-slate-900 to-zinc-950 text-white">
      <nav className="sticky top-0 z-10 border-b border-white/10 bg-zinc-950/70 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2">
            <Wordmark tone="light" className="whitespace-nowrap text-xl" />
            <span className="hidden whitespace-nowrap rounded-full border border-white/20 px-2 py-0.5 text-xs text-zinc-300 md:inline">작은 회사 통합 운영관리</span>
          </div>
          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            {SECTION_LINKS.map(({ href, label }) => (
              <a key={href} href={href} className="hidden min-h-11 items-center whitespace-nowrap rounded-xl px-3 text-sm text-zinc-300 hover:text-white lg:inline-flex">
                {label}
              </a>
            ))}
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
            5~20인 작은 회사를 위한 통합 운영관리
          </p>
          {/* 메인 카피는 두 줄로 고정(휴대폰에서도 어절 중간에서 끊기지 않게 break-keep) */}
          <h1 className="mt-5 break-keep text-[2.5rem] font-extrabold leading-[1.15] tracking-tight sm:text-6xl lg:text-[3.5rem]">
            작은 회사 운영,
            <br />
            <span className="text-blue-400">WORKON</span> 하나로.
          </h1>
          <p className="mt-5 max-w-md text-balance break-keep text-lg leading-relaxed text-zinc-300 sm:text-xl">
            경비·결재부터 사내 채팅·캘린더·회의실 예약, 세무사무소 전달까지. 따로 쓰던 업무 도구를 한 구독으로 묶고 서로 이어 놨어요.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link href={START_HREF} className="inline-flex min-h-12 items-center justify-center whitespace-nowrap rounded-xl bg-blue-500 px-6 font-semibold hover:bg-blue-400">
              🏢 우리 회사 무료로 시작하기
            </Link>
            <a href="#pricing" className="inline-flex min-h-12 items-center justify-center whitespace-nowrap rounded-xl border border-white/20 px-6 text-zinc-200 hover:bg-white/5">
              요금제 보기
            </a>
          </div>
          <p className="mt-3 text-sm text-zinc-400">첫 월말 마감까지 무료 · 결제 정보 필요 없음 · 초기 도입비 없음</p>
        </div>
        <HeroMockup />
      </header>

      <section id="pillars" className="mx-auto max-w-5xl scroll-mt-20 px-4 py-16" aria-labelledby="pillars-title">
        <h2 id="pillars-title" className="text-balance break-keep text-center text-3xl font-bold tracking-tight">회사 운영에 필요한 것, 한곳에서</h2>
        <p className="mt-2 text-balance break-keep text-center text-zinc-400">메신저·캘린더·경비 앱을 따로 쓰고 따로 결제하던 일을 하나로.</p>
        <ul className="mt-10 grid gap-4 md:grid-cols-3">
          {PILLARS.map(({ icon: Icon, title, points }) => (
            <li key={title} className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur">
              <Icon className="size-7 text-blue-300" aria-hidden />
              <h3 className="mt-4 text-lg font-semibold">{title}</h3>
              <ul className="mt-3 flex flex-col gap-2">
                {points.map((t) => (
                  <li key={t} className="flex gap-2 break-keep text-sm leading-relaxed text-zinc-300">
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-blue-300" aria-hidden />
                    {t}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-16" aria-labelledby="links-title">
        <h2 id="links-title" className="text-balance break-keep text-center text-3xl font-bold tracking-tight">하나로 묶어서, 이어지니까 편해요</h2>
        <p className="mt-2 text-balance break-keep text-center text-zinc-400">기능을 모아 놓기만 한 게 아니라 서로 이어져 있어서 손이 덜 가요.</p>
        <ul className="mt-10 grid gap-4 md:grid-cols-2">
          {LINKS.map(({ icon: Icon, title, body }) => (
            <li key={title} className="flex gap-4 rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-blue-500/15">
                <Icon className="size-6 text-blue-300" aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="block break-keep font-semibold">{title}</span>
                <span className="mt-1 block break-keep text-sm leading-relaxed text-zinc-300">{body}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-16" aria-labelledby="expense-title">
        <h2 id="expense-title" className="text-balance break-keep text-center text-3xl font-bold tracking-tight">경비 처리는 더 깊게</h2>
        <p className="mt-2 text-balance break-keep text-center text-zinc-400">작은 회사에서 손이 가장 많이 가는 경비·결재는 AI가 대신 채우고 맞춰요.</p>
        <ul className="mt-10 grid gap-4 md:grid-cols-2">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <li key={title} className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur">
              <Icon className="size-7 text-blue-300" />
              <h3 className="mt-4 text-lg font-semibold">{title}</h3>
              <p className="mt-2 break-keep text-sm leading-relaxed text-zinc-300">{body}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-16" aria-labelledby="flow-title">
        <h2 id="flow-title" className="text-balance break-keep text-center text-3xl font-bold tracking-tight">경비는 한 달이 이렇게 흘러가요</h2>
        <p className="mt-2 text-balance break-keep text-center text-zinc-400">영수증을 찍는 순간부터 세무사무소가 받기까지, 손으로 옮기는 단계가 없어요.</p>
        <ol className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {FLOW.map(({ icon: Icon, when, who, title, body }, i) => (
            <li key={title} className="relative flex flex-col rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur">
              <span className="flex items-center gap-2 text-xs font-semibold text-blue-300">
                <span className="flex size-6 items-center justify-center rounded-full bg-blue-500/20 tabular-nums">{i + 1}</span>
                {when} · {who}
              </span>
              <Icon className="mt-4 size-7 text-blue-300" aria-hidden />
              <h3 className="mt-3 break-keep font-semibold">{title}</h3>
              <p className="mt-2 break-keep text-sm leading-relaxed text-zinc-300">{body}</p>
            </li>
          ))}
        </ol>
      </section>

      <AiSimulator startHref={START_HREF} />

      <section className="mx-auto max-w-5xl px-4 py-16" aria-labelledby="roles-title">
        <h2 id="roles-title" className="text-balance break-keep text-center text-3xl font-bold tracking-tight">누구에게 좋은가요?</h2>
        <p className="mt-2 text-balance break-keep text-center text-zinc-400">5인 회사에도 과하지 않게. 쓰는 사람마다 편해지는 게 달라요.</p>
        <ul className="mt-10 grid gap-4 sm:grid-cols-2">
          {ROLES.map(({ icon: Icon, who, body }) => (
            <li key={who} className="flex gap-4 rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-blue-500/15">
                <Icon className="size-6 text-blue-300" aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="block font-semibold">{who}</span>
                <span className="mt-1 block break-keep text-sm leading-relaxed text-zinc-300">{body}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <Pricing />

      <Testimonials />

      <Faq />

      <section className="mx-auto max-w-3xl px-4 pb-28 pt-8 text-center">
        <h2 className="text-balance break-keep text-3xl font-bold tracking-tight">회사 운영, 이제 WORKON 하나로 시작하세요.</h2>
        <p className="mt-3 text-balance break-keep text-zinc-400">경비부터 결재, 사내 소통, 일정까지. 초기 도입비 없이 월 구독 하나로.</p>
        <Link href={START_HREF} className="mt-8 inline-flex min-h-14 items-center justify-center whitespace-nowrap rounded-xl bg-blue-500 px-8 text-lg font-semibold hover:bg-blue-400">
          🏢 우리 회사 무료로 시작하기
        </Link>
        {/* 가입 전 문의 창구(D-142) — 카카오톡 채널 주소가 등록되기 전에는 숨긴다 */}
        {ADMIN_FEEDBACK_URL && (
          <div className="mt-4">
            <a
              href={ADMIN_FEEDBACK_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-12 items-center justify-center whitespace-nowrap rounded-xl border border-white/20 px-6 text-zinc-200 hover:bg-white/5"
            >
              💬 궁금한 점은 카카오톡으로 문의하기
            </a>
          </div>
        )}
      </section>

      <footer className="flex flex-col items-center gap-2 border-t border-white/10 py-8 text-xs text-zinc-500">
        <nav className="flex flex-wrap justify-center gap-x-4">
          <Link href="/terms" className="inline-flex min-h-11 items-center hover:text-zinc-300">이용약관</Link>
          <Link href="/privacy" className="inline-flex min-h-11 items-center font-semibold hover:text-zinc-300">개인정보 처리방침</Link>
          <Link href="/for-tax-office" className="inline-flex min-h-11 items-center hover:text-zinc-300">세무사무소</Link>
        </nav>
        <BusinessInfo />
        <p>© 다모은랩 · WORKON</p>
      </footer>
    </div>
  );
}

// 사업자 정보(D-142) — 운영자 정보(OPERATOR)가 채워진 칸만 보인다. 지금은 상호·이메일만(D-233, SHOW_FULL_BUSINESS_INFO), [사업자 정보 ▾]로 접어 둠
function BusinessInfo() {
  if (!OPERATOR.name) return null;
  const items = [
    ["상호", OPERATOR.name],
    ["대표", OPERATOR.ceo],
    ["사업자등록번호", OPERATOR.businessNumber],
    ["통신판매업 신고", OPERATOR.mailOrderNumber],
    ["주소", OPERATOR.address],
    ["전화", OPERATOR.phone],
    ["이메일", OPERATOR.email],
    ["호스팅", OPERATOR.hosting],
  ].filter(([label, value]) => value && (SHOW_FULL_BUSINESS_INFO || label === "상호" || label === "이메일"));
  // 접어 두기(D-233): [사업자 정보 ▾]를 눌러야 펼쳐진다(자바스크립트 없이 details)
  return (
    <details className="group max-w-3xl px-4 text-center">
      <summary className="mx-auto inline-flex min-h-11 cursor-pointer list-none items-center gap-1 rounded-lg px-3 hover:text-zinc-300 [&::-webkit-details-marker]:hidden">
        사업자 정보 <span aria-hidden className="transition-transform group-open:rotate-180">▾</span>
      </summary>
      <p className="mt-1 leading-relaxed">
        {items.map(([label, value]) => (
          <span key={label} className="mx-1.5 inline-block">
            {label} {value}
          </span>
        ))}
      </p>
    </details>
  );
}
