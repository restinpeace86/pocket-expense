"use client";

import type { Field } from "@/lib/company-forms/model";

// [회사 추가 항목](8-104 C): 회사 휴가신청서 양식의 직원 입력 칸(최대 5개). 지난 값이 미리 채워지고, 필수가 비면 신청 안 됨
const input = "h-12 w-full rounded-xl border border-zinc-300 bg-white px-3 text-[15px] outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20";

export function missingRequired(fields: Field[], values: Record<string, string>): Field | null {
  return fields.find((f) => f.b.k === "input" && f.b.required && !(values[f.key] ?? "").trim()) ?? null;
}

export function LeaveCustomFields({
  formName,
  fields,
  values,
  onChange,
  members,
}: {
  formName: string;
  fields: Field[];
  values: Record<string, string>;
  onChange: (key: string, v: string) => void;
  members: { id: string; name: string }[];
}) {
  return (
    <section aria-labelledby="custom-title" className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-3.5" data-leave-custom>
      <div>
        <h2 id="custom-title" className="text-sm font-semibold">
          회사 추가 항목
        </h2>
        <p className="text-xs text-zinc-600">회사 {formName}에 들어가는 칸이에요. 지난번에 쓴 값이 있으면 미리 채워 둬요.</p>
      </div>
      {fields.map((f) => {
        if (f.b.k !== "input") return null;
        const b = f.b;
        const id = `custom-${f.key}`;
        const v = values[f.key] ?? "";
        return (
          <label key={f.key} htmlFor={id} className="flex flex-col gap-1.5" data-custom-field={f.key}>
            <span className="text-sm font-medium">
              {f.label}
              {b.required ? <span className="ml-0.5 text-red-600">*</span> : <span className="ml-1 text-xs font-normal text-zinc-500">(선택)</span>}
            </span>
            {b.type === "long" ? (
              <textarea id={id} rows={3} maxLength={1000} value={v} onChange={(e) => onChange(f.key, e.target.value)} className="rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-[15px] outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20" />
            ) : b.type === "choice" || b.type === "member" ? (
              <select id={id} value={v} onChange={(e) => onChange(f.key, e.target.value)} className={input}>
                <option value="">{b.type === "member" ? "직원 고르기" : "고르기"}</option>
                {b.type === "member"
                  ? members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))
                  : (b.options ?? []).map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
              </select>
            ) : (
              <input
                id={id}
                type={b.type === "date" ? "date" : "text"}
                inputMode={b.type === "number" ? "decimal" : undefined}
                maxLength={200}
                value={v}
                onChange={(e) => onChange(f.key, b.type === "number" ? e.target.value.replace(/[^0-9.-]/g, "") : e.target.value)}
                className={input}
              />
            )}
          </label>
        );
      })}
    </section>
  );
}
