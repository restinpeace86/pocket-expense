import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ProfileForm } from "@/components/employee/profile-form";
import { requireWorkspace } from "@/lib/auth/guards";
import { getMyProfile } from "@/lib/employee/profile";

export const metadata = { title: "내 정보 · PocketExpense" };

// 직원 [내 정보] (employee-mobile.md ⑤)
export default function ProfilePage({ params }: PageProps<"/workspace/[id]/employee/profile">) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 pb-6 pt-5">
      <h1 className="text-xl font-bold tracking-tight">내 정보</h1>
      <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-zinc-100" />}>
        <Profile params={params} />
      </Suspense>
    </main>
  );
}

async function Profile({ params }: { params: PageProps<"/workspace/[id]/employee/profile">["params"] }) {
  const { id } = await params;
  const membership = await requireWorkspace(id);
  const profile = await getMyProfile(membership.member_id);
  if (!profile) notFound();
  return <ProfileForm profile={profile} />;
}
