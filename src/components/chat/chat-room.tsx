"use client";

import { AlarmClock, Archive, ArrowDown, ArrowLeft, Bell, CheckCheck, ChevronLeft, Copy, Download, FileSpreadsheet, FileStack, FileText, ImageOff, ImagePlus, ListChecks, Loader2, Lock, LogOut, MapPin, Menu, MessagesSquare, Paperclip, Pencil, RotateCw, SendHorizontal, Trash2, UserPlus, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { pushChatMessageAction } from "@/app/workspace/[id]/chat/actions";
import { isAdminRole } from "@/lib/auth/paths";
import { assistantLinkLabel, buildRows, noticeCard, CHAT_BODY_MAX, CHAT_FILE_MAX, displayName, fileSizeLabel, mergeMessages, previewText, READ_LIST_KINDS, readersFor, roomTitle, timeLabel, unreadCountFor, type ChatKind, type ChatMember, type ChatMessage, type ChatThread, meetingNoticeCard } from "@/lib/chat/format";
import { applyThreadMessage, canStartThread, OPEN_THREAD_EVENT, THREAD_KINDS, THREAD_READ_EVENT } from "@/lib/chat/threads";
import { ThreadCard, ThreadCloseSheet, ThreadCreateSheet, ThreadList } from "./thread-ui";
import { formatWon } from "@/lib/format";
import { processChatImage } from "@/lib/receipts/image";
import { LogoMark } from "@/components/brand/logo";
import { Avatar } from "./avatar";
import { useChat } from "./chat-app";
import { ChatOverlay } from "./overlay";
import { KeepSheet } from "@/components/vault/keep-sheet";
import { ConvertSheet } from "@/components/doc-convert/convert-sheet";
import { ChatFormSheet } from "@/components/company-forms/chat-form-sheet";
import { convertChatFileAction } from "@/app/workspace/[id]/employee/convert/actions";
import { isConvertible } from "@/lib/doc-convert/model";
import { MemberPicker } from "./member-picker";
import { signedUrls } from "./signed-urls";
import { closeNativeNotifications } from "@/components/push/native";
import { BRAND } from "@/lib/brand";

type Detail = {
  id: string;
  kind: ChatKind;
  title: string | null;
  claim_id: string | null;
  claim: { id: string; title: string; status: string; total_amount: number; member_id: string } | null;
  members: ChatMember[];
};
const BUCKET = "chat-files";
// 말풍선에 쓸 파일: 미리보기가 있으면 미리보기, 예전 사진은 원본
const thumbOf = (m: ChatMessage) => m.attachment_thumb_path ?? m.attachment_path;
const PAGE = 50;

// 대화방(카톡 대화창): 날짜 구분선, 내 말풍선은 오른쪽 노랑, 상대는 왼쪽 흰색 + 이름·프로필,
// 말풍선 옆 숫자 = 아직 안 읽은 사람 수, 같은 사람·같은 분은 묶어서 시각을 마지막에만
// thread: 서브 대화 모드(D-246) — 같은 대화창을 서브 대화 글만 보이게(서랍·시트 안)
type ThreadMode = { id: string; onBack: () => void; onClose: () => void };
type ThreadDetail = ChatThread & { root: ChatMessage | null; can_manage: boolean };
type ThreadUi = { mode: "list" } | { mode: "thread"; id: string };

export function ChatRoom({ roomId, thread }: { roomId: string; thread?: ThreadMode }) {
  const { membership, supabase, useEvents } = useChat();
  const tid = thread?.id ?? null;
  const [tinfo, setTinfo] = useState<ThreadDetail | null>(null); // 서브 대화 모드: 제목·상태·원래 메시지
  const [threadUi, setThreadUi] = useState<ThreadUi | null>(null); // 메인 모드: 오른쪽 서랍(휴대폰은 시트)
  const [creating, setCreating] = useState<ChatMessage | null>(null);
  const [closing, setClosing] = useState(false);
  const [openCount, setOpenCount] = useState(0);
  const me = membership.member_id;
  const ws = `/workspace/${membership.company_id}`;
  const router = useRouter();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [missing, setMissing] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [text, setText] = useState("");
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [viewer, setViewer] = useState<ChatMessage | null>(null);
  const [menuFor, setMenuFor] = useState<ChatMessage | null>(null);
  const [readsFor, setReadsFor] = useState<ChatMessage | null>(null); // 읽음 확인(D-244)
  const [keepFor, setKeepFor] = useState<ChatMessage | null>(null); // 영구 보관(D-245)
  const [convertFor, setConvertFor] = useState<ChatMessage | null>(null); // 서류 → 엑셀(8-104)
  const [formFor, setFormFor] = useState<ChatMessage | null>(null); // 회사 양식으로 등록(8-104 B, 관리자만)
  const [kept, setKept] = useState<Set<string>>(() => new Set()); // 이 방에서 보관된 메시지(내 것 + 회사 공유)
  const [panel, setPanel] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [newBelow, setNewBelow] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  // 도우미 방(D-222): 답을 찾는 동안 "확인하고 있어요…"
  const [thinking, setThinking] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);
  const prependFrom = useRef<number | null>(null);
  const files = useRef(new Map<string, { file: File | Blob; ext: string; name: string; kind: "image" | "file"; width?: number; height?: number; thumb?: Blob; thumbExt?: string }>());
  const readTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const imageInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  // ── 불러오기 ──
  const loadDetail = useCallback(async () => {
    const { data, error } = await supabase.rpc("chat_room_detail", { p_room: roomId });
    if (error || !data) return setMissing(true);
    setDetail(data as unknown as Detail);
    if (tid) {
      const { data: t, error: te } = await supabase.rpc("chat_thread_detail", { p_thread: tid });
      if (te || !t) return setMissing(true);
      setTinfo(t as unknown as ThreadDetail);
    }
  }, [supabase, roomId, tid]);
  // 메시지 쪽: 메인 = 방 글(서브 대화 글 빼고), 서브 대화 모드 = 그 서브 대화 글
  const page = useCallback(
    (args: { p_before?: string; p_after?: string; p_limit: number }) =>
      tid ? supabase.rpc("chat_thread_messages", { p_thread: tid, ...args }) : supabase.rpc("chat_messages_page", { p_room: roomId, ...args }),
    [supabase, roomId, tid],
  );
  // 머리글 [서브 대화 n] = 진행 중 개수
  const loadThreadCount = useCallback(async () => {
    if (tid) return;
    const { data } = await supabase.rpc("chat_thread_list", { p_room: roomId });
    setOpenCount(((data as unknown as ChatThread[]) ?? []).filter((t) => t.status === "open").length);
  }, [supabase, roomId, tid]);

  // 보관된 메시지 표시(D-245): 내가 볼 수 있는 보관 파일(내 나만 보기 + 회사 공유) 중 이 방 것
  useEffect(() => {
    void supabase
      .from("vault_files")
      .select("source_message_id")
      .eq("source_room_id", roomId)
      .is("deleted_at", null)
      .then(({ data }) => data && setKept(new Set(data.map((d) => d.source_message_id).filter((x): x is string => !!x))));
  }, [supabase, roomId]);

  const markRead = useCallback(() => {
    if (readTimer.current) clearTimeout(readTimer.current);
    readTimer.current = setTimeout(() => {
      if (document.visibilityState !== "visible") return;
      if (tid) void supabase.rpc("chat_thread_mark_read", { p_thread: tid }).then(() => window.dispatchEvent(new CustomEvent(THREAD_READ_EVENT, { detail: tid })));
      else void supabase.rpc("chat_mark_read", { p_room: roomId }).then(() => undefined); // 빌더는 then을 불러야 요청이 나간다
    }, 300);
  }, [supabase, roomId, tid]);

  const loadLatest = useCallback(async () => {
    const { data, error } = await page({ p_limit: PAGE });
    if (error) return setMissing(true);
    const list = ((data as unknown as ChatMessage[]) ?? []).reverse();
    setMessages((m) => mergeMessages(m, list));
    setHasMore(list.length === PAGE);
    setLoaded(true);
    markRead();
  }, [page, markRead]);

  // 방에 들어오면 이 방 알림(상단 배너)을 치운다 — 카톡처럼(D-214)
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .getRegistration("/sw.js")
      .then((reg) => reg?.getNotifications({ tag: `chat-${roomId}` }))
      .then((list) => list?.forEach((n) => n.close()))
      .catch(() => undefined);
    closeNativeNotifications(`chat-${roomId}`); // 안드로이드 설치 앱 알림도(D-228)
  }, [roomId]);

  useEffect(() => {
    void Promise.resolve().then(() => Promise.all([loadDetail(), loadLatest(), loadThreadCount()]));
    return () => {
      if (readTimer.current) clearTimeout(readTimer.current);
    };
  }, [loadDetail, loadLatest, loadThreadCount]);

  // 메인 모드: 주소 ?thread= 또는 토스트·[내 서브 대화]에서 서브 대화 열기
  useEffect(() => {
    if (tid) return;
    const fromUrl = new URLSearchParams(window.location.search).get("thread");
    if (fromUrl) void Promise.resolve().then(() => setThreadUi({ mode: "thread", id: fromUrl }));
    const onOpen = (e: Event) => {
      const d = (e as CustomEvent<{ roomId: string; threadId: string }>).detail;
      if (d?.roomId === roomId) setThreadUi({ mode: "thread", id: d.threadId });
    };
    window.addEventListener(OPEN_THREAD_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_THREAD_EVENT, onOpen);
  }, [tid, roomId]);
  // 서브 대화를 열면 그 카드의 새 글 숫자를 지움(읽음은 서브 대화 쪽이 저장)
  useEffect(() => {
    if (tid || threadUi?.mode !== "thread") return;
    const id = threadUi.id;
    void Promise.resolve().then(() => setMessages((list) => list.map((m) => (m.thread?.id === id && m.thread.new ? { ...m, thread: { ...m.thread, new: 0 } } : m))));
  }, [tid, threadUi, loaded]);
  // 열린 서브 대화를 화면 밖(시각 알림)에 알림 + 좁은 PC에서 채팅 목록 접기
  useEffect(() => {
    if (tid) return;
    const open = threadUi?.mode === "thread" ? threadUi.id : threadUi ? "list" : null;
    if (open) document.body.dataset.openThread = open;
    else delete document.body.dataset.openThread;
    return () => {
      delete document.body.dataset.openThread;
    };
  }, [tid, threadUi]);

  // 다시 연결되면 마지막 메시지 이후를 채운다(빠진 메시지 방지)
  const fillGap = useCallback(async () => {
    const last = [...messages].reverse().find((m) => !m.pending);
    const { data } = await page({ p_after: last?.created_at, p_limit: 100 });
    const list = ((data as unknown as ChatMessage[]) ?? []).reverse();
    if (list.length) setMessages((m) => mergeMessages(m, list));
    void loadDetail();
    void loadThreadCount();
    markRead();
  }, [messages, page, loadDetail, loadThreadCount, markRead]);

  useEvents((e) => {
    if (e.event === "reconnect") return void fillGap();
    if (e.payload.room_id !== roomId) return;
    if (e.event === "thread" || e.event === "thread_message") {
      const th = e.payload.thread;
      if (tid) {
        if (th.id !== tid) return;
        setTinfo((t) => (t ? { ...t, ...th, root: t.root, can_manage: t.can_manage, new: 0 } : t));
        if (e.event === "thread_message") {
          setMessages((list) => mergeMessages(list, [e.payload.message]));
          if (e.payload.message.sender_member_id !== me) markRead();
        }
        return;
      }
      // 메인: 원래 메시지 카드 갱신
      const viewing = threadUi?.mode === "thread" && threadUi.id === th.id;
      setMessages((list) =>
        list.map((m) => {
          if (m.id !== th.root_message_id) return m;
          if (e.event === "thread_message") {
            return { ...m, thread: applyThreadMessage(m.thread, th, { me, participants: e.payload.participants, senderId: e.payload.message.sender_member_id, insert: e.payload.insert, viewing }) };
          }
          return { ...m, thread: { ...th, mine: m.thread?.mine ?? (th.created_by === me || m.sender_member_id === me), new: m.thread?.new ?? 0 } };
        }),
      );
      if (e.event === "thread") void loadThreadCount();
      return;
    }
    if (tid) return; // 서브 대화 모드는 메인 글을 받지 않음
    if (e.event === "message" || e.event === "message_update") {
      const m = e.payload as unknown as ChatMessage;
      setMessages((list) => mergeMessages(list, [m]));
      if (e.event === "message" && m.sender_member_id !== me) {
        if (atBottom.current) markRead();
        else {
          setNewBelow((n) => n + 1);
          markRead();
        }
      }
    } else if (e.event === "read") {
      const p = e.payload;
      setDetail((d) => (d ? { ...d, members: d.members.map((x) => (x.member_id === p.member_id ? { ...x, last_read_at: p.last_read_at } : x)) } : d));
    } else if (e.event === "room") {
      if (e.payload.left !== me) void loadDetail();
    }
  });

  const loadOlder = async () => {
    const first = messages.find((m) => !m.pending);
    if (!first || loadingOlder) return;
    setLoadingOlder(true);
    prependFrom.current = scroller.current?.scrollHeight ?? null;
    const { data } = await page({ p_before: first.created_at, p_limit: PAGE });
    const list = ((data as unknown as ChatMessage[]) ?? []).reverse();
    setMessages((m) => mergeMessages(m, list));
    setHasMore(list.length === PAGE);
    setLoadingOlder(false);
  };

  // ── 스크롤: 처음·내가 보낸 뒤·맨 아래 보고 있을 때 새 메시지 → 맨 아래로. 이전 대화를 붙이면 위치 유지 ──
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    if (prependFrom.current !== null) {
      el.scrollTop += el.scrollHeight - prependFrom.current;
      prependFrom.current = null;
      return;
    }
    const last = messages[messages.length - 1];
    if (atBottom.current || last?.sender_member_id === me) {
      el.scrollTop = el.scrollHeight;
      setNewBelow(0);
    }
  }, [messages, me]);
  // 휴대폰 키보드가 올라와 대화 칸이 줄어들면, 맨 아래를 보고 있었으면 계속 마지막 메시지가 보이게
  useEffect(() => {
    const el = scroller.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      if (atBottom.current) el.scrollTop = el.scrollHeight;
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const onScroll = () => {
    const el = scroller.current;
    if (!el) return;
    atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (atBottom.current) setNewBelow(0);
    if (el.scrollTop < 60 && hasMore && !loadingOlder) void loadOlder();
  };
  const toBottom = () => {
    const el = scroller.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    setNewBelow(0);
  };

  // ── 첨부 주소(서명된 주소, D-204): 말풍선은 작은 미리보기만(없는 예전 사진은 원본). 원본은 사진을 눌렀을 때만 ──
  useEffect(() => {
    const need = messages.filter((m) => m.kind === "image" && m.attachment_path && !m.deleted && !m.pending && !urls[thumbOf(m) as string]).map((m) => thumbOf(m) as string);
    if (!need.length) return;
    void signedUrls(supabase, BUCKET, need).then((next) => {
      if (Object.keys(next).length) setUrls((u) => ({ ...u, ...next }));
    });
  }, [messages, urls, supabase]);
  useEffect(() => {
    const p = viewer && !viewer.localUrl ? viewer.attachment_path : null;
    if (!p || urls[p]) return;
    void signedUrls(supabase, BUCKET, [p]).then((next) => setUrls((u) => ({ ...u, ...next })));
  }, [viewer, urls, supabase]);

  // ── 보내기(화면에 먼저 보여 주고, 저장되면 바꿔 끼움. 실패하면 다시 보내기) ──
  const deliver = async (msg: ChatMessage) => {
    setMessages((m) => mergeMessages(m, [{ ...msg, pending: "sending" }]));
    let attachment: Record<string, unknown> | undefined;
    let uploaded: string[] = [];
    if (msg.kind !== "text") {
      const f = files.current.get(msg.id);
      if (!f) return setMessages((m) => mergeMessages(m, [{ ...msg, pending: "failed" }]));
      // 파일 이름이 메시지마다 달라 내용이 바뀌지 않으므로 브라우저가 오래 저장해 두게(다시 받지 않게)
      const dir = `${membership.company_id}/${roomId}/${msg.id}`;
      const path = `${dir}.${f.ext}`;
      const up = await supabase.storage.from(BUCKET).upload(path, f.file, { upsert: true, cacheControl: "31536000", contentType: f.file.type || "application/octet-stream" });
      if (up.error) return setMessages((m) => mergeMessages(m, [{ ...msg, pending: "failed" }]));
      let thumbPath: string | undefined;
      if (f.thumb) {
        thumbPath = `${dir}_t.${f.thumbExt ?? "jpg"}`;
        const t = await supabase.storage.from(BUCKET).upload(thumbPath, f.thumb, { upsert: true, cacheControl: "31536000", contentType: f.thumb.type || "image/jpeg" });
        if (t.error) thumbPath = undefined; // 미리보기를 못 올려도 원본으로 보여 준다
      }
      uploaded = [path, ...(thumbPath ? [thumbPath] : [])];
      attachment = { path, thumb_path: thumbPath, thumb_size: f.thumb?.size, name: f.name, size: f.file.size, mime: f.file.type || "application/octet-stream", width: f.width, height: f.height };
    }
    const { data, error } = await supabase.rpc("chat_send", {
      p_room: roomId,
      p_id: msg.id,
      p_kind: msg.kind,
      p_body: msg.kind === "text" ? (msg.body ?? "") : undefined,
      p_attachment: attachment as never,
      p_thread: tid ?? undefined,
    });
    if (error?.message?.includes("THREAD_CLOSED")) {
      setMessages((m) => mergeMessages(m, [{ ...msg, pending: "failed" }]));
      void loadDetail();
      return setNotice("종결된 대화라 보내지 못했어요. [다시 열기] 뒤에 다시 보내 주세요.");
    }
    if (error?.message?.includes("STORAGE_FULL")) {
      // 회사 채팅 저장 공간이 다 참(D-204) → 올린 파일은 지우고 안내
      if (uploaded.length) void supabase.storage.from(BUCKET).remove(uploaded);
      files.current.delete(msg.id);
      setMessages((m) => m.filter((x) => x.id !== msg.id));
      const { data: st } = await supabase.rpc("chat_storage_status");
      const info = st as { limit?: number; days?: number } | null;
      const gb = info?.limit ? `(${Math.round((info.limit / 1024 ** 3) * 10) / 10}GB)` : "";
      return setNotice(`회사 채팅 저장 공간${gb}이 다 찼어요. 사진·파일은 ${info?.days ?? 90}일이 지나면 자동으로 지워져 다시 보낼 수 있어요.`);
    }
    if (error || !data) return setMessages((m) => mergeMessages(m, [{ ...msg, pending: "failed" }]));
    setMessages((m) => mergeMessages(m, [data as unknown as ChatMessage]));
    files.current.delete(msg.id);
    if (detail?.kind === "assistant" && msg.kind === "text") {
      // 도우미 방: 서버가 답(bot 글)을 만들어 돌려준다 — 실시간으로도 오지만 바로 붙인다
      setThinking(true);
      const reply = (await pushChatMessageAction(msg.id).catch(() => null)) as ChatMessage | null;
      setThinking(false);
      if (reply) {
        atBottom.current = true;
        setMessages((m) => mergeMessages(m, [reply]));
      }
      return;
    }
    void pushChatMessageAction(msg.id).catch(() => undefined);
  };

  const draft = (kind: ChatMessage["kind"], extra: Partial<ChatMessage>): ChatMessage => ({
    id: crypto.randomUUID(),
    room_id: roomId,
    sender_member_id: me,
    sender_name: membership.name,
    kind,
    body: null,
    attachment_path: null,
    attachment_thumb_path: null,
    attachment_name: null,
    attachment_size: null,
    attachment_mime: null,
    width: null,
    height: null,
    created_at: new Date().toISOString(),
    deleted: false,
    ...extra,
  });

  const sendText = () => {
    const body = text.trim();
    if (!body) return;
    setText("");
    atBottom.current = true;
    void deliver(draft("text", { body: body.slice(0, CHAT_BODY_MAX) }));
    input.current?.focus();
  };

  const attach = async (list: FileList | null, as: "image" | "file") => {
    for (const file of Array.from(list ?? [])) {
      if (file.size > CHAT_FILE_MAX) {
        setNotice(`${file.name}: 20MB 이하 파일만 보낼 수 있어요.`);
        continue;
      }
      let kind: "image" | "file" = as === "image" && file.type.startsWith("image/") ? "image" : "file";
      let blob: Blob = file;
      let ext = (file.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8) || "bin";
      let width: number | undefined;
      let height: number | undefined;
      let thumb: Blob | undefined;
      let thumbExt: string | undefined;
      if (kind === "image") {
        try {
          const p = await processChatImage(file); // 휴대폰 사진 회전 반영 + 1280px JPEG(카톡 일반 화질) + 말풍선용 미리보기
          blob = p.original;
          ext = "jpg";
          width = p.width;
          height = p.height;
          thumb = p.thumb;
          thumbExt = p.thumbExt;
        } catch {
          kind = "file"; // 읽지 못하는 사진 형식은 파일로 보낸다
        }
      }
      const msg = draft(kind, {
        attachment_name: kind === "image" ? `${file.name.replace(/\.[^.]+$/, "")}.${ext}` : file.name,
        attachment_size: blob.size,
        attachment_mime: blob.type,
        width: width ?? null,
        height: height ?? null,
        localUrl: kind === "image" ? URL.createObjectURL(blob) : undefined,
      });
      files.current.set(msg.id, { file: blob, ext, name: msg.attachment_name ?? file.name, kind, width, height, thumb, thumbExt });
      atBottom.current = true;
      void deliver(msg);
    }
  };

  const removeFailed = (m: ChatMessage) => {
    files.current.delete(m.id);
    setMessages((list) => list.filter((x) => x.id !== m.id));
  };

  const deleteMessage = async (m: ChatMessage) => {
    setMenuFor(null);
    if (!window.confirm("이 메시지를 삭제할까요? 모든 참여자에게 '삭제된 메시지입니다'로 보여요.")) return;
    const { data, error } = await supabase.rpc("chat_delete_message", { p_id: m.id });
    if (error) return setNotice("삭제하지 못했어요. 잠시 뒤 다시 시도해 주세요.");
    if (data) void supabase.storage.from(BUCKET).remove([data, ...(m.attachment_thumb_path ? [m.attachment_thumb_path] : [])]);
    setMessages((list) => mergeMessages(list, [{ ...m, deleted: true, body: null, attachment_path: null, attachment_thumb_path: null }]));
  };

  const download = async (m: ChatMessage) => {
    if (!m.attachment_path) return;
    const { data } = await supabase.storage.from(BUCKET).createSignedUrl(m.attachment_path, 60, { download: m.attachment_name ?? true });
    if (data?.signedUrl) window.location.assign(data.signedUrl);
  };

  // ── 방 메뉴 ──
  const invite = async (ids: string[]) => {
    if (!detail) return "잠시 뒤 다시 시도해 주세요.";
    if (detail.kind === "direct") {
      // 1:1에서 초대하면 카톡처럼 새 그룹방
      const others = detail.members.map((x) => x.member_id).filter((x) => x !== me);
      const { data, error } = await supabase.rpc("chat_create_group", { p_member_ids: [...others, ...ids] });
      if (error || !data) return "초대하지 못했어요.";
      setInviting(false);
      router.push(`${ws}/chat/${data}`);
      return null;
    }
    const { error } = await supabase.rpc("chat_invite", { p_room: roomId, p_member_ids: ids });
    if (error) return "초대하지 못했어요.";
    setInviting(false);
    void loadDetail();
    return null;
  };
  const rename = async () => {
    const t = window.prompt("채팅방 이름(비우면 참여자 이름으로 보여요)", detail?.title ?? "");
    if (t === null) return;
    const { error } = await supabase.rpc("chat_rename", { p_room: roomId, p_title: t.slice(0, 50) });
    if (error) return setNotice("이름을 바꾸지 못했어요.");
    void loadDetail();
  };
  const leave = async () => {
    if (!window.confirm("채팅방을 나갈까요? 나가면 대화 내용을 더 볼 수 없어요.")) return;
    const { error } = await supabase.rpc("chat_leave", { p_room: roomId });
    if (error) return setNotice("나가지 못했어요.");
    router.push(`${ws}/chat`);
  };

  if (missing) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center text-sm text-zinc-600">
        대화방을 찾을 수 없어요. 나간 방이거나 초대받지 않은 방이에요.
        <Link href={`${ws}/chat`} className="font-semibold text-brand-700 underline">
          채팅 목록으로
        </Link>
      </div>
    );
  }

  const title = detail ? roomTitle({ ...detail, claim_title: detail.claim?.title }, me) : "";
  const assistant = detail?.kind === "assistant";
  const readList = !!detail && READ_LIST_KINDS.includes(detail.kind); // 단체방·결의서 방만 읽은 사람 목록
  const count = detail && detail.kind !== "direct" && detail.kind !== "notice" && !assistant ? detail.members.length : null;
  const ask = (q: string) => {
    atBottom.current = true;
    void deliver(draft("text", { body: q }));
  };
  const claimHref = detail?.claim
    ? detail.claim.member_id === me
      ? `${ws}/employee/claims/${detail.claim.id}`
      : isAdminRole(membership.role)
        ? `${ws}/admin/claims/${detail.claim.id}`
        : `${ws}/approvals/${detail.claim.id}`
    : null;
  const membersById = new Map((detail?.members ?? []).map((m) => [m.member_id, m]));
  const rows = buildRows(messages, me);
  const touch = typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;

  const threadsOn = !tid && !!detail && THREAD_KINDS.includes(detail.kind);
  const openThread = (id: string) => setThreadUi({ mode: "thread", id });
  const tClosed = tinfo?.status === "closed";
  const reopen = async () => {
    if (!tid) return;
    const { data, error } = await supabase.rpc("chat_thread_reopen", { p_thread: tid });
    if (error || !data) return setNotice("다시 열지 못했어요.");
    setTinfo((t) => (t ? { ...t, ...(data as unknown as ChatThread) } : t));
  };

  return (
    <div className="flex min-h-0 min-w-0 flex-1">
    <div className="relative flex min-h-0 min-w-0 flex-1 flex-col bg-[var(--chat-bg)]">
      {tid && thread ? (
        <header className="flex h-14 shrink-0 items-center gap-1 border-b border-zinc-200 bg-white px-1" data-thread-head>
          <button type="button" onClick={thread.onBack} className="inline-flex h-11 shrink-0 items-center gap-0.5 rounded-xl px-2 text-sm text-zinc-700 hover:bg-zinc-100">
            <ChevronLeft className="size-5" aria-hidden />
            목록
          </button>
          <span className="min-w-0 flex-1 px-1">
            <b className="block truncate text-[15px] text-zinc-900">{tinfo?.title ?? "서브 대화"}</b>
            <span className="block truncate text-xs text-zinc-600">서브 대화 · {tinfo ? (tClosed ? "종결" : `진행 중 · ${tinfo.people_count}명`) : "불러오는 중"}</span>
          </span>
          {tinfo?.can_manage && !tClosed && (
            <button type="button" onClick={() => setClosing(true)} className="h-9 shrink-0 rounded-lg border border-zinc-300 px-2.5 text-[13px] font-semibold hover:bg-zinc-50" data-thread-close>
              종결하기
            </button>
          )}
          <button type="button" onClick={thread.onClose} aria-label="서브 대화 닫기" className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl text-zinc-600 hover:bg-zinc-100">
            <X className="size-5" />
          </button>
        </header>
      ) : (
      <header className="flex h-14 shrink-0 items-center gap-1 border-b border-[var(--chat-head-border)] bg-[var(--chat-head)] px-2">
        <Link href={`${ws}/chat`} aria-label="채팅 목록" className="inline-flex size-11 items-center justify-center rounded-xl text-zinc-800 hover:bg-black/5 md:hidden">
          <ArrowLeft className="size-5" />
        </Link>
        <h2 className="min-w-0 flex-1 truncate px-1 text-base font-bold text-zinc-900">
          {title}
          {count !== null && <span className="ml-1.5 font-normal text-zinc-600">{count}</span>}
        </h2>
        {assistant && <span className="shrink-0 px-1 text-xs text-zinc-600">조회·화면 이동 · 하루 30번</span>}
        {threadsOn && (
          <button
            type="button"
            onClick={() => setThreadUi((u) => (u ? null : { mode: "list" }))}
            aria-expanded={!!threadUi}
            className={`inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl border px-2.5 text-[13px] font-semibold ${threadUi ? "border-brand-600 bg-brand-50 text-brand-800" : "border-brand-200 bg-white text-brand-800 hover:bg-brand-50"}`}
            data-thread-open-list
          >
            <MessagesSquare className="size-4" aria-hidden />
            <span className="hidden sm:inline">서브 대화</span>
            {openCount > 0 && <span className="rounded-full bg-brand-600 px-1.5 text-[11px] text-white">{openCount}</span>}
          </button>
        )}
        {detail?.kind !== "notice" && !assistant && (
          <button type="button" onClick={() => setPanel(true)} aria-label="채팅방 메뉴" className="inline-flex size-11 items-center justify-center rounded-xl text-zinc-800 hover:bg-black/5">
            <Menu className="size-5" />
          </button>
        )}
      </header>
      )}
      {!tid && detail?.claim && claimHref && (
        <Link href={claimHref} className="mx-3 mb-1 flex shrink-0 items-center gap-2 rounded-xl bg-white/90 px-3 py-2 text-sm shadow-sm hover:bg-white">
          <FileText className="size-4 shrink-0 text-brand-700" />
          <span className="min-w-0 flex-1 truncate">
            <span className="font-semibold">{detail.claim.title || "제목 없는 결의서"}</span>
            <span className="ml-1.5 tabular-nums text-zinc-600">{formatWon(detail.claim.total_amount)}</span>
          </span>
          <span className="shrink-0 font-semibold text-brand-700">소명서 보기 →</span>
        </Link>
      )}

      <div ref={scroller} onScroll={onScroll} className="min-h-0 flex-1 overflow-y-auto px-3 pb-3" role="log" aria-label="대화 내용" aria-live="polite">
        {hasMore && (
          <div className="flex justify-center py-2">
            <button type="button" onClick={() => void loadOlder()} className="rounded-full bg-black/10 px-3 py-1 text-xs text-zinc-700">
              {loadingOlder ? "불러오는 중…" : "이전 대화 더 보기"}
            </button>
          </div>
        )}
        {!loaded && (
          <div className="flex justify-center py-10">
            <Loader2 className="size-6 animate-spin text-zinc-600" />
          </div>
        )}
        {tid && tinfo?.root && (
          <div className="mt-3 rounded-xl bg-white/80 px-3 py-2.5 text-[13.5px] leading-relaxed text-zinc-900" data-thread-root>
            <b className="block text-xs text-zinc-600">
              원래 메시지 · {tinfo.root.sender_name ?? "알 수 없음"} · {timeLabel(tinfo.root.created_at)}
            </b>
            <p className="line-clamp-4 whitespace-pre-line break-words">{previewText(tinfo.root)}</p>
          </div>
        )}
        {loaded && !messages.length && !assistant && <p className="py-10 text-center text-sm text-zinc-700">{tid ? "이 건에 대한 이야기를 시작해 보세요." : "첫 메시지를 보내 보세요."}</p>}
        {loaded && assistant && (
          <div className="mx-auto mt-4 flex max-w-sm flex-col items-center gap-3 rounded-2xl bg-white/90 p-4 text-center shadow-sm" aria-label="도우미 안내">
            <LogoMark className="size-12" />
            <p className="text-sm leading-relaxed text-zinc-800">
              그냥 대화하듯 물어보세요. 일정·회의실 빈 시간·내 결의서·승인 대기를 찾아 주고, 필요한 화면을 열어 드려요. 질문과 답은 나만 봐요.
            </p>
            <div className="flex flex-wrap justify-center gap-1.5">
              {["오늘 일정", "내일 회의실 빈 시간", "반려된 결의서", "승인 대기 몇 건?"].map((q) => (
                <button key={q} type="button" onClick={() => ask(q)} className="min-h-10 rounded-full border border-brand-200 bg-brand-50 px-3 text-sm font-medium text-brand-800 hover:bg-brand-100">
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}
        {rows.map((row) => {
          if (row.type === "date")
            return (
              <div key={row.key} className="flex justify-center py-3">
                <span className="rounded-full bg-[var(--chat-chip)] px-3 py-1 text-xs text-[var(--chat-chip-fg)]">{row.label}</span>
              </div>
            );
          if (row.type === "notice")
            return (
              <div key={row.key} className="mt-2.5 flex justify-start gap-2">
                <span aria-hidden className="inline-flex size-10 shrink-0 items-center justify-center rounded-[38%] bg-amber-100 text-amber-700">
                  <Bell className="size-5" />
                </span>
                <div className="flex min-w-0 max-w-[80%] items-end gap-1">
                  <NoticeBubble body={row.msg.body} link={row.msg.link ?? null} />
                  <span className="shrink-0 whitespace-nowrap pb-0.5 text-[11px] text-zinc-600">{timeLabel(row.msg.created_at)}</span>
                </div>
              </div>
            );
          if (row.type === "bot")
            return (
              <div key={row.key} className="mt-2.5 flex justify-start gap-2">
                <LogoMark className="size-10 rounded-[38%]" />
                <div className="min-w-0 max-w-[80%]">
                  <p className="mb-0.5 text-xs text-zinc-700">{BRAND.name} 도우미</p>
                  <div className="flex items-end gap-1">
                    <div className="min-w-0 rounded-2xl rounded-tl-md border border-[var(--chat-other-border)] bg-[var(--chat-other)] px-3 py-2.5 text-sm shadow-sm" data-bot>
                      <p className="whitespace-pre-line break-words leading-relaxed text-zinc-900">{row.msg.body}</p>
                      {row.msg.link && (
                        <Link href={row.msg.link} className="mt-2 flex min-h-10 items-center justify-center rounded-xl bg-brand-50 px-3 text-sm font-semibold text-brand-700 hover:bg-brand-100">
                          {assistantLinkLabel(row.msg.link)}
                        </Link>
                      )}
                    </div>
                    <span className="shrink-0 whitespace-nowrap pb-0.5 text-[11px] text-zinc-600">{timeLabel(row.msg.created_at)}</span>
                  </div>
                </div>
              </div>
            );
          if (row.type === "system")
            return (
              <div key={row.key} className="flex justify-center py-1.5">
                <span className="max-w-[85%] rounded-full bg-[var(--chat-chip)] px-3 py-1 text-center text-xs text-[var(--chat-chip-fg)]">{row.msg.body}</span>
              </div>
            );
          const m = row.msg;
          const unread = m.pending || tid ? 0 : unreadCountFor(m, detail?.members ?? []);
          const sender = m.sender_member_id ? membersById.get(m.sender_member_id) : undefined;
          const name = sender ? displayName(sender) : (m.sender_name ?? "알 수 없음");
          const meta = (
            <span className={`flex shrink-0 flex-col justify-end pb-0.5 text-[11px] leading-tight ${row.mine ? "items-end" : "items-start"}`}>
              {m.pending === "sending" && <Loader2 className="size-3 animate-spin text-zinc-600" />}
              {unread > 0 &&
                (readList ? (
                  <button type="button" data-unread onClick={() => setReadsFor(m)} aria-label={`안 읽은 사람 ${unread}명 보기`} className="-m-1.5 p-1.5 text-[13px] font-extrabold leading-none text-[var(--chat-unread)] [text-shadow:var(--chat-unread-shadow)] hover:underline">
                    {unread}
                  </button>
                ) : (
                  <span data-unread className="text-[13px] font-extrabold leading-none text-[var(--chat-unread)] [text-shadow:var(--chat-unread-shadow)]">{unread}</span>
                ))}
              {kept.has(m.id) && <span data-kept className="whitespace-nowrap text-[11px] font-semibold text-[var(--chat-meta)]">보관됨</span>}
              {row.showTime && !m.pending && <span className="whitespace-nowrap text-[var(--chat-meta)]">{timeLabel(m.created_at)}</span>}
            </span>
          );
          const bubble = (
            <MessageBody
              m={m}
              mine={row.mine}
              url={m.localUrl ?? (thumbOf(m) ? urls[thumbOf(m) as string] : undefined)}
              onOpenImage={() => setViewer(m)}
              onDownload={() => void download(m)}
              onMenu={() => !m.pending && !m.deleted && setMenuFor(m)}
              touch={touch}
            />
          );
          return (
            <div key={row.key} className={`flex gap-2 ${row.showName ? "mt-2.5" : "mt-1"} ${row.mine ? "justify-end" : "justify-start"}`}>
              {!row.mine && (row.showName ? <Avatar id={m.sender_member_id} name={name} /> : <span className="w-10 shrink-0" />)}
              <div className={`flex min-w-0 max-w-[75%] flex-col ${row.mine ? "items-end" : "items-start"}`}>
                {!row.mine && row.showName && <span className="mb-1 text-xs text-zinc-700">{name}</span>}
                <div className={`flex items-end gap-1 ${row.mine ? "flex-row" : "flex-row-reverse"}`}>
                  {meta}
                  {bubble}
                </div>
                {!tid && m.thread && <ThreadCard t={m.thread} onOpen={() => openThread(m.thread!.id)} />}
                {m.pending === "failed" && (
                  <span className="mt-1 flex gap-2 text-xs">
                    <span className="text-red-700">보내지 못했어요</span>
                    <button type="button" onClick={() => void deliver(m)} className="inline-flex items-center gap-0.5 font-semibold text-zinc-800 underline">
                      <RotateCw className="size-3" />
                      다시 보내기
                    </button>
                    <button type="button" onClick={() => removeFailed(m)} className="font-semibold text-zinc-800 underline">
                      삭제
                    </button>
                  </span>
                )}
              </div>
            </div>
          );
        })}
        {/* 답이 실시간으로 먼저 오면(마지막 글이 답) 바로 숨김 */}
        {thinking && messages[messages.length - 1]?.kind !== "bot" && (
          <div className="mt-2.5 flex items-center gap-2" role="status">
            <LogoMark className="size-10 rounded-[38%]" />
            <span className="inline-flex items-center gap-1.5 rounded-2xl bg-[var(--chat-other)] px-3 py-2.5 text-sm text-zinc-700 shadow-sm">
              <Loader2 className="size-4 animate-spin" /> 확인하고 있어요…
            </span>
          </div>
        )}
      </div>

      {newBelow > 0 && (
        <button type="button" onClick={toBottom} className="absolute bottom-20 left-1/2 inline-flex -translate-x-1/2 items-center gap-1 rounded-full bg-zinc-800/85 px-3 py-1.5 text-xs text-white shadow">
          <ArrowDown className="size-3.5" />새 메시지 {newBelow}
        </button>
      )}
      {notice && (
        <div role="alert" className="absolute inset-x-3 bottom-20 flex items-center gap-2 rounded-xl bg-zinc-800 px-3 py-2 text-sm text-white shadow">
          <span className="flex-1">{notice}</span>
          <button type="button" onClick={() => setNotice(null)} aria-label="닫기">
            <X className="size-4" />
          </button>
        </div>
      )}

      {tid && tClosed ? (
        <div className="shrink-0 border-t border-zinc-200 bg-white p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]" data-thread-closed>
          <p className="flex items-center gap-1.5 text-[13.5px] font-bold text-zinc-800">
            <Lock className="size-4" aria-hidden />
            종결된 대화예요{tinfo?.closed_by_name ? ` · ${tinfo.closed_by_name}` : ""}
          </p>
          {tinfo?.summary && <p className="mt-2 rounded-lg bg-zinc-100 px-2.5 py-1.5 text-[13px] text-zinc-800">요약 · {tinfo.summary}</p>}
          {tinfo?.can_manage ? (
            <button type="button" onClick={() => void reopen()} className="mt-2.5 flex h-11 w-full items-center justify-center rounded-xl border border-brand-300 font-semibold text-brand-800 hover:bg-brand-50" data-thread-reopen>
              다시 열기
            </button>
          ) : (
            <p className="mt-2 text-xs text-zinc-600">기록으로 볼 수 있어요. 다시 열기는 만든 사람·관리자가 할 수 있어요.</p>
          )}
        </div>
      ) : detail?.kind === "notice" ? (
        <p className="shrink-0 bg-white p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] text-center text-sm text-zinc-600">회의 10분 전·결재 완료·공지 같은 알림이 카드로 오는 방이에요. 답장은 보낼 수 없어요.</p>
      ) : (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          sendText();
        }}
        className="flex shrink-0 items-end gap-1 bg-white p-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]"
      >
        {!assistant && (
        <>
        <button type="button" onClick={() => imageInput.current?.click()} aria-label="사진 보내기" className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl text-zinc-600 hover:bg-zinc-100">
          <ImagePlus className="size-5" />
        </button>
        <button type="button" onClick={() => fileInput.current?.click()} aria-label="파일 보내기" className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl text-zinc-600 hover:bg-zinc-100">
          <Paperclip className="size-5" />
        </button>
        <input ref={imageInput} type="file" accept="image/*" multiple hidden onChange={(e) => (void attach(e.target.files, "image"), (e.target.value = ""))} />
        <input ref={fileInput} type="file" multiple hidden onChange={(e) => (void attach(e.target.files, "file"), (e.target.value = ""))} />
        </>
        )}
        <textarea
          ref={input}
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, CHAT_BODY_MAX))}
          onKeyDown={(e) => {
            // PC: Enter 보내기, Shift+Enter 줄바꿈. 한글 입력 중(조합 중)에는 보내지 않는다. 휴대폰은 Enter = 줄바꿈
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && !touch) {
              e.preventDefault();
              sendText();
            }
          }}
          rows={1}
          placeholder={assistant ? "예) 내일 회의실 빈 시간" : tid ? "서브 대화에 쓰기" : "메시지 입력"}
          aria-label="메시지 입력"
          className="max-h-32 min-h-11 flex-1 resize-none rounded-xl bg-zinc-100 px-3 py-2.5 text-base leading-6 outline-none [field-sizing:content] md:text-sm md:leading-6"
        />
        <button type="submit" disabled={!text.trim()} aria-label="보내기" className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-amber-300 text-zinc-900 hover:bg-amber-400 disabled:bg-zinc-100 disabled:text-zinc-400">
          <SendHorizontal className="size-5" />
        </button>
      </form>
      )}

      {menuFor && (
        <ChatOverlay>
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 md:items-center" onClick={() => setMenuFor(null)} role="dialog" aria-modal aria-label="메시지 메뉴">
          <div className="w-full max-w-sm overflow-hidden rounded-t-2xl bg-white pb-[env(safe-area-inset-bottom)] md:rounded-2xl" onClick={(e) => e.stopPropagation()}>
            {menuFor.kind === "text" && (
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard?.writeText(menuFor.body ?? "");
                  setMenuFor(null);
                  setNotice("복사했어요.");
                }}
                className="flex min-h-12 w-full items-center gap-3 px-4 text-left hover:bg-zinc-50"
              >
                <Copy className="size-4" />
                복사
              </button>
            )}
            {(menuFor.kind === "image" || menuFor.kind === "file") && menuFor.attachment_path && !menuFor.expired && !menuFor.deleted && (
              kept.has(menuFor.id) ? (
                <Link href={`${ws}/employee/vault`} className="flex min-h-12 w-full items-center gap-3 px-4 text-left hover:bg-zinc-50" data-open-vault>
                  <Archive className="size-4" />
                  보관됨 · 파일 보관함에서 보기
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setKeepFor(menuFor);
                    setMenuFor(null);
                  }}
                  className="flex min-h-12 w-full items-start gap-3 px-4 py-2.5 text-left font-semibold text-brand-800 hover:bg-brand-50"
                  data-keep
                >
                  <Archive className="mt-0.5 size-4" />
                  <span>
                    영구 보관
                    <span className="block text-xs font-normal text-zinc-600">보관 기간이 지나도 지워지지 않게 [파일 보관함]에 남겨요</span>
                  </span>
                </button>
              )
            )}
            {(menuFor.kind === "image" || menuFor.kind === "file") && menuFor.attachment_path && !menuFor.expired && !menuFor.deleted && isConvertible(menuFor.attachment_mime) && (
              <button
                type="button"
                onClick={() => {
                  setConvertFor(menuFor);
                  setMenuFor(null);
                }}
                className="flex min-h-12 w-full items-start gap-3 px-4 py-2.5 text-left font-semibold text-brand-800 hover:bg-brand-50"
                data-convert
              >
                <FileSpreadsheet className="mt-0.5 size-4" />
                <span>
                  엑셀로 변환
                  <span className="block text-xs font-normal text-zinc-600">표 모양 그대로 엑셀로 · 앱에서 보고 고치기</span>
                </span>
              </button>
            )}
            {isAdminRole(membership.role) && (menuFor.kind === "image" || menuFor.kind === "file") && menuFor.attachment_path && !menuFor.expired && !menuFor.deleted && isConvertible(menuFor.attachment_mime) && (
              <button
                type="button"
                onClick={() => {
                  setFormFor(menuFor);
                  setMenuFor(null);
                }}
                className="flex min-h-12 w-full items-start gap-3 px-4 py-2.5 text-left font-semibold text-brand-800 hover:bg-brand-50"
                data-form-register
              >
                <FileStack className="mt-0.5 size-4" />
                <span>
                  회사 양식으로 등록
                  <span className="block text-xs font-normal text-zinc-600">관리자만 · 이 서류 모양으로 휴가신청서 등을 출력(PC에서)</span>
                </span>
              </button>
            )}
            {!tid && menuFor.thread && (
              <button
                type="button"
                onClick={() => {
                  openThread(menuFor.thread!.id);
                  setMenuFor(null);
                }}
                className="flex min-h-12 w-full items-center gap-3 px-4 text-left font-semibold text-brand-800 hover:bg-brand-50"
                data-thread-view
              >
                <MessagesSquare className="size-4" />
                서브 대화 보기
              </button>
            )}
            {!tid && canStartThread(menuFor, detail?.kind) && (
              <button
                type="button"
                onClick={() => {
                  setCreating(menuFor);
                  setMenuFor(null);
                }}
                className="flex min-h-12 w-full items-start gap-3 px-4 py-2.5 text-left font-semibold text-brand-800 hover:bg-brand-50"
                data-thread-start
              >
                <MessagesSquare className="mt-0.5 size-4" />
                <span>
                  서브 대화 만들기
                  <span className="block text-xs font-normal text-zinc-600">이 건만 따로 이야기해요(메인에는 카드만)</span>
                </span>
              </button>
            )}
            {readList && !tid && (
              <button
                type="button"
                onClick={() => {
                  setReadsFor(menuFor);
                  setMenuFor(null);
                }}
                className="flex min-h-12 w-full items-center gap-3 px-4 text-left hover:bg-zinc-50"
                data-read-check
              >
                <CheckCheck className="size-4" />
                읽음 확인
              </button>
            )}
            {menuFor.sender_member_id === me && (
              <button type="button" onClick={() => void deleteMessage(menuFor)} className="flex min-h-12 w-full items-center gap-3 px-4 text-left text-red-700 hover:bg-zinc-50">
                <Trash2 className="size-4" />
                삭제
              </button>
            )}
            <button type="button" onClick={() => setMenuFor(null)} className="flex min-h-12 w-full items-center justify-center border-t border-zinc-100 text-zinc-600 hover:bg-zinc-50">
              취소
            </button>
          </div>
        </div>
        </ChatOverlay>
      )}

      {readsFor && detail && <ReadSheet msg={readsFor} members={detail.members} onClose={() => setReadsFor(null)} />}
      {keepFor && (
        <ChatOverlay>
          <KeepSheet
            supabase={supabase}
            ws={ws}
            msg={{
              id: keepFor.id,
              kind: keepFor.kind === "image" ? "image" : "file",
              name: keepFor.attachment_name ?? (keepFor.kind === "image" ? "사진" : "파일"),
              size: keepFor.attachment_size ?? 0,
              from: `${detail ? roomTitle(detail, me) : "채팅"} · ${displayName(keepFor.sender_member_id ? membersById.get(keepFor.sender_member_id) : undefined, keepFor.sender_name ?? "알 수 없음")}`,
            }}
            onClose={() => setKeepFor(null)}
            onKept={(scope) => {
              const id = keepFor.id;
              setKept((k) => new Set(k).add(id));
              setKeepFor(null);
              setNotice(scope === "private" ? "나만 보기로 보관했어요. [파일 보관함]에서 볼 수 있어요." : "회사에 공유해 보관했어요. [파일 보관함]에서 볼 수 있어요.");
            }}
          />
        </ChatOverlay>
      )}

      {convertFor && (
        <ChatOverlay>
          <ConvertSheet
            ws={ws}
            name={convertFor.attachment_name ?? (convertFor.kind === "image" ? "사진" : "파일")}
            from={`${detail ? roomTitle(detail, me) : "채팅"} · ${displayName(convertFor.sender_member_id ? membersById.get(convertFor.sender_member_id) : undefined, convertFor.sender_name ?? "알 수 없음")}`}
            run={() => convertChatFileAction(convertFor.id)}
            onClose={() => setConvertFor(null)}
          />
        </ChatOverlay>
      )}

      {formFor && (
        <ChatOverlay>
          <ChatFormSheet ws={ws} companyId={membership.company_id} me={membership.member_id} message={{ id: formFor.id, name: formFor.attachment_name ?? (formFor.kind === "image" ? "사진" : "파일") }} onClose={() => setFormFor(null)} />
        </ChatOverlay>
      )}

      {viewer && (
        <ChatOverlay>
        <div className="fixed inset-0 z-50 flex flex-col bg-black/90" role="dialog" aria-modal aria-label="사진 보기" onClick={() => setViewer(null)}>
          <div className="flex h-14 shrink-0 items-center justify-end gap-1 px-2" onClick={(e) => e.stopPropagation()}>
            <button type="button" onClick={() => void download(viewer)} aria-label="사진 저장" className="inline-flex size-11 items-center justify-center rounded-xl text-white hover:bg-white/10">
              <Download className="size-5" />
            </button>
            <button type="button" onClick={() => setViewer(null)} aria-label="닫기" className="inline-flex size-11 items-center justify-center rounded-xl text-white hover:bg-white/10">
              <X className="size-6" />
            </button>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={viewer.localUrl ?? (viewer.attachment_path ? (urls[viewer.attachment_path] ?? urls[thumbOf(viewer) as string] ?? "") : "")} alt={viewer.attachment_name ?? "사진"} className="min-h-0 flex-1 object-contain p-2" />
        </div>
        </ChatOverlay>
      )}

      {panel && detail && (
        <ChatOverlay>
        <div className="fixed inset-0 z-40 flex justify-end bg-black/30" onClick={() => setPanel(false)} role="dialog" aria-modal aria-label="채팅방 정보">
          <div className="flex h-full w-80 max-w-[85vw] flex-col bg-white" onClick={(e) => e.stopPropagation()}>
            <div className="flex h-14 shrink-0 items-center border-b border-zinc-100 px-4">
              <h3 className="flex-1 font-bold">대화상대 {detail.members.length}</h3>
              <button type="button" onClick={() => setPanel(false)} aria-label="닫기" className="-mr-2 inline-flex size-11 items-center justify-center rounded-xl hover:bg-zinc-100">
                <X className="size-5" />
              </button>
            </div>
            <button
              type="button"
              onClick={() => {
                setPanel(false);
                setInviting(true);
              }}
              className="flex min-h-12 items-center gap-3 px-4 text-left hover:bg-zinc-50"
            >
              <span className="inline-flex size-10 items-center justify-center rounded-[38%] bg-zinc-100">
                <UserPlus className="size-5" />
              </span>
              대화상대 초대
            </button>
            <ul className="min-h-0 flex-1 overflow-y-auto">
              {detail.members.map((x) => (
                <li key={x.member_id} className="flex items-center gap-3 px-4 py-2">
                  <Avatar id={x.member_id} name={x.name} />
                  <span className="truncate">
                    {displayName(x)}
                    {x.member_id === me && <span className="ml-1 rounded bg-zinc-200 px-1 text-[11px] text-zinc-700">나</span>}
                  </span>
                </li>
              ))}
            </ul>
            <div className="shrink-0 border-t border-zinc-100 p-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
              {detail.kind === "group" && (
                <button type="button" onClick={() => void rename()} className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm hover:bg-zinc-50">
                  <Pencil className="size-4" />
                  채팅방 이름 바꾸기
                </button>
              )}
              {detail.kind !== "direct" && (
                <button type="button" onClick={() => void leave()} className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm text-red-700 hover:bg-zinc-50">
                  <LogOut className="size-4" />
                  채팅방 나가기
                </button>
              )}
            </div>
          </div>
        </div>
        </ChatOverlay>
      )}

      {inviting && detail && <MemberPicker mode="invite" exclude={detail.members.map((x) => x.member_id)} onClose={() => setInviting(false)} onConfirm={(ids) => invite(ids)} />}
      {creating && (
        <ThreadCreateSheet
          roomId={roomId}
          root={creating}
          onClose={() => setCreating(null)}
          onCreated={(t) => {
            const rootId = creating.id;
            setMessages((list) => list.map((m) => (m.id === rootId ? { ...m, thread: { ...t, mine: true } } : m)));
            setCreating(null);
            openThread(t.id);
            void loadThreadCount();
          }}
        />
      )}
      {closing && tinfo && (
        <ThreadCloseSheet
          thread={tinfo}
          onClose={() => setClosing(false)}
          onClosed={(t) => {
            setTinfo((x) => (x ? { ...x, ...t } : x));
            setClosing(false);
          }}
        />
      )}
    </div>
    {threadUi && !tid && (
      // PC: 오른쪽 서랍(메인과 함께 실시간) / 휴대폰: 아래에서 올라오는 전체 화면 시트. 열리는 서브 대화는 한 번에 하나
      <aside className="fixed inset-0 z-40 flex flex-col bg-white md:static md:z-auto md:w-[380px] md:shrink-0 md:border-l md:border-zinc-300 md:shadow-[-6px_0_18px_rgba(0,0,0,0.06)]" aria-label="서브 대화" data-thread-drawer>
        {threadUi.mode === "list" ? (
          <ThreadList roomId={roomId} roomLabel={title} onPick={(id) => openThread(id)} onClose={() => setThreadUi(null)} />
        ) : (
          <ChatRoom key={threadUi.id} roomId={roomId} thread={{ id: threadUi.id, onBack: () => setThreadUi({ mode: "list" }), onClose: () => setThreadUi(null) }} />
        )}
      </aside>
    )}
    </div>
  );
}

// 말풍선 하나: 글·사진·파일·삭제됨. 길게 누르거나(휴대폰) 오른쪽 클릭(PC)하면 메뉴
function MessageBody({
  m,
  mine,
  url,
  onOpenImage,
  onDownload,
  onMenu,
  touch,
}: {
  m: ChatMessage;
  mine: boolean;
  url: string | undefined;
  onOpenImage: () => void;
  onDownload: () => void;
  onMenu: () => void;
  touch: boolean;
}) {
  const press = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handlers = {
    onContextMenu: (e: React.MouseEvent) => {
      e.preventDefault();
      onMenu();
    },
    onPointerDown: () => {
      if (!touch) return;
      press.current = setTimeout(onMenu, 500);
    },
    onPointerUp: () => press.current && clearTimeout(press.current),
    onPointerLeave: () => press.current && clearTimeout(press.current),
    onPointerCancel: () => press.current && clearTimeout(press.current),
  };
  const tone = mine
    ? "border border-[var(--chat-mine-border)] bg-[var(--chat-mine)] text-[var(--chat-mine-fg)]"
    : "border border-[var(--chat-other-border)] bg-[var(--chat-other)] text-[var(--chat-other-fg)]";
  const soft = mine ? "border border-[var(--chat-mine-border)] bg-[var(--chat-mine-soft)]" : "border border-[var(--chat-other-border)] bg-[var(--chat-other)]/80";
  if (m.deleted) return <span className={`rounded-2xl px-3 py-2 text-sm italic text-zinc-500 ${soft}`}>삭제된 메시지입니다.</span>;
  if (m.expired && (m.kind === "image" || m.kind === "file"))
    return (
      <span {...handlers} className={`flex max-w-64 items-center gap-2 rounded-2xl px-3 py-2.5 text-sm text-zinc-500 ${soft}`}>
        {m.kind === "image" ? <ImageOff className="size-5 shrink-0" /> : <FileText className="size-5 shrink-0" />}
        <span className="min-w-0">
          <span className="block whitespace-nowrap">보관 기간이 지난 {m.kind === "image" ? "사진" : "파일"}이에요.</span>
          {m.kind === "file" && m.attachment_name && <span className="block truncate text-xs">{m.attachment_name}</span>}
        </span>
      </span>
    );
  if (m.kind === "image") {
    const ratio = m.width && m.height ? m.width / m.height : 1;
    return (
      <button type="button" {...handlers} onClick={onOpenImage} aria-label="사진 크게 보기" className="block overflow-hidden rounded-2xl bg-white/60" style={{ width: ratio >= 1 ? 224 : Math.max(120, Math.round(224 * ratio)), aspectRatio: `${ratio}` }}>
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={m.attachment_name ?? "사진"} className={`size-full object-cover ${m.pending === "sending" ? "opacity-60" : ""}`} />
        ) : (
          <span className="flex size-full items-center justify-center">
            <Loader2 className="size-5 animate-spin text-zinc-500" />
          </span>
        )}
      </button>
    );
  }
  if (m.kind === "file")
    return (
      <button type="button" {...handlers} onClick={onDownload} disabled={!!m.pending} className={`flex w-60 max-w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left ${tone}`}>
        <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-black/5">
          <FileText className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{m.attachment_name}</span>
          <span className="block text-xs text-zinc-600">{fileSizeLabel(m.attachment_size)} · 받기</span>
        </span>
      </button>
    );
  return (
    <span {...handlers} className={`select-text whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-[15px] leading-snug [overflow-wrap:anywhere] ${tone} ${mine ? "rounded-tr-md" : "rounded-tl-md"}`}>
      {m.body}
    </span>
  );
}

// [알림]방 글(D-206). 회의 10분 전 글은 카드로(D-217): 시간·제목·장소·안건 첫 줄·자료 수 + [안건·자료 보기]
function NoticeBubble({ body, link }: { body: string | null; link: string | null }) {
  const card = meetingNoticeCard(body);
  if (!card) {
    // 앱 알림 카드(D-224): 첫 줄 = 제목, 나머지 = "이름: 값" 줄 또는 글
    const n = noticeCard(body);
    return (
      <article aria-label={`알림: ${n.title}`} className="w-64 min-w-0 max-w-full overflow-hidden rounded-2xl rounded-tl-md border border-[var(--chat-other-border)] bg-white text-sm shadow-sm" data-notice-card>
        <p className="flex items-center gap-1.5 bg-brand-50 px-3 py-2 text-xs font-bold text-brand-800">
          <Bell className="size-4 shrink-0" />
          <span className="min-w-0 break-words">{n.title}</span>
        </p>
        {n.rows.length > 0 && (
          <dl className="flex flex-col gap-1 px-3 py-2.5">
            {n.rows.map((r, i) =>
              r.label ? (
                <div key={i} className="flex gap-2">
                  <dt className="shrink-0 text-zinc-500">{r.label}</dt>
                  <dd className="min-w-0 break-words font-medium text-zinc-900">{r.value}</dd>
                </div>
              ) : (
                <p key={i} className="whitespace-pre-line break-words leading-relaxed text-zinc-800">
                  {r.value}
                </p>
              ),
            )}
          </dl>
        )}
        {link && (
          <Link href={link} className="flex min-h-11 items-center justify-center border-t border-zinc-100 px-3 text-sm font-semibold text-brand-700 hover:bg-zinc-50">
            {assistantLinkLabel(link)}
          </Link>
        )}
      </article>
    );
  }
  return (
    <article aria-label="회의 시작 10분 전 안내" className="w-64 min-w-0 max-w-full overflow-hidden rounded-2xl rounded-tl-md border border-[var(--chat-other-border)] bg-white text-sm shadow-sm">
      <p className="flex items-center gap-1.5 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">
        <AlarmClock className="size-4" />
        회의 시작 10분 전
      </p>
      <div className="flex flex-col gap-1.5 px-3 py-2.5">
        <p className="break-words text-base font-bold leading-snug text-zinc-900">{card.title}</p>
        <p className="font-semibold tabular-nums text-brand-700">{card.time}</p>
        {card.place && (
          <p className="flex items-start gap-1.5 text-zinc-700">
            <MapPin className="mt-0.5 size-4 shrink-0 text-zinc-400" />
            <span className="break-words">{card.place}</span>
          </p>
        )}
        {card.agenda && (
          <p className="flex items-start gap-1.5 text-zinc-700">
            <ListChecks className="mt-0.5 size-4 shrink-0 text-zinc-400" />
            <span className="break-words">{card.agenda}</span>
          </p>
        )}
        {card.files > 0 && (
          <p className="flex items-center gap-1.5 text-zinc-700">
            <Paperclip className="size-4 shrink-0 text-zinc-400" />
            회의 자료 {card.files}개
          </p>
        )}
      </div>
      {link && (
        <Link href={link} className="flex min-h-11 items-center justify-center border-t border-zinc-100 px-3 text-sm font-semibold text-brand-700 hover:bg-zinc-50">
          {card.agenda || card.files ? "안건·자료 보기" : "캘린더에서 보기"}
        </Link>
      )}
    </article>
  );
}


// 읽음 확인(D-244): 단체방·결의서 방에서 이 글을 읽은 사람·안 읽은 사람. 읽음이 오면 바로 바뀐다(members가 실시간으로 갱신)
function ReadSheet({ msg, members, onClose }: { msg: ChatMessage; members: ChatMember[]; onClose: () => void }) {
  const { read, unread } = readersFor(msg, members);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const list = (title: string, people: ChatMember[], attr: string) => (
    <section aria-label={title} {...{ [attr]: "" }}>
      <h3 className="px-4 pb-1 pt-3 text-[13px] font-bold text-zinc-600">
        {title} <span className="text-zinc-900">{people.length}명</span>
      </h3>
      {people.length === 0 ? (
        <p className="px-4 pb-2 text-sm text-zinc-500">없어요</p>
      ) : (
        <ul>
          {people.map((p) => (
            <li key={p.member_id} className="flex min-h-12 items-center gap-3 px-4 py-1.5">
              <Avatar id={p.member_id} name={p.name} size="sm" />
              <span className="text-[15px]">{displayName(p)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
  return (
    <ChatOverlay>
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 md:items-center" onClick={onClose} role="dialog" aria-modal aria-labelledby="read-sheet-title">
        <div className="flex max-h-[80dvh] w-full max-w-sm flex-col overflow-hidden rounded-t-2xl bg-white pb-[env(safe-area-inset-bottom)] md:rounded-2xl" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-2 border-b border-zinc-100 px-4 py-3">
            <h2 id="read-sheet-title" className="text-base font-bold">
              읽음 확인
            </h2>
            <button type="button" onClick={onClose} aria-label="닫기" className="ml-auto inline-flex size-10 items-center justify-center rounded-lg text-zinc-600 hover:bg-zinc-100">
              <X className="size-5" />
            </button>
          </div>
          <p className="truncate border-b border-zinc-100 bg-zinc-50 px-4 py-2 text-sm text-zinc-700">
            {timeLabel(msg.created_at)} · {previewText(msg) || "메시지"}
          </p>
          <div className="min-h-0 flex-1 overflow-y-auto pb-2">
            {list("안 읽음", unread, "data-unread-list")}
            {list("읽음", read, "data-read-list")}
          </div>
        </div>
      </div>
    </ChatOverlay>
  );
}
