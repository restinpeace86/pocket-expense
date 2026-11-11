// Moa-on 로고(D-252, 시안 D "모이는 M"): M의 두 줄기가 가운데로 모이고 위에 점(불)이 켜진다 — 흩어진 일을 모아(Moa) 켠다(on)
// - MoaMark: M 표시만(글자색 = currentColor)
// - Wordmark: 한 줄 [M 아이콘] Moa-on — 머리글·메뉴용
// - StackedLogo: 큰 아이콘 + "Moa-on" — 로그인용
// - LogoMark: 브랜드 색 네모 + 흰 M — 아이콘 자리용
// 같은 모양을 아이콘(src/app/icon.tsx, icons/[size], 공유 이미지)과 안드로이드 런처·알림 아이콘에도 쓴다
type Tone = "dark" | "light" | "current";

const TEXT: Record<Tone, string> = { dark: "text-[#1e1b4b]", light: "text-white", current: "" };
export const MOA_PATH = "M8 34V14l14 12 14-12v20";

export function MoaMark({ className = "size-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 44 44" aria-hidden className={className}>
      <path d={MOA_PATH} fill="none" stroke="currentColor" strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="22" cy="8" r="4" fill="currentColor" />
    </svg>
  );
}

export function Wordmark({ tone = "dark", className = "" }: { tone?: Tone; className?: string }) {
  return (
    <span role="img" aria-label="Moa-on" className={`inline-flex items-center gap-[0.4em] font-black leading-none tracking-[-0.03em] ${TEXT[tone]} ${className}`}>
      <LogoMark className="size-[1.55em] rounded-[0.4em]" />
      <span aria-hidden>Moa-on</span>
    </span>
  );
}

export function StackedLogo({ tone = "dark", className = "" }: { tone?: Tone; className?: string }) {
  return (
    <span role="img" aria-label="Moa-on" className={`inline-flex flex-col items-center gap-[0.25em] font-black leading-none tracking-[-0.03em] ${TEXT[tone]} ${className}`}>
      <LogoMark className="size-[1.6em] rounded-[0.38em]" />
      <span aria-hidden>Moa-on</span>
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
