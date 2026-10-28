"use client";

import { Building2, Landmark } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useState } from "react";
import { registerTaxOfficeAction, type OfficeFormState } from "@/app/tax-office/actions";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { ConsentSection } from "@/components/legal/consent-section";
import { Field, FormError } from "@/components/onboarding/field";
import { buttonPrimary, buttonSecondary, Card, inputClass, PageShell } from "@/components/ui/page-shell";

type Request = { company_name: string; office_name: string };
const initial: OfficeFormState = { error: null };

// 세무사무소 구성원이 아닌 계정: 연결 요청 확인 → 세무사무소 등록(관리자) 또는 초대 코드로 합류(소속 세무사) (D-149)
export function TaxOfficeOnboarding({ email, requests }: { email: string | null; requests: Request[] }) {
  const [state, formAction, pending] = useActionState(registerTaxOfficeAction, initial);
  const [code, setCode] = useState("");
  const router = useRouter();
  const suggested = requests[0]?.office_name ?? "";

  return (
    <PageShell>
      <div className="pt-6">
        <p className="flex items-center gap-1.5 text-sm font-medium text-blue-600">
          <Landmark className="size-4" aria-hidden />
          세무사무소
        </p>
        <h1 className="text-balance break-keep text-2xl font-bold tracking-tight">세무사무소 워크스페이스</h1>
        <p className="mt-1 break-keep text-sm text-zinc-600">고객사의 승인된 지출과 세무용 엑셀을 한곳에서 확인해요. 고객사 회사 계정과는 따로예요.</p>
      </div>

      {requests.length > 0 ? (
        <Card>
          <h2 className="text-lg font-semibold">연결을 요청한 고객사 {requests.length}곳</h2>
          <p className="mt-1 break-all text-sm text-zinc-600">{email}(으)로 세무사무소 연결을 요청했어요. 세무사무소를 등록하면 바로 고객사 목록에 보여요.</p>
          <ul className="mt-3 flex flex-col gap-1.5">
            {requests.map((r, i) => (
              <li key={i} className="flex items-center gap-2 rounded-lg bg-zinc-50 px-3 py-2 text-sm">
                <Building2 className="size-4 shrink-0 text-zinc-400" aria-hidden />
                <span className="min-w-0 flex-1 truncate font-medium">{r.company_name}</span>
              </li>
            ))}
          </ul>
        </Card>
      ) : (
        <p className="break-keep rounded-xl bg-zinc-100 px-4 py-3 text-sm text-zinc-600">
          아직 이 계정({email ?? "이메일 확인 안 됨"})으로 들어온 고객사 연결 요청이 없어요. 사무소를 먼저 등록해 두면, 고객사가 이 이메일을 넣는 순간 목록에 보여요.
        </p>
      )}

      <Card>
        <form action={formAction} className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold">세무사무소 등록 (대표·관리자)</h2>
          <Field label="세무사무소명" required>
            <input name="officeName" defaultValue={state.values?.officeName ?? suggested} required maxLength={100} className={inputClass} placeholder="예: OO세무사무소" />
          </Field>
          <Field label="사업자등록번호" required hint="숫자 10자리 (하이픈은 있어도 없어도 됩니다)">
            <input name="businessNumber" defaultValue={state.values?.businessNumber} required inputMode="numeric" pattern="[0-9]{3}-?[0-9]{2}-?[0-9]{5}" title="사업자등록번호 10자리를 입력해 주세요" className={inputClass} placeholder="123-45-67890" />
          </Field>
          <Field label="내 이름" required>
            <input name="name" defaultValue={state.values?.name} required maxLength={50} className={inputClass} autoComplete="name" placeholder="예: 홍길동 세무사" />
          </Field>
          <Field label="휴대폰 번호" hint="선택">
            <input name="phone" defaultValue={state.values?.phone} inputMode="tel" className={inputClass} autoComplete="tel" placeholder="010-1234-5678" />
          </Field>
          <ConsentSection />
          <FormError message={state.error} />
          <button type="submit" disabled={pending} className={buttonPrimary}>
            {pending ? "등록하는 중..." : "세무사무소 등록하고 시작하기"}
          </button>
          <p className="break-all text-xs text-zinc-500">사무소 이메일은 지금 로그인한 계정({email ?? "-"})이에요. 고객사는 이 이메일로 사무소를 지정해요.</p>
        </form>
      </Card>

      <Card>
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            const c = code.trim().toUpperCase();
            if (c) router.push(`/tax-join/${encodeURIComponent(c)}`);
          }}
        >
          <h2 className="text-lg font-semibold">초대 코드로 합류 (소속 세무사·직원)</h2>
          <p className="break-keep text-sm text-zinc-600">사무소 관리자에게 받은 초대 링크가 없다면 코드를 입력하세요.</p>
          <input value={code} onChange={(e) => setCode(e.target.value)} maxLength={8} className={`${inputClass} uppercase tracking-widest`} placeholder="초대 코드 8자리" aria-label="사무소 초대 코드" />
          <button type="submit" disabled={!code.trim()} className={buttonSecondary}>
            합류하기
          </button>
        </form>
      </Card>
      <div className="text-center">
        <SignOutButton />
      </div>
    </PageShell>
  );
}
