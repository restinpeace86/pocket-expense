"use client";

import { ArrowDown, ArrowUp, Check, Pencil, Plus, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { deleteMeetingRoomAction, reorderMeetingRoomsAction, saveMeetingRoomAction } from "@/app/workspace/[id]/admin/calendar-settings/actions";
import { FormError } from "@/components/onboarding/field";
import { inputClass } from "@/components/ui/page-shell";
import type { MeetingRoom } from "@/lib/calendar/calendar";

type Result = { error: string | null };

// 회의실 설정(D-207): 추가·이름 변경·순서 변경·삭제
export function MeetingRoomsView({ rooms, calendarHref }: { rooms: MeetingRoom[]; calendarHref: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");

  function run(action: () => Promise<Result>, onDone?: () => void) {
    setError(null);
    startTransition(async () => {
      const r = await action();
      if (r.error) setError(r.error);
      else onDone?.();
    });
  }

  function move(index: number, delta: -1 | 1) {
    const ids = rooms.map((r) => r.id);
    const j = index + delta;
    [ids[index], ids[j]] = [ids[j], ids[index]];
    run(() => reorderMeetingRoomsAction(ids));
  }

  function remove(r: MeetingRoom) {
    const lines = [`'${r.name}' 회의실을 삭제할까요?`];
    if (r.upcoming > 0) lines.push(`앞으로 잡힌 예약 ${r.upcoming}건은 지워지지 않고, 장소에 '${r.name}' 글자로 남아요. 다시 예약을 막아 주지는 않아요.`);
    if (!confirm(lines.join("\n\n"))) return;
    run(() => deleteMeetingRoomAction(r.id));
  }

  return (
    <section className="flex flex-col gap-4">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          run(() => saveMeetingRoomAction(null, newName), () => setNewName(""));
        }}
      >
        <input
          className={inputClass}
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="새 회의실 이름 (예: 3층 회의실)"
          maxLength={50}
          aria-label="새 회의실 이름"
        />
        <button
          type="submit"
          disabled={pending || !newName.trim()}
          className="inline-flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
        >
          <Plus className="size-4" /> 추가
        </button>
      </form>
      <FormError message={error} />

      {rooms.length === 0 ? (
        <p className="rounded-xl border border-dashed border-zinc-300 bg-white px-4 py-10 text-center text-sm text-zinc-500">
          아직 등록한 회의실이 없어요. 회의실이 없으면 그대로 두고, 일정의 장소에 글자로 적으면 돼요.
        </p>
      ) : (
        <ul className="flex flex-col gap-2" aria-label="회의실 목록">
          {rooms.map((r, i) => (
            <RoomItem
              key={r.id}
              room={r}
              first={i === 0}
              last={i === rooms.length - 1}
              busy={pending}
              onMove={(delta) => move(i, delta)}
              onRename={(name, done) => run(() => saveMeetingRoomAction(r.id, name), done)}
              onDelete={() => remove(r)}
            />
          ))}
        </ul>
      )}
      <p className="text-sm text-zinc-600">
        예약은{" "}
        <Link href={calendarHref} className="font-medium text-brand-700 underline underline-offset-2">
          캘린더
        </Link>
        에서 해요. [회의실 현황]으로 오늘 비어 있는 시간을 보고 바로 잡을 수 있어요.
      </p>
    </section>
  );
}

const iconButton =
  "inline-flex size-11 shrink-0 items-center justify-center rounded-xl text-zinc-600 hover:bg-zinc-100 disabled:opacity-30 disabled:hover:bg-transparent";

function RoomItem({
  room: r,
  first,
  last,
  busy,
  onMove,
  onRename,
  onDelete,
}: {
  room: MeetingRoom;
  first: boolean;
  last: boolean;
  busy: boolean;
  onMove: (delta: -1 | 1) => void;
  onRename: (name: string, done: () => void) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(r.name);

  if (editing) {
    return (
      <li className="rounded-xl border border-brand-200 bg-white p-3">
        <form
          className="flex items-center gap-1"
          onSubmit={(e) => {
            e.preventDefault();
            onRename(name, () => setEditing(false));
          }}
        >
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} maxLength={50} aria-label="회의실 이름" autoFocus />
          <button type="submit" disabled={busy || !name.trim()} className={iconButton} aria-label="저장">
            <Check className="size-5 text-brand-600" />
          </button>
          <button
            type="button"
            className={iconButton}
            aria-label="취소"
            onClick={() => {
              setName(r.name);
              setEditing(false);
            }}
          >
            <X className="size-5" />
          </button>
        </form>
      </li>
    );
  }

  return (
    <li className="flex items-center gap-1 rounded-xl border border-zinc-200 bg-white py-2 pl-4 pr-2">
      <div className="min-w-0 flex-1">
        <p className="break-words font-medium">{r.name}</p>
        <p className="text-xs text-zinc-500">{r.upcoming > 0 ? `앞으로 예약 ${r.upcoming}건` : "앞으로 예약 없음"}</p>
      </div>
      <button type="button" className={iconButton} disabled={busy || first} onClick={() => onMove(-1)} aria-label={`${r.name} 위로`}>
        <ArrowUp className="size-4" />
      </button>
      <button type="button" className={iconButton} disabled={busy || last} onClick={() => onMove(1)} aria-label={`${r.name} 아래로`}>
        <ArrowDown className="size-4" />
      </button>
      <button type="button" className={iconButton} disabled={busy} onClick={() => setEditing(true)} aria-label={`${r.name} 이름 변경`}>
        <Pencil className="size-4" />
      </button>
      <button type="button" className={`${iconButton} hover:text-red-600`} disabled={busy} onClick={onDelete} aria-label={`${r.name} 삭제`}>
        <Trash2 className="size-4" />
      </button>
    </li>
  );
}
