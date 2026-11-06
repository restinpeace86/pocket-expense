"use client";

import { UserPlus } from "lucide-react";
import { useSearchParams } from "next/navigation";

// 초대 메시지·앱 설치 QR로 들어온 경우(D-229, ?join=초대코드): 맨 위에 "먼저 가입 신청" 단계를 보여 준다.
// 가입은 웹에서 한 번 — 그다음 설치 앱·홈 화면 아이콘에서 같은 방법으로 로그인하면 그대로 이어진다
const CODE = /^[A-HJ-NP-Z2-9]{8}$/;

export function JoinStep() {
  const code = (useSearchParams().get("join") ?? "").toUpperCase();
  if (!CODE.test(code)) return null;
  return (
    <section aria-label="먼저 가입 신청" className="rounded-xl border-2 border-brand-600 bg-brand-50 p-5">
      <p className="flex items-center gap-2 font-bold text-brand-900">
        <UserPlus className="size-5" aria-hidden /> 1단계 · 먼저 가입 신청
      </p>
      <p className="mt-1 text-sm leading-relaxed text-zinc-700">
        회사에서 초대받으셨어요. 아래 버튼으로 가입 신청을 먼저 해 주세요(이름·연락처 입력). 관리자가 승인하면 바로 쓸 수 있어요.
      </p>
      <a href={`/join/${code}`} className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700">
        가입 신청하기
      </a>
      <p className="mt-3 text-sm font-semibold text-zinc-800">2단계 · 아래에서 내 휴대폰에 맞게 설치</p>
      <p className="mt-0.5 text-sm text-zinc-600">설치한 앱(또는 홈 화면 아이콘)을 열고, 가입할 때와 같은 방법으로 로그인하면 돼요.</p>
    </section>
  );
}
