import { notFound } from "next/navigation";
import { Suspense } from "react";
import { VaultView, type VaultRoom } from "@/components/vault/vault-view";
import { isAdminRole } from "@/lib/auth/paths";
import { requireWorkspace } from "@/lib/auth/guards";
import { chatEnabled } from "@/lib/chat/server";
import { createClient } from "@/lib/supabase/server";
import type { VaultFile, VaultStatus } from "@/lib/vault/format";
import { BRAND } from "@/lib/brand";

export const metadata = { title: `파일 보관함 · ${BRAND.name}` };

// 파일 보관함(D-245, spec/features/file-vault.md): 채팅에서 [영구 보관]한 파일 — 회사 공유 / 나만 보기
export default function VaultPage({ params }: PageProps<"/workspace/[id]/employee/vault">) {
  return (
    <Suspense fallback={<div className="mx-auto my-4 h-96 w-[calc(100%-2rem)] max-w-md animate-pulse rounded-2xl bg-zinc-100" />}>
      <Content params={params} />
    </Suspense>
  );
}

async function Content({ params }: Pick<PageProps<"/workspace/[id]/employee/vault">, "params">) {
  const { id } = await params;
  const membership = await requireWorkspace(id);
  const supabase = await createClient();
  const cols = "id, owner_member_id, scope, name, kind, mime, size, thumb_size, path, thumb_path, source_room_id, source_message_id, created_at, deleted_at";
  const [files, trashRows, status, enabled] = await Promise.all([
    supabase.from("vault_files").select(cols).is("deleted_at", null).order("created_at", { ascending: false }),
    // 휴지통(D-266): RLS가 내가 복구할 수 있는 것만 준다(내 파일 + 관리자는 회사 공유)
    supabase.from("vault_files").select(cols).not("deleted_at", "is", null).order("deleted_at", { ascending: false }),
    supabase.rpc("vault_status"),
    chatEnabled(),
  ]);
  const list = (files.data ?? []) as VaultFile[];
  const trash = (trashRows.data ?? []) as VaultFile[];
  // 채팅을 쓰지 않고 보관한 파일도 없으면 화면이 필요 없음
  if (!enabled && list.length === 0 && trash.length === 0) notFound();
  const owners = [...new Set([...list, ...trash].map((f) => f.owner_member_id))];
  const roomIds = [...new Set(list.map((f) => f.source_room_id).filter((x): x is string => !!x))];
  const [people, rooms] = await Promise.all([
    owners.length ? supabase.from("members").select("id, name, status").in("id", owners) : Promise.resolve({ data: [] as { id: string; name: string; status: string }[] }),
    roomIds.length ? supabase.from("chat_rooms").select("id, kind, title").in("id", roomIds) : Promise.resolve({ data: [] as VaultRoom[] }),
  ]);
  return (
    <VaultView
      ws={`/workspace/${id}`}
      me={membership.member_id}
      admin={isAdminRole(membership.role)}
      files={list}
      trash={trash}
      status={(status.data as unknown as VaultStatus) ?? { used: 0, limit: 0, company_count: 0, mine_private: 0 }}
      people={Object.fromEntries((people.data ?? []).map((p) => [p.id, p.status === "inactive" ? `${p.name}(퇴사)` : p.name]))}
      rooms={Object.fromEntries(((rooms.data ?? []) as VaultRoom[]).map((r) => [r.id, r]))}
    />
  );
}
