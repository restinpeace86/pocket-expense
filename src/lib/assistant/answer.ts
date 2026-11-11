import "server-only";
import { isAdminRole, type Membership } from "@/lib/auth/paths";
import { busyRanges, DAY_SLOTS, dayLabel, eventsOnDay, placeLabel, slotEndOf, slotTime, timeLabelOn, todayKst, type CalEvent, type MeetingRoom, type SlotRange } from "@/lib/calendar/calendar";
import { getReviewerInbox } from "@/lib/claims/inbox";
import { formatWon } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { normalizeAiIntent, ruleIntent, type Intent, type OpenTarget } from "./intent";

// WORKON 도우미 답(D-222, spec/features/assistant.md)
// - 할 일은 조회·화면 이동뿐. 데이터는 로그인한 사람의 권한으로 지금 쓰는 DB 함수·표에서 꺼낸다(RLS·회사 분리 그대로 — AI는 데이터를 보지 않음)
// - 답 글은 코드가 정해진 모양으로 쓴다(AI가 숫자·일정을 지어내지 않게). AI(Gemini)는 규칙으로 못 알아들은 질문의 "무엇을 할지"만 고른다
type Who = Pick<Membership, "company_id" | "member_id" | "role">;
type Supa = Awaited<ReturnType<typeof createClient>>;
export type AssistantReply = { body: string; link: string | null };

const HELP = [
  "저는 WORKON 도우미예요. 지금은 이런 걸 찾아 드려요:",
  "· 내 일정 — \"오늘 일정\", \"내일 일정\", \"11월 7일 일정\"",
  "· 회의실 빈 시간 — \"내일 회의실 빈 시간\", \"3층 회의실 오늘 언제 비어?\"",
  "· 내 결의서 — \"임시저장한 결의서\", \"반려된 결의서\"",
  "· 승인 대기 — \"승인 대기 몇 건?\"(결재하는 분)",
  "· 화면 열기 — \"회의실 예약 열어줘\", \"새 결의서 쓰기\"",
  "예약·승인처럼 바꾸는 일은 아직 못 하고, 해당 화면으로 안내해 드려요.",
].join("\n");

const OPEN_LABEL: Record<OpenTarget, string> = {
  calendar: "캘린더",
  rooms: "회의실 예약",
  claims: "내 결의서",
  new_claim: "새 결의서 쓰기",
  approvals: "결재",
  settlements: "정산",
  chat: "채팅 목록",
  profile: "내 정보",
};
function openPath(t: OpenTarget, ws: string, who: Who): string {
  const admin = isAdminRole(who.role);
  switch (t) {
    case "calendar":
      return `${ws}/calendar`;
    case "rooms":
      return `${ws}/calendar/rooms`;
    case "claims":
      return `${ws}/employee/claims`;
    case "new_claim":
      return `${ws}/employee/claims`;
    case "approvals":
      return admin ? `${ws}/admin/claims` : `${ws}/approvals`;
    case "settlements":
      return admin ? `${ws}/admin/payouts` : `${ws}/employee/settlements`;
    case "chat":
      return `${ws}/chat`;
    case "profile":
      return `${ws}/employee/profile`;
  }
}

// 규칙 → 못 알아들으면 Gemini(같은 모양만 받음). 키가 없거나 실패하면 도움말
export async function understand(text: string, today: string): Promise<Intent> {
  const r = ruleIntent(text, today);
  if (r) return r;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { tool: "help" };
  const model = process.env.GEMINI_ASSISTANT_MODEL || process.env.GEMINI_MODEL || "gemini-flash-lite-latest";
  const prompt = `너는 사내 업무 앱 WORKON의 도우미다. 사용자의 한국어 질문을 아래 도구 중 하나로만 분류해 JSON으로 답하라. 오늘은 ${today}(한국 시간).
tool: "schedule"(내 일정, day) | "rooms"(회의실 빈 시간, day, room=회의실 이름이 있으면) | "my_claims"(내 결의서, filter=draft|rejected|open) | "approvals"(내가 승인할 결의서) | "open"(화면 열기, target=calendar|rooms|claims|new_claim|approvals|settlements|chat|profile) | "help"(사용법·인사) | "unsupported"(그 밖의 모든 것: 분석·작성·검색·예약하기·승인하기 등).
day는 YYYY-MM-DD. 확실하지 않으면 unsupported.
질문: ${JSON.stringify(text.slice(0, 300))}`;
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0,
          maxOutputTokens: 120,
          responseSchema: {
            type: "OBJECT",
            properties: { tool: { type: "STRING" }, day: { type: "STRING" }, room: { type: "STRING" }, filter: { type: "STRING" }, target: { type: "STRING" } },
            required: ["tool"],
          },
        },
      }),
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    if (!res.ok) return { tool: "help" };
    const json = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    const raw = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    return normalizeAiIntent(JSON.parse(raw), today);
  } catch {
    return { tool: "help" };
  }
}

// 비어 있는 칸(지난 시간 빼고, 기본 08~20시)
function freeRanges(busy: SlotRange[], day: string, today: string): SlotRange[] {
  const from = Math.max(8 * 6, day === today ? slotEndOf(new Date().toISOString(), day) : 0);
  const to = 20 * 6;
  const out: SlotRange[] = [];
  let cur = from;
  for (const b of [...busy].sort((a, c) => a.from - c.from)) {
    if (b.to <= cur) continue;
    if (b.from > cur) out.push({ from: cur, to: Math.min(b.from, to) });
    cur = Math.max(cur, b.to);
    if (cur >= to) break;
  }
  if (cur < to) out.push({ from: cur, to });
  return out.filter((r) => r.to > r.from && r.from < DAY_SLOTS);
}

const calendarOff = (msg?: string) => /FEATURE_DISABLED/.test(msg ?? "");

export async function answer(text: string, who: Who): Promise<AssistantReply> {
  const supabase: Supa = await createClient();
  const today = todayKst();
  const ws = `/workspace/${who.company_id}`;
  const intent = await understand(text, today);

  switch (intent.tool) {
    case "help":
      return { body: HELP, link: null };
    case "unsupported":
      return { body: "그건 아직 도와드리지 못해요. 지금은 일정·회의실 빈 시간·내 결의서·승인 대기 찾기와 화면 열기만 할 수 있어요. \"도움말\"이라고 쳐 보세요.", link: null };
    case "open":
      return {
        body: intent.target === "new_claim" ? "내 결의서 화면을 열어 드릴게요. 아래 큰 버튼으로 영수증을 찍어 새 결의서를 시작하세요." : `${OPEN_LABEL[intent.target]} 화면을 열어 드릴게요.`,
        link: openPath(intent.target, ws, who),
      };

    case "schedule": {
      const { data, error } = await supabase.rpc("calendar_events_range", { p_from: intent.day, p_to: intent.day, p_members: [who.member_id] });
      if (error) return { body: calendarOff(error.message) ? "회사에서 사내 캘린더를 쓰지 않아요. 관리자가 설정 › 기능 사용에서 켤 수 있어요." : "일정을 불러오지 못했어요. 잠시 뒤 다시 물어봐 주세요.", link: null };
      const list = eventsOnDay((data as unknown as CalEvent[]) ?? [], intent.day).filter((e) => e.attendees.find((a) => a.member_id === who.member_id)?.response !== "declined");
      const head = `${dayLabel(intent.day)} 내 일정`;
      if (!list.length) return { body: `${head}은 없어요.`, link: `${ws}/calendar?date=${intent.day}` };
      const lines = list.slice(0, 8).map((e) => `· ${timeLabelOn(e, intent.day)} ${e.title}${placeLabel(e) ? ` (${placeLabel(e)})` : ""}`);
      return { body: [`${head} ${list.length}건`, ...lines, ...(list.length > 8 ? [`외 ${list.length - 8}건`] : [])].join("\n"), link: `${ws}/calendar?date=${intent.day}` };
    }

    case "rooms": {
      const [{ data: rooms, error: e1 }, { data: books, error: e2 }] = await Promise.all([
        supabase.rpc("calendar_rooms"),
        supabase.rpc("calendar_room_bookings", { p_starts: `${intent.day}T00:00:00+09:00`, p_ends: new Date(Date.parse(`${intent.day}T00:00:00+09:00`) + 86400_000).toISOString() }),
      ]);
      if (e1 || e2) return { body: calendarOff(e1?.message ?? e2?.message) ? "회사에서 사내 캘린더를 쓰지 않아요." : "회의실 현황을 불러오지 못했어요. 잠시 뒤 다시 물어봐 주세요.", link: null };
      let list = (rooms as unknown as MeetingRoom[]) ?? [];
      if (!list.length) return { body: "등록된 회의실이 없어요. 관리자가 설정 › 회사 자산 › 회의실에서 추가할 수 있어요.", link: null };
      if (intent.room) {
        const key = intent.room.replace(/\s+/g, "");
        const hit = list.filter((r) => r.name.replace(/\s+/g, "").includes(key) || key.includes(r.name.replace(/\s+/g, "")));
        if (hit.length) list = hit;
      }
      if (intent.day < today) return { body: `${dayLabel(intent.day)}은 지난 날이에요.`, link: `${ws}/calendar/rooms?date=${intent.day}` };
      const bookings = (books as unknown as CalEvent[]) ?? [];
      const lines = list.slice(0, 10).map((r) => {
        const free = freeRanges(busyRanges(bookings, r.id, intent.day), intent.day, today);
        return `· ${r.name}: ${free.length ? `${free.map((f) => `${slotTime(f.from)}~${slotTime(f.to)}`).join(", ")} 비어 있어요` : "08~20시 사이 빈 시간이 없어요"}`;
      });
      return { body: [`${dayLabel(intent.day)} 회의실 빈 시간(08~20시)`, ...lines].join("\n"), link: `${ws}/calendar/rooms?date=${intent.day}${list.length === 1 ? `&room=${list[0].id}` : ""}` };
    }

    case "my_claims": {
      const statuses: ("draft" | "rejected")[] = intent.filter === "draft" ? ["draft"] : intent.filter === "rejected" ? ["rejected"] : ["draft", "rejected"];
      const { data, error } = await supabase
        .from("expense_claims")
        .select("id, title, status, total_amount, rejection_reason, updated_at")
        .eq("company_id", who.company_id)
        .eq("member_id", who.member_id)
        .in("status", statuses)
        .order("updated_at", { ascending: false })
        .limit(20);
      if (error) return { body: "결의서를 불러오지 못했어요. 잠시 뒤 다시 물어봐 주세요.", link: null };
      const rows = data ?? [];
      const what = intent.filter === "draft" ? "작성 중(임시저장) 결의서" : intent.filter === "rejected" ? "반려된 결의서" : "아직 올리지 않았거나 반려된 결의서";
      const listLink = intent.filter === "open" ? `${ws}/employee/claims` : `${ws}/employee/claims?status=${intent.filter}`;
      if (!rows.length) return { body: `${what}는 없어요. 👍`, link: null };
      const lines = rows.slice(0, 5).map((c) => `· ${c.status === "rejected" ? "[반려] " : "[작성 중] "}${c.title?.trim() || "제목 없음"} · ${formatWon(c.total_amount ?? 0)}${c.status === "rejected" && c.rejection_reason ? ` — ${c.rejection_reason.slice(0, 40)}` : ""}`);
      const link = rows.length === 1 ? `${ws}/employee/claims/${rows[0].id}/edit` : listLink;
      return { body: [`${what} ${rows.length}건`, ...lines, ...(rows.length > 5 ? [`외 ${rows.length - 5}건`] : [])].join("\n"), link };
    }

    case "approvals": {
      if (isAdminRole(who.role)) {
        const { data, error } = await supabase.from("expense_claims").select("id, title, total_amount, member_id").eq("company_id", who.company_id).eq("status", "submitted").order("submitted_at", { ascending: true }).limit(50);
        if (error) return { body: "승인 대기를 불러오지 못했어요. 잠시 뒤 다시 물어봐 주세요.", link: null };
        const rows = data ?? [];
        if (!rows.length) return { body: "승인 대기 중인 결의서는 없어요.", link: `${ws}/admin/claims` };
        const ids = [...new Set(rows.map((r) => r.member_id))];
        const { data: ms } = await supabase.from("members").select("id, name").in("id", ids);
        const name = new Map((ms ?? []).map((m) => [m.id, m.name]));
        const lines = rows.slice(0, 5).map((r) => `· ${name.get(r.member_id) ?? ""} — ${r.title?.trim() || "제목 없음"} · ${formatWon(r.total_amount ?? 0)}`);
        return { body: [`승인 대기 ${rows.length}건(오래된 순)`, ...lines, ...(rows.length > 5 ? [`외 ${rows.length - 5}건`] : [])].join("\n"), link: `${ws}/admin/claims` };
      }
      const list = await getReviewerInbox(who.company_id, who.member_id, "waiting");
      if (!list.length) return { body: "내가 검토할 결의서는 없어요.", link: null };
      const lines = list.slice(0, 5).map((r) => `· ${r.member_name} — ${r.title?.trim() || "제목 없음"} · ${formatWon(r.total_amount)}`);
      return { body: [`내 검토 차례 ${list.length}건`, ...lines].join("\n"), link: `${ws}/approvals` };
    }
  }
}
