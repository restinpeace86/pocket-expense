import { FileSpreadsheet, FolderArchive, Landmark, MessageSquareMore, ReceiptText, Tags } from "lucide-react";
import Link from "next/link";
import { Card, PageShell } from "@/components/ui/page-shell";

// 세무사무소 소개 (D-173): 알림톡·안내 링크로 처음 들어온 세무사가 이점을 보고 시작하게. 무료
const BENEFITS = [
  { icon: FolderArchive, title: "한 달 자료를 한 번에", body: "승인된 지출 장부(엑셀)·영수증 원본·지출결의서 PDF·홈택스 자료·송금 확인증을 증빙 묶음(ZIP) 하나로 받아요." },
  { icon: FileSpreadsheet, title: "우리 사무소 양식 그대로", body: "회계 프로그램 업로드 양식(.xlsx·.xls)을 올려 두면 고객사 자료를 그 양식에 채워 줘요." },
  { icon: ReceiptText, title: "확인할 곳을 먼저 표시", body: "사업자번호 없음·부가세 미구분·증빙 없음·카드 내역 대조 결과가 영수증마다 표시돼요." },
  { icon: Tags, title: "계정과목은 사무소 기준", body: "사무소 기본 계정과목이 모든 고객사에 적용되고, 영수증별 조정도 사무소가 해요." },
  { icon: MessageSquareMore, title: "자료 요청도 여기서", body: "부족한 자료는 영수증을 골라 고객사에 요청하고, 답변이 오면 알림을 받아요." },
  { icon: Landmark, title: "세무사무소는 무료", body: "사무소 등록·소속 세무사·고객사 관리 모두 요금이 없어요. 고객사 회사 계정과는 따로예요." },
];

export function OfficeIntro({
  companyName,
  officeName,
  agentName,
  startHref,
  invalid = false,
}: {
  companyName?: string;
  officeName?: string;
  agentName?: string | null;
  startHref: string;
  invalid?: boolean;
}) {
  return (
    <PageShell>
      <div className="flex flex-col gap-2 pt-8">
        <p className="flex items-center gap-1.5 text-sm font-medium text-brand-700">
          <Landmark className="size-4" aria-hidden />
          PocketExpense 세무사무소
        </p>
        <h1 className="text-balance break-keep text-2xl font-bold tracking-tight">
          {companyName ? `${companyName}의 세무 자료가 정리돼 있어요` : "고객사 지출 자료를 정리된 채로 받으세요"}
        </h1>
        <p className="break-keep text-zinc-600">
          {companyName
            ? `${agentName ? `${agentName}님, ` : ""}고객사 ${companyName}이(가) PocketExpense로 지출·증빙을 관리하고, ${officeName ?? "세무사무소"}을(를) 세무대행 사무소로 지정했어요. 아래 버튼으로 시작하면 바로 이 고객사와 연결돼요.`
            : "고객사가 PocketExpense로 영수증·지출결의서를 관리하면, 세무사무소는 승인된 자료를 매달 한곳에서 받아요."}
        </p>
        {invalid && (
          <p role="alert" className="break-keep rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
            이 연결 링크는 맞지 않거나 바뀌었어요. 고객사에 새 링크를 요청하거나, 아래에서 세무사무소로 시작한 뒤 고객사가 사무소 이메일을 지정하면 연결돼요.
          </p>
        )}
      </div>
      <Card>
        <ul className="flex flex-col gap-4">
          {BENEFITS.map(({ icon: Icon, title, body }) => (
            <li key={title} className="flex gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                <Icon className="size-5" aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="block font-semibold text-zinc-900">{title}</span>
                <span className="block break-keep text-sm text-zinc-600">{body}</span>
              </span>
            </li>
          ))}
        </ul>
      </Card>
      <Link href={startHref} className="inline-flex min-h-12 items-center justify-center rounded-xl bg-brand-600 px-5 font-semibold text-white hover:bg-brand-700">
        세무사무소로 시작하기 (무료)
      </Link>
      <p className="text-center text-xs text-zinc-500">카카오 또는 Google 계정으로 로그인해요. 이미 세무사무소가 있으면 로그인만 하면 돼요.</p>
    </PageShell>
  );
}
