import { Bell, FileText, Users } from "lucide-react";
import { LogoMark } from "@/components/brand/logo";
import { avatarColor, type ChatKind } from "@/lib/chat/format";

// 카톡처럼 둥근 네모 프로필(사진 대신 이름 첫 글자)
export function Avatar({ id, name, size = "md" }: { id: string | null; name: string | null; size?: "sm" | "md" | "lg" }) {
  const cls = size === "lg" ? "size-12 text-lg" : size === "sm" ? "size-8 text-xs" : "size-10 text-sm";
  return (
    <span aria-hidden className={`inline-flex shrink-0 items-center justify-center rounded-[38%] font-semibold ${cls} ${avatarColor(id)}`}>
      {(name ?? "?").trim().slice(0, 1) || "?"}
    </span>
  );
}

export function RoomAvatar({ kind, other }: { kind: ChatKind; other?: { member_id: string; name: string } | null }) {
  if (kind === "direct") return <Avatar id={other?.member_id ?? null} name={other?.name ?? "?"} size="lg" />;
  if (kind === "assistant") return <LogoMark className="size-12 rounded-[38%]" />;
  if (kind === "notice")
    return (
      <span aria-hidden className="inline-flex size-12 shrink-0 items-center justify-center rounded-[38%] bg-amber-100 text-amber-700">
        <Bell className="size-6" />
      </span>
    );
  return (
    <span aria-hidden className={`inline-flex size-12 shrink-0 items-center justify-center rounded-[38%] ${kind === "claim" ? "bg-brand-100 text-brand-700" : "bg-zinc-200 text-zinc-700"}`}>
      {kind === "claim" ? <FileText className="size-6" /> : <Users className="size-6" />}
    </span>
  );
}
