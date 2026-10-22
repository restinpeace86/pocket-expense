"use client";

import { Car, Pencil, Plus } from "lucide-react";
import { useState, useTransition } from "react";
import { addVehicleAction, setVehicleActiveAction, updateVehicleAction } from "@/app/workspace/[id]/admin/vehicles/actions";
import { Field, FormError } from "@/components/onboarding/field";
import { SectionHeading } from "@/components/ui/help";
import { inputClass } from "@/components/ui/page-shell";
import type { CompanyVehicleRow } from "@/lib/admin/queries";
import { formatWon } from "@/lib/format";
import { measureAction } from "@/lib/perf/client";

// 회사차량 설정 (D-105) — 법인카드 설정과 같은 모양
type Result = { error: string | null };
const card = "rounded-xl border border-zinc-200 bg-white p-5 shadow-sm";
const secondaryBtn =
  "inline-flex min-h-11 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border border-zinc-300 bg-white px-3 text-sm font-medium hover:bg-zinc-50 disabled:opacity-50";

export function VehiclesHeading() {
  return (
    <SectionHeading
      as="h1"
      title="회사차량"
      summary="회사 명의 차량을 등록해 두면 직원이 '회사차량' 결의서에서 어느 차에 쓴 돈인지 골라요."
      helpId="admin.vehicles"
      help={
        <>
          <p>
            <b>왜 필요한가요?</b> 주유·정비·세차처럼 회사차량에 쓴 돈(차량유지비)은 세무사가 차량별로 정리해요(업무용 승용차 관련 비용). 결의서마다 차량이 붙어 있으면 차량별로 모아 볼 수 있어요.
          </p>
          <p>
            <b>꼭 등록해야 하나요?</b> 회사차량 결의서를 쓴다면 등록을 권해요. 차량이 하나라도 등록돼 있으면 직원은 회사차량 결의서에서 차량을 꼭 골라야 상신할 수 있어요.
          </p>
          <p>
            <b>직원 개인 차량은?</b> 여기가 아니라 직원 [내 정보]의 차량번호예요(출장 자차 유류비용).
          </p>
        </>
      }
    />
  );
}

export function VehiclesView({ vehicles, preview = false }: { vehicles: CompanyVehicleRow[]; preview?: boolean }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [nickname, setNickname] = useState("");
  const [plate, setPlate] = useState("");

  function run(label: string, action: () => Promise<Result>, done?: () => void) {
    if (preview) return;
    setError(null);
    startTransition(async () => {
      const r = await measureAction(`vehicles.${label}`, action);
      if (r.error) setError(r.error);
      else done?.();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <section className={card}>
        <SectionHeading title="차량 추가" summary="별칭과 차량번호만 등록해요." />
        <form
          className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_12rem_auto] sm:items-start"
          onSubmit={(e) => {
            e.preventDefault();
            run("add", () => addVehicleAction({ nickname, plateNumber: plate }), () => {
              setNickname("");
              setPlate("");
            });
          }}
        >
          <Field label="별칭" required>
            <input className={inputClass} value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="예: 영업 1호차" maxLength={30} required />
          </Field>
          <Field label="차량번호" required>
            <input className={inputClass} value={plate} onChange={(e) => setPlate(e.target.value)} placeholder="예: 12가3456" maxLength={20} required />
          </Field>
          <button
            type="submit"
            disabled={pending || !nickname.trim() || plate.replace(/\s+/g, "").length < 2}
            className="inline-flex min-h-11 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50 sm:mt-7 sm:justify-self-start"
          >
            <Plus className="size-4" /> 추가
          </button>
        </form>
      </section>

      <FormError message={error} />

      {vehicles.length === 0 ? (
        <p className="rounded-xl border border-dashed border-zinc-300 bg-white px-4 py-10 text-center text-sm text-zinc-500">
          등록된 회사차량이 없어요. 등록하지 않으면 회사차량 결의서에서 차량을 고르지 않고 상신해요.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {vehicles.map((v) => (
            <VehicleItem
              key={v.id}
              vehicle={v}
              busy={pending}
              onSave={(n, p, done) => run("update", () => updateVehicleAction(v.id, { nickname: n, plateNumber: p }), done)}
              onToggle={() => {
                if (v.is_active && !confirm(`'${v.nickname}' 차량을 사용 안 함으로 바꿀까요? 지난 결의서 연결은 그대로 남아요.`)) return;
                run(v.is_active ? "deactivate" : "activate", () => setVehicleActiveAction(v.id, !v.is_active));
              }}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function VehicleItem({
  vehicle: v,
  busy,
  onSave,
  onToggle,
}: {
  vehicle: CompanyVehicleRow;
  busy: boolean;
  onSave: (nickname: string, plate: string, done: () => void) => void;
  onToggle: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [nickname, setNickname] = useState(v.nickname);
  const [plate, setPlate] = useState(v.plate_number);
  return (
    <li className={`rounded-xl border bg-white p-4 ${v.is_active ? "border-zinc-200" : "border-dashed border-zinc-300 bg-zinc-50"}`}>
      {editing ? (
        <form
          className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start"
          onSubmit={(e) => {
            e.preventDefault();
            onSave(nickname, plate, () => setEditing(false));
          }}
        >
          <Field label="별칭">
            <input className={inputClass} value={nickname} onChange={(e) => setNickname(e.target.value)} maxLength={30} required autoFocus />
          </Field>
          <Field label="차량번호">
            <input className={inputClass} value={plate} onChange={(e) => setPlate(e.target.value)} maxLength={20} required />
          </Field>
          <div className="flex gap-2 sm:mt-7">
            <button type="submit" disabled={busy || !nickname.trim() || plate.replace(/\s+/g, "").length < 2} className="inline-flex min-h-11 items-center whitespace-nowrap rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white disabled:opacity-50">
              저장
            </button>
            <button type="button" className={secondaryBtn} onClick={() => setEditing(false)}>
              취소
            </button>
          </div>
        </form>
      ) : (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <span className={`inline-flex size-10 shrink-0 items-center justify-center rounded-lg ${v.is_active ? "bg-brand-50 text-brand-700" : "bg-zinc-200 text-zinc-500"}`}>
              <Car className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="break-words font-medium">
                {v.nickname} <span className="whitespace-nowrap tabular-nums text-zinc-500">{v.plate_number}</span>
                {!v.is_active && <span className="ml-1 inline-block whitespace-nowrap rounded-full bg-zinc-200 px-2 py-0.5 text-xs text-zinc-600">사용 안 함</span>}
              </p>
              <p className="text-sm text-zinc-600">
                <span className="whitespace-nowrap">이번 달 차량유지비 {formatWon(v.month_total)}</span>
              </p>
            </div>
          </div>
          <div className="flex gap-2 sm:shrink-0">
            {v.is_active && (
              <button type="button" className={secondaryBtn} disabled={busy} onClick={() => setEditing(true)}>
                <Pencil className="size-4" /> 수정
              </button>
            )}
            <button type="button" className={secondaryBtn} disabled={busy} onClick={onToggle}>
              {v.is_active ? "사용 안 함" : "다시 사용"}
            </button>
          </div>
        </div>
      )}
    </li>
  );
}
