"use client";

import { Check, Copy, RefreshCw } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { regenerateTaxOfficeCodeAction, setTaxOfficeMemberStatusAction } from "@/app/tax-office/actions";
import { FormError } from "@/components/onboarding/field";
import { guardAction } from "@/lib/action-guard";

const card = "rounded-xl border border-zinc-200 bg-white p-5 shadow-sm";
const secondary =
  "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-zinc-300 bg-white px-4 text-sm font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-50";

// 소속 세무사 초대 링크 (D-149)
export function OfficeInvite({ code, officeName }: { code: string; officeName: string }) {
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  useEffect(() => setOrigin(window.location.origin), []);
  const link = `${origin}/tax-join/${code}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(`[PocketExpense] ${officeName}에 합류해 주세요. 로그인한 뒤 담당 고객사의 세무 자료를 볼 수 있어요.\n${link}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("복사하지 못했어요. 링크를 길게 눌러 직접 복사해 주세요.");
    }
  }

  return (
    <section className={card} aria-label="소속 세무사 초대">
      <h2 className="font-semibold">소속 세무사·직원 초대</h2>
      <p className="mt-1 break-keep text-sm text-zinc-600">링크를 받은 사람이 로그인하면 바로 소속 세무사로 합류해요. 고객사는 배정해야 보여요.</p>
      <div className="mt-3 flex flex-col gap-2 rounded-lg bg-zinc-50 p-3">
        <p className="break-all font-mono text-sm text-zinc-800">{link}</p>
        <p className="text-sm text-zinc-600">
          초대 코드 <b className="font-mono tracking-widest text-zinc-900">{code}</b>
        </p>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <button type="button" onClick={copy} className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-brand-600 px-4 font-semibold text-white hover:bg-brand-700">
          {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
          {copied ? "복사했어요" : "초대 안내 복사"}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (!confirm("초대 링크를 새로 만들까요? 이전 링크와 코드는 바로 쓸 수 없게 돼요(이미 합류한 사람은 그대로).")) return;
            setError(null);
            startTransition(async () => {
              const r = await guardAction(() => regenerateTaxOfficeCodeAction());
              if (r.error) setError(r.error);
            });
          }}
          className={secondary}
        >
          <RefreshCw className="size-4" aria-hidden />
          링크 새로 만들기
        </button>
      </div>
      <div className="mt-2">
        <FormError message={error} />
      </div>
    </section>
  );
}

type Member = { id: string; name: string; email: string | null; phone: string | null; role: string; status: string; assigned_count: number };

// 구성원 목록·이용 중지 (D-149). 중지하면 맡던 고객사 배정이 풀린다
export function OfficeMembers({ members, myId }: { members: Member[]; myId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  function setStatus(m: Member, status: "active" | "inactive") {
    if (status === "inactive" && !confirm(`${m.name}의 이용을 중지할까요? 맡던 고객사 ${m.assigned_count}곳의 배정이 풀리고 바로 볼 수 없어요.`)) return;
    setError(null);
    startTransition(async () => {
      const r = await guardAction(() => setTaxOfficeMemberStatusAction(m.id, status));
      if (r.error) setError(r.error);
    });
  }
  return (
    <section className={card} aria-label="구성원">
      <h2 className="font-semibold">구성원 {members.length}명</h2>
      <ul className="mt-3 flex flex-col divide-y divide-zinc-100">
        {members.map((m) => (
          <li key={m.id} className="flex flex-wrap items-center gap-3 py-3">
            <div className="min-w-0 flex-1">
              <p className="font-medium text-zinc-900">
                {m.name}
                <span className={`ml-2 rounded-full px-2 py-0.5 text-xs ${m.role === "admin" ? "bg-brand-50 text-brand-700" : "bg-zinc-100 text-zinc-600"}`}>
                  {m.role === "admin" ? "관리자" : "세무사"}
                </span>
                {m.status !== "active" && <span className="ml-1 rounded-full bg-red-50 px-2 py-0.5 text-xs text-red-700">이용 중지</span>}
              </p>
              <p className="break-all text-xs text-zinc-500">
                {m.email ?? "이메일 없음"} · 맡은 고객사 {m.assigned_count}곳
              </p>
            </div>
            {m.id !== myId &&
              (m.status === "active" ? (
                <button type="button" disabled={pending} onClick={() => setStatus(m, "inactive")} className={`${secondary} text-red-700`}>
                  이용 중지
                </button>
              ) : (
                <button type="button" disabled={pending} onClick={() => setStatus(m, "active")} className={secondary}>
                  다시 사용
                </button>
              ))}
          </li>
        ))}
      </ul>
      <FormError message={error} />
    </section>
  );
}
