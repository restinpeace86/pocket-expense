// WORKON 로고(D-221): "ON"의 O를 켜진 스위치(토글)로 — 회사 일을 켠다는 뜻.
// 참고 이미지(reference/logo1·logo2)는 생각만 빌렸고 모양은 새로 그렸다(다른 회사 로고를 그대로 쓰지 않음).
// - Wordmark: 한 줄 "WORK⏺N" — 머리글·메뉴용
// - StackedLogo: 두 줄 "WORK / ⏺N" — 랜딩 히어로·로그인용
// - LogoMark: 스위치만 — 아이콘 자리용
// 색: 스위치 = 브랜드 색(화면 색상 테마를 따라감), 글자 = 지정한 글자색(밝은 바탕 남색, 어두운 바탕 흰색)
type Tone = "dark" | "light" | "current";

const TEXT: Record<Tone, string> = { dark: "text-[#1e1b4b]", light: "text-white", current: "" };

// 켜진 스위치: 알약 모양 + 오른쪽 흰 동그라미. 글자 높이(1em 기준 0.72em)에 맞춘다
function Toggle({ className = "" }: { className?: string }) {
  return (
    <span aria-hidden className={`relative mx-[0.04em] inline-block h-[0.74em] w-[1.18em] shrink-0 rounded-full bg-brand-600 align-baseline ${className}`}>
      <span className="absolute right-[0.11em] top-1/2 size-[0.52em] -translate-y-1/2 rounded-full bg-white" />
    </span>
  );
}

export function Wordmark({ tone = "dark", className = "" }: { tone?: Tone; className?: string }) {
  return (
    <span role="img" aria-label="WORKON" className={`inline-flex items-center font-black leading-none tracking-[-0.02em] ${TEXT[tone]} ${className}`}>
      <span aria-hidden>WORK</span>
      <Toggle />
      <span aria-hidden>N</span>
    </span>
  );
}

export function StackedLogo({ tone = "dark", className = "" }: { tone?: Tone; className?: string }) {
  return (
    <span role="img" aria-label="WORKON" className={`inline-flex flex-col items-start font-black leading-[0.9] tracking-[-0.02em] ${TEXT[tone]} ${className}`}>
      <span aria-hidden>WORK</span>
      <span aria-hidden className="inline-flex items-center">
        <Toggle className="ml-0" />
        <span>N</span>
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
