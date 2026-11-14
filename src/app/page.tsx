import { ArrowRight, Briefcase, Building2, Camera, CheckCircle2, Crown, FileText, Landmark, Layers, Smartphone, Sparkles, Wallet } from "lucide-react";
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
import { ACCENT, BRAND_BUTTON, type Accent } from "@/components/landing/accent";
import { WhyArtwork, type WhyArt } from "@/components/landing/why-art";
import { SectionNav } from "@/components/landing/section-nav";
import { MobileStartBar } from "@/components/landing/mobile-start-bar";
import { FEATURE_GROUPS } from "@/lib/landing/features";

// 랜딩 페이지 (spec/screens/landing-page.md §0, D-255 §C 개편). 정적 화면 — 세션을 읽지 않는다.
// 밝은 바탕 + [기능 미리 보기]만 진한 띠(시뮬레이션 8개 탭). D-273: 구역마다 박히는 한 줄 + 뒷받침 한 줄, 중간 구역 합침. CTA는 로그인 후 회사 생성 위저드로 간다.
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

// 다른 점(D-255 §C) — 지금 있는 기능만(D-200 원칙)
// D-273 랜딩 다시 짜기: 구역마다 박히는 한 줄 + 뒷받침 한 줄. 비슷한 카드가 이어지던 중간(이어짐·경비 더 깊게·한 달 흐름)은 [한 달 흐름] 하나로.
// [다른 점] 큰 글씨 4장 + 아래 [기능] 벽(모든 플랜 공통 기능을 구역별 칩으로 — 기능이 안 보이지 않게)
const WHY: { icon: typeof Layers; big: string; body: string; accent: Accent; art: WhyArt }[] = [
  { icon: Layers, big: "앱 다섯 개 → 하나", body: "경비·근태·채팅·캘린더·서류를 한 구독으로.", accent: "attend", art: "bundle" },
  { icon: Sparkles, big: "찍으면 결의서", body: "AI가 채우고, 사람은 확인만.", accent: "expense", art: "ai" },
  { icon: FileText, big: "쓰던 양식 그대로", body: "우리 회사 결의서·휴가신청서에 그대로 채워요.", accent: "docs", art: "form" },
  { icon: Landmark, big: "세무사무소까지 한 번에", body: "월말 마감 파일이 메일 없이 넘어가요.", accent: "tax", art: "tax" },
];

// 한 달 흐름(4단계) + 이어지는 점(칩) — 예전 [이어져서 편해요]·[경비 처리는 더 깊게]를 칩으로
const FLOW: { verb: string; when: string; body: string; accent: Accent; icon: typeof Layers }[] = [
  { verb: "찍는다", when: "매일 · 직원", body: "AI가 결의서를 채워요", accent: "expense", icon: Camera },
  { verb: "누른다", when: "수시로 · 대표", body: "알림 받고 휴대폰에서 승인", accent: "attend", icon: CheckCircle2 },
  { verb: "모인다", when: "월말 · 경리", body: "정산·카드 대조·마감 파일 자동", accent: "docs", icon: Wallet },
  { verb: "넘어간다", when: "마감 뒤 · 세무사무소", body: "메일·압축 파일 없이 바로", accent: "tax", icon: Landmark },
];
const LINKS = ["출장 일정 → 결의서 자동 채움", "결의서마다 바로 대화", "회의실 예약 = 참석자 일정", "QR 한 번 → 월 근태", "휴가 승인 → 회사 휴가신청서", "법인카드 내역 자동 대조", "우리 회사 양식 그대로 PDF·엑셀"];

const ROLES: { who: string; line: string; accent: Accent; icon: typeof Layers }[] = [
  { who: "대표", line: "결재는 휴대폰으로", accent: "expense", icon: Crown },
  { who: "경리·관리자", line: "월말 취합 끝", accent: "collab", icon: Briefcase },
  { who: "직원", line: "휴대폰 하나로 다", accent: "attend", icon: Smartphone },
  { who: "세무사무소", line: "자료가 알아서 와요", accent: "tax", icon: Landmark },
];

// 큰 제목 + 뒷받침 한 줄(D-273)
function Heading({ id, eyebrow, title, accent, sub }: { id: string; eyebrow: string; title: string; accent?: string; sub: string }) {
  return (
    <>
      <p className="text-center text-sm font-bold text-indigo-600">{eyebrow}</p>
      <h2 id={id} className="mt-2 text-balance break-keep text-center text-[2rem] font-extrabold leading-tight tracking-tight text-zinc-900 sm:text-[2.6rem]">
        {title}
        {accent && (
          <>
            <br />
            <span className="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">{accent}</span>
          </>
        )}
      </h2>
      <p className="mx-auto mt-3 max-w-2xl text-balance break-keep text-center text-lg text-zinc-600">{sub}</p>
    </>
  );
}

const card = "rounded-2xl border border-zinc-200 bg-white shadow-sm";

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
            <SectionNav links={SECTION_LINKS} />
            <Link href="/login" className="inline-flex min-h-11 items-center whitespace-nowrap rounded-xl px-2 text-sm text-zinc-700 hover:text-zinc-900 sm:px-3">
              로그인
            </Link>
            <Link href={START_HREF} className={`inline-flex min-h-11 items-center whitespace-nowrap rounded-xl px-3 text-sm font-semibold sm:px-4 ${BRAND_BUTTON}`}>
              <Building2 className="mr-1.5 hidden size-4 sm:inline" />
              <span className="hidden sm:inline">우리 회사&nbsp;</span>무료로 시작하기
            </Link>
          </div>
        </div>
      </nav>

      {/* 히어로 바탕: 흰색 위에 은은한 인디고·보라 빛(D-263) */}
      <header
        style={{
          background:
            "radial-gradient(640px 340px at 85% 18%, rgba(124,58,237,.16), transparent 70%), radial-gradient(560px 320px at 8% 92%, rgba(79,70,229,.12), transparent 70%), radial-gradient(420px 260px at 55% 100%, rgba(13,148,136,.08), transparent 70%), #fff",
        }}
      >
        <div className="mx-auto grid max-w-5xl items-center gap-12 px-4 pb-20 pt-12 sm:pt-16 lg:grid-cols-2 lg:gap-16 lg:pt-20">
          <div>
            <p className="inline-flex rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-sm font-semibold text-indigo-700">✦ 5~20인 작은 회사를 위한 통합 운영관리</p>
            {/* 메인 카피는 두 줄로 고정(휴대폰에서도 어절 중간에서 끊기지 않게 break-keep) */}
            <h1 className="mt-5 break-keep text-[2.5rem] font-extrabold leading-[1.15] tracking-tight sm:text-6xl lg:text-[3.5rem]">
              {/* D-274 슬로건: 진짜 일에만 / 집중하세요. */}
              진짜 일에만
              <br />
              <span className="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">집중하세요.</span>
            </h1>
            <p className="mt-5 max-w-md text-balance break-keep text-lg leading-relaxed text-zinc-600 sm:text-xl">
              {BRAND.sloganSub} 결재·근태부터 채팅·일정·회의실까지, 회사 생활은 {BRAND_JOSA.i} 챙겨요.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link href={START_HREF} className={`inline-flex min-h-12 items-center justify-center whitespace-nowrap rounded-xl px-6 font-semibold ${BRAND_BUTTON}`}>
                🏢 우리 회사 무료로 시작하기
              </Link>
              <a href="#preview" className="inline-flex min-h-12 items-center justify-center whitespace-nowrap rounded-xl border-[1.5px] border-indigo-200 bg-white px-6 font-semibold text-indigo-700 hover:bg-indigo-50">
                ▶ 화면으로 먼저 보기
              </a>
            </div>
            <p className="mt-3 text-sm text-zinc-500">첫 월말 마감까지 무료 · 결제 정보 필요 없음 · 초기 도입비 없음</p>
          </div>
          <HeroMockup />
        </div>
      </header>

      <section id="why" className="mx-auto max-w-5xl scroll-mt-20 px-4 py-16" aria-labelledby="why-title">
        <Heading id="why-title" eyebrow="무엇이 다른가요" title="회사 운영에 필요한 기능," accent="전부 들어 있어요." sub="따로 쓰던 앱은 하나로, 손 가는 일은 AI가 대신." />
        {/* 큰 글씨 4장(D-273) — 뒷받침은 한 줄 */}
        <ul className="mt-10 grid gap-4 md:grid-cols-2">
          {WHY.map(({ icon: Icon, big, body, accent, art }) => (
            <li key={big} className={`flex flex-col gap-4 overflow-hidden rounded-3xl bg-gradient-to-br p-6 lg:flex-row lg:items-end lg:justify-between ${ACCENT[accent].card}`} data-why={accent}>
              <div className="flex min-w-0 flex-col self-start">
                <span className={`flex size-11 items-center justify-center rounded-xl ${ACCENT[accent].tile}`}>
                  <Icon className="size-6" aria-hidden />
                </span>
                <h3 className="mt-4 break-keep text-[1.7rem] font-extrabold leading-tight tracking-tight">{big}</h3>
                <p className="mt-2 break-keep text-zinc-700">{body}</p>
              </div>
              {/* 휴대폰에서는 그림을 빼 길이를 줄임(D-273) */}
              <div className="hidden shrink-0 sm:block">
                <WhyArtwork art={art} />
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* 기능 벽(D-273): 모든 플랜 공통 기능을 구역별 칩으로 — 무엇이 있는지 한눈에. [▶ 화면으로 보기] = 그 미리 보기 탭 */}
      <section id="pillars" className="scroll-mt-16 bg-zinc-50 py-16" aria-labelledby="pillars-title">
        <div className="mx-auto max-w-5xl px-4">
          <Heading id="pillars-title" eyebrow="기능" title="이게 다 들어 있어요." sub="기능마다 따로 결제하지 않아요. 안 쓰는 건 꺼 두면 메뉴에서 사라져요." />
          <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURE_GROUPS.map((g) => (
              <li key={g.key} className={`${card} relative flex flex-col overflow-hidden p-5`} data-pillar={g.title} data-accent={g.accent}>
                <span className={`absolute inset-x-0 top-0 h-1.5 ${ACCENT[g.accent].band}`} aria-hidden />
                <p className={`text-sm font-bold ${ACCENT[g.accent].text}`}>{g.title}</p>
                <h3 className="mt-1 break-keep text-xl font-extrabold tracking-tight">{g.one}</h3>
                <ul className="mt-3 flex flex-1 flex-wrap content-start gap-1.5" aria-label={`${g.title} 기능`}>
                  {g.items.map((t) => (
                    <li key={t} className={`rounded-full px-2.5 py-1 text-[13px] font-medium ${ACCENT[g.accent].chip}`}>
                      {t}
                    </li>
                  ))}
                </ul>
                <a href={`#preview-${g.sim}`} className={`mt-4 inline-flex min-h-10 items-center gap-1 self-start rounded-lg text-sm font-semibold hover:underline ${ACCENT[g.accent].text}`} data-pillar-sim={g.sim}>
                  ▶ 화면으로 보기 <ArrowRight className="size-4" aria-hidden />
                </a>
              </li>
            ))}
            <li className="flex flex-col justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 p-6 text-white shadow-lg shadow-indigo-600/20">
              <p className="break-keep text-2xl font-extrabold leading-tight">모든 플랜에<br />전부 포함</p>
              <p className="mt-2 break-keep text-sm leading-relaxed text-white/85">플랜은 사용량만 달라요. 인원은 무제한이에요.</p>
              <a href="#pricing" className="mt-4 inline-flex min-h-10 items-center gap-1 self-start rounded-lg bg-white px-3 text-sm font-semibold text-indigo-700 hover:bg-indigo-50">
                요금제 보기 <ArrowRight className="size-4" aria-hidden />
              </a>
            </li>
          </ul>
        </div>
      </section>

      <FeaturePreview startHref={START_HREF} />

      {/* 한 달 흐름(D-273): 예전 [이어져서 편해요]·[경비 처리는 더 깊게]·[한 달 흐름]을 하나로 */}
      <section className="mx-auto max-w-5xl px-4 py-16" aria-labelledby="flow-title">
        <Heading id="flow-title" eyebrow="한 달 흐름" title="영수증 한 장이" accent="세무사무소까지, 손 안 대고." sub="찍는 순간부터 세무사무소가 받기까지, 옮겨 적는 단계가 없어요." />
        <ol className="mt-10 grid gap-3 md:grid-cols-4" data-flow>
          {FLOW.map(({ verb, when, body, accent, icon: Icon }, i) => (
            <li key={verb} className={`${card} relative flex flex-col gap-1.5 p-5`}>
              <span className="flex items-center gap-2 text-xs font-semibold text-zinc-600">
                <span className="flex size-6 items-center justify-center rounded-full bg-gradient-to-br from-indigo-600 to-violet-600 tabular-nums text-white">{i + 1}</span>
                {when}
              </span>
              <span className={`mt-2 flex size-11 items-center justify-center rounded-xl ${ACCENT[accent].soft}`}>
                <Icon className="size-6" aria-hidden />
              </span>
              <h3 className="mt-1 text-3xl font-extrabold tracking-tight">{verb}</h3>
              <p className="break-keep text-zinc-700">{body}</p>
            </li>
          ))}
        </ol>
        <p className="mt-8 text-center text-sm font-bold text-zinc-500">서로 이어져 있어서 손이 덜 가요</p>
        <ul className="mt-3 flex flex-wrap justify-center gap-2" aria-label="이어지는 기능">
          {LINKS.map((t) => (
            <li key={t} className="rounded-full bg-indigo-50 px-3 py-1.5 text-sm font-semibold text-indigo-800">
              {t}
            </li>
          ))}
        </ul>
      </section>

      <section className="bg-zinc-50 py-16" aria-labelledby="roles-title">
        <div className="mx-auto max-w-5xl px-4">
          <Heading id="roles-title" eyebrow="누구에게" title="모두가 덜 일해요." sub="5인 회사에도 과하지 않게." />
          <ul className="mt-10 grid grid-cols-2 gap-3 md:grid-cols-4">
            {ROLES.map(({ who, line, accent, icon: Icon }) => (
              <li key={who} className={`${card} flex flex-col gap-2 p-5`}>
                <span className={`flex size-10 items-center justify-center rounded-xl ${ACCENT[accent].tile}`}>
                  <Icon className="size-5" aria-hidden />
                </span>
                <span className="text-sm font-semibold text-zinc-500">{who}</span>
                <b className="break-keep text-xl font-extrabold leading-tight tracking-tight">{line}</b>
              </li>
            ))}
          </ul>
        </div>
      </section>
      <Pricing />

      <Testimonials />

      <Faq />

      <section className="bg-gradient-to-b from-white via-indigo-50 to-violet-100/70 px-4 pb-28 pt-10 text-center">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-balance break-keep text-[2rem] font-extrabold leading-tight tracking-tight sm:text-[2.6rem]">
            다음 달 월말은
            <br />
            <span className="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">다르게.</span>
          </h2>
          <p className="mt-3 text-balance break-keep text-lg text-zinc-600">첫 월말 마감까지 무료. 결제 정보는 필요 없어요.</p>
          <Link href={START_HREF} className={`mt-8 inline-flex min-h-14 items-center justify-center whitespace-nowrap rounded-xl px-8 text-lg font-semibold ${BRAND_BUTTON}`}>
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
      <MobileStartBar href={START_HREF} />
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
