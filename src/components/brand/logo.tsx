// Moa-on 로고(D-221 → D-251 시안 A): "on"의 o를 켜진 스위치(토글)로 — 흩어진 회사 일을 모아(Moa) 켠다(on)는 뜻.
// 스위치·앱 아이콘은 WORKON 때 것을 그대로 이어 쓴다(기존 사용자가 같은 앱으로 알아보게).
// - Wordmark: 한 줄 "Moa-⏺n" — 머리글·메뉴용
// - StackedLogo: 두 줄 "Moa- / ⏺n" — 랜딩 히어로·로그인용
// - LogoMark: 스위치만 — 아이콘 자리용
// 색: 스위치·하이픈 = 브랜드 색(화면 색상 테마를 따라감), 글자 = 지정한 글자색(밝은 바탕 남색, 어두운 바탕 흰색)
type Tone = "dark" | "light" | "current";

const TEXT: Record<Tone, string> = { dark: "text-[#1e1b4b]", light: "text-white", current: "" };

// 켜진 스위치: 알약 모양 + 오른쪽 흰 동그라미. 소문자 높이에 맞춘다
function Toggle({ className = "" }: { className?: string }) {
  return (
    <span aria-hidden className={`relative mx-[0.03em] inline-block h-[0.6em] w-[0.98em] shrink-0 rounded-full bg-brand-600 ${className}`}>
      <span className="absolute right-[0.09em] top-1/2 size-[0.43em] -translate-y-1/2 rounded-full bg-white" />
    </span>
  );
}

function Hyphen() {
  return (
    <span aria-hidden className="mx-[0.02em] text-brand-600">
      -
    </span>
  );
}

export function Wordmark({ tone = "dark", className = "" }: { tone?: Tone; className?: string }) {
  return (
    <span role="img" aria-label="Moa-on" className={`inline-flex items-center font-black leading-none tracking-[-0.03em] ${TEXT[tone]} ${className}`}>
      <span aria-hidden>Moa</span>
      <Hyphen />
      <Toggle className="translate-y-[0.06em]" />
      <span aria-hidden>n</span>
    </span>
  );
}

export function StackedLogo({ tone = "dark", className = "" }: { tone?: Tone; className?: string }) {
  return (
    <span role="img" aria-label="Moa-on" className={`inline-flex flex-col items-start font-black leading-[0.95] tracking-[-0.03em] ${TEXT[tone]} ${className}`}>
      <span aria-hidden className="inline-flex items-center">
        Moa
        <Hyphen />
      </span>
      <span aria-hidden className="inline-flex items-center">
        <Toggle className="ml-0 translate-y-[0.06em]" />
        <span>n</span>
      </span>
    </span>
  );
}

// 네모 아이콘(머리글 왼쪽): 브랜드 색 바탕에 흰 스위치
export function LogoMark({ className = "size-8" }: { className?: string }) {
  return (
    <span aria-hidden className={`inline-flex shrink-0 items-center justify-center rounded-lg bg-brand-600 shadow-sm ${className}`}>
      <span className="relative inline-block h-[38%] w-[62%] rounded-full bg-white/95">
        <span className="absolute right-[9%] top-1/2 aspect-square h-[70%] -translate-y-1/2 rounded-full bg-brand-600" />
      </span>
    </span>
  );
}
