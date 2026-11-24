import Link from "next/link";

// [계정 삭제] 들어가는 길(D-314) — 내 정보·세무사무소·가입 화면 아래에 작게
export function DeleteAccountLink() {
  return (
    <div className="text-center">
      <Link href="/account/delete" prefetch={false} className="inline-flex min-h-11 items-center px-1 text-sm text-zinc-500 underline underline-offset-2 hover:text-zinc-700" data-account-delete-link>
        계정 삭제
      </Link>
    </div>
  );
}
