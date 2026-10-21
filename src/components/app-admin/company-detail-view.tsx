import Link from "next/link";
import type { getCompanyDetail } from "@/lib/app-admin/queries";
import { CLAIM_STATUS_LABEL, formatBizNo, formatKst, LEDGER_REASON_LABEL, MEMBER_STATUS_LABEL, PARSE_STATUS_LABEL, ROLE_LABEL } from "@/lib/app-admin/labels";
import { MonthNav, Panel, TableWrap, td, th } from "./app-admin-shell";

export type CompanyDetail = NonNullable<Awaited<ReturnType<typeof getCompanyDetail>>>;

function PhotoState({ r }: { r: CompanyDetail["records"][number] }) {
  if (r.photo_state === "live") return <span className="text-zinc-600">보관 중</span>;
  if (r.photo_state === "purged") return <span className="text-zinc-400">기간 지나 삭제</span>;
  return <span className="text-amber-700">운영 보관함 (~{formatKst(r.photo_purge_after).slice(0, 10)})</span>;
}

// 회사 한 곳: 정보 · 멤버 · 크레딧 지급 내역 · 영수증(크레딧 사용) 한 장씩
export function CompanyDetailView({ data, month, base = "/app-admin" }: { data: CompanyDetail; month: string; base?: string }) {
  const { company, members, ledger, records } = data;
  const deleted = records.filter((r) => r.status === "item_deleted").length;
  return (
    <>
      <div className="flex flex-col gap-1">
        <Link href={`${base}?month=${month}`} className="w-fit text-sm text-zinc-500 hover:underline">
          ← 회사 목록
        </Link>
        <h1 className="text-2xl font-bold">{company.name}</h1>
        <p className="text-sm text-zinc-500">
          사업자번호 {formatBizNo(company.business_number)} · 가입 {formatKst(company.created_at).slice(0, 10)} · 크레딧 지급 {company.receipt_credits_granted} / 사용 {company.receipt_credits_used} / 남음{" "}
          <b className="text-zinc-800">{company.receipt_credits_granted - company.receipt_credits_used}</b>
        </p>
      </div>

      <Panel
        title={`영수증 (크레딧 사용) — ${records.length}장${deleted ? `, 직원이 지움 ${deleted}장` : ""}`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <MonthNav month={month} hrefFor={(m) => `${base}/companies/${company.id}?month=${m}`} />
            <a href={`${base}/companies/${company.id}/export?month=${month}`} className="inline-flex min-h-9 items-center rounded-lg bg-zinc-900 px-3 text-sm font-medium text-white hover:bg-zinc-700">
              CSV 내려받기
            </a>
          </div>
        }
      >
        {records.length === 0 ? (
          <p className="py-6 text-center text-sm text-zinc-500">이 달에 크레딧을 쓴 영수증이 없습니다.</p>
        ) : (
          <TableWrap>
            <table className="w-full min-w-[1100px] border-collapse">
              <thead>
                <tr>
                  <th className={th}>크레딧 사용 시각</th>
                  <th className={th}>직원</th>
                  <th className={th}>가맹점</th>
                  <th className={th}>사용일</th>
                  <th className={`${th} text-right`}>금액</th>
                  <th className={`${th} text-right`}>품목</th>
                  <th className={th}>AI 인식</th>
                  <th className={th}>결의서</th>
                  <th className={th}>상태</th>
                  <th className={th}>사진</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r) => (
                  <tr key={r.id} className={r.status === "item_deleted" ? "bg-red-50/40 hover:bg-red-50" : "hover:bg-zinc-50"}>
                    <td className={`${td} whitespace-nowrap`}>
                      <Link href={`${base}/receipts/${r.id}`} className="text-blue-700 underline-offset-2 hover:underline">
                        {formatKst(r.credited_at)}
                      </Link>
                    </td>
                    <td className={`${td} whitespace-nowrap`}>{r.member_name ?? "-"}</td>
                    <td className={td}>{r.merchant_name ?? <span className="text-zinc-400">-</span>}</td>
                    <td className={`${td} whitespace-nowrap`}>{r.expense_date ?? ""}</td>
                    <td className={`${td} whitespace-nowrap text-right tabular-nums`}>{r.amount !== null ? r.amount.toLocaleString("ko-KR") : ""}</td>
                    <td className={`${td} text-right tabular-nums`}>{r.line_item_count || ""}</td>
                    <td className={`${td} whitespace-nowrap`}>{PARSE_STATUS_LABEL[r.parse_status ?? "none"] ?? r.parse_status}</td>
                    <td className={td}>
                      {r.claim_title || <span className="text-zinc-400">(제목 없음)</span>}
                      <span className="ml-1 text-xs text-zinc-500">{CLAIM_STATUS_LABEL[r.claim_status ?? ""] ?? ""}</span>
                    </td>
                    <td className={`${td} whitespace-nowrap`}>
                      {r.status === "item_deleted" ? <span className="font-medium text-red-700">직원이 지움 {formatKst(r.item_deleted_at)}</span> : "결의서에 있음"}
                    </td>
                    <td className={`${td} whitespace-nowrap text-xs`}>
                      <PhotoState r={r} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
        {data.truncated && <p className="mt-2 text-xs text-amber-700">이 달 영수증이 많아 최근 1,000장만 보여 줍니다. 전체는 CSV로 내려받으세요.</p>}
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title={`멤버 ${members.length}명`}>
          <TableWrap>
            <table className="w-full min-w-[420px] border-collapse">
              <thead>
                <tr>
                  <th className={th}>이름</th>
                  <th className={th}>역할</th>
                  <th className={th}>상태</th>
                  <th className={th}>가입</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.id}>
                    <td className={td}>{m.name}</td>
                    <td className={td}>{ROLE_LABEL[m.role] ?? m.role}</td>
                    <td className={td}>{MEMBER_STATUS_LABEL[m.status] ?? m.status}</td>
                    <td className={`${td} whitespace-nowrap`}>{formatKst(m.created_at).slice(0, 10)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        </Panel>
        <Panel title="크레딧 지급 내역">
          {ledger.length === 0 ? (
            <p className="text-sm text-zinc-500">지급 내역이 없습니다.</p>
          ) : (
            <TableWrap>
              <table className="w-full min-w-[360px] border-collapse">
                <thead>
                  <tr>
                    <th className={th}>시각</th>
                    <th className={th}>내용</th>
                    <th className={`${th} text-right`}>장수</th>
                  </tr>
                </thead>
                <tbody>
                  {ledger.map((l) => (
                    <tr key={l.id}>
                      <td className={`${td} whitespace-nowrap`}>{formatKst(l.created_at)}</td>
                      <td className={td}>{LEDGER_REASON_LABEL[l.reason] ?? l.reason}</td>
                      <td className={`${td} text-right tabular-nums`}>{l.delta > 0 ? `+${l.delta}` : l.delta}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          )}
          <p className="mt-2 text-xs text-zinc-500">영수증 1장 차감은 위 영수증 표에 한 줄씩 있습니다.</p>
        </Panel>
      </div>
    </>
  );
}
