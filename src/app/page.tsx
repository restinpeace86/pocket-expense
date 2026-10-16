// T0 스캐폴딩용 임시 홈. 실제 랜딩 페이지는 T2-0(spec/screens/landing-page.md)에서 구현한다.
export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-3 px-4 py-24 text-center">
      <h1 className="text-3xl font-semibold tracking-tight">PocketExpense</h1>
      <p className="text-base text-zinc-600 dark:text-zinc-400">
        소기업·스타트업을 위한 가장 가벼운 AI 경비 정산
      </p>
    </main>
  );
}
