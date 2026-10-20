"use client";

import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { updateMyProfileAction } from "@/app/workspace/[id]/employee/profile/actions";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { inputClass } from "@/components/ui/page-shell";
import type { MyProfile } from "@/lib/employee/profile";
import { formatPhone } from "@/lib/format";
import { measureAction } from "@/lib/perf/client";

// 직원 [내 정보] (employee-mobile.md ⑤)
const ROLE_LABEL: Record<string, string> = { super_admin: "최고 관리자", admin: "관리자", employee: "직원" };
const PROVIDER_LABEL: Record<string, string> = { kakao: "카카오", google: "Google" };

function Field({ label, htmlFor, hint, children }: { label: string; htmlFor: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium text-zinc-800">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-zinc-500">{hint}</p>}
    </div>
  );
}

export function ProfileForm({ profile }: { profile: MyProfile }) {
  const router = useRouter();
  const init = {
    name: profile.name,
    phone: formatPhone(profile.phone),
    position: profile.position ?? "",
    employeeNumber: profile.employee_number ?? "",
    vehicleNumber: profile.vehicle_number ?? "",
    bankName: profile.bank?.bank_name ?? "",
    accountNumber: profile.bank?.account_number ?? "",
    accountHolder: profile.bank?.account_holder ?? "",
  };
  const [f, setF] = useState(init);
  const [agreed, setAgreed] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [pending, start] = useTransition();
  const set = (k: keyof typeof init, v: string) => setF((x) => ({ ...x, [k]: v }));
  const dirty = JSON.stringify(f) !== JSON.stringify(init);
  // 선택 항목(정산 계좌·차량번호)을 처음 넣을 때만 선택 동의를 받는다 (D-059)
  const needsConsent = !profile.optionalConsented && !!(f.vehicleNumber.trim() || f.bankName.trim() || f.accountNumber.trim() || f.accountHolder.trim());

  return (
    <div className="flex flex-col gap-5">
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          setMessage(null);
          const res = await measureAction("employee.save_profile", () => updateMyProfileAction({ ...f, optionalAgreed: agreed }));
          if (res.error) setMessage({ kind: "error", text: res.error });
          else {
            setMessage({ kind: "ok", text: "저장했어요." });
            router.refresh();
          }
        });
      }}
    >
      <section className="flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-4">
        <h2 className="font-semibold">기본 정보</h2>
        <Field label="이름" htmlFor="name">
          <input id="name" className={inputClass} value={f.name} maxLength={50} onChange={(e) => set("name", e.target.value)} autoComplete="name" />
        </Field>
        <Field label="휴대폰 번호" htmlFor="phone" hint="결재 요청·승인·지급 알림톡을 이 번호로 받아요.">
          <input id="phone" className={inputClass} value={f.phone} inputMode="tel" maxLength={13} onChange={(e) => set("phone", e.target.value)} autoComplete="tel" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="직급" htmlFor="position">
            <input id="position" className={inputClass} value={f.position} maxLength={50} placeholder="예: 대리" onChange={(e) => set("position", e.target.value)} />
          </Field>
          <Field label="사번" htmlFor="emp">
            <input id="emp" className={inputClass} value={f.employeeNumber} maxLength={50} onChange={(e) => set("employeeNumber", e.target.value)} />
          </Field>
        </div>
        <dl className="grid grid-cols-[5rem_1fr] gap-y-1.5 text-sm">
          <dt className="text-zinc-500">부서</dt>
          <dd>
            {profile.department ?? "없음"} <span className="text-xs text-zinc-400">(관리자만 바꿀 수 있어요)</span>
          </dd>
          <dt className="text-zinc-500">역할</dt>
          <dd>{ROLE_LABEL[profile.role] ?? profile.role}</dd>
        </dl>
      </section>

      <section className="flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-4">
        <div>
          <h2 className="font-semibold">
            정산 계좌 <span className="text-xs font-normal text-zinc-500">[선택]</span>
          </h2>
          <p className="text-sm text-zinc-600">사비로 쓴 돈을 돌려받을 계좌예요. 관리자가 지급할 때 보여요.</p>
        </div>
        <Field label="은행" htmlFor="bank">
          <input id="bank" className={inputClass} value={f.bankName} maxLength={30} placeholder="예: 국민은행" onChange={(e) => set("bankName", e.target.value)} />
        </Field>
        <Field label="계좌번호" htmlFor="account">
          <input id="account" className={inputClass} value={f.accountNumber} inputMode="numeric" maxLength={30} placeholder="숫자와 - 만" onChange={(e) => set("accountNumber", e.target.value.replace(/[^0-9-]/g, ""))} />
        </Field>
        <Field label="예금주" htmlFor="holder">
          <input id="holder" className={inputClass} value={f.accountHolder} maxLength={50} onChange={(e) => set("accountHolder", e.target.value)} />
        </Field>
        <p className="text-xs text-zinc-500">세 칸을 모두 비우고 저장하면 계좌가 지워져요.</p>
      </section>

      <section className="flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-4">
        <h2 className="font-semibold">
          차량번호 <span className="text-xs font-normal text-zinc-500">[선택]</span>
        </h2>
        <Field label="차량번호" htmlFor="vehicle" hint="자차로 출장 다녀온 유류비를 청구할 때 써요.">
          <input id="vehicle" className={inputClass} value={f.vehicleNumber} maxLength={20} placeholder="예: 12가3456" onChange={(e) => set("vehicleNumber", e.target.value)} />
        </Field>
      </section>

      {needsConsent && (
        <label className="flex items-start gap-3 rounded-2xl border border-brand-200 bg-brand-50 p-4 text-sm">
          <input type="checkbox" className="mt-0.5 size-5 shrink-0" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
          <span>
            [선택] 정산 계좌·차량번호 수집·이용에 동의합니다.{" "}
            <Link href="/privacy" target="_blank" className="text-brand-700 underline underline-offset-2">
              내용 보기
            </Link>
            <span className="block text-xs text-zinc-500">동의하지 않으려면 계좌·차량번호 칸을 비워 주세요.</span>
          </span>
        </label>
      )}

      {message && (
        <p className={`rounded-lg px-3 py-2 text-sm ${message.kind === "ok" ? "bg-green-50 text-green-800" : "bg-red-50 text-red-700"}`} role={message.kind === "error" ? "alert" : "status"}>
          {message.text}
        </p>
      )}
      <button type="submit" disabled={pending || !dirty || (needsConsent && !agreed)} className="inline-flex min-h-12 items-center justify-center gap-1.5 rounded-xl bg-brand-600 font-semibold text-white hover:bg-brand-700 disabled:opacity-50">
        {pending && <Loader2 className="size-4 animate-spin" />}저장
      </button>
    </form>

      {/* 로그아웃은 그 자체가 form이라 위 form 밖에 둔다(form 안에 form을 넣을 수 없음) */}
      <section className="flex items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-white p-4 text-sm">
        <div className="min-w-0">
          <p className="font-medium">로그인 계정</p>
          <p className="truncate text-zinc-600">
            {profile.login.provider ? (PROVIDER_LABEL[profile.login.provider] ?? profile.login.provider) : "-"}
            {profile.login.email && ` · ${profile.login.email}`}
          </p>
        </div>
        <SignOutButton className="min-h-11 shrink-0 rounded-xl border border-zinc-300 px-4 text-sm font-medium hover:bg-zinc-50" />
      </section>
    </div>
  );
}
