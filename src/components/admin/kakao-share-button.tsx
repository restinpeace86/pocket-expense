"use client";

import { Loader2, MessageCircle } from "lucide-react";
import { useState } from "react";

// 카카오톡으로 초대 링크 공유 (개선사항 1-2). 카카오 JS SDK를 누를 때 불러온다(첫 화면을 느리게 하지 않게).
// 키: NEXT_PUBLIC_KAKAO_JS_KEY (카카오 개발자 콘솔 › 앱 › 플랫폼 › Web에 사이트 도메인 등록 필요). 키가 없으면 버튼을 숨긴다.
const SDK_URL = "https://t1.kakaocdn.net/kakao_js_sdk/2.7.2/kakao.min.js";

type KakaoSdk = {
  isInitialized(): boolean;
  init(key: string): void;
  Share: { sendDefault(options: Record<string, unknown>): void };
};
declare global {
  interface Window {
    Kakao?: KakaoSdk;
  }
}

function loadSdk(): Promise<KakaoSdk> {
  if (window.Kakao) return Promise.resolve(window.Kakao);
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SDK_URL;
    s.async = true;
    s.crossOrigin = "anonymous";
    s.onload = () => (window.Kakao ? resolve(window.Kakao) : reject(new Error("no sdk")));
    s.onerror = () => reject(new Error("sdk load failed"));
    document.head.appendChild(s);
  });
}

export function KakaoShareButton({ link, companyName }: { link: string; companyName: string }) {
  const key = process.env.NEXT_PUBLIC_KAKAO_JS_KEY;
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!key) return null;

  async function share() {
    setError(null);
    setPending(true);
    try {
      const kakao = await loadSdk();
      if (!kakao.isInitialized()) kakao.init(key!);
      const origin = new URL(link).origin;
      kakao.Share.sendDefault({
        objectType: "feed",
        content: {
          title: `${companyName}에서 경비 정산에 초대했어요`,
          description: "링크를 열어 로그인하고 이름·연락처를 입력하면 가입 신청이 돼요. 관리자가 승인하면 바로 영수증을 올릴 수 있어요.",
          imageUrl: `${origin}/share/invite-image`,
          imageWidth: 800,
          imageHeight: 400,
          link: { mobileWebUrl: link, webUrl: link },
        },
        buttons: [{ title: "가입하기", link: { mobileWebUrl: link, webUrl: link } }],
      });
    } catch {
      setError("카카오톡 공유를 열지 못했어요. [링크 복사]로 보내 주세요.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={share}
        disabled={pending}
        className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl bg-[#FEE500] px-4 text-sm font-semibold text-[#191919] hover:brightness-95 disabled:opacity-60 sm:flex-none"
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> : <MessageCircle className="size-4" />}
        카카오톡으로 공유하기
      </button>
      {error && (
        <p role="alert" className="w-full text-sm text-red-600">
          {error}
        </p>
      )}
    </>
  );
}
