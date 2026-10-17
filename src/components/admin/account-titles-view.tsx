"use client";

import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { useState, useTransition } from "react";
import {
  addAccountTitleAction,
  deleteAccountTitleAction,
  setMappingAction,
  updateAccountTitleAction,
} from "@/app/workspace/[id]/admin/account-titles/actions";
import { FormError } from "@/components/onboarding/field";
import { SectionHeading } from "@/components/ui/help";
import { inputClass } from "@/components/ui/page-shell";
import type { AccountTitleRow, MappingRow } from "@/lib/admin/queries";
import { classificationLabel, MAPPING_ROWS, type TripType } from "@/lib/expense/categories";
import { measureAction } from "@/lib/perf/client";

type Result = { error: string | null };
const card = "rounded-xl border border-zinc-200 bg-white p-5 shadow-sm";
const iconButton =
  "inline-flex size-11 shrink-0 items-center justify-center rounded-xl text-zinc-600 hover:bg-zinc-100 disabled:opacity-30 disabled:hover:bg-transparent";

export function AccountTitlesHeading() {
  return (
    <SectionHeading
      as="h1"
      title="계정과목"
      summary="영수증 분류를 세무사무소 장부의 계정과목에 연결해요."
      helpId="admin.account-titles"
      help={
        <>
          <p>
            <b>왜 필요한가요?</b> 직원은 &lsquo;일반 식대&rsquo;, &lsquo;출장비 › 택시&rsquo;처럼 쉽게 고르고, 세무사무소는 &lsquo;복리후생비&rsquo;,
            &lsquo;여비교통비&rsquo; 같은 계정과목으로 장부를 써요. 여기서 둘을 연결해 두면 월말 세무 자료에 계정과목이 자동으로 들어가요.
          </p>
          <p>
            <b>무엇을 바꾸면 되나요?</b> 처음에는 일반적인 기본값이 들어 있어요. 담당 세무사가 쓰는 계정과목 이름과 코드(회계 프로그램의 계정코드)가 다르면
            맞춰 주세요. 담당 세무사와 확인한 뒤 설정하는 걸 권장해요.
          </p>
          <p>
            <b>바꾸면?</b> 이후에 상신되는 소명서부터 적용돼요. 이미 상신된 영수증은 그대로이고, 필요하면 지출 승인 관리에서 하나씩 조정할 수 있어요.
          </p>
        </>
      }
    />
  );
}

export function AccountTitlesView({ titles, mappings, preview = false }: { titles: AccountTitleRow[]; mappings: MappingRow[]; preview?: boolean }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");

  function run(label: string, action: () => Promise<Result>, done?: () => void, success?: string) {
    if (preview) return;
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const r = await measureAction(`account-titles.${label}`, action);
      if (r.error) setError(r.error);
      else {
        done?.();
        if (success) setNotice(success);
      }
    });
  }

  const mappingFor = (category: string, tripType: string | null) =>
    mappings.find((m) => m.category === category && (m.trip_type ?? null) === tripType)?.account_title_id ?? "";

  return (
    <div className="flex flex-col gap-4">
      <FormError message={error} />
      {notice && <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</p>}

      <section className={card}>
        <SectionHeading title="분류별 계정과목" summary="영수증 분류마다 어떤 계정과목으로 넘길지 골라요." />
        <ul className="mt-4 flex flex-col divide-y divide-zinc-100">
          {MAPPING_ROWS.map((r) => {
            const value = mappingFor(r.category, r.tripType);
            return (
              <li key={`${r.category}-${r.tripType ?? ""}`} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-sm font-medium text-zinc-800">{classificationLabel(r.category, r.tripType as TripType | null)}</span>
                <select
                  className={`${inputClass} sm:w-56`}
                  value={value}
                  disabled={pending}
                  aria-label={`${classificationLabel(r.category, r.tripType as TripType | null)} 계정과목`}
                  onChange={(e) =>
                    run(
                      "map",
                      () => setMappingAction(r.category, r.tripType, e.target.value),
                      undefined,
                      "저장했어요. 이후 상신되는 소명서부터 적용돼요.",
                    )
                  }
                >
                  {!value && <option value="">선택해 주세요</option>}
                  {titles.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                      {t.code ? ` (${t.code})` : ""}
                    </option>
                  ))}
                </select>
              </li>
            );
          })}
        </ul>
      </section>

      <section className={card}>
        <SectionHeading title="계정과목 목록" summary="이름과 계정코드는 세무사무소 회계 프로그램에 맞춰 주세요. 분류에 연결된 계정과목은 삭제할 수 없어요." />
        <form
          className="mt-4 flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            run(
              "add",
              () => addAccountTitleAction(name, code),
              () => {
                setName("");
                setCode("");
              },
            );
          }}
        >
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="계정과목 이름 (예: 회의비)" maxLength={30} aria-label="새 계정과목 이름" />
          <input className={`${inputClass} sm:w-40`} value={code} onChange={(e) => setCode(e.target.value)} placeholder="코드 (선택)" maxLength={20} aria-label="새 계정과목 코드" />
          <button
            type="submit"
            disabled={pending || !name.trim()}
            className="inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
          >
            <Plus className="size-4" /> 추가
          </button>
        </form>
        <ul className="mt-3 flex flex-col gap-2">
          {titles.map((t) => (
            <TitleItem
              key={t.id}
              title={t}
              busy={pending}
              onSave={(n, c, done) => run("update", () => updateAccountTitleAction(t.id, n, c), done)}
              onDelete={() => {
                if (!confirm(`'${t.name}' 계정과목을 삭제할까요?`)) return;
                run("delete", () => deleteAccountTitleAction(t.id));
              }}
            />
          ))}
        </ul>
      </section>
    </div>
  );
}

function TitleItem({
  title: t,
  busy,
  onSave,
  onDelete,
}: {
  title: AccountTitleRow;
  busy: boolean;
  onSave: (name: string, code: string, done: () => void) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(t.name);
  const [code, setCode] = useState(t.code ?? "");

  if (editing) {
    return (
      <li className="rounded-xl border border-brand-200 p-3">
        <form
          className="flex flex-col gap-2 sm:flex-row sm:items-center"
          onSubmit={(e) => {
            e.preventDefault();
            onSave(name, code, () => setEditing(false));
          }}
        >
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} maxLength={30} aria-label="계정과목 이름" autoFocus />
          <input className={`${inputClass} sm:w-40`} value={code} onChange={(e) => setCode(e.target.value)} maxLength={20} placeholder="코드" aria-label="계정과목 코드" />
          <div className="flex shrink-0 gap-1 self-end sm:self-auto">
            <button type="submit" disabled={busy || !name.trim()} className={iconButton} aria-label="저장">
              <Check className="size-5 text-brand-600" />
            </button>
            <button
              type="button"
              className={iconButton}
              aria-label="취소"
              onClick={() => {
                setName(t.name);
                setCode(t.code ?? "");
                setEditing(false);
              }}
            >
              <X className="size-5" />
            </button>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li className="flex items-center gap-1 rounded-xl border border-zinc-200 py-2 pl-4 pr-2">
      <div className="min-w-0 flex-1">
        <p className="break-words font-medium">{t.name}</p>
        <p className="text-xs text-zinc-500">{t.code ? `코드 ${t.code}` : "코드 없음"}{t.used && " · 분류에 연결됨"}</p>
      </div>
      <button type="button" className={iconButton} disabled={busy} onClick={() => setEditing(true)} aria-label={`${t.name} 수정`}>
        <Pencil className="size-4" />
      </button>
      <button
        type="button"
        className={`${iconButton} hover:text-red-600`}
        disabled={busy || t.used}
        onClick={onDelete}
        aria-label={t.used ? `${t.name}은 분류에 연결되어 삭제할 수 없어요` : `${t.name} 삭제`}
        title={t.used ? "분류에 연결되어 있어 삭제할 수 없어요" : undefined}
      >
        <Trash2 className="size-4" />
      </button>
    </li>
  );
}
