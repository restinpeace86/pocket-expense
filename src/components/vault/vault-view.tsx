"use client";

import { ArrowUpRight, ChevronLeft, Download, Eye, Loader2, Lock, MoreVertical, Search, Trash2, Users, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { deleteVaultFileAction, setVaultScopeAction } from "@/app/workspace/[id]/employee/vault/actions";
import { signedUrls } from "@/components/chat/signed-urls";
import { bytesLabel, fileSizeLabel } from "@/lib/chat/format";
import { createClient } from "@/lib/supabase/client";
import { fileBadge, filterVault, VAULT_BUCKET, VAULT_CACHE, type VaultFile, type VaultScope, type VaultStatus } from "@/lib/vault/format";
import { UsageBar } from "./usage-bar";

export type VaultRoom = { id: string; kind: string; title: string | null };

const dateLabel = (iso: string) => new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "long", day: "numeric" }).format(new Date(iso));
const roomLabel = (r: VaultRoom | undefined) => (!r ? null : r.kind === "direct" ? "1:1 대화" : r.kind === "claim" ? (r.title ?? "결의서 방") : (r.title ?? "단체방"));
const cacheKey = (id: string) => `/vault-cache/${id}`;

// 한 번 받은 보관 파일은 기기(Cache Storage)에 두고 다시 열 때 서버에 가지 않는다(D-245 트래픽 안전장치). 로그아웃하면 지움
async function getBlob(supabase: ReturnType<typeof createClient>, f: VaultFile): Promise<Blob> {
  let cache: Cache | null = null;
  try {
    cache = await caches.open(VAULT_CACHE);
    const hit = await cache.match(cacheKey(f.id));
    if (hit) return await hit.blob();
  } catch {}
  const { data, error } = await supabase.storage.from(VAULT_BUCKET).createSignedUrl(f.path, 60);
  if (error || !data) throw new Error("NOT_FOUND");
  const res = await fetch(data.signedUrl);
  if (!res.ok) throw new Error("NOT_FOUND");
  const blob = await res.blob();
  try {
    await cache?.put(cacheKey(f.id), new Response(blob, { headers: { "Content-Type": f.mime ?? blob.type ?? "application/octet-stream" } }));
  } catch {}
  return blob;
}

export function VaultView({
  ws,
  me,
  admin,
  files,
  status,
  people,
  rooms,
}: {
  ws: string;
  me: string;
  admin: boolean;
  files: VaultFile[];
  status: VaultStatus;
  people: Record<string, string>;
  rooms: Record<string, VaultRoom>;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [tab, setTab] = useState<VaultScope>("company");
  const [query, setQuery] = useState("");
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [menu, setMenu] = useState<VaultFile | null>(null);
  const [viewer, setViewer] = useState<{ name: string; url: string } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const who = (id: string) => people[id] ?? "알 수 없음";
  const shown = filterVault(files, tab, query, who);
  const counts = { company: files.filter((f) => f.scope === "company").length, private: files.filter((f) => f.scope === "private").length };

  // 사진 미리보기(480px)만 받는다 — 원본은 열 때만
  useEffect(() => {
    const paths = files.map((f) => f.thumb_path).filter((p): p is string => !!p);
    if (paths.length) void signedUrls(supabase, VAULT_BUCKET, paths).then(setThumbs);
  }, [files, supabase]);
  // 기기에 저장한 파일 중 이제 볼 수 없는 것(지워짐·나만 보기로 바뀜)은 지운다
  useEffect(() => {
    const ok = new Set(files.map((f) => cacheKey(f.id)));
    void (async () => {
      try {
        const cache = await caches.open(VAULT_CACHE);
        for (const req of await cache.keys()) if (!ok.has(new URL(req.url).pathname)) await cache.delete(req);
      } catch {}
    })();
  }, [files]);

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-3 px-4 pb-28 pt-3 md:max-w-3xl md:px-6 md:pt-6">
      <div className="flex items-center gap-1">
        <Link href={`${ws}/employee`} aria-label="홈으로" className="flex size-10 items-center justify-center rounded-lg text-zinc-700 hover:bg-zinc-100">
          <ChevronLeft className="size-6" />
        </Link>
        <h1 className="text-xl font-bold md:text-2xl">파일 보관함</h1>
      </div>
      <div role="tablist" aria-label="보관 범위" className="grid grid-cols-2 rounded-xl bg-zinc-200 p-1">
        {(
          [
            ["company", "회사 공유", Users],
            ["private", "나만 보기", Lock],
          ] as const
        ).map(([v, label, Icon]) => (
          <button key={v} type="button" role="tab" aria-selected={tab === v} onClick={() => setTab(v)} className={`flex h-10 items-center justify-center gap-1.5 rounded-lg text-sm ${tab === v ? "bg-white font-bold shadow-sm" : "text-zinc-600"}`} data-tab={v}>
            <Icon className="size-4" aria-hidden /> {label} <span className={tab === v ? "text-brand-700" : ""}>{counts[v]}</span>
          </button>
        ))}
      </div>
      <label className="flex h-11 items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3">
        <Search className="size-4 text-zinc-500" aria-hidden />
        <span className="sr-only">파일 검색</span>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="파일 이름·보관한 사람 검색" className="min-w-0 flex-1 bg-transparent text-base outline-none md:text-sm" />
      </label>
      {shown.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-zinc-300 bg-white px-4 py-8 text-center text-sm leading-relaxed text-zinc-600" data-vault-empty>
          {query ? "찾는 파일이 없어요." : tab === "company" ? "회사에 공유된 보관 파일이 없어요." : "나만 보기로 보관한 파일이 없어요."}
          <span className="mt-1 block text-[13px]">채팅의 사진·파일을 길게 누르거나 오른쪽 클릭 → [영구 보관]</span>
        </p>
      ) : (
        <ul aria-label={tab === "company" ? "회사 공유 파일" : "나만 보기 파일"} className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
          {shown.map((f) => (
            <li key={f.id} className="flex items-center gap-3 border-b border-zinc-100 px-3.5 py-3 last:border-b-0" data-vault-file={f.name}>
              {f.thumb_path && thumbs[f.thumb_path] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={thumbs[f.thumb_path]} alt="" className="size-11 shrink-0 rounded-lg object-cover" />
              ) : (
                <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-[11px] font-bold text-zinc-700">{fileBadge(f.name, f.kind)}</span>
              )}
              <button type="button" onClick={() => setMenu(f)} className="min-w-0 flex-1 text-left">
                <b className="block truncate text-sm">{f.name}</b>
                <span className="block truncate text-xs text-zinc-600">
                  {fileSizeLabel(f.size)} · {who(f.owner_member_id)} · {dateLabel(f.created_at)}
                  {roomLabel(f.source_room_id ? rooms[f.source_room_id] : undefined) && ` · ${roomLabel(rooms[f.source_room_id!])}`}
                </span>
              </button>
              <button type="button" onClick={() => setMenu(f)} aria-label={`${f.name} 메뉴`} className="flex size-10 shrink-0 items-center justify-center rounded-lg text-zinc-600 hover:bg-zinc-100" data-file-menu>
                <MoreVertical className="size-5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <section aria-label="회사 보관 공간" className="rounded-2xl border border-zinc-200 bg-white px-4 py-3">
        <div className="mb-1.5 flex justify-between text-[13px] text-zinc-600">
          <span>회사 보관 공간</span>
          <span>
            <b className="text-zinc-900">{bytesLabel(status.used)}</b> / {bytesLabel(status.limit)}
          </span>
        </div>
        <UsageBar used={status.used} limit={status.limit} />
        <p className="mt-2 text-xs leading-relaxed text-zinc-600">채팅의 사진·파일을 길게 누르거나 오른쪽 클릭 → [영구 보관]으로 여기 남겨요. 보관한 파일은 자동으로 지워지지 않아요. 사진은 미리보기만 보여 주고, 열 때 원본을 받아요.</p>
      </section>
      {notice && (
        <div role="status" className="fixed inset-x-4 bottom-24 z-40 mx-auto flex max-w-md items-center gap-2 rounded-xl bg-zinc-800 px-3 py-2 text-sm text-white shadow">
          <span className="flex-1">{notice}</span>
          <button type="button" onClick={() => setNotice(null)} aria-label="닫기">
            <X className="size-4" />
          </button>
        </div>
      )}
      {menu && (
        <FileMenu
          f={menu}
          ws={ws}
          mine={menu.owner_member_id === me}
          canDelete={menu.owner_member_id === me || (admin && menu.scope === "company")}
          owner={who(menu.owner_member_id)}
          room={menu.source_room_id ? rooms[menu.source_room_id] : undefined}
          supabase={supabase}
          onClose={() => setMenu(null)}
          onView={(v) => setViewer(v)}
          onDone={(msg) => {
            setMenu(null);
            setNotice(msg);
          }}
        />
      )}
      {viewer && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/90" role="dialog" aria-modal aria-label="사진 보기" onClick={() => setViewer(null)}>
          <div className="flex items-center gap-2 p-3 text-white">
            <span className="min-w-0 flex-1 truncate text-sm">{viewer.name}</span>
            <button type="button" aria-label="닫기" onClick={() => setViewer(null)} className="flex size-10 items-center justify-center">
              <X className="size-6" />
            </button>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={viewer.url} alt={viewer.name} className="min-h-0 flex-1 object-contain" data-vault-viewer />
        </div>
      )}
    </main>
  );
}

function FileMenu({
  f,
  ws,
  mine,
  canDelete,
  owner,
  room,
  supabase,
  onClose,
  onView,
  onDone,
}: {
  f: VaultFile;
  ws: string;
  mine: boolean;
  canDelete: boolean;
  owner: string;
  room: VaultRoom | undefined;
  supabase: ReturnType<typeof createClient>;
  onClose: () => void;
  onView: (v: { name: string; url: string }) => void;
  onDone: (msg: string) => void;
}) {
  const [busy, start] = useTransition();
  const [loading, setLoading] = useState<"open" | "download" | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const open = async () => {
    setError(null);
    // PDF 등은 새 창을 먼저 열어 둔다(받은 뒤 열면 팝업 차단)
    const win = f.kind === "image" ? null : window.open("", "_blank");
    setLoading("open");
    try {
      const url = URL.createObjectURL(await getBlob(supabase, f));
      if (f.kind === "image") {
        onClose();
        onView({ name: f.name, url });
      } else if (win) win.location.href = url;
      else window.location.href = url;
    } catch {
      win?.close();
      setError("파일을 열지 못했어요.");
    } finally {
      setLoading(null);
    }
  };
  const download = async () => {
    setError(null);
    setLoading("download");
    try {
      const url = URL.createObjectURL(await getBlob(supabase, f));
      const a = document.createElement("a");
      a.href = url;
      a.download = f.name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
    } catch {
      setError("파일을 받지 못했어요.");
    } finally {
      setLoading(null);
    }
  };
  const toggleScope = () =>
    start(async () => {
      const next: VaultScope = f.scope === "company" ? "private" : "company";
      const r = await setVaultScopeAction(f.id, next);
      if (!r.ok) return setError(r.error ?? "바꾸지 못했어요.");
      onDone(next === "company" ? "회사 공유로 바꿨어요." : "나만 보기로 바꿨어요.");
    });
  const remove = () =>
    start(async () => {
      const r = await deleteVaultFileAction(f.id);
      if (!r.ok) return setError(r.error);
      try {
        await (await caches.open(VAULT_CACHE)).delete(cacheKey(f.id));
      } catch {}
      onDone("보관함에서 지웠어요.");
    });
  const item = "flex min-h-13 w-full items-center gap-3 px-4 py-2.5 text-left text-[15px] hover:bg-zinc-50 disabled:opacity-60";
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 md:items-center" onClick={onClose}>
      <section role="dialog" aria-modal="true" aria-labelledby="vault-file-title" onClick={(e) => e.stopPropagation()} className="w-full max-w-md overflow-hidden rounded-t-3xl bg-white pb-[env(safe-area-inset-bottom)] md:rounded-3xl" data-vault-menu>
        <div className="flex items-center gap-3 border-b border-zinc-100 px-4 pb-3 pt-4">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-[11px] font-bold text-zinc-700">{fileBadge(f.name, f.kind)}</span>
          <span className="min-w-0 flex-1">
            <h2 id="vault-file-title" className="truncate text-[15px] font-bold">
              {f.name}
            </h2>
            <span className="text-xs text-zinc-600">
              {fileSizeLabel(f.size)} · 보관: {owner}({dateLabel(f.created_at)}) · <b className="text-brand-700">{f.scope === "company" ? "회사 공유" : "나만 보기"}</b>
            </span>
          </span>
        </div>
        {confirmDelete ? (
          <div className="flex flex-col gap-3 p-4" data-delete-confirm>
            <p className="text-[15px] leading-relaxed">
              <b>{f.name}</b>을(를) 보관함에서 지울까요? 지우면 되돌릴 수 없어요. 채팅의 원본은 보관 기간까지는 그대로 있어요.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setConfirmDelete(false)} className="h-12 rounded-xl border border-zinc-300 font-semibold">
                취소
              </button>
              <button type="button" onClick={remove} disabled={busy} className="flex h-12 items-center justify-center gap-1.5 rounded-xl bg-red-600 font-semibold text-white disabled:opacity-70" data-delete-yes>
                {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
                지우기
              </button>
            </div>
          </div>
        ) : (
          <>
            <button type="button" onClick={() => void open()} disabled={!!loading} className={item} data-vault-open>
              {loading === "open" ? <Loader2 className="size-4 animate-spin" /> : <Eye className="size-4" />}
              <span className="flex-1">
                열기<span className="block text-xs text-zinc-600">한 번 연 파일은 이 기기에 저장돼 다음엔 바로 열려요</span>
              </span>
            </button>
            <button type="button" onClick={() => void download()} disabled={!!loading} className={item} data-vault-download>
              {loading === "download" ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
              받기
            </button>
            {mine && (
              <button type="button" onClick={toggleScope} disabled={busy} className={item} data-vault-scope>
                {f.scope === "company" ? <Lock className="size-4" /> : <Users className="size-4" />}
                <span className="flex-1">
                  {f.scope === "company" ? "나만 보기로 바꾸기" : "회사 공유로 바꾸기"}
                  <span className="block text-xs text-zinc-600">{f.scope === "company" ? "보관한 사람만 보여요" : "우리 회사 직원 모두가 볼 수 있어요"}</span>
                </span>
              </button>
            )}
            {room && f.source_room_id && (
              <Link href={`${ws}/chat/${f.source_room_id}`} className={item}>
                <ArrowUpRight className="size-4" />
                올라온 채팅으로 가기
              </Link>
            )}
            {canDelete && (
              <button type="button" onClick={() => setConfirmDelete(true)} className={`${item} text-red-700`} data-vault-delete>
                <Trash2 className="size-4" />
                <span className="flex-1">
                  보관함에서 지우기<span className="block text-xs text-zinc-600">{mine ? "채팅의 원본은 그대로예요(기간 지나면 지워짐)" : "관리자로 지워요 · 회사 공유 파일"}</span>
                </span>
              </button>
            )}
            {error && (
              <p role="alert" className="px-4 pb-2 text-sm font-semibold text-red-700">
                {error}
              </p>
            )}
            <button type="button" onClick={onClose} className="flex min-h-12 w-full items-center justify-center border-t border-zinc-100 text-zinc-600 hover:bg-zinc-50">
              닫기
            </button>
          </>
        )}
      </section>
    </div>
  );
}
