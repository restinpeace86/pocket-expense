"use client";

import type { Field } from "@/lib/company-forms/model";
import { stdField } from "@/lib/company-forms/doc-types";
import type { Payload } from "@/lib/approval-docs/model";

// [결재 문서] 쓰기 칸(9-33e3): 양식의 '직원 입력' 칸만 위→아래, 입력 방식마다 맞는 칸
// 저장 값: 글·날짜 = 그대로 / 금액·숫자 = 숫자만 / 기간 = "시작~끝"(날짜) / 시각 = "09:00~11:00" / 직원 고르기 = 이름
const box = "h-12 w-full rounded-xl border border-zinc-300 bg-white px-3 text-[15px] outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20";

export function DocFields({ docType, fields, values, onChange, members, invalid }: { docType: string; fields: Field[]; values: Payload; onChange: (key: string, v: string) => void; members: { id: string; name: string }[]; invalid: string | null }) {
  return (
    <div className="flex flex-col gap-4" data-doc-fields>
      {fields.map((f) => {
        if (f.b.k !== "input") return null;
        const b = f.b;
        const id = `doc-${f.key}`;
        const raw = values[f.key];
        const v = typeof raw === "string" ? raw : "";
        // 회사 양식에 적힌 이름 그대로(쓰던 양식 그대로). 비었으면 표준 칸 이름
        const label = f.label.trim() || stdField(docType, b.std)?.label || "입력";
        const bad = invalid === f.key;
        const cls = `${box} ${bad ? "border-red-500 ring-2 ring-red-500/20" : ""}`;
        const [a, z] = v.includes("~") ? v.split("~") : [v, ""];
        return (
          <div key={f.key} className="flex flex-col gap-1.5" data-doc-field={f.key} data-type={b.type}>
            <label htmlFor={id} className="text-sm font-medium">
              {label}
              {b.required ? <span className="ml-0.5 text-red-600">*</span> : <span className="ml-1 text-xs font-normal text-zinc-500">(선택)</span>}
            </label>
            {b.type === "long" ? (
              <textarea id={id} rows={4} maxLength={3000} value={v} onChange={(e) => onChange(f.key, e.target.value)} className={`${cls} h-auto py-2.5`} />
            ) : b.type === "money" || b.type === "number" ? (
              <div className="relative">
                <input
                  id={id}
                  inputMode="numeric"
                  value={b.type === "money" && v ? Number(v).toLocaleString("ko-KR") : v}
                  onChange={(e) => onChange(f.key, e.target.value.replace(/[^0-9]/g, "").slice(0, 13))}
                  className={`${cls} ${b.type === "money" ? "pr-9 text-right" : ""}`}
                />
                {b.type === "money" && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-zinc-500">원</span>}
              </div>
            ) : b.type === "date" ? (
              <input id={id} type="date" value={v} onChange={(e) => onChange(f.key, e.target.value)} className={cls} />
            ) : b.type === "period" || b.type === "time_range" ? (
              <div className="flex items-center gap-2">
                <input id={id} type={b.type === "period" ? "date" : "time"} aria-label={`${label} 시작`} value={a} onChange={(e) => onChange(f.key, `${e.target.value}~${z}`)} className={`${cls} min-w-0 flex-1`} />
                <span className="text-zinc-500">~</span>
                <input type={b.type === "period" ? "date" : "time"} aria-label={`${label} 끝`} value={z} min={b.type === "period" ? a || undefined : undefined} onChange={(e) => onChange(f.key, `${a}~${e.target.value}`)} className={`${cls} min-w-0 flex-1`} />
              </div>
            ) : b.type === "choice" && (b.options ?? []).length > 0 && (b.options ?? []).length <= 6 ? (
              <div role="radiogroup" aria-labelledby={id} className="flex flex-wrap gap-2" id={id}>
                {(b.options ?? []).map((o) => (
                  <button key={o} type="button" role="radio" aria-checked={v === o} onClick={() => onChange(f.key, v === o ? "" : o)} className={`h-10 rounded-xl border px-3.5 text-sm ${v === o ? "border-brand-600 bg-brand-50 font-semibold text-brand-800" : "border-zinc-300 bg-white text-zinc-800"}`}>
                    {o}
                  </button>
                ))}
              </div>
            ) : b.type === "choice" || b.type === "member" ? (
              <select id={id} value={v} onChange={(e) => onChange(f.key, e.target.value)} className={cls}>
                <option value="">{b.type === "member" ? "직원 고르기" : "고르기"}</option>
                {(b.type === "member" ? members.map((m) => m.name) : (b.options ?? [])).map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            ) : (
              <input id={id} maxLength={300} value={v} onChange={(e) => onChange(f.key, e.target.value)} className={cls} />
            )}
            {bad && (
              <span role="alert" className="text-[13px] font-semibold text-red-700">
                꼭 적어 주세요
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
