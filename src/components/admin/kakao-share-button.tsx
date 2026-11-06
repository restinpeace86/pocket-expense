"use client";

import { Loader2, MessageCircle } from "lucide-react";
import { useState } from "react";
import { inviteShareOptions } from "@/lib/invite-share";

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

// D-229: 버튼 하나로 [웹으로 가입하기]·[앱 설치 안내] 두 길을 같이 보낸다(src/lib/invite-share.ts)
export function KakaoShareButton({ link, installLink, companyName }: { link: string; installLink: string; companyName: string }) {
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
      kakao.Share.sendDefault(inviteShareOptions({ companyName, joinLink: link, installLink, origin: new URL(link).origin }));
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
