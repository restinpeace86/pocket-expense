import { MessageCircle } from "lucide-react";

// 랜딩 오른쪽 아래 [1:1 문의](D-292): 누르면 다모온 카카오톡 채널 채팅방(새 창).
// 휴대폰 아래 고정 [무료로 시작하기] 줄(MobileStartBar, data-mobile-start="on")이 올라오면 그 위로 비켜 선다
export function KakaoFab({ href }: { href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="카카오톡으로 1:1 문의하기(새 창)"
      data-landing-kakao
      className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] right-4 z-40 inline-flex min-h-12 items-center gap-1.5 rounded-full bg-[#FEE500] px-4 text-sm font-bold text-[#191919] shadow-lg shadow-black/15 ring-1 ring-black/5 transition-[bottom,filter] duration-300 hover:brightness-95 sm:right-6 sm:bottom-6 sm:px-5 max-lg:[body:has([data-mobile-start=on])_&]:bottom-[calc(6.25rem+env(safe-area-inset-bottom))]"
    >
      <MessageCircle className="size-5 shrink-0 fill-[#191919]" aria-hidden />
      1:1 문의
    </a>
  );
}
