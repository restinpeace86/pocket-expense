"use client";

import { BookCopy } from "lucide-react";
import { useState, useTransition } from "react";
import { applyDefaultTitlesAction, saveDefaultTitlesAction } from "@/app/tax-office/default-titles-actions";
import { thrownActionMessage } from "@/lib/action-guard";
import { formatDateTimeKst } from "@/lib/claims/format";

// 사무소 기본 계정과목 (D-160, D-167): 기본값은 모든 고객사에 자동 적용, 사무소가 특정 회사만 직접 고치면 그 회사는 "개별 설정"
export type DefaultTitles = {
  titles: { name: string; code: string | null }[] | null;
  mapping_count: number;
  source_name: string | null;
  saved_at: string | null;
  custom_company_ids: string[];
} | null;
type Msg = { kind: "ok" | "error"; text: string } | null;

const btn = "inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-xl px-4 text-sm font-semibold disabled:opacity-50";

function Summary({ value }: { value: NonNullable<DefaultTitles> }) {
  return (
    <p className="mt-1 break-keep text-sm text-zinc-600">
      ‘{value.source_name ?? "고객사"}’ 설정으로 {value.saved_at ? formatDateTimeKst(value.saved_at) : ""}에 저장 · 계정과목 {value.titles?.length ?? 0}개 · 분류 연결 {value.mapping_count}개
    </p>
  );
}

function Message({ msg }: { msg: Msg }) {
  if (!msg) return null;
  return (
    <p role={msg.kind === "error" ? "alert" : "status"} className={`mt-2 break-keep text-sm ${msg.kind === "error" ? "text-red-700" : "text-emerald-700"}`}>
      {msg.text}
    </p>
  );
}

function useRun() {
  const [msg, setMsg] = useState<Msg>(null);
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<Msg>) =>
    start(async () => {
      setMsg(null);
      try {
        setMsg(await fn());
      } catch {
        setMsg({ kind: "error", text: thrownActionMessage() });
      }
    });
  return { msg, pending, run };
}

const savedText = (r: { companies: number; changes: number }) =>
  `사무소 기본값으로 저장했어요. ${r.companies ? `개별 설정이 아닌 고객사 ${r.companies}곳에 바로 적용했어요(바뀐 곳 ${r.changes}군데).` : "지금 함께 맞출 다른 고객사는 없어요."} 새로 연결되는 고객사도 자동으로 이 기본값을 써요.`;

// 고객사 계정과목 화면(사무소 관리자)
export function DefaultTitlesForCompany({ companyId, companyName, value }: { companyId: string; companyName: string; value: DefaultTitles }) {
  const { msg, pending, run } = useRun();
  const has = !!value?.titles;
  const custom = !!value?.custom_company_ids.includes(companyId);
  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm" aria-label="사무소 기본 계정과목">
      <h2 className="flex flex-wrap items-center gap-1.5 font-semibold">
        <BookCopy className="size-4 text-zinc-500" aria-hidden />
        사무소 기본 계정과목
        {has && (
          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${custom ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-700"}`}>
            {custom ? "이 회사는 개별 설정" : "이 회사는 기본값 사용"}
          </span>
        )}
      </h2>
      {has ? (
        <>
          <Summary value={value!} />
          <p className="mt-1 break-keep text-sm text-zinc-600">
            {custom
              ? "이 회사는 사무소가 따로 고쳐서 기본값을 바꿔도 따라가지 않아요."
              : "위 표에서 이 회사만 고치면 '개별 설정'이 되어, 이후 기본값을 바꿔도 이 회사는 그대로예요."}
          </p>
        </>
      ) : (
        <p className="mt-1 break-keep text-sm text-zinc-600">
          아직 없어요. 기준이 되는 고객사를 우리 사무소 기준으로 맞춘 뒤 저장하면, 모든 고객사(새로 연결되는 고객사 포함)에 자동으로 적용돼요.
        </p>
      )}
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (!confirm(`‘${companyName}’ 설정을 사무소 기본값으로 저장할까요? 개별 설정이 아닌 모든 고객사에 바로 적용돼요(같은 이름은 코드를 맞추고, 없는 계정과목은 추가, 분류 연결은 기본값대로. 회사에만 있는 계정과목은 지우지 않아요).`)) return;
            run(async () => {
              const r = await saveDefaultTitlesAction(companyId);
              return r.ok ? { kind: "ok", text: savedText(r) } : { kind: "error", text: r.error };
            });
          }}
          className={`${btn} border border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50`}
        >
          이 회사 설정을 사무소 기본값으로 저장
        </button>
        {has && custom && (
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (!confirm(`‘${companyName}’을(를) 사무소 기본값으로 되돌릴까요? 이후 기본값을 바꾸면 함께 바뀌어요.`)) return;
              run(async () => {
                const r = await applyDefaultTitlesAction([companyId]);
                return r.ok ? { kind: "ok", text: `기본값으로 되돌렸어요(바뀐 곳 ${r.changes}군데).` } : { kind: "error", text: r.error };
              });
            }}
            className={`${btn} bg-brand-600 text-white hover:bg-brand-700`}
          >
            사무소 기본값으로 되돌리기
          </button>
        )}
      </div>
      <Message msg={msg} />
    </section>
  );
}

// 사무소 관리(관리자): 기본값 요약 + 개별 설정 고객사 목록·되돌리기
export function DefaultTitlesApply({ value, clients }: { value: DefaultTitles; clients: { id: string; name: string }[] }) {
  const { msg, pending, run } = useRun();
  const custom = clients.filter((c) => value?.custom_company_ids.includes(c.id));
  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5" aria-label="기본 계정과목">
      <h2 className="flex items-center gap-1.5 text-lg font-semibold">
        <BookCopy className="size-5 text-zinc-500" aria-hidden />
        기본 계정과목
      </h2>
      {!value?.titles ? (
        <p className="mt-1 break-keep text-sm text-zinc-600">
          아직 사무소 기본값이 없어요. 고객사 → [계정과목]에서 기준이 되는 회사를 우리 사무소 기준으로 맞춘 뒤 [이 회사 설정을 사무소 기본값으로 저장]을 눌러 주세요. 저장하면 모든 고객사에 자동으로 적용돼요.
        </p>
      ) : (
        <>
          <Summary value={value} />
          <p className="mt-1 break-keep text-sm text-zinc-600">
            모든 고객사({clients.length}곳)에 자동 적용돼요. 새로 연결되는 고객사도 연결되는 순간 적용되고, 바뀐 내용은 회사에 이력·알림으로 전해져요. 사무소가 따로 고친 고객사는 &lsquo;개별 설정&rsquo;이라 기본값을 바꿔도 그대로예요.
          </p>
          <h3 className="mt-3 text-sm font-semibold text-zinc-900">개별 설정 고객사 {custom.length}곳</h3>
          {custom.length === 0 ? (
            <p className="mt-1 text-sm text-zinc-500">없어요. 모든 고객사가 기본값을 쓰고 있어요.</p>
          ) : (
            <ul className="mt-1 flex flex-col divide-y divide-zinc-100">
              {custom.map((c) => (
                <li key={c.id} className="flex min-w-0 items-center justify-between gap-2 py-2 text-sm">
                  <span className="min-w-0 truncate">{c.name}</span>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => {
                      if (!confirm(`‘${c.name}’을(를) 사무소 기본값으로 되돌릴까요?`)) return;
                      run(async () => {
                        const r = await applyDefaultTitlesAction([c.id]);
                        return r.ok ? { kind: "ok", text: `‘${c.name}’을(를) 기본값으로 되돌렸어요(바뀐 곳 ${r.changes}군데).` } : { kind: "error", text: r.error };
                      });
                    }}
                    className="inline-flex min-h-10 shrink-0 items-center whitespace-nowrap rounded-lg border border-zinc-300 bg-white px-3 text-sm hover:bg-zinc-50 disabled:opacity-50"
                  >
                    기본값으로 되돌리기
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      <Message msg={msg} />
    </section>
  );
}
