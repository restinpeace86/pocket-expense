"use client";

import { X } from "lucide-react";
import { useActionState, useState, type KeyboardEvent } from "react";
import { createCompanyAction, type FormState } from "@/app/onboarding/actions";
import { buttonPrimary, inputClass } from "@/components/ui/page-shell";
import { Field, FormError } from "./field";
import { PrivacyConsent } from "./privacy-consent";

const initial: FormState = { error: null };

// 회사 생성 위저드 Step 2 (spec/screens/admin-onboarding.md)
export function CreateCompanyForm() {
  const [state, formAction, pending] = useActionState(createCompanyAction, initial);
  const [departments, setDepartments] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [myDepartment, setMyDepartment] = useState("");

  function addDraft() {
    const names = draft.split(",").map((d) => d.trim()).filter(Boolean);
    if (names.length === 0) return;
    setDepartments((prev) => [...prev, ...names.filter((n) => !prev.includes(n))].slice(0, 50));
    setDraft("");
  }
  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addDraft();
    }
  }
  function remove(name: string) {
    setDepartments((prev) => prev.filter((d) => d !== name));
    if (myDepartment === name) setMyDepartment("");
  }

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <h2 className="text-lg font-semibold">회사 정보</h2>
      <Field label="회사명" required>
        <input name="companyName" required maxLength={100} className={inputClass} placeholder="예: 포켓컴퍼니" />
      </Field>
      <Field label="사업자등록번호" required hint="숫자 10자리 (하이픈은 있어도 없어도 됩니다)">
        <input
          name="businessNumber"
          required
          inputMode="numeric"
          pattern="[0-9]{3}-?[0-9]{2}-?[0-9]{5}"
          title="사업자등록번호 10자리를 입력해 주세요 (예: 123-45-67890)"
          className={inputClass}
          placeholder="123-45-67890"
        />
      </Field>
      <Field label="부서 목록" required hint="입력 후 Enter 또는 쉼표(,)로 추가 · 직원 가입 시 선택지가 됩니다">
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onKeyDown}
              className={inputClass}
              placeholder="예: 개발팀, 마케팅팀, 경영지원팀"
            />
            <button type="button" onClick={addDraft} className="min-h-11 shrink-0 rounded-xl border border-zinc-300 px-4 text-sm font-medium">
              추가
            </button>
          </div>
          {departments.length > 0 && (
            <ul className="flex flex-wrap gap-2">
              {departments.map((d) => (
                <li key={d} className="flex items-center gap-1 rounded-full bg-blue-50 py-1 pl-3 pr-1 text-sm text-blue-800">
                  {d}
                  <input type="hidden" name="departments" value={d} />
                  <button type="button" onClick={() => remove(d)} aria-label={`${d} 삭제`} className="rounded-full p-1 hover:bg-blue-100">
                    <X className="size-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Field>

      <h2 className="pt-2 text-lg font-semibold">대표자 / 관리자 정보</h2>
      <Field label="이름" required>
        <input name="name" required maxLength={50} className={inputClass} autoComplete="name" />
      </Field>
      <Field label="휴대폰 번호" required hint="결재 요청 알림톡을 받을 번호입니다">
        <input name="phone" required inputMode="tel" className={inputClass} placeholder="010-1234-5678" autoComplete="tel" />
      </Field>
      <Field label="본인 부서" required>
        <select
          name="myDepartment"
          required
          value={myDepartment}
          onChange={(e) => setMyDepartment(e.target.value)}
          className={inputClass}
          disabled={departments.length === 0}
        >
          <option value="">{departments.length === 0 ? "먼저 부서를 추가하세요" : "선택하세요"}</option>
          {departments.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </Field>
      <Field label="직급" hint="선택">
        <input name="position" maxLength={50} className={inputClass} placeholder="예: 대표" />
      </Field>

      <PrivacyConsent />
      <FormError message={state.error} />
      <button type="submit" disabled={pending || departments.length === 0} className={buttonPrimary}>
        {pending ? "회사를 만드는 중..." : "회사 만들고 시작하기"}
      </button>
    </form>
  );
}
