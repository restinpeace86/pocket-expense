"use client";

import { useActionState } from "react";
import { joinTaxOfficeAction, type OfficeFormState } from "@/app/tax-office/actions";
import { ConsentSection } from "@/components/legal/consent-section";
import { Field, FormError } from "@/components/onboarding/field";
import { buttonPrimary, inputClass } from "@/components/ui/page-shell";

const initial: OfficeFormState = { error: null };

// 소속 세무사 합류 입력 (D-149)
export function JoinTaxOfficeForm({ code }: { code: string }) {
  const [state, formAction, pending] = useActionState(joinTaxOfficeAction, initial);
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="code" value={code} />
      <Field label="이름" required>
        <input name="name" required maxLength={50} className={inputClass} autoComplete="name" placeholder="예: 김세무 세무사" />
      </Field>
      <Field label="휴대폰 번호" hint="선택">
        <input name="phone" inputMode="tel" className={inputClass} autoComplete="tel" placeholder="010-1234-5678" />
      </Field>
      <ConsentSection />
      <FormError message={state.error} />
      <button type="submit" disabled={pending} className={buttonPrimary}>
        {pending ? "합류하는 중..." : "합류하기"}
      </button>
    </form>
  );
}
