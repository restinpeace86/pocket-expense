export function SignOutButton({ className }: { className?: string }) {
  return (
    <form action="/auth/signout" method="post">
      <button type="submit" className={className ?? "text-sm text-zinc-500 underline underline-offset-2 hover:text-zinc-700"}>
        로그아웃
      </button>
    </form>
  );
}
