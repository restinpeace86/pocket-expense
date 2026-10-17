"use client";

import { useActionState } from "react";
import { joinAction, type FormState } from "@/app/onboarding/actions";
import { buttonPrimary, inputClass } from "@/components/ui/page-shell";
import { Field, FormError } from "./field";
import { ConsentSection } from "@/components/legal/consent-section";

const initial: FormState = { error: null };

type Department = { id: string; name: string };
type Prefill = { name?: string | null; phone?: string | null; departmentId?: string | null; position?: string | null };

// 직원 정보 입력 (spec/features/auth-onboarding.md §3.2)
export function JoinForm({
  companyName,
  departments,
  code,
  token,
  prefill = {},
}: {
  companyName: string;
  departments: Department[];
  code?: string;
  token?: string;
  prefill?: Prefill;
}) {
  const [state, formAction, pending] = useActionState(joinAction, initial);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      {code && <input type="hidden" name="code" value={code} />}
      {token && <input type="hidden" name="token" value={token} />}

      <div className="rounded-xl bg-blue-50 px-4 py-3 text-blue-900">
        <p className="text-sm">가입할 회사</p>
        <p className="text-lg font-semibold">{companyName}</p>
      </div>

      <Field label="이름(실명)" required>
        <input name="name" required maxLength={50} defaultValue={prefill.name ?? ""} className={inputClass} autoComplete="name" />
      </Field>
      <Field label="휴대폰 번호" required hint="결재 알림을 카카오톡으로 받을 번호입니다">
        <input name="phone" required inputMode="tel" defaultValue={prefill.phone ?? ""} className={inputClass} placeholder="010-1234-5678" autoComplete="tel" />
      </Field>
      <Field label="부서" required>
        <select name="departmentId" required defaultValue={prefill.departmentId ?? ""} className={inputClass}>
          <option value="">선택하세요</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="직급" hint="선택">
          <input name="position" maxLength={50} defaultValue={prefill.position ?? ""} className={inputClass} />
        </Field>
        <Field label="사번" hint="선택">
          <input name="employeeNumber" maxLength={50} className={inputClass} />
        </Field>
      </div>

      <details className="rounded-xl border border-zinc-200 p-4">
        <summary className="min-h-6 cursor-pointer text-sm font-medium text-zinc-800">정산 계좌 · 차량번호 (선택, 나중에 입력 가능)</summary>
        <div className="mt-4 flex flex-col gap-4">
          <p className="text-xs text-zinc-500">개인카드로 쓴 경비를 돌려받을 계좌입니다. 입력한다면 세 칸을 모두 채우고, 아래 [선택] 항목 동의에 체크해 주세요.</p>
          <Field label="은행">
            <input name="bankName" maxLength={30} className={inputClass} />
          </Field>
          <Field label="계좌번호">
            <input name="accountNumber" inputMode="numeric" maxLength={30} className={inputClass} />
          </Field>
          <Field label="예금주">
            <input name="accountHolder" maxLength={30} className={inputClass} />
          </Field>
          <Field label="차량번호" hint="자차 출장비 청구 시 사용">
            <input name="vehicleNumber" maxLength={20} className={inputClass} placeholder="예: 12가 3456" />
          </Field>
        </div>
      </details>

      <ConsentSection withOptional />
      <FormError message={state.error} />
      <button type="submit" disabled={pending} className={buttonPrimary}>
        {pending ? "가입하는 중..." : token ? "가입 완료하고 시작하기" : "가입 신청하기"}
      </button>
      {!token && <p className="text-center text-xs text-zinc-500">관리자가 승인하면 바로 이용할 수 있어요.</p>}
    </form>
  );
}
