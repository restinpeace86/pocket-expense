"use client";

import { useState, useTransition } from "react";
import { setCardViaHometaxAction, setMainTemplateAction } from "@/app/tax-office/[companyId]/export-options-actions";
import { FormError } from "@/components/onboarding/field";
import { guardAction } from "@/lib/action-guard";

// 고객사 법인카드 수집 방식(D-189): 켬(기본) = 위하고 일반전표에 사비만 / 끔 = 법인카드도 두 줄 전표로
export function CardViaHometaxToggle({ companyId, value }: { companyId: string; value: boolean }) {
  const [checked, setChecked] = useState(value);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="rounded-lg bg-zinc-50 px-3 py-2.5">
      <label className="flex cursor-pointer items-start gap-2.5 text-sm">
        <input
          type="checkbox"
          checked={checked}
          disabled={pending}
          onChange={(e) => {
            const next = e.target.checked;
            setChecked(next);
            setError(null);
            start(async () => {
              const r = await guardAction(() => setCardViaHometaxAction(companyId, next));
              if (!r.ok) {
                setChecked(!next);
                setError(r.error);
              }
            });
          }}
          className="mt-0.5 size-5 shrink-0 accent-brand-600"
        />
        <span className="min-w-0">
          <span className="block break-keep font-medium text-zinc-900">이 고객사 법인카드 사용 내역은 홈택스에서 받아 위하고에 넣고 있어요</span>
          <span className="mt-0.5 block break-keep text-xs text-zinc-600">
            {checked
              ? "그래서 위하고 일반전표 시트에는 사비 지출만 넣어요(법인카드 전표가 두 번 생기지 않게). 법인카드 내역을 홈택스로 받지 않는 고객사라면 체크를 끄세요."
              : "법인카드 지출도 위하고 일반전표 시트에 두 줄 전표(차변 비용 / 대변 253 미지급금·카드)로 넣어요. 개인부담이 있는 건은 적요에 '개인부담 N원 별도'를 붙여요."}
          </span>
        </span>
      </label>
      <FormError message={error} />
    </div>
  );
}

// 사무소가 고르는 고객사 엑셀의 회계 프로그램 시트(D-189): 더존 위하고 일반전표(기본) 또는 결산 양식 하나
export function MainTemplatePicker({ templates, value }: { templates: { id: string; name: string; draft: boolean }[]; value: string | null }) {
  const [picked, setPicked] = useState<string | null>(value);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const choose = (id: string | null) => {
    const prev = picked;
    setPicked(id);
    setError(null);
    start(async () => {
      const r = await guardAction(() => setMainTemplateAction(id));
      if (!r.ok) {
        setPicked(prev);
        setError(r.error);
      }
    });
  };
  const opts = [{ id: null as string | null, name: "더존 위하고 일반전표 (기본)", draft: false }, ...templates];
  return (
    <fieldset className="mt-3" disabled={pending}>
      <legend className="text-sm font-medium text-zinc-900">고객사 세무용 엑셀에 넣을 회계 프로그램 시트</legend>
      <p className="mt-0.5 break-keep text-xs text-zinc-500">위하고를 쓰지 않으면 아래 [양식 추가]로 쓰는 프로그램의 업로드 양식을 올린 뒤 여기서 고르세요. 고르면 고객사 엑셀의 위하고 시트 자리에 그 양식대로 채운 시트가 들어가요(고객사 관리자가 받는 엑셀도 같아요).</p>
      <div className="mt-2 flex flex-col gap-1.5">
        {opts.map((o) => (
          <label key={o.id ?? "wehago"} className={`flex min-h-11 cursor-pointer items-center gap-2.5 rounded-lg border px-3 text-sm ${picked === o.id ? "border-brand-600 bg-brand-50" : "border-zinc-200 hover:bg-zinc-50"}`}>
            <input type="radio" name="main-template" checked={picked === o.id} onChange={() => choose(o.id)} className="size-4 accent-brand-600" />
            <span className="min-w-0 flex-1 break-keep">{o.name}</span>
            {o.draft && <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-800">초안</span>}
          </label>
        ))}
      </div>
      <FormError message={error} />
    </fieldset>
  );
}
