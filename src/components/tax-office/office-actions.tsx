"use client";

import { LogOut, Unlink } from "lucide-react";
import { useState, useTransition } from "react";
import { closeOfficeAction, leaveOfficeAction, releaseClientAction, transferAdminAction } from "@/app/tax-office/actions";
import { FormError } from "@/components/onboarding/field";
import { inputClass } from "@/components/ui/page-shell";
import { guardAction } from "@/lib/action-guard";

const secondary =
  "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-zinc-300 bg-white px-4 text-sm font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-50";
const danger =
  "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-red-300 bg-white px-4 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50";

// 고객사 연결 해제(사무소 관리자, D-152)
export function ReleaseClientButton({ companyId, companyName }: { companyId: string; companyName: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (!confirm(`${companyName}와(과)의 연결을 해제할까요?\n해제하면 우리 사무소는 이 회사 자료를 바로 볼 수 없고, 회사 화면에 "세무사무소가 연결을 해제했어요"로 보여요. 회사가 다시 지정하기 전에는 다시 연결되지 않아요.`)) return;
          setError(null);
          startTransition(async () => {
            const r = await guardAction(() => releaseClientAction(companyId));
            if (r.error) setError(r.error);
          });
        }}
        className="inline-flex min-h-10 w-fit items-center gap-1 rounded-lg px-2 text-sm text-zinc-500 hover:bg-zinc-100 hover:text-red-700 disabled:opacity-50"
      >
        <Unlink className="size-4" aria-hidden />
        {pending ? "해제하는 중..." : "고객사 해제"}
      </button>
      <FormError message={error} />
    </div>
  );
}

// 사무소 관리자 바꾸기(사무소 관리자 → 같은 사무소의 고른 세무사)
export function TransferAdminButton({ memberId, name }: { memberId: string; name: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (!confirm(`사무소 관리자를 ${name}(으)로 바꿀까요?\n바꾸면 나는 소속 세무사가 되고, 사무소 관리(초대·담당 배정·결산 양식·세무사무소 삭제)는 ${name}이(가) 해요.`)) return;
          setError(null);
          startTransition(async () => {
            const r = await guardAction(() => transferAdminAction(memberId));
            if (r.error) setError(r.error);
          });
        }}
        className={secondary}
      >
        사무소 관리자 바꾸기
      </button>
      {error && <FormError message={error} />}
    </>
  );
}

// 사무소에서 탈퇴(퇴사) — 소속 세무사
export function LeaveOfficeSection({ officeName }: { officeName: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm" aria-label="사무소에서 탈퇴(퇴사)">
      <h2 className="font-semibold">사무소에서 탈퇴(퇴사)</h2>
      <p className="mt-1 break-keep text-sm text-zinc-600">
        퇴사하거나 다른 사무소로 옮길 때 써요(로그아웃이 아니에요). 탈퇴하면 {officeName}의 고객사 자료를 더 볼 수 없고, 맡던 고객사 배정도 풀려요. 다시 들어오려면 초대 링크가
        필요해요.
      </p>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (!confirm(`${officeName}에서 탈퇴할까요?\n탈퇴하면 고객사 자료를 더 볼 수 없어요.`)) return;
          setError(null);
          startTransition(async () => {
            const r = await guardAction(() => leaveOfficeAction());
            if (r?.error) setError(r.error);
          });
        }}
        className={`${danger} mt-3`}
      >
        <LogOut className="size-4" aria-hidden />
        {pending ? "탈퇴하는 중..." : "사무소에서 탈퇴(퇴사)"}
      </button>
      <div className="mt-2">
        <FormError message={error} />
      </div>
    </section>
  );
}

// 세무사무소 삭제(사무소 관리자): 사무소명을 그대로 입력해야 버튼이 켜짐
export function CloseOfficeSection({ officeName, memberCount, clientCount }: { officeName: string; memberCount: number; clientCount: number }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [typed, setTyped] = useState("");
  return (
    <section className="rounded-xl border border-red-200 bg-white p-5 shadow-sm" aria-label="세무사무소 삭제">
      <h2 className="font-semibold text-red-800">세무사무소 삭제</h2>
      <p className="mt-1 break-keep text-sm text-zinc-600">
        사무소가 PocketExpense를 더 쓰지 않거나 폐업·잘못 등록했을 때 써요. 관리만 다른 사람에게 맡기려면 위 구성원 목록에서 [사무소 관리자 바꾸기]를 하세요. 삭제하면 구성원{" "}
        {memberCount}명과 결산 양식이 모두 지워지고, 고객사 {clientCount}곳은
        &quot;세무사무소 가입 대기&quot;로 돌아가요(같은 이메일로 다시 등록하면 다시 연결돼요). 되돌릴 수 없어요.
      </p>
      <label className="mt-3 flex flex-col gap-1.5 text-sm text-zinc-700">
        확인을 위해 사무소명 <b className="text-zinc-900">{officeName}</b>을(를) 그대로 입력하세요
        <input value={typed} onChange={(e) => setTyped(e.target.value)} className={inputClass} aria-label="사무소명 확인" autoComplete="off" />
      </label>
      <button
        type="button"
        disabled={pending || typed.trim() !== officeName}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const r = await guardAction(() => closeOfficeAction(typed));
            if (r?.error) setError(r.error);
          });
        }}
        className={`${danger} mt-3`}
      >
        {pending ? "삭제하는 중..." : "세무사무소 삭제"}
      </button>
      <div className="mt-2">
        <FormError message={error} />
      </div>
    </section>
  );
}
