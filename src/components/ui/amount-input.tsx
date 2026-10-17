"use client";

import { inputClass } from "@/components/ui/page-shell";

// 금액·숫자 입력: 입력하는 동안 천 단위 쉼표를 보여 주고(10,000), 값은 숫자만 넘긴다.
export function AmountInput({
  name,
  value,
  onChange,
  unit = "원",
  required,
  ariaLabel,
}: {
  name: string;
  value: string; // 숫자만
  onChange: (digits: string) => void;
  unit?: string;
  required?: boolean;
  ariaLabel?: string;
}) {
  const shown = value === "" ? "" : Number(value).toLocaleString("ko-KR");
  return (
    <div className="relative">
      <input
        name={name}
        value={shown}
        onChange={(e) => onChange(e.target.value.replace(/[^0-9]/g, "").replace(/^0+(?=\d)/, "").slice(0, 9))}
        className={`${inputClass} pr-10 text-right tabular-nums`}
        inputMode="numeric"
        required={required}
        aria-label={ariaLabel}
      />
      <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-zinc-500">{unit}</span>
    </div>
  );
}
