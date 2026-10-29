"use client";

import { Pencil, Plus, Repeat } from "lucide-react";
import { useState, useTransition } from "react";
import { addRecurringAction, setRecurringActiveAction, updateRecurringAction, type RecurringInput } from "@/app/workspace/[id]/admin/recurring/actions";
import { Field, FormError } from "@/components/onboarding/field";
import { AmountInput } from "@/components/ui/amount-input";
import { SectionHeading } from "@/components/ui/help";
import { inputClass } from "@/components/ui/page-shell";
import type { RecurringRow } from "@/lib/admin/queries";
import { claimStatusBadge } from "@/lib/expense/status";
import { formatWon } from "@/lib/format";
import { measureAction } from "@/lib/perf/client";
import { nextBillingDate, scheduleLabel } from "@/lib/recurring/schedule";

// 정기 결제 설정 (D-110, D-171): 매달 나가는 것 목록 — 법인카드 정기 결제는 카드 내역 대조에서 실제 결제와 맞으면 결의서, 개인카드는 결제일 알림
type Result = { error: string | null };
type Option = { id: string; name: string };
type Card = { id: string; nickname: string; last4: string };
const card = "rounded-xl border border-zinc-200 bg-white p-5 shadow-sm";
const secondaryBtn =
  "inline-flex min-h-11 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border border-zinc-300 bg-white px-3 text-sm font-medium hover:bg-zinc-50 disabled:opacity-50";

export function RecurringHeading() {
  return (
    <SectionHeading
      as="h1"
      title="정기 결제"
      summary="노션·구글 같은 구독료를 등록해 두면, 법인카드 내역 대조에서 실제 결제와 맞춰 결의서를 만들어요."
      helpId="admin.recurring"
      help={
        <>
          <p>
            <b>법인카드 정기 결제</b> 결제일에 결의서를 미리 만들지 않아요. 월말에 [법인카드 › 카드 내역 대조]로 카드사 내역을 올리면, 가맹점 이름(아래 &lsquo;카드 내역 가맹점 이름&rsquo;)과 금액(±10%)이 맞는 결제에 &ldquo;정기 결제&rdquo; 표시가 붙어요. [정기 결제로 처리]를 누르면 담당자 앞으로 결의서가 만들어지고, 그 카드 결제가 증빙으로 붙어요. 담당자는 확인 후 상신만 하면 돼요.
          </p>
          <p>
            <b>개인카드 정기 결제</b> 카드 내역이 없으니 결제일 아침에 담당자에게 &ldquo;결제 내역을 찍어 상신해 주세요&rdquo; 알림만 가요.
          </p>
          <p>
            <b>결제가 안 보여요</b> 결제일이 카드 내역 기간 안인데 맞는 결제가 없으면 대조 화면에 따로 알려 줘요(해지·금액 변경 확인용).
          </p>
          <p>
            <b>해지했어요</b> [사용 안 함]으로 바꾸면 더 이상 찾지 않아요. 지난 결의서는 그대로 남아요.
          </p>
        </>
      }
    />
  );
}

const empty = (members: Option[]): RecurringInput => ({
  serviceName: "",
  amount: "",
  cycle: "monthly",
  billingDay: 1,
  billingMonth: null,
  paymentMethod: "corporate_card",
  corporateCardId: null,
  assigneeMemberId: members[0]?.id ?? "",
  memo: "",
  merchantKeyword: "",
});
const fromRow = (r: RecurringRow): RecurringInput => ({
  serviceName: r.service_name,
  amount: String(r.amount),
  cycle: r.cycle,
  billingDay: r.billing_day,
  billingMonth: r.billing_month,
  paymentMethod: r.payment_method,
  corporateCardId: r.corporate_card_id,
  assigneeMemberId: r.assignee_member_id,
  memo: r.memo ?? "",
  merchantKeyword: r.merchant_keyword ?? "",
});

export function RecurringView({ rows, members, cards, today, preview = false }: { rows: RecurringRow[]; members: Option[]; cards: Card[]; today: string; preview?: boolean }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<RecurringInput>(() => empty(members));
  const names = new Map(members.map((m) => [m.id, m.name]));
  const cardNames = new Map(cards.map((c) => [c.id, `${c.nickname} (${c.last4})`]));

  function run(label: string, action: () => Promise<Result>, done?: () => void) {
    if (preview) return;
    setError(null);
    startTransition(async () => {
      const r = await measureAction(`recurring.${label}`, action);
      if (r.error) setError(r.error);
      else done?.();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <section className={card}>
        <SectionHeading title="정기 결제 추가" summary="서비스명·금액·결제일·담당자를 정해 주세요." />
        <RecurringForm
          value={form}
          onChange={setForm}
          members={members}
          cards={cards}
          busy={pending}
          submitLabel="추가"
          onSubmit={() => run("add", () => addRecurringAction(form), () => setForm(empty(members)))}
        />
      </section>

      <FormError message={error} />

      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-zinc-300 bg-white px-4 py-10 text-center text-sm text-zinc-500">등록된 정기 결제가 없어요.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((r) => (
            <RecurringItem
              key={r.id}
              row={r}
              members={members}
              cards={cards}
              busy={pending}
              today={today}
              assignee={names.get(r.assignee_member_id) ?? "(활성 멤버 아님)"}
              cardName={r.corporate_card_id ? (cardNames.get(r.corporate_card_id) ?? "법인카드") : null}
              onSave={(v, done) => run("update", () => updateRecurringAction(r.id, v), done)}
              onToggle={() => {
                if (r.is_active && !confirm(`'${r.service_name}' 정기 결제를 사용 안 함으로 바꿀까요? 더 이상 카드 내역에서 찾거나 알리지 않아요.`)) return;
                run(r.is_active ? "deactivate" : "activate", () => setRecurringActiveAction(r.id, !r.is_active));
              }}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function RecurringItem({
  row: r,
  members,
  cards,
  busy,
  today,
  assignee,
  cardName,
  onSave,
  onToggle,
}: {
  row: RecurringRow;
  members: Option[];
  cards: Card[];
  busy: boolean;
  today: string;
  assignee: string;
  cardName: string | null;
  onSave: (v: RecurringInput, done: () => void) => void;
  onToggle: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<RecurringInput>(() => fromRow(r));
  // 이번 기간 결의서가 이미 만들어졌으면 그다음 결제일
  const sched = { cycle: r.cycle, billingDay: r.billing_day, billingMonth: r.billing_month, startsOn: r.starts_on };
  const first = nextBillingDate(sched, today);
  const next = r.last && r.last.period >= first ? nextBillingDate(sched, new Date(Date.parse(r.last.period) + 86400_000).toISOString().slice(0, 10)) : first;
  const lastBadge = r.last ? claimStatusBadge(r.last.status) : null;
  return (
    <li className={`rounded-xl border bg-white p-4 ${r.is_active ? "border-zinc-200" : "border-dashed border-zinc-300 bg-zinc-50"}`}>
      {editing ? (
        <RecurringForm value={form} onChange={setForm} members={members} cards={cards} busy={busy} submitLabel="저장" onSubmit={() => onSave(form, () => setEditing(false))} onCancel={() => setEditing(false)} />
      ) : (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <span className={`inline-flex size-10 shrink-0 items-center justify-center rounded-lg ${r.is_active ? "bg-brand-50 text-brand-700" : "bg-zinc-200 text-zinc-500"}`}>
              <Repeat className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="break-words font-medium">
                {r.service_name} <span className="whitespace-nowrap tabular-nums text-zinc-600">{formatWon(r.amount)}</span>
                {!r.is_active && <span className="ml-1 inline-block whitespace-nowrap rounded-full bg-zinc-200 px-2 py-0.5 text-xs text-zinc-600">사용 안 함</span>}
              </p>
              <p className="text-sm text-zinc-600">
                {scheduleLabel({ cycle: r.cycle, billingDay: r.billing_day, billingMonth: r.billing_month })} · {r.payment_method === "corporate_card" ? `💳 ${cardName ?? "법인카드"}` : "🧾 담당자 개인카드"} · 담당 {assignee}
              </p>
              <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-500">
                {r.is_active && <span>다음 결제일 {next.slice(5).replace("-", "/")}</span>}
                {r.last && lastBadge && (
                  <span className="inline-flex items-center gap-1">
                    최근 {r.last.period.slice(5).replace("-", "/")}분 <span className={`rounded-full px-2 py-0.5 ${lastBadge.className}`}>{lastBadge.label}</span>
                  </span>
                )}
              </p>
            </div>
          </div>
          <div className="flex gap-2 sm:shrink-0">
            {r.is_active && (
              <button type="button" className={secondaryBtn} disabled={busy} onClick={() => setEditing(true)}>
                <Pencil className="size-4" /> 수정
              </button>
            )}
            <button type="button" className={secondaryBtn} disabled={busy} onClick={onToggle}>
              {r.is_active ? "사용 안 함" : "다시 사용"}
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

function RecurringForm({
  value: v,
  onChange,
  members,
  cards,
  busy,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  value: RecurringInput;
  onChange: (v: RecurringInput) => void;
  members: Option[];
  cards: Card[];
  busy: boolean;
  submitLabel: string;
  onSubmit: () => void;
  onCancel?: () => void;
}) {
  const set = <K extends keyof RecurringInput>(k: K, x: RecurringInput[K]) => onChange({ ...v, [k]: x });
  const ok = v.serviceName.trim() && Number(v.amount) > 0 && v.assigneeMemberId && (v.cycle === "monthly" || v.billingMonth);
  return (
    <form
      className="mt-4 grid gap-3 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <Field label="서비스명" required>
        <input className={inputClass} value={v.serviceName} onChange={(e) => set("serviceName", e.target.value)} placeholder="예: 노션 팀 플랜" maxLength={60} required />
      </Field>
      <Field label="예상 금액" required>
        <AmountInput name="recurring-amount" ariaLabel="예상 금액" value={v.amount} onChange={(x) => set("amount", x)} />
      </Field>
      <Field label="결제 주기" required>
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="결제 주기">
          {(
            [
              ["monthly", "매월"],
              ["yearly", "매년"],
            ] as const
          ).map(([c, label]) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={v.cycle === c}
              onClick={() => onChange({ ...v, cycle: c, billingMonth: c === "yearly" ? (v.billingMonth ?? 1) : null })}
              className={`min-h-11 rounded-xl border text-sm font-medium ${v.cycle === c ? "border-brand-600 bg-brand-50 text-brand-800" : "border-zinc-300 bg-white text-zinc-700"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </Field>
      <div className="grid grid-cols-2 gap-2">
        {v.cycle === "yearly" && (
          <Field label="결제 월" required>
            <select className={inputClass} value={v.billingMonth ?? 1} onChange={(e) => set("billingMonth", Number(e.target.value))}>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>
                  {m}월
                </option>
              ))}
            </select>
          </Field>
        )}
        <Field label="결제일" required>
          <select className={inputClass} value={v.billingDay} onChange={(e) => set("billingDay", Number(e.target.value))}>
            {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
              <option key={d} value={d}>
                {d === 31 ? "말일" : `${d}일`}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="결제수단" required>
        <select className={inputClass} value={v.paymentMethod === "corporate_card" ? (v.corporateCardId ?? "") : "personal"} onChange={(e) => (e.target.value === "personal" ? onChange({ ...v, paymentMethod: "personal_card", corporateCardId: null }) : onChange({ ...v, paymentMethod: "corporate_card", corporateCardId: e.target.value || null }))}>
          <option value="">💳 법인카드 (카드 지정 안 함)</option>
          {cards.map((c) => (
            <option key={c.id} value={c.id}>
              💳 {c.nickname} ({c.last4})
            </option>
          ))}
          <option value="personal">🧾 담당자 개인카드 (돌려받음)</option>
        </select>
      </Field>
      <Field label="담당자" required>
        <select className={inputClass} value={v.assigneeMemberId} onChange={(e) => set("assigneeMemberId", e.target.value)} required>
          {members.length === 0 && <option value="">활성 멤버가 없어요</option>}
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </Field>
      {v.paymentMethod === "corporate_card" && (
        <div className="sm:col-span-2">
          <Field label="카드 내역 가맹점 이름 (선택)" hint="카드사 내역에 찍히는 가맹점 이름의 일부(예: AUTODESK, NOTION). 비우면 서비스명으로 찾아요.">
            <input className={inputClass} value={v.merchantKeyword} onChange={(e) => set("merchantKeyword", e.target.value)} placeholder="예: AUTODESK" maxLength={60} />
          </Field>
        </div>
      )}
      <div className="sm:col-span-2">
        <Field label="메모 (선택)">
          <input className={inputClass} value={v.memo} onChange={(e) => set("memo", e.target.value)} placeholder="예: 팀 10명 좌석, 연 결제 전환 검토" maxLength={200} />
        </Field>
      </div>
      <div className="flex gap-2 sm:col-span-2">
        <button type="submit" disabled={busy || !ok} className="inline-flex min-h-11 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50">
          {submitLabel === "추가" && <Plus className="size-4" />} {submitLabel}
        </button>
        {onCancel && (
          <button type="button" className={secondaryBtn} onClick={onCancel}>
            취소
          </button>
        )}
      </div>
    </form>
  );
}
