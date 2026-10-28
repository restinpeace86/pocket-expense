"use client";

import { Building2, Check, Search, UserRound, X } from "lucide-react";
import Link from "next/link";
import { useActionState, useEffect, useId, useState } from "react";
import { saveReferralAction, searchReferralCompaniesAction, type ReferralCompany, type ReferralState } from "@/app/onboarding/referral/actions";
import { buttonPrimary, buttonSecondary, inputClass } from "@/components/ui/page-shell";
import { Field, FormError } from "./field";

const initial: ReferralState = { error: null };
type Kind = "company" | "person";

// 추천 회사 / 추천인 입력 (선택 단계, D-147). 고르지 않으면 [건너뛰기]
export function ReferralForm({ skipHref }: { skipHref: string }) {
  const [state, formAction, pending] = useActionState(saveReferralAction, initial);
  const [kind, setKind] = useState<Kind>("company");
  const [company, setCompany] = useState<ReferralCompany | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const ready = kind === "company" ? company !== null : name.trim().length > 0 && phone.replace(/\D/g, "").length >= 10;

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <input type="hidden" name="kind" value={kind} />
      <div role="radiogroup" aria-label="추천 유형" className="grid grid-cols-2 gap-1 rounded-xl bg-zinc-100 p-1">
        <KindTab active={kind === "company"} onClick={() => setKind("company")} icon={<Building2 className="size-4" aria-hidden />} label="추천 회사" />
        <KindTab active={kind === "person"} onClick={() => setKind("person")} icon={<UserRound className="size-4" aria-hidden />} label="추천인" />
      </div>

      {kind === "company" ? (
        <CompanyPicker value={company} onChange={setCompany} />
      ) : (
        <>
          <Field label="추천인 이름" required>
            <input name="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={50} className={inputClass} autoComplete="off" placeholder="예: 홍길동" />
          </Field>
          <Field label="추천인 휴대폰 번호" required hint="추천해 주신 분께 감사 인사를 전할 때만 써요">
            <input name="phone" value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" className={inputClass} autoComplete="off" placeholder="010-1234-5678" />
          </Field>
        </>
      )}

      <FormError message={state.error} />
      <div className="flex flex-col gap-2">
        <button type="submit" disabled={pending || !ready} className={buttonPrimary}>
          {pending ? "저장하는 중..." : "저장하고 시작하기"}
        </button>
        <Link href={skipHref} className={buttonSecondary} aria-disabled={pending}>
          건너뛰기
        </Link>
      </div>
      <p className="break-keep text-center text-xs text-zinc-500">추천 정보는 한 번만 적을 수 있고, 나중에 바꿀 수 없어요.</p>
    </form>
  );
}

function KindTab({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={`inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg text-sm font-semibold transition-colors ${
        active ? "bg-white text-brand-700 shadow-sm ring-1 ring-brand-600/40" : "text-zinc-500 hover:text-zinc-900"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

// 가입된 회사 이름 검색(2자 이상, 0.25초 쉬면 검색)
function CompanyPicker({ value, onChange }: { value: ReferralCompany | null; onChange: (c: ReferralCompany | null) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ReferralCompany[]>([]);
  const [searched, setSearched] = useState("");
  const [failed, setFailed] = useState(false);
  const listId = useId();

  useEffect(() => {
    const q = query.trim();
    if (value || q.length < 2) return;
    let alive = true;
    const t = setTimeout(async () => {
      try {
        const rows = await searchReferralCompaniesAction(q);
        if (!alive) return;
        setResults(rows);
        setFailed(false);
      } catch {
        if (alive) setFailed(true);
      }
      if (alive) setSearched(q);
    }, 250);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [query, value]);

  if (value) {
    return (
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-zinc-800">추천 회사</span>
        <input type="hidden" name="companyId" value={value.id} />
        <div className="flex min-h-11 items-center gap-2 rounded-xl border border-brand-600 bg-brand-50/60 px-3">
          <Check className="size-4 shrink-0 text-brand-700" aria-hidden />
          <span className="min-w-0 flex-1 truncate font-medium text-zinc-900">{value.name}</span>
          <button type="button" onClick={() => onChange(null)} aria-label="추천 회사 다시 고르기" className="rounded-full p-1.5 text-zinc-500 hover:bg-brand-100">
            <X className="size-4" />
          </button>
        </div>
      </div>
    );
  }

  const q = query.trim();
  const showList = q.length >= 2 && searched === q;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={`${listId}-input`} className="text-sm font-medium text-zinc-800">
        추천 회사<span className="ml-0.5 text-red-500">*</span>
      </label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" aria-hidden />
        <input
          id={`${listId}-input`}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          maxLength={50}
          autoComplete="off"
          className={`${inputClass} pl-9`}
          placeholder="회사 이름 2자 이상"
        />
      </div>
      {failed && <p className="text-xs text-red-600">검색하지 못했어요. 인터넷 연결을 확인하고 다시 입력해 주세요.</p>}
      {showList && !failed && (
        results.length === 0 ? (
          <p className="break-keep rounded-xl bg-zinc-50 px-3 py-2 text-sm text-zinc-600">
            ‘{q}’(으)로 가입된 회사가 없어요. 이름을 다시 확인하거나, 사람이 추천했다면 [추천인]에 적어 주세요.
          </p>
        ) : (
          <ul id={listId} role="listbox" aria-label="검색된 회사" className="flex flex-col overflow-hidden rounded-xl border border-zinc-200">
            {results.map((c) => (
              <li key={c.id} role="option" aria-selected={false} className="border-b border-zinc-100 last:border-b-0">
                <button type="button" onClick={() => onChange(c)} className="flex min-h-11 w-full items-center gap-2 px-3 text-left text-sm hover:bg-zinc-50">
                  <Building2 className="size-4 shrink-0 text-zinc-400" aria-hidden />
                  <span className="min-w-0 flex-1 truncate">{c.name}</span>
                </button>
              </li>
            ))}
          </ul>
        )
      )}
      {!showList && <span className="text-xs text-zinc-500">PocketExpense를 쓰고 있는 회사 중에서 골라 주세요</span>}
    </div>
  );
}
