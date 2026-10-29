"use client";

import { Check, Clock, Copy, Landmark, Unlink } from "lucide-react";
import { useState, useTransition } from "react";
import { clearCompanyTaxOfficeAction, saveCompanyTaxOfficeAction } from "@/app/workspace/[id]/admin/tax-office/actions";
import { Field, FormError } from "@/components/onboarding/field";
import { inputClass } from "@/components/ui/page-shell";
import { guardAction } from "@/lib/action-guard";

export type CompanyTaxOffice = {
  office_name: string;
  office_email: string;
  agent_name: string | null;
  agent_email: string | null;
  agent_phone: string | null;
  registered: boolean;
  registered_name: string | null;
  assigned_name: string | null;
  assigned_email: string | null;
  updated_at: string;
  released_at?: string | null; // 세무사무소가 연결을 해제함(D-152)
  released_office_name?: string | null;
};

// 지역번호(02) 전화도 보기 좋게
const formatTel = (t: string) => (t.startsWith("02") ? t.replace(/^(02)(\d{3,4})(\d{4})$/, "$1-$2-$3") : t.replace(/^(\d{3})(\d{3,4})(\d{4})$/, "$1-$2-$3"));
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const card = "rounded-xl border border-zinc-200 bg-white p-5 shadow-sm";
const primary =
  "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-brand-600 px-4 font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50";
const secondary =
  "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-zinc-300 bg-white px-4 font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-50";

// 우리 회사 세무사무소 지정·연결 상태·안내 복사 (D-149)
export function CompanyTaxOfficeForm({ current, companyName, connectCode = null }: { current: CompanyTaxOffice | null; companyName: string; connectCode?: string | null }) {
  const [editing, setEditing] = useState(!current);
  const [officeName, setOfficeName] = useState(current?.office_name ?? "");
  const [officeEmail, setOfficeEmail] = useState(current?.office_email ?? "");
  const [agentName, setAgentName] = useState(current?.agent_name ?? "");
  const [agentEmail, setAgentEmail] = useState(current?.agent_email ?? "");
  const [agentPhone, setAgentPhone] = useState(current?.agent_phone ? formatTel(current.agent_phone) : "");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();
  const ready = officeName.trim() && EMAIL.test(officeEmail.trim()) && (!agentEmail.trim() || EMAIL.test(agentEmail.trim()));
  const officeChanged = !!current && officeEmail.trim().toLowerCase() !== current.office_email;

  function save() {
    if (officeChanged && !confirm(`세무사무소 이메일을 바꾸면 ${current?.office_name}(${current?.office_email})은(는) 바로 우리 회사 자료를 볼 수 없어요. 바꿀까요?`)) return;
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const r = await guardAction(() => saveCompanyTaxOfficeAction({ officeName, officeEmail, agentName, agentEmail, agentPhone }));
      if (r.error) return setError(r.error);
      setEditing(false);
      setNotice("저장했어요.");
    });
  }

  function disconnect() {
    if (!current || !confirm(`${current.registered_name ?? current.office_name}와(과)의 연결을 끊을까요? 끊으면 바로 우리 회사 자료를 볼 수 없어요.`)) return;
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const r = await guardAction(() => clearCompanyTaxOfficeAction());
      if (r.error) return setError(r.error);
      setOfficeName("");
      setOfficeEmail("");
      setAgentName("");
      setAgentEmail("");
      setAgentPhone("");
      setEditing(true);
      setNotice("연결을 끊었어요.");
    });
  }

  async function copyGuide() {
    if (!current) return;
    // 연결 코드 링크(D-173): 어떤 계정으로 로그인해도 이 고객사와 연결된다
    const link = connectCode && !current.registered ? `${window.location.origin}/for-tax-office/${connectCode}` : `${window.location.origin}/login?next=/tax-office`;
    const text = current.registered
      ? `[PocketExpense] ${companyName}의 세무 자료가 ${current.registered_name ?? current.office_name} 고객사 목록에 연결됐어요. 로그인하면 승인된 지출 장부·영수증·지출결의서·홈택스 자료를 받을 수 있어요.\n${link}`
      : `[PocketExpense] 고객사 ${companyName}이(가) 지출·증빙 관리에 PocketExpense를 쓰고 있고, ${current.office_name}을(를) 세무대행 사무소로 지정했어요. 무료 세무사무소 워크스페이스에서 승인된 지출 장부·영수증·지출결의서·홈택스 자료를 한 번에 받을 수 있어요. 아래 링크로 시작하세요.\n${link}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("복사하지 못했어요. 세무사무소에 로그인 주소를 직접 알려 주세요.");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {current && !editing && (
        <section className={card} aria-label="연결된 세무사무소">
          <div className="flex items-start gap-3">
            <span
              className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${current.registered ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}
            >
              {current.registered ? <Landmark className="size-5" aria-hidden /> : <Clock className="size-5" aria-hidden />}
            </span>
            <div className="min-w-0 flex-1">
              <p className={`text-xs font-medium ${current.registered ? "text-emerald-700" : current.released_at ? "text-red-700" : "text-amber-700"}`}>
                {current.registered ? "연결됨" : current.released_at ? "세무사무소가 연결을 해제했어요" : "세무사무소 가입 대기"}
              </p>
              <p className="break-keep font-semibold text-zinc-900">{current.registered_name ?? current.office_name}</p>
              <p className="break-all text-sm text-zinc-600">{current.office_email}</p>
            </div>
          </div>
          <dl className="mt-3 grid gap-1 rounded-lg bg-zinc-50 px-3 py-2 text-sm">
            <div className="flex flex-wrap gap-x-2">
              <dt className="text-zinc-500">담당 세무사</dt>
              <dd className="font-medium text-zinc-900">
                {current.released_at && !current.registered
                  ? "없음 (연결 해제)"
                  : current.assigned_name
                  ? `${current.assigned_name} (사무소 배정)`
                  : current.registered
                    ? "사무소에서 배정 전이에요"
                    : current.agent_name
                      ? `${current.agent_name} (사무소 가입 뒤 확인)`
                      : "사무소 가입 뒤 사무소가 배정해요"}
              </dd>
            </div>
            {current.agent_phone && (
              <div className="flex flex-wrap gap-x-2">
                <dt className="text-zinc-500">연락처</dt>
                <dd>{formatTel(current.agent_phone)}</dd>
              </div>
            )}
          </dl>
          {current.released_at && !current.registered && (
            <p className="mt-3 break-keep rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
              {current.released_office_name ?? current.office_name}에서 우리 회사와의 연결을 해제했어요. 지금은 세무사무소가 우리 회사 자료를 볼 수 없고, 계정과목은 다시 우리 회사가
              관리해요. 계약이 계속된다면 세무사무소에 확인한 뒤 [정보 바꾸기]에서 다시 저장해 주세요.
            </p>
          )}
          {!current.registered && !current.released_at && (
            <p className="mt-3 break-keep text-sm text-zinc-600">
              세무사무소가 아직 연결 전이에요.{" "}
              {current.agent_phone ? "담당 세무사 휴대폰으로 연결 링크를 카카오 알림톡으로 보냈어요(발송 서비스 연결 전에는 기록만 남아요). " : ""}
              [세무사무소 안내 복사]로 연결 링크를 직접 보낼 수도 있어요. 사무소가 링크로 들어와 로그인하면 어떤 계정이든 바로 연결돼요.
              {connectCode && <span className="mt-1 block break-all rounded-md bg-zinc-50 px-2 py-1 font-mono text-xs text-zinc-700">/for-tax-office/{connectCode}</span>}
            </p>
          )}
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <button type="button" onClick={copyGuide} className={primary}>
              {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
              {copied ? "복사했어요" : "세무사무소 안내 복사"}
            </button>
            <button type="button" onClick={() => setEditing(true)} disabled={pending} className={secondary}>
              정보 바꾸기
            </button>
            <button type="button" onClick={disconnect} disabled={pending} className={`${secondary} text-red-700`}>
              <Unlink className="size-4" aria-hidden />
              연결 끊기
            </button>
          </div>
        </section>
      )}

      {editing && (
        <section className={card} aria-label="세무사무소 정보">
          <div className="flex flex-col gap-4">
            <Field label="세무사무소명" required>
              <input value={officeName} onChange={(e) => setOfficeName(e.target.value)} maxLength={100} className={inputClass} placeholder="예: OO세무사무소" />
            </Field>
            <Field label="세무사무소 이메일" required hint="세무사무소 대표 메일. 이 이메일 계정으로 로그인하거나, 저장 뒤 생기는 연결 링크로 들어오면 연결돼요">
              <input
                value={officeEmail}
                onChange={(e) => setOfficeEmail(e.target.value)}
                type="email"
                inputMode="email"
                autoComplete="off"
                maxLength={254}
                className={inputClass}
                placeholder="office@example.com"
              />
            </Field>
            <div className="flex flex-col gap-4 rounded-xl bg-zinc-50 p-3">
              <p className="text-sm font-medium text-zinc-700">
                담당 세무사 <span className="font-normal text-zinc-500">(선택 · 알고 있으면 적어 두세요. 배정은 사무소가 해요)</span>
              </p>
              <Field label="이름">
                <input value={agentName} onChange={(e) => setAgentName(e.target.value)} maxLength={50} className={inputClass} placeholder="예: 홍길동 세무사" />
              </Field>
              <Field label="이메일" hint="이 세무사가 사무소에 합류하면 우리 회사에 자동으로 배정돼요">
                <input
                  value={agentEmail}
                  onChange={(e) => setAgentEmail(e.target.value)}
                  type="email"
                  inputMode="email"
                  autoComplete="off"
                  maxLength={254}
                  className={inputClass}
                  placeholder="tax@example.com"
                />
              </Field>
              <Field label="연락처">
                <input value={agentPhone} onChange={(e) => setAgentPhone(e.target.value)} inputMode="tel" className={inputClass} placeholder="02-123-4567" />
              </Field>
            </div>
            <p className="break-keep rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
              저장하면 승인 절차 없이 바로 연결돼요. 이 사무소는 우리 회사의 승인된 지출·영수증·세무 엑셀을 볼 수 있으니 이메일을 한 번 더 확인해 주세요.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row-reverse">
              <button type="button" onClick={save} disabled={pending || !ready} className={`${primary} sm:min-w-40`}>
                {pending ? "저장하는 중..." : current ? "바꾼 내용 저장" : "저장하고 연결"}
              </button>
              {current && (
                <button type="button" onClick={() => setEditing(false)} disabled={pending} className={secondary}>
                  취소
                </button>
              )}
            </div>
          </div>
        </section>
      )}

      <FormError message={error} />
      {notice && (
        <p role="status" className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {notice}
        </p>
      )}
    </div>
  );
}
