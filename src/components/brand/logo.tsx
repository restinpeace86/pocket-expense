import { BRAND } from "@/lib/brand";
import { markSvg } from "./mark-svg";

// 서비스 로고(D-274, 시안 A "켜짐 버튼"): 열린 고리 + 위 점 — 진짜 일을 켠다(Real + On)
// - MoaMark: 표시만(글자색 = currentColor, 이름은 예전 그대로 둠)
// - Wordmark: 한 줄 [아이콘] Real + On(강조) — 머리글·메뉴용
// - StackedLogo: 큰 아이콘 + 이름 — 로그인용
// - LogoMark: 브랜드 색 네모 + 흰 표시 — 아이콘 자리용
// 이름·모양·색은 src/lib/brand.ts 한 곳(9-14a). 같은 모양을 아이콘(src/app/icon.tsx, icons/[size], 공유 이미지)과 설치 앱 아이콘(scripts/apply-brand.mjs)에도 쓴다
type Tone = "dark" | "light" | "current";

// 진한 글자색 = BRAND.color.ink(Tailwind는 빌드 때 글자 그대로의 클래스만 읽어서 값을 여기 적는다 — 바꾸면 같이)
const TEXT: Record<Tone, string> = { dark: "text-[#1e1b4b]", light: "text-white", current: "" };

// 이름 글자: 뒷부분(BRAND.accent, "On")만 브랜드 그라데이션(밝은 바탕) · 연한 보라(어두운 바탕)
const ACCENT_TEXT: Record<Tone, string> = {
  dark: "bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent",
  light: "text-indigo-200",
  current: "",
};
function NameText({ tone }: { tone: Tone }) {
  const a: string = BRAND.accent;
  const n: string = BRAND.name;
  if (!a || !n.endsWith(a)) return <span aria-hidden>{n}</span>;
  return (
    <span aria-hidden>
      {n.slice(0, n.length - a.length)}
      <span className={ACCENT_TEXT[tone]}>{a}</span>
    </span>
  );
}

export function MoaMark({ className = "size-6" }: { className?: string }) {
  return (
    <span aria-hidden className={`inline-flex [&>svg]:size-full ${className}`}>
      {markSvg({ size: "100%", color: "currentColor" })}
    </span>
  );
}

export function Wordmark({ tone = "dark", className = "" }: { tone?: Tone; className?: string }) {
  return (
    <span role="img" aria-label={BRAND.name} className={`inline-flex items-center gap-[0.4em] font-black leading-none tracking-[-0.03em] ${TEXT[tone]} ${className}`}>
      <LogoMark className="size-[1.55em] rounded-[0.4em]" />
      <NameText tone={tone} />
    </span>
  );
}

export function StackedLogo({ tone = "dark", className = "" }: { tone?: Tone; className?: string }) {
  return (
    <span role="img" aria-label={BRAND.name} className={`inline-flex flex-col items-center gap-[0.25em] font-black leading-none tracking-[-0.03em] ${TEXT[tone]} ${className}`}>
      <LogoMark className="size-[1.6em] rounded-[0.38em]" />
      <NameText tone={tone} />
    </span>
  );
}

export function LogoMark({ className = "size-8" }: { className?: string }) {
  return (
    <span aria-hidden className={`inline-flex shrink-0 items-center justify-center rounded-lg bg-brand-600 text-white shadow-sm ${className}`}>
      <MoaMark className="size-[68%]" />
    </span>
  );
}
