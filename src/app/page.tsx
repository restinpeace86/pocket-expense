import { ArrowRight, Briefcase, Building2, CalendarCheck, CalendarDays, Camera, CheckCircle2, CreditCard, Crown, DoorOpen, FileSpreadsheet, FileText, Landmark, Layers, Link2, MessageCircle, MessagesSquare, ReceiptText, ScanLine, Smartphone, Sparkles, Wallet } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Faq } from "@/components/landing/faq";
import { FeaturePreview } from "@/components/landing/feature-preview";
import { HeroMockup } from "@/components/landing/hero-mockup";
import { Pricing } from "@/components/landing/pricing";
import { Testimonials } from "@/components/landing/testimonials";
import { OPERATOR, SHOW_FULL_BUSINESS_INFO } from "@/components/legal/documents";
import { ADMIN_FEEDBACK_URL } from "@/lib/feedback";
import { Wordmark } from "@/components/brand/logo";
import { BRAND, BRAND_JOSA } from "@/lib/brand";

// 랜딩 페이지 (spec/screens/landing-page.md §0, D-255 §C 개편). 정적 화면 — 세션을 읽지 않는다.
// 밝은 바탕 + [기능 미리 보기]만 진한 띠(시뮬레이션 7개 탭). CTA는 로그인 후 회사 생성 위저드로 간다.
// 검색 결과에 대표 주소로 잡히게(7차 개선사항 6) — 제목·설명·공유 이미지는 루트 layout 기본값
export const metadata: Metadata = { alternates: { canonical: "/" } };

// 상단 메뉴 바로 가기(D-143) — PC(lg 이상)에서만 보인다(휴대폰·태블릿은 자리가 없어 로그인·시작 버튼만)
const SECTION_LINKS = [
  { href: "#why", label: "다른 점" },
  { href: "#pillars", label: "기능" },
  { href: "#preview", label: "미리 보기" },
  { href: "#pricing", label: "요금제" },
  { href: "#faq", label: "자주 묻는 질문" },
];

const START_HREF = `/login?next=${encodeURIComponent("/onboarding/create-company")}`;

// Moa-on이 다른 점(D-255 §C) — 지금 있는 기능만(D-200 원칙)
const WHY = [
  { icon: Layers, big: "도구 여럿 → 구독 하나", body: "경비·결재, 근태·휴가, 사내 채팅·캘린더·회의실, 서류 변환까지. 따로 가입하고 따로 결제하던 걸 한 곳에서." },
  { icon: Sparkles, big: "AI가 먼저 채워요", body: "영수증은 결의서로, 종이 표는 엑셀로. 사람은 맞는지 확인만 하면 돼요." },
  { icon: FileText, big: "우리 회사 양식 그대로", body: "쓰던 지출결의서·휴가신청서 양식에 그대로 채워서 PDF·엑셀로 받아요. 양식을 바꿀 필요가 없어요." },
  { icon: Landmark, big: "세무사무소까지 이어져요", body: "승인된 지출만 모여 월말에 세무사무소 무료 전용 화면으로. 메일·압축 파일이 없어요." },
];

// 다섯 기둥(D-255 §C). sim = [기능 미리 보기] 탭 키
const PILLARS = [
  { icon: ReceiptText, title: "경비·결재", sim: "receipt", points: ["영수증 사진 → AI가 지출결의서 채움", "알림 받고 휴대폰에서 결재", "직원 사비 정산 · 법인카드 내역 대조"] },
  { icon: CalendarCheck, title: "근태·휴가", sim: "qr", points: ["입구 QR을 휴대폰으로 찍는 출퇴근", "휴가 신청 · 남은 연차 미리 보기", "정정 신청 · 월 근태 한눈에"] },
  { icon: MessagesSquare, title: "협업", sim: "rooms", points: ["사내 채팅 · 서브 대화 · 파일 보관함", "일정 공유 캘린더 · 출장·외근", "회의실 예약 · 안건·자료 · 10분 전 알림"] },
  { icon: FileSpreadsheet, title: "문서·양식", sim: "convert", points: ["종이·PDF 서류 → 표 모양 그대로 엑셀", "회사 양식 휴가신청서 · 지출결의서", "PDF·엑셀로 바로 받기"] },
  { icon: Landmark, title: "세무 연계", sim: "closing", points: ["월말 마감 파일(장부·영수증·결의서 PDF)", "세무사무소는 무료 전용 화면에서 받음", "더존 위하고 일반전표 엑셀 그대로"] },
];

// 따로 쓰던 도구를 묶으면 생기는 것 — 기능끼리 이어진 부분(D-210·D-216·D-217·D-203·D-236·8-104C)
const LINKS = [
  { icon: CalendarDays, title: "출장 일정 → 결의서 자동 채움", body: "캘린더에 적어 둔 출장을 결의서에서 누르면 출장지·기간·목적이 들어가요. 두 번 적지 않아요." },
  { icon: DoorOpen, title: "회의실 예약 = 참석자 일정", body: "예약하면 참석자 캘린더에 회의로 잡히고, 안건·자료가 붙고, 10분 전에 채팅 알림이 가요." },
  { icon: MessageCircle, title: "결의서마다 바로 대화", body: "궁금한 결의서는 그 자리에서 [이 건으로 대화] — 카톡에 캡처해 보낼 필요가 없어요." },
  { icon: CalendarCheck, title: "휴가 승인 → 회사 휴가신청서", body: "대표가 승인하면 결재란까지 채운 우리 회사 양식 휴가신청서가 PDF·엑셀로 나와요." },
  { icon: ScanLine, title: "QR 한 번 → 월 근태", body: "출퇴근을 찍는 순간 월 근태에 쌓이고, 빠진 날은 정정 신청으로 대표 승인을 받아요." },
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

// 누구에게 좋은가(D-200)
const ROLES = [
  { icon: Crown, who: "대표", body: "결재·휴가 승인은 휴대폰으로 몇 초. 이번 달 지출은 계정과목별로, 직원 출퇴근·일정·회의실은 한눈에 봐요. 도구 여러 개를 따로 결제하지 않아도 돼요." },
  { icon: Briefcase, who: "경리·관리자", body: "영수증 풀칠·엑셀 취합 없이 승인된 것만 모여요. 정산 지급 목록, 월 근태, 세무 마감 파일이 자동으로 만들어져요." },
  { icon: Smartphone, who: "직원", body: "링크로 가입하고 휴대폰 하나로 다 해요. 영수증은 찍기만, 출퇴근은 QR로, 휴가 신청·회의실 예약·사내 채팅도 같은 곳에서." },
  { icon: Landmark, who: "세무사무소", body: "고객사 자료를 무료 전용 화면에서 바로 받아요. 확인할 영수증은 표시되어 오고, 궁금한 건 영수증에 바로 물어봐요." },
];

const card = "rounded-2xl border border-zinc-200 bg-white shadow-sm";

function Heading({ id, title, sub }: { id: string; title: string; sub: string }) {
  return (
    <>
      <h2 id={id} className="text-balance break-keep text-center text-3xl font-bold tracking-tight text-zinc-900">
        {title}
      </h2>
      <p className="mx-auto mt-2 max-w-2xl text-balance break-keep text-center text-zinc-600">{sub}</p>
    </>
  );
}

export default function LandingPage() {
  return (
    <div className="flex-1 overflow-x-clip bg-white text-zinc-900" data-landing>
      <nav className="sticky top-0 z-10 border-b border-zinc-200 bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2">
            <Wordmark tone="dark" className="whitespace-nowrap text-xl" />
            <span className="hidden whitespace-nowrap rounded-full border border-zinc-300 px-2 py-0.5 text-xs text-zinc-600 md:inline">작은 회사 통합 운영관리</span>
          </div>
          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            {SECTION_LINKS.map(({ href, label }) => (
              <a key={href} href={href} className="hidden min-h-11 items-center whitespace-nowrap rounded-xl px-2.5 text-sm text-zinc-600 hover:text-zinc-900 lg:inline-flex">
                {label}
              </a>
            ))}
            <Link href="/login" className="inline-flex min-h-11 items-center whitespace-nowrap rounded-xl px-2 text-sm text-zinc-700 hover:text-zinc-900 sm:px-3">
              로그인
            </Link>
            <Link href={START_HREF} className="inline-flex min-h-11 items-center whitespace-nowrap rounded-xl bg-blue-600 px-3 text-sm font-semibold text-white hover:bg-blue-500 sm:px-4">
              <Building2 className="mr-1.5 hidden size-4 sm:inline" />
              <span className="hidden sm:inline">우리 회사&nbsp;</span>무료로 시작하기
            </Link>
          </div>
        </div>
      </nav>

      <header className="bg-gradient-to-b from-blue-50 via-white to-white">
        <div className="mx-auto grid max-w-5xl items-center gap-12 px-4 pb-20 pt-12 sm:pt-16 lg:grid-cols-2 lg:gap-16 lg:pt-20">
          <div>
            <p className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700">5~20인 작은 회사를 위한 통합 운영관리</p>
            {/* 메인 카피는 두 줄로 고정(휴대폰에서도 어절 중간에서 끊기지 않게 break-keep) */}
            <h1 className="mt-5 break-keep text-[2.5rem] font-extrabold leading-[1.15] tracking-tight sm:text-6xl lg:text-[3.5rem]">
              작은 회사 운영,
              <br />
              <span className="text-blue-600">{BRAND.name}</span> 하나로.
            </h1>
            <p className="mt-5 max-w-md text-balance break-keep text-lg leading-relaxed text-zinc-600 sm:text-xl">
              경비·결재, 출퇴근·휴가, 사내 채팅·캘린더·회의실, 세무사무소 전달까지. 따로 쓰던 업무 도구를 한 구독으로 묶고 서로 이어 놨어요.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link href={START_HREF} className="inline-flex min-h-12 items-center justify-center whitespace-nowrap rounded-xl bg-blue-600 px-6 font-semibold text-white hover:bg-blue-500">
                🏢 우리 회사 무료로 시작하기
              </Link>
              <a href="#preview" className="inline-flex min-h-12 items-center justify-center whitespace-nowrap rounded-xl border border-zinc-300 bg-white px-6 font-medium text-zinc-800 hover:bg-zinc-50">
                ▶ 화면으로 먼저 보기
              </a>
            </div>
            <p className="mt-3 text-sm text-zinc-500">첫 월말 마감까지 무료 · 결제 정보 필요 없음 · 초기 도입비 없음</p>
          </div>
          <HeroMockup />
        </div>
      </header>

      <section id="why" className="mx-auto max-w-5xl scroll-mt-20 px-4 py-16" aria-labelledby="why-title">
        <Heading id="why-title" title={`${BRAND_JOSA.i} 다른 점`} sub="기능을 모아 놓기만 한 게 아니라, 작은 회사에서 손이 가장 많이 가는 일을 대신해요." />
        <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {WHY.map(({ icon: Icon, big, body }, i) => (
            <li key={big} className={`${card} flex flex-col p-5`}>
              <span className="flex items-center justify-between">
                <span className="flex size-11 items-center justify-center rounded-xl bg-blue-600 text-white">
                  <Icon className="size-6" aria-hidden />
                </span>
                <span className="text-sm font-bold tabular-nums text-blue-300">0{i + 1}</span>
              </span>
              <h3 className="mt-4 break-keep text-lg font-bold">{big}</h3>
              <p className="mt-2 break-keep text-sm leading-relaxed text-zinc-600">{body}</p>
            </li>
          ))}
        </ul>
      </section>

      <section id="pillars" className="scroll-mt-16 bg-zinc-50 py-16" aria-labelledby="pillars-title">
        <div className="mx-auto max-w-5xl px-4">
          <Heading id="pillars-title" title="회사 운영에 필요한 것, 한곳에서" sub="메신저·캘린더·경비·근태 앱을 따로 쓰고 따로 결제하던 일을 하나로." />
          <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {PILLARS.map(({ icon: Icon, title, sim, points }) => (
              <li key={title} className={`${card} flex flex-col p-6`} data-pillar={title}>
                <Icon className="size-7 text-blue-600" aria-hidden />
                <h3 className="mt-4 text-lg font-semibold">{title}</h3>
                <ul className="mt-3 flex flex-1 flex-col gap-2">
                  {points.map((t) => (
                    <li key={t} className="flex gap-2 break-keep text-sm leading-relaxed text-zinc-700">
                      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-blue-600" aria-hidden />
                      {t}
                    </li>
                  ))}
                </ul>
                <a href={`#preview-${sim}`} className="mt-4 inline-flex min-h-10 items-center gap-1 self-start rounded-lg text-sm font-semibold text-blue-700 hover:text-blue-900" data-pillar-sim={sim}>
                  ▶ 화면으로 보기 <ArrowRight className="size-4" aria-hidden />
                </a>
              </li>
            ))}
            <li className="flex flex-col justify-center rounded-2xl border border-dashed border-blue-300 bg-blue-50/60 p-6">
              <p className="break-keep text-lg font-bold text-blue-900">모든 플랜에 전부 포함</p>
              <p className="mt-2 break-keep text-sm leading-relaxed text-blue-900/80">기능마다 따로 결제하지 않아요. 쓰지 않는 기능은 설정에서 끄면 메뉴에서 사라져요.</p>
              <a href="#pricing" className="mt-4 inline-flex min-h-10 items-center gap-1 self-start text-sm font-semibold text-blue-700 hover:text-blue-900">
                요금제 보기 <ArrowRight className="size-4" aria-hidden />
              </a>
            </li>
          </ul>
        </div>
      </section>

      <FeaturePreview startHref={START_HREF} />

      <section className="mx-auto max-w-5xl px-4 py-16" aria-labelledby="links-title">
        <Heading id="links-title" title="하나로 묶어서, 이어지니까 편해요" sub="기능을 모아 놓기만 한 게 아니라 서로 이어져 있어서 손이 덜 가요." />
        <ul className="mt-10 grid gap-4 md:grid-cols-2">
          {LINKS.map(({ icon: Icon, title, body }) => (
            <li key={title} className={`${card} flex gap-4 p-5`}>
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-blue-50">
                <Icon className="size-6 text-blue-600" aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="block break-keep font-semibold">{title}</span>
                <span className="mt-1 block break-keep text-sm leading-relaxed text-zinc-600">{body}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="bg-zinc-50 py-16" aria-labelledby="expense-title">
        <div className="mx-auto max-w-5xl px-4">
          <Heading id="expense-title" title="경비 처리는 더 깊게" sub="작은 회사에서 손이 가장 많이 가는 경비·결재는 AI가 대신 채우고 맞춰요." />
          <ul className="mt-10 grid gap-4 md:grid-cols-2">
            {FEATURES.map(({ icon: Icon, title, body }) => (
              <li key={title} className={`${card} p-6`}>
                <Icon className="size-7 text-blue-600" aria-hidden />
                <h3 className="mt-4 text-lg font-semibold">{title}</h3>
                <p className="mt-2 break-keep text-sm leading-relaxed text-zinc-600">{body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-16" aria-labelledby="flow-title">
        <Heading id="flow-title" title="경비는 한 달이 이렇게 흘러가요" sub="영수증을 찍는 순간부터 세무사무소가 받기까지, 손으로 옮기는 단계가 없어요." />
        <ol className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {FLOW.map(({ icon: Icon, when, who, title, body }, i) => (
            <li key={title} className={`${card} relative flex flex-col p-5`}>
              <span className="flex items-center gap-2 text-xs font-semibold text-blue-700">
                <span className="flex size-6 items-center justify-center rounded-full bg-blue-100 tabular-nums">{i + 1}</span>
                {when} · {who}
              </span>
              <Icon className="mt-4 size-7 text-blue-600" aria-hidden />
              <h3 className="mt-3 break-keep font-semibold">{title}</h3>
              <p className="mt-2 break-keep text-sm leading-relaxed text-zinc-600">{body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="bg-zinc-50 py-16" aria-labelledby="roles-title">
        <div className="mx-auto max-w-5xl px-4">
          <Heading id="roles-title" title="누구에게 좋은가요?" sub="5인 회사에도 과하지 않게. 쓰는 사람마다 편해지는 게 달라요." />
          <ul className="mt-10 grid gap-4 sm:grid-cols-2">
            {ROLES.map(({ icon: Icon, who, body }) => (
              <li key={who} className={`${card} flex gap-4 p-5`}>
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-blue-50">
                  <Icon className="size-6 text-blue-600" aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block font-semibold">{who}</span>
                  <span className="mt-1 block break-keep text-sm leading-relaxed text-zinc-600">{body}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <Pricing />

      <Testimonials />

      <Faq />

      <section className="bg-gradient-to-b from-white to-blue-50 px-4 pb-28 pt-10 text-center">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-balance break-keep text-3xl font-bold tracking-tight">회사 운영, 이제 {BRAND.name} 하나로 시작하세요.</h2>
          <p className="mt-3 text-balance break-keep text-zinc-600">경비부터 결재, 출퇴근·휴가, 사내 소통, 일정까지. 초기 도입비 없이 월 구독 하나로.</p>
          <Link href={START_HREF} className="mt-8 inline-flex min-h-14 items-center justify-center whitespace-nowrap rounded-xl bg-blue-600 px-8 text-lg font-semibold text-white hover:bg-blue-500">
            🏢 우리 회사 무료로 시작하기
          </Link>
          {/* 가입 전 문의 창구(D-142) — 카카오톡 채널 주소가 등록되기 전에는 숨긴다 */}
          {ADMIN_FEEDBACK_URL && (
            <div className="mt-4">
              <a
                href={ADMIN_FEEDBACK_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-12 items-center justify-center whitespace-nowrap rounded-xl border border-zinc-300 bg-white px-6 text-zinc-800 hover:bg-zinc-50"
              >
                💬 궁금한 점은 카카오톡으로 문의하기
              </a>
            </div>
          )}
        </div>
      </section>

      <footer className="flex flex-col items-center gap-2 border-t border-zinc-200 bg-zinc-50 py-8 text-xs text-zinc-500">
        <nav className="flex flex-wrap justify-center gap-x-4">
          <Link href="/terms" className="inline-flex min-h-11 items-center hover:text-zinc-800">이용약관</Link>
          <Link href="/privacy" className="inline-flex min-h-11 items-center font-semibold hover:text-zinc-800">개인정보 처리방침</Link>
          <Link href="/for-tax-office" className="inline-flex min-h-11 items-center hover:text-zinc-800">세무사무소</Link>
        </nav>
        <BusinessInfo />
        <p>© 다모은랩 · {BRAND.name}</p>
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
      <summary className="mx-auto inline-flex min-h-11 cursor-pointer list-none items-center gap-1 rounded-lg px-3 hover:text-zinc-800 [&::-webkit-details-marker]:hidden">
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
