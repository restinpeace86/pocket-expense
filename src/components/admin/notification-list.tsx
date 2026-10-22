import Link from "next/link";
import { ResendButton } from "./resend-button";
import { formatDateTimeKst } from "@/lib/claims/format";
import { maskPhone } from "@/lib/notify/templates";

// 알림 이력 목록 + 실패 건 [재발송] (T11-4, kakao-alimtalk.md §5)
const TEMPLATE_LABEL: Record<string, string> = {
  APPROVAL_REQUEST: "결재 요청",
  APPROVAL_COMPLETED: "승인 완료",
  APPROVAL_REJECTED: "반려",
  PAYOUT_COMPLETED: "지급 완료",
  INVITE: "초대",
  REMINDER: "독촉",
  RECURRING_READY: "정기 결제 준비",
};

export type NotificationRow = {
  id: string;
  claim_id: string | null;
  recipient_member_id: string | null;
  recipient_phone: string;
  template_code: string;
  payload: { text?: string; button_label?: string; button_url?: string };
  status: "queued" | "sent" | "failed";
  provider: string;
  error_message: string | null;
  created_at: string;
  recipient_name: string | null;
  claim_title: string | null;
};

export function NotificationList({ rows, devMode, failedOnly, base }: { rows: NotificationRow[]; devMode: boolean; failedOnly: boolean; base: string }) {

  return (
    <div className="flex flex-col gap-4">
      {devMode && (
        <p className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
          지금은 <b>개발 모드</b>라 카카오톡으로 실제로 보내지 않고 기록만 남깁니다. 발송대행사를 연결하면 같은 내용이 바로 발송돼요.
        </p>
      )}
      <div className="flex gap-1 rounded-xl bg-zinc-100 p-1 sm:w-64">
        {(
          [
            ["", "전체"],
            ["failed", "실패"],
          ] as const
        ).map(([k, l]) => (
          <Link key={l} href={k ? `${base}?status=${k}` : base} aria-current={(k === "failed") === failedOnly ? "page" : undefined} className={`inline-flex min-h-10 flex-1 items-center justify-center rounded-lg text-sm ${(k === "failed") === failedOnly ? "bg-white font-semibold shadow-sm" : "text-zinc-600"}`}>
            {l}
          </Link>
        ))}
      </div>
      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-zinc-300 bg-white px-4 py-12 text-center text-sm text-zinc-500">{failedOnly ? "실패한 알림이 없어요." : "아직 보낸 알림이 없어요."}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((r) => {
            const payload = r.payload;
            return (
              <li key={r.id} className="rounded-xl border border-zinc-200 bg-white p-4 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium">{TEMPLATE_LABEL[r.template_code] ?? r.template_code}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${r.status === "sent" ? "bg-green-100 text-green-700" : r.status === "failed" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-800"}`}>
                    {r.status === "sent" ? (r.provider === "log" ? "기록됨 (개발 모드)" : "발송됨") : r.status === "failed" ? "실패" : "보내는 중"}
                  </span>
                  <span className="text-zinc-700">
                    → {r.recipient_name ?? "비회원"} {r.recipient_phone && `(${maskPhone(r.recipient_phone)})`}
                  </span>
                  <span className="ml-auto text-xs text-zinc-500">{formatDateTimeKst(r.created_at)}</span>
                </div>
                {r.claim_id && <p className="mt-1 text-xs text-zinc-500">결의서: {r.claim_title}</p>}
                {r.error_message && <p className="mt-1 text-xs text-red-700">실패 사유: {r.error_message}</p>}
                {r.status === "failed" && <ResendButton logId={r.id} />}
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs text-zinc-500">보낸 내용 보기</summary>
                  <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-zinc-50 p-3 font-sans text-xs text-zinc-700">{payload.text}</pre>
                  {payload.button_label && (
                    <p className="mt-1 break-all text-xs text-zinc-500">
                      [{payload.button_label}] {payload.button_url}
                    </p>
                  )}
                </details>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
