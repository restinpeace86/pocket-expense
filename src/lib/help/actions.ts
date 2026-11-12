"use server";

import { requireWorkspace } from "@/lib/auth/guards";
import { isAdminRole } from "@/lib/auth/paths";
import { createClient } from "@/lib/supabase/server";
import { helpFeatures } from "./features";
import { guidesFor, isShortQuery, rankGuides } from "./guides";
import { loadHelp } from "./store";
import { BRAND } from "@/lib/brand";

// AI 도움말(D-251 개선사항 7 → D-255 DB): 질문과 가까운 도움말 글 몇 편만 골라 Gemini가 그 글만 보고 짧게 답한다.
// 글에 없으면 지어내지 않고 "도움말에 없어요". 크레딧은 쓰지 않고 한 사람 하루 20번(help_take). 단어 하나면 AI 없이 글만 바로
export type HelpAnswer =
  | { ok: true; found: boolean; answer: string | null; refs: string[]; remaining: number | null }
  | { ok: false; error: string };

export async function askHelpAction(companyId: string, mode: "admin" | "employee", question: string): Promise<HelpAnswer> {
  const q = question.trim().slice(0, 200);
  if (q.length < 1) return { ok: false, error: "궁금한 걸 적어 주세요." };
  const membership = await requireWorkspace(companyId);
  const admin = mode === "admin" && isAdminRole(membership.role);
  const picked = rankGuides(q, guidesFor(await loadHelp(), admin, await helpFeatures()), 4);
  if (isShortQuery(q)) return { ok: true, found: picked.length > 0, answer: null, refs: picked.map((g) => g.id), remaining: null };
  const supabase = await createClient();
  const { data: remaining, error } = await supabase.rpc("help_take");
  if (error) return { ok: false, error: error.message.includes("HELP_LIMIT") ? "오늘 물어볼 수 있는 20번을 다 썼어요. 아래 카테고리에서 글을 찾아보거나 단어 하나로 찾아보세요(단어 검색은 횟수에 안 들어가요)." : "지금은 답을 만들 수 없어요. 잠시 뒤 다시 해 주세요." };
  const left = Number(remaining ?? 0);
  if (!picked.length) return { ok: true, found: false, answer: null, refs: [], remaining: left };

  const apiKey = process.env.GEMINI_API_KEY;
  // 키가 없거나 AI가 실패하면 가까운 글만 보여 준다
  if (!apiKey) return { ok: true, found: true, answer: null, refs: picked.map((g) => g.id), remaining: left };
  const model = process.env.GEMINI_ASSISTANT_MODEL || process.env.GEMINI_MODEL || "gemini-flash-lite-latest";
  const docs = picked.map((g) => [`[${g.id}] ${g.title}`, g.summary, ...g.steps.map((st, i) => `${i + 1}. ${st.body}`)].join("\n")).join("\n\n");
  const prompt = `너는 업무 앱 ${BRAND.name}의 도움말 안내원이다. 아래 [도움말 글]에 적힌 내용만 근거로 사용자의 질문에 한국어 해요체로 2~4문장, 버튼 이름은 [ ]로 답하라.
글에 답이 없으면 found=false, answer는 빈 문자열. 글에 없는 기능·숫자·화면을 지어내지 마라. ids에는 근거로 쓴 글의 id(최대 2개)를 넣어라.

[도움말 글]
${docs}

[질문]
${JSON.stringify(q)}`;
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.1,
          maxOutputTokens: 400,
          responseSchema: { type: "OBJECT", properties: { found: { type: "BOOLEAN" }, answer: { type: "STRING" }, ids: { type: "ARRAY", items: { type: "STRING" } } }, required: ["found", "answer", "ids"] },
        },
      }),
      signal: AbortSignal.timeout(12000),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(String(res.status));
    const json = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    const raw = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    const out = JSON.parse(raw) as { found?: boolean; answer?: string; ids?: string[] };
    const known = new Set(picked.map((g) => g.id));
    // 검색 순위(더 가까운 글)대로 — 펼치는 글과 [이동]은 맨 앞 글
    const rank = new Map(picked.map((g, i) => [g.id, i]));
    const ids = (out.ids ?? []).filter((x) => known.has(x)).sort((x, y) => rank.get(x)! - rank.get(y)!).slice(0, 2);
    if (!out.found || !out.answer?.trim()) return { ok: true, found: false, answer: null, refs: picked.map((g) => g.id), remaining: left };
    return { ok: true, found: true, answer: out.answer.trim().slice(0, 600), refs: ids.length ? ids : [picked[0].id], remaining: left };
  } catch {
    return { ok: true, found: true, answer: null, refs: picked.map((g) => g.id), remaining: left };
  }
}
