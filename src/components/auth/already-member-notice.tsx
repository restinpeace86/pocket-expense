import Link from "next/link";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { buttonPrimary, buttonSecondary, Card } from "@/components/ui/page-shell";
import { workspaceHome, type Membership } from "@/lib/auth/paths";

// 이미 회사에 소속된 계정으로 다른 회사 초대 링크를 열었을 때(7-15, D-004 한 계정 = 한 회사).
// 말없이 내 회사로 보내면 합류된 줄 알 수 있어서, 왜 안 되는지와 할 일을 알려 준다.
export function AlreadyMemberNotice({ membership, invitedCompany }: { membership: Membership; invitedCompany: string }) {
  return (
    <>
      <div className="pt-8 text-center">
        <p className="text-sm text-zinc-500">경비 정산 초대</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">{invitedCompany}</h1>
      </div>
      <Card>
        <div role="alert" className="flex flex-col gap-2 break-keep text-zinc-700">
          <p className="font-semibold text-zinc-900">이미 다른 회사에 소속된 계정이에요</p>
          <p>
            지금 계정은 <b>{membership.company_name}</b>에 소속되어 있어요. 한 계정은 한 회사에만 속할 수 있어서 이 계정으로는 {invitedCompany}에 합류할 수 없어요.
          </p>
          <p className="text-sm text-zinc-500">다른 카카오·Google 계정으로 합류하려면 로그아웃한 뒤 이 초대 링크를 다시 열어 주세요.</p>
        </div>
        <div className="mt-5 flex flex-col gap-2">
          <Link href={workspaceHome(membership)} className={buttonPrimary}>
            {membership.company_name}(으)로 가기
          </Link>
          <SignOutButton className={buttonSecondary} />
        </div>
      </Card>
    </>
  );
}
