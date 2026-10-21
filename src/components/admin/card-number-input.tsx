"use client";

import { useRef, type ClipboardEvent, type KeyboardEvent, type RefObject } from "react";

// 법인카드 번호 입력: ㅁㅁㅁㅁ-ㅁㅁ**-****-ㅁㅁㅁㅁ (corporate-cards.md §2, D-083)
// 앞 6자리(BIN)·뒤 4자리만 칸이 있고 가운데 6자리는 입력란 자체가 없다(카드번호 전체를 받지 않음).
// 칸이 차면 다음 칸으로 넘어가고, 빈 칸에서 지우기를 누르면 앞 칸으로 돌아간다.
// 카드번호 전체를 붙여 넣으면 앞 6자리·뒤 4자리만 나눠 넣고 나머지는 버린다.
const box =
  "min-h-11 rounded-xl border border-zinc-300 bg-white px-2 text-center text-base tabular-nums tracking-wider text-zinc-900 placeholder:text-zinc-300 focus:border-brand-500 focus:outline-none";

export function CardNumberInput({
  bin6,
  last4,
  onChange,
  idPrefix,
  lockLast4 = false,
  bin6Required = true,
}: {
  bin6: string;
  last4: string;
  onChange: (bin6: string, last4: string) => void;
  idPrefix: string;
  lockLast4?: boolean; // 이미 등록된 카드: 뒤 4자리는 고칠 수 없고 보여 주기만
  bin6Required?: boolean;
}) {
  const a = useRef<HTMLInputElement>(null);
  const b = useRef<HTMLInputElement>(null);
  const d = useRef<HTMLInputElement>(null);
  const first = bin6.slice(0, 4);
  const second = bin6.slice(4, 6);
  const digits = (v: string, n: number) => v.replace(/\D/g, "").slice(0, n);

  function onPaste(e: ClipboardEvent<HTMLInputElement>) {
    const all = e.clipboardData.getData("text").replace(/\D/g, "");
    if (all.length < 10) return; // 짧으면 그 칸에 그대로 붙인다
    e.preventDefault();
    onChange(all.slice(0, 6), lockLast4 ? last4 : all.slice(-4));
    (lockLast4 ? b : d).current?.focus();
  }

  function back(e: KeyboardEvent<HTMLInputElement>, prev: RefObject<HTMLInputElement | null>) {
    if (e.key === "Backspace" && e.currentTarget.value === "") {
      e.preventDefault();
      prev.current?.focus();
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span id={`${idPrefix}-label`} className="text-sm font-medium text-zinc-800">
        카드번호
        {bin6Required && <span className="ml-0.5 text-red-500">*</span>}
      </span>
      <div role="group" aria-labelledby={`${idPrefix}-label`} className="flex w-full max-w-xs items-center gap-1 text-zinc-400">
        <input
          ref={a}
          id={`${idPrefix}-a`}
          aria-label="카드번호 앞 1~4번째 자리"
          className={`${box} w-0 min-w-0 flex-[4]`}
          inputMode="numeric"
          autoComplete="off"
          placeholder="0000"
          value={first}
          onPaste={onPaste}
          onChange={(e) => {
            const v = digits(e.target.value, 4);
            onChange(v + second, last4);
            if (v.length === 4) b.current?.focus();
          }}
        />
        <span aria-hidden>-</span>
        <input
          ref={b}
          aria-label="카드번호 5~6번째 자리"
          className={`${box} w-0 min-w-0 flex-[2.4]`}
          inputMode="numeric"
          autoComplete="off"
          placeholder="00"
          value={second}
          onPaste={onPaste}
          onKeyDown={(e) => back(e, a)}
          onChange={(e) => {
            const v = digits(e.target.value, 2);
            onChange(first + v, last4);
            if (v.length === 2 && !lockLast4) d.current?.focus();
          }}
        />
        <span aria-hidden className="shrink-0 select-none whitespace-nowrap tabular-nums">
          **-****-
        </span>
        {lockLast4 ? (
          <span className="shrink-0 tabular-nums text-zinc-900">{last4}</span>
        ) : (
          <input
            ref={d}
            aria-label="카드번호 뒤 4자리"
            className={`${box} w-0 min-w-0 flex-[4]`}
            inputMode="numeric"
            autoComplete="off"
            placeholder="0000"
            value={last4}
            onPaste={onPaste}
            onKeyDown={(e) => back(e, b)}
            onChange={(e) => onChange(bin6, digits(e.target.value, 4))}
          />
        )}
      </div>
      <span className="text-xs text-zinc-500">앞 6자리와 뒤 4자리만 받아요. 가운데 숫자·유효기간·CVC는 저장하지 않아요.</span>
    </div>
  );
}
