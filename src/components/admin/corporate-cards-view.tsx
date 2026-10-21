"use client";

import { CreditCard, Pencil, Plus } from "lucide-react";
import { useState, useTransition } from "react";
import {
  addCardAction,
  setCardActiveAction,
  updateCardAction,
} from "@/app/workspace/[id]/admin/corporate-cards/actions";
import { CardNumberInput } from "@/components/admin/card-number-input";
import { Field, FormError } from "@/components/onboarding/field";
import { SectionHeading } from "@/components/ui/help";
import { inputClass } from "@/components/ui/page-shell";
import type { CorporateCardRow } from "@/lib/admin/queries";
import { formatCardNumber } from "@/lib/cards/match";
import { formatWon } from "@/lib/format";
import { measureAction } from "@/lib/perf/client";

type Result = { error: string | null };
type MemberOption = { id: string; name: string };
const card = "rounded-xl border border-zinc-200 bg-white p-5 shadow-sm";
const secondaryBtn =
  "inline-flex min-h-11 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border border-zinc-300 bg-white px-3 text-sm font-medium hover:bg-zinc-50 disabled:opacity-50";

export function CorporateCardsHeading() {
  return (
    <SectionHeading
      as="h1"
      title="법인카드"
      summary="법인카드 앞 6자리와 뒤 4자리를 등록해 두면 영수증에서 법인카드인지 개인카드인지 자동으로 골라 줘요."
      helpId="admin.corporate-cards"
      help={
        <>
          <p>
            <b>왜 필요한가요?</b> 직원이 개인카드로 낸 영수증을 법인카드로 잘못
            올리면 돌려받을 돈이 빠져요. 영수증에 찍힌 카드번호 중 보이는 숫자를
            등록된 카드와 비교해 결제수단을 골라 줘서 이런 실수를 줄여요.
            영수증은 가운데 자리를 *로 가려 찍기 때문에 앞 6자리·뒤 4자리로
            비교하고, 그중 가려진 자리도 빼고 비교해요.
            세무사무소가 카드사 내역과 맞춰 볼 때도 쓰여요.
          </p>
          <p>
            <b>꼭 등록해야 하나요?</b> 아니에요(선택 기능). 등록하지 않으면
            직원은 법인카드 / 개인카드 중에서 직접 골라요.
          </p>
          <p>
            <b>보안</b> 영수증에도 찍히는 <b>앞 6자리(카드사 번호)와 뒤
            4자리만</b> 저장해요. 가운데 숫자·유효기간·CVC는 받지도 저장하지도
            않아요.
          </p>
        </>
      }
    />
  );
}

export function CorporateCardsView({
  cards,
  members,
  preview = false,
}: {
  cards: CorporateCardRow[];
  members: MemberOption[];
  preview?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [nickname, setNickname] = useState("");
  const [bin6, setBin6] = useState("");
  const [last4, setLast4] = useState("");
  const [holder, setHolder] = useState("");

  function run(
    label: string,
    action: () => Promise<Result>,
    done?: () => void,
  ) {
    if (preview) return;
    setError(null);
    startTransition(async () => {
      const r = await measureAction(`corporate-cards.${label}`, action);
      if (r.error) setError(r.error);
      else done?.();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <section className={card}>
        <SectionHeading
          title="카드 추가"
          summary="카드 앞 6자리와 뒤 4자리만 등록합니다. 카드번호 전체는 저장하지 않습니다."
        />
        <form
          className="mt-4 grid gap-3 sm:grid-cols-2 sm:items-start xl:grid-cols-[minmax(0,1fr)_auto_12rem_auto]"
          onSubmit={(e) => {
            e.preventDefault();
            run(
              "add",
              () =>
                addCardAction({
                  nickname,
                  bin6,
                  last4,
                  holderMemberId: holder || null,
                }),
              () => {
                setNickname("");
                setBin6("");
                setLast4("");
                setHolder("");
              },
            );
          }}
        >
          <div className="sm:col-span-2 xl:col-span-1">
            <Field label="별칭" required>
              <input
                className={inputClass}
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="예: 대표 법인카드"
                maxLength={30}
                required
              />
            </Field>
          </div>
          <div className="sm:col-span-2 xl:col-span-1 xl:w-72">
            <CardNumberInput
              idPrefix="new-card"
              bin6={bin6}
              last4={last4}
              onChange={(b, l) => {
                setBin6(b);
                setLast4(l);
              }}
            />
          </div>
          <Field label="담당자 (선택)">
            <select
              className={inputClass}
              value={holder}
              onChange={(e) => setHolder(e.target.value)}
            >
              <option value="">없음</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </Field>
          <button
            type="submit"
            disabled={pending || !nickname.trim() || bin6.length !== 6 || last4.length !== 4}
            className="inline-flex min-h-11 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50 sm:col-span-2 sm:justify-self-start xl:col-span-1 xl:mt-7"
          >
            <Plus className="size-4" /> 추가
          </button>
        </form>
      </section>

      <FormError message={error} />

      {cards.length === 0 ? (
        <p className="rounded-xl border border-dashed border-zinc-300 bg-white px-4 py-10 text-center text-sm text-zinc-500">
          등록된 법인카드가 없어요. 등록하지 않아도 직원이 결제수단을 직접 고를
          수 있어요.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {cards.map((c) => (
            <CardItem
              key={c.id}
              card={c}
              members={members}
              busy={pending}
              onSave={(n, h, b, done) =>
                run(
                  "update",
                  () =>
                    updateCardAction(c.id, { nickname: n, holderMemberId: h, bin6: b }),
                  done,
                )
              }
              onToggle={() => {
                if (
                  c.is_active &&
                  !confirm(
                    `'${c.nickname}' 카드를 사용 안 함으로 바꿀까요? 지난 영수증 연결은 그대로 남아요.`,
                  )
                )
                  return;
                run(c.is_active ? "deactivate" : "activate", () =>
                  setCardActiveAction(c.id, !c.is_active),
                );
              }}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function CardItem({
  card: c,
  members,
  busy,
  onSave,
  onToggle,
}: {
  card: CorporateCardRow;
  members: MemberOption[];
  busy: boolean;
  onSave: (nickname: string, holder: string | null, bin6: string, done: () => void) => void;
  onToggle: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [nickname, setNickname] = useState(c.nickname);
  const [holder, setHolder] = useState(c.holder_member_id ?? "");
  const [bin6, setBin6] = useState(c.bin6 ?? "");
  const bin6Ok = bin6.length === 6 || (!c.bin6 && bin6.length === 0); // 예전 카드는 비워 둬도 저장 가능

  return (
    <li
      className={`rounded-xl border bg-white p-4 ${c.is_active ? "border-zinc-200" : "border-dashed border-zinc-300 bg-zinc-50"}`}
    >
      {editing ? (
        <form
          className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-start"
          onSubmit={(e) => {
            e.preventDefault();
            onSave(nickname, holder || null, bin6, () => setEditing(false));
          }}
        >
          <Field label="별칭">
            <input
              className={inputClass}
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              maxLength={30}
              required
              autoFocus
            />
          </Field>
          <Field label="담당자">
            <select
              className={inputClass}
              value={holder}
              onChange={(e) => setHolder(e.target.value)}
            >
              <option value="">없음</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </Field>
          <CardNumberInput idPrefix={`card-${c.id}`} bin6={bin6} last4={c.last4} lockLast4 bin6Required={!!c.bin6} onChange={(b) => setBin6(b)} />
          <div className="flex gap-2 lg:mt-7">
            <button
              type="submit"
              disabled={busy || !nickname.trim() || !bin6Ok}
              className="inline-flex min-h-11 items-center whitespace-nowrap rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white disabled:opacity-50"
            >
              저장
            </button>
            <button
              type="button"
              className={secondaryBtn}
              onClick={() => setEditing(false)}
            >
              취소
            </button>
          </div>
        </form>
      ) : (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <span
              className={`inline-flex size-10 shrink-0 items-center justify-center rounded-lg ${c.is_active ? "bg-brand-50 text-brand-700" : "bg-zinc-200 text-zinc-500"}`}
            >
              <CreditCard className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="break-words font-medium">
                {c.nickname}{" "}
                <span className="whitespace-nowrap tabular-nums text-zinc-500">{formatCardNumber(c)}</span>
                {c.is_active && !c.bin6 && (
                  <span className="ml-1 inline-block whitespace-nowrap rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">앞 6자리 미등록</span>
                )}
                {!c.is_active && (
                  <span className="ml-1 inline-block whitespace-nowrap rounded-full bg-zinc-200 px-2 py-0.5 text-xs text-zinc-600">사용 안 함</span>
                )}
              </p>
              <p className="text-sm text-zinc-600">
                {c.holder_name ? `담당 ${c.holder_name}` : "담당자 없음"} ·{" "}
                <span className="whitespace-nowrap">이번 달 사용 {formatWon(c.month_total)}</span>
              </p>
            </div>
          </div>
          <div className="flex gap-2 sm:shrink-0">
            {c.is_active && (
              <button
                type="button"
                className={secondaryBtn}
                disabled={busy}
                onClick={() => setEditing(true)}
              >
                <Pencil className="size-4" /> 수정
              </button>
            )}
            <button
              type="button"
              className={secondaryBtn}
              disabled={busy}
              onClick={onToggle}
            >
              {c.is_active ? "사용 안 함" : "다시 사용"}
            </button>
          </div>
        </div>
      )}
    </li>
  );
}
