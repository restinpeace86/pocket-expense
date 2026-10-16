"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Provider = "kakao" | "google";

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
        className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-[#FEE500] px-4 text-base font-semibold text-black/85 hover:brightness-95 disabled:opacity-60"
      >
        {pending === "kakao" ? "카카오로 이동 중..." : "카카오로 3초 만에 시작하기"}
      </button>
      <button
        type="button"
        onClick={() => signIn("google")}
        disabled={pending !== null}
        className="inline-flex min-h-12 w-full items-center justify-center rounded-xl border border-zinc-300 bg-white px-4 text-base font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-60"
      >
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
