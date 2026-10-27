import { Star } from "lucide-react";
import { cacheLife, cacheTag } from "next/cache";
import { authorLabel } from "@/lib/feedback-survey";
import { createAdminClient } from "@/lib/supabase/admin";

// 랜딩 "실제 사용자 후기" (7차 개선사항 7, D-130)
// 홈페이지 소개에 동의했고 운영자가 숨기지 않은 한 줄 후기만, 작성자는 규모·업종·직무로만(회사명·이름 없음).
// 공개 데이터지만 표에 anon 권한을 주지 않고 서버가 service role로 익명 칸만 읽는다(읽기 전용). 후기가 없으면 섹션을 숨긴다 — 지어낸 후기는 넣지 않는다.
export type TestimonialRow = { id: string; rating: number; review: string; industry: string; company_size: string; job_role: string };

async function loadTestimonials(): Promise<TestimonialRow[]> {
  "use cache";
  cacheTag("testimonials");
  cacheLife("hours");
  const admin = createAdminClient();
  if (!admin) return [];
  try {
    const { data } = await admin
      .from("feedback_surveys")
      .select("id, rating, review, industry, company_size, job_role")
      .eq("display_consent", true)
      .eq("is_displayed", true)
      .not("review", "is", null)
      .order("created_at", { ascending: false })
      .limit(6);
    return (data ?? []).filter((r): r is TestimonialRow => !!r.review);
  } catch {
    return [];
  }
}

export async function Testimonials() {
  const rows = await loadTestimonials();
  return <TestimonialsView rows={rows} />;
}

export function TestimonialsView({ rows }: { rows: TestimonialRow[] }) {
  if (!rows.length) return null;
  return (
    <section className="mx-auto max-w-5xl px-4 py-16" aria-labelledby="reviews-title">
      <h2 id="reviews-title" className="text-balance text-center text-3xl font-bold tracking-tight">
        실제 사용자 후기
      </h2>
      <p className="mt-2 text-center text-sm text-zinc-400">PocketExpense를 쓰는 회사 담당자들이 직접 남긴 한 줄 후기예요.</p>
      <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((r) => (
          <li key={r.id} className="flex flex-col rounded-2xl border border-white/10 bg-white/5 p-5">
            <p className="flex gap-0.5" aria-label={`별점 ${r.rating}점`}>
              {[1, 2, 3, 4, 5].map((n) => (
                <Star key={n} className={`size-4 ${n <= r.rating ? "fill-amber-400 text-amber-400" : "text-zinc-600"}`} />
              ))}
            </p>
            <p className="mt-3 flex-1 break-keep leading-relaxed text-zinc-100">&ldquo;{r.review}&rdquo;</p>
            <p className="mt-4 text-sm text-zinc-400">— {authorLabel(r)}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
