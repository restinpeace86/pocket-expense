"use client";

import { ArrowLeft, Crown, ShieldCheck, UserCheck, UserMinus } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import {
  deactivateMemberAction,
  deactivationCheckAction,
  reactivateMemberAction,
  setMemberRoleAction,
  transferSuperAdminAction,
  updateMemberAction,
  type DeactivationCheck,
} from "@/app/workspace/[id]/admin/actions";
import { Field, FormError } from "@/components/onboarding/field";
import { SectionHeading } from "@/components/ui/help";
import { inputClass } from "@/components/ui/page-shell";
import type { MemberCapabilities } from "@/lib/admin/capabilities";
import type { MemberDetail } from "@/lib/admin/queries";
import { formatPhone } from "@/lib/format";

const ROLE_LABEL = { super_admin: "최고 관리자", admin: "관리자", employee: "일반 멤버" } as const;
const STATUS_LABEL = { pending: "가입 승인 대기", approved: "활성", inactive: "비활성(퇴사)" } as const;
const won = (n: number) => `${n.toLocaleString("ko-KR")}원`;
const card = "rounded-xl border border-zinc-200 bg-white p-5 shadow-sm";
const secondaryBtn =
  "inline-flex min-h-11 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border border-zinc-300 bg-white px-4 text-sm font-medium hover:bg-zinc-50 disabled:opacity-50";

// 멤버 상세·편집 (spec/screens/admin-team-members.md §4.B~D, roles-and-permissions.md §3)
export function MemberDetailView({
  member: m,
  departments,
  can,
  backHref,
  preview = false,
  initialCheck = null,
}: {
  member: MemberDetail;
  departments: { id: string; name: string }[];
  can: MemberCapabilities;
  backHref: string;
  preview?: boolean;
  initialCheck?: DeactivationCheck | null; // 미리보기에서 비활성화 점검 결과 화면을 그리기 위한 값
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [check, setCheck] = useState<DeactivationCheck | null>(initialCheck);

  function run(action: () => Promise<{ error: string | null }>, success: string, after?: () => void) {
    if (preview) return;
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const r = await action();
      if (r.error) setError(r.error);
      else {
        setNotice(success);
        after?.();
      }
    });
  }

  // 저장 실패 시 입력값이 지워지지 않도록 form action 대신 onSubmit
  function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const dept = String(form.get("departmentId") ?? "");
    run(
      () =>
        updateMemberAction({
          memberId: m.id,
          name: String(form.get("name") ?? ""),
          phone: String(form.get("phone") ?? ""),
          departmentId: dept || null,
          position: String(form.get("position") ?? ""),
          employeeNumber: String(form.get("employeeNumber") ?? ""),
        }),
      "저장했어요.",
    );
  }

  function changeRole() {
    const to = m.role === "admin" ? "employee" : "admin";
    const msg =
      to === "admin"
        ? `${m.name}님을 관리자로 지정할까요?\n\n관리자는 모든 직원의 지출소명서 승인·반려, 회사 설정, 멤버 관리를 할 수 있어요.`
        : `${m.name}님을 일반 멤버로 바꿀까요?\n\n관리자 화면에 더 이상 들어올 수 없어요.`;
    if (!confirm(msg)) return;
    run(() => setMemberRoleAction(m.id, to), to === "admin" ? "관리자로 지정했어요." : "일반 멤버로 바꿨어요.");
  }

  function transfer() {
    if (!confirm(`${m.name}님이 최고 관리자가 되고, 나는 관리자가 됩니다.\n\n되돌리려면 ${m.name}님이 다시 넘겨야 합니다. 넘길까요?`)) return;
    run(
      () => transferSuperAdminAction(m.id),
      `${m.name}님에게 최고 관리자를 넘겼어요. 결재라인은 자동으로 바뀌지 않으니, 대표 직통 결재로 바꾸려면 결재라인에서 결재자를 수정해 주세요.`,
    );
  }

  function startDeactivate() {
    if (preview) return;
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const r = await deactivationCheckAction(m.id);
      if (r.error) setError(r.error);
      else setCheck(r.check ?? null);
    });
  }

  return (
    <>
      <Link href={backHref} className="inline-flex min-h-11 w-fit items-center gap-1 text-sm text-zinc-600 hover:text-zinc-900">
        <ArrowLeft className="size-4" /> 멤버 목록
      </Link>

      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-bold tracking-tight">{m.name}</h1>
        <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs ${m.role === "employee" ? "bg-zinc-100 text-zinc-600" : "bg-blue-50 text-blue-700"}`}>
          {ROLE_LABEL[m.role]}
        </span>
        <span
          className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs ${m.status === "approved" ? "bg-emerald-50 text-emerald-700" : m.status === "pending" ? "bg-amber-50 text-amber-800" : "bg-zinc-200 text-zinc-600"}`}
        >
          {STATUS_LABEL[m.status]}
        </span>
      </div>

      {notice && <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</p>}
      <FormError message={error} />

      <section className={card}>
        <h2 className="font-semibold">기본 정보</h2>
        {can.canEdit ? (
          <form onSubmit={save} className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="이름" required>
              <input name="name" defaultValue={m.name} className={inputClass} maxLength={50} required />
            </Field>
            <Field label="휴대폰" required hint="알림톡을 받는 번호예요.">
              <input name="phone" defaultValue={formatPhone(m.phone)} className={inputClass} inputMode="tel" required />
            </Field>
            <Field label="부서">
              <select name="departmentId" defaultValue={m.department_id ?? ""} className={inputClass}>
                <option value="">부서 없음</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="직급">
              <input name="position" defaultValue={m.position ?? ""} className={inputClass} maxLength={50} placeholder="예: 대리" />
            </Field>
            <Field label="사번">
              <input name="employeeNumber" defaultValue={m.employee_number ?? ""} className={inputClass} maxLength={50} placeholder="선택" />
            </Field>
            <Field label="로그인 이메일" hint="카카오·Google 계정 이메일이라 여기서 바꿀 수 없어요.">
              <input value={m.email ?? "—"} className={`${inputClass} bg-zinc-50 text-zinc-500`} readOnly />
            </Field>
            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={pending}
                className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-blue-600 px-6 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 sm:w-auto"
              >
                {pending ? "저장 중..." : "저장"}
              </button>
            </div>
          </form>
        ) : (
          <>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              {[
                ["부서", m.department ?? "부서 없음"],
                ["직급", m.position ?? "—"],
                ["휴대폰", formatPhone(m.phone)],
                ["이메일", m.email ?? "—"],
                ["사번", m.employee_number ?? "—"],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="text-zinc-500">{k}</dt>
                  <dd className="break-all font-medium">{v}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-4 text-sm text-zinc-500">관리자 정보는 최고 관리자만 수정할 수 있어요.</p>
          </>
        )}
      </section>

      {(can.canChangeRole || can.canTransfer) && (
        <section className={card}>
          <SectionHeading
            title="권한"
            summary="이 멤버가 관리자 화면을 쓸 수 있는지 정해요."
            helpId="admin.member.role"
            help={
              <>
                <p>
                  <b>관리자</b>는 직원 지출소명서 승인·반려, 회사 설정, 멤버 관리를 할 수 있어요. 경리·총무 담당자에게 주면 대표 계정을 같이 쓰지 않아도 돼요.
                </p>
                <p>
                  <b>최고 관리자 넘기기</b>는 대표가 바뀌거나, 담당자가 대신 회사를 등록한 뒤 대표에게 넘길 때 써요. 넘기면 나는 관리자가 되고, 되돌리려면 상대가
                  다시 넘겨야 해요.
                </p>
              </>
            }
          />
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            {can.canChangeRole && (
              <button type="button" onClick={changeRole} disabled={pending} className={secondaryBtn}>
                <ShieldCheck className="size-4" /> {m.role === "admin" ? "일반 멤버로 변경" : "관리자로 지정"}
              </button>
            )}
            {can.canTransfer && (
              <button type="button" onClick={transfer} disabled={pending} className={secondaryBtn}>
                <Crown className="size-4" /> 최고 관리자 넘기기
              </button>
            )}
          </div>
        </section>
      )}

      {can.canReactivate && (
        <section className={card}>
          <SectionHeading
            title="다시 활성화"
            summary="실수로 비활성화했거나 다시 입사한 경우에 써요. 역할·부서는 그대로 돌아오고 바로 로그인할 수 있어요."
          />
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (!confirm(`${m.name}님을 다시 활성화할까요?`)) return;
              run(() => reactivateMemberAction(m.id), `${m.name}님을 다시 활성화했어요.`);
            }}
            className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-1.5 whitespace-nowrap rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 sm:w-auto"
          >
            <UserCheck className="size-4" /> 다시 활성화
          </button>
        </section>
      )}

      {can.canDeactivate && (
        <section className={card}>
          <SectionHeading
            title="퇴사 처리"
            summary="비활성화하면 로그인과 새 청구가 막혀요. 지난 지출 내역은 남아요."
            helpId="admin.member.deactivate"
            help={
              <>
                <p>
                  <b>왜 삭제가 아니라 비활성화인가요?</b> 지난 영수증과 지출소명서는 세무 증빙이라 지우면 안 돼요. 비활성화는 기록은 남기고 회사 데이터에 들어오는
                  것만 막아요.
                </p>
                <p>
                  <b>누르면 먼저 점검해요.</b> 아직 정산받지 못한 건이나 작성 중인 소명서가 있으면 알려 주고(그래도 진행 가능), 결재라인 검토자이거나 지금
                  검토할 차례인 소명서가 있으면 먼저 처리하도록 막아요.
                </p>
              </>
            }
          />
          {!check ? (
            <button type="button" onClick={startDeactivate} disabled={pending} className={`${secondaryBtn} mt-4 w-full text-red-600 sm:w-auto`}>
              <UserMinus className="size-4" /> 비활성화
            </button>
          ) : (
            <DeactivatePanel
              check={check}
              busy={pending}
              onCancel={() => setCheck(null)}
              onConfirm={() => run(() => deactivateMemberAction(m.id), `${m.name}님을 비활성화했어요.`, () => setCheck(null))}
            />
          )}
        </section>
      )}
    </>
  );
}

function DeactivatePanel({ check, busy, onCancel, onConfirm }: { check: DeactivationCheck; busy: boolean; onCancel: () => void; onConfirm: () => void }) {
  const warnings: string[] = [];
  if (check.unpaid_claims > 0)
    warnings.push(`정산받지 못한 승인 건 ${check.unpaid_claims}건 (지급 ${won(check.payout_amount)} / 납부 ${won(check.payback_amount)})`);
  if (check.open_claims > 0) warnings.push(`작성 중이거나 반려된 소명서 ${check.open_claims}건`);
  const blocks: string[] = [];
  if (check.approval_line_steps > 0) blocks.push("사전 검토 결재라인에 검토자로 들어 있어요. 결재라인에서 먼저 빼 주세요.");
  if (check.pending_reviews > 0) blocks.push(`지금 이 멤버가 검토할 차례인 소명서가 ${check.pending_reviews}건 있어요. 먼저 처리해 주세요.`);

  return (
    <div className="mt-4 flex flex-col gap-3">
      {blocks.length > 0 ? (
        <div className="rounded-xl bg-red-50 p-4 text-sm text-red-800">
          <p className="font-semibold">아직 비활성화할 수 없어요</p>
          <ul className="mt-1 list-disc pl-5">
            {blocks.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </div>
      ) : warnings.length > 0 ? (
        <div className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold">확인해 주세요 (비활성화는 할 수 있어요)</p>
          <ul className="mt-1 list-disc pl-5">
            {warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="rounded-xl bg-zinc-50 p-4 text-sm text-zinc-700">남은 정산이나 작성 중인 소명서가 없어요.</p>
      )}
      <div className="flex flex-col gap-2 sm:flex-row">
        <button type="button" onClick={onCancel} className={secondaryBtn}>
          취소
        </button>
        {!check.blocked && (
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-xl bg-red-600 px-4 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
          >
            {busy ? "처리 중..." : "비활성화 확정"}
          </button>
        )}
      </div>
    </div>
  );
}
