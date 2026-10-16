"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Provider = "kakao" | "google";

// 카카오 심볼(말풍선) — 카카오 로그인 디자인 가이드의 노란 배경 + 검은 심볼
function KakaoSymbol() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="size-5">
      <path
        fill="#000000"
        d="M12 3C6.48 3 2 6.58 2 11c0 2.84 1.86 5.33 4.66 6.74l-.95 3.47c-.08.3.26.54.52.37l4.13-2.73c.53.06 1.08.1 1.64.1 5.52 0 10-3.58 10-8S17.52 3 12 3z"
      />
    </svg>
  );
}

// Google "G" 로고 (공식 4색)
function GoogleLogo() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden className="size-5">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

// 카카오/Google 로그인 (휴대폰 인증 없음, D-002). 로그인 후 /auth/callback에서 소속에 따라 분기한다.
export function OAuthButtons({ next }: { next?: string }) {
  const [pending, setPending] = useState<Provider | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function signIn(provider: Provider) {
    setPending(provider);
    setError(null);
    const callback = new URL("/auth/callback", window.location.origin);
    if (next) callback.searchParams.set("next", next);
    const { error } = await createClient().auth.signInWithOAuth({
      provider,
      options: { redirectTo: callback.toString() },
    });
    if (error) {
      setError("로그인을 시작하지 못했어요. 잠시 후 다시 시도해 주세요.");
      setPending(null);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={() => signIn("kakao")}
        disabled={pending !== null}
        className="relative inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-[#FEE500] px-12 text-base font-semibold text-black/85 hover:brightness-95 disabled:opacity-60"
      >
        <span className="absolute left-4">
          <KakaoSymbol />
        </span>
        {pending === "kakao" ? "카카오로 이동 중..." : "카카오로 3초 만에 시작하기"}
      </button>
      <button
        type="button"
        onClick={() => signIn("google")}
        disabled={pending !== null}
        className="relative inline-flex min-h-12 w-full items-center justify-center rounded-xl border border-zinc-300 bg-white px-12 text-base font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-60"
      >
        <span className="absolute left-4">
          <GoogleLogo />
        </span>
        {pending === "google" ? "Google로 이동 중..." : "Google로 로그인"}
      </button>
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
