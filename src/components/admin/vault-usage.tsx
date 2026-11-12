import { UsageBar } from "@/components/vault/usage-bar";
import { bytesLabel } from "@/lib/chat/format";
import { usagePct } from "@/lib/vault/format";

export type VaultUsage = {
  used: number;
  limit: number;
  members: { member_id: string; name: string; status: string; company_count: number; company_bytes: number; private_count: number; private_bytes: number; total: number; private_delete_at: string | null }[];
};

const day = (iso: string) => new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "long", day: "numeric" }).format(new Date(iso));

// 관리자 [파일 보관] › 영구 보관함(D-245, 시안 ⑥): 회사 사용량 + 직원별 개수·용량(나만 보기 파일 이름·내용은 보이지 않음)
export function VaultUsageCard({ usage }: { usage: VaultUsage }) {
  return (
    <section aria-labelledby="vault-usage-title" className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-4 md:p-5" data-vault-usage>
      <h2 id="vault-usage-title" className="text-lg font-bold">
        영구 보관함
      </h2>
      <div>
        <div className="mb-1.5 flex justify-between text-sm text-zinc-600">
          <span>사용량</span>
          <span>
            <b className="text-zinc-900">{bytesLabel(usage.used)}</b> / {bytesLabel(usage.limit)} ({usagePct(usage.used, usage.limit)}%)
          </span>
        </div>
        <UsageBar used={usage.used} limit={usage.limit} />
      </div>
      <p className="text-sm leading-relaxed text-zinc-600">
        직원이 채팅에서 [영구 보관]한 파일이에요. <b>자동으로 지워지지 않아요.</b> 70%·90%가 차면 [알림]방으로 알려 드려요. 다 차면 새로 보관만 막히고 채팅은 그대로 써요.
      </p>
      <h3 className="mt-1 text-[15px] font-bold">사람별 사용량</h3>
      <p className="text-[13px] leading-relaxed text-zinc-600">
        &lsquo;나만 보기&rsquo; 파일은 이름·내용을 볼 수 없어요. 공간이 부족하면 많이 쓰는 직원에게 정리를 부탁해 주세요. 회사 공유 파일은 [파일 보관함]에서 관리자도 지울 수 있어요. 퇴사 처리한 직원의 &lsquo;나만 보기&rsquo; 파일은 30일 뒤 지워져요.
      </p>
      {usage.members.length === 0 ? (
        <p className="rounded-xl border border-dashed border-zinc-300 px-4 py-6 text-center text-sm text-zinc-500">아직 보관한 파일이 없어요.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-sm" data-vault-members>
            <thead>
              <tr className="border-b border-zinc-200 text-left text-xs text-zinc-600">
                <th className="py-2 pr-3 font-semibold">직원</th>
                <th className="py-2 pr-3 font-semibold">회사 공유</th>
                <th className="py-2 pr-3 font-semibold">나만 보기</th>
                <th className="py-2 font-semibold">합계</th>
              </tr>
            </thead>
            <tbody>
              {usage.members.map((m) => (
                <tr key={m.member_id} className="border-b border-zinc-100 last:border-b-0">
                  <td className="py-2.5 pr-3">
                    {m.name}
                    {m.status === "inactive" && <span className="text-zinc-500">(퇴사)</span>}
                    {m.private_delete_at && m.private_count > 0 && <span className="block text-xs text-red-700">나만 보기 {day(m.private_delete_at)} 삭제 예정</span>}
                  </td>
                  <td className="py-2.5 pr-3">
                    {m.company_count}개 · {bytesLabel(m.company_bytes)}
                  </td>
                  <td className="py-2.5 pr-3">
                    {m.private_count}개{m.private_count > 0 && ` · ${bytesLabel(m.private_bytes)}`}
                  </td>
                  <td className="py-2.5 font-semibold">{bytesLabel(m.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
