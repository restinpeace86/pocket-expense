import "server-only";
import { cleanAiLine } from "./threads";

// 서브 대화 AI(D-246): 만들 때 제목 제안 1번, 종결할 때 한 줄 요약 1번. 키가 없거나 늦으면(3초) 빈 문자열 → 화면이 대신 채움
export async function geminiLine(prompt: string, max: number, timeoutMs = 3000): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return "";
  const model = process.env.GEMINI_ASSISTANT_MODEL || process.env.GEMINI_MODEL || "gemini-flash-lite-latest";
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.2, maxOutputTokens: 80 } }),
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });
    if (!res.ok) return "";
    const json = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    return cleanAiLine(json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "", max);
  } catch {
    return "";
  }
}

type Line = { name: string | null; kind: string; body: string | null; attachment_name: string | null };
export const lineText = (m: Line) => `${m.name ?? "알 수 없음"}: ${m.kind === "text" ? (m.body ?? "").replace(/\s+/g, " ").slice(0, 300) : m.kind === "image" ? "(사진)" : `(파일 ${m.attachment_name ?? ""})`}`;

export const titlePrompt = (root: string, before: string[]) =>
  `사내 메신저에서 아래 "원래 메시지"로 따로 이야기할 작은 대화방을 만든다. 무슨 건인지 한눈에 알 수 있는 한국어 제목을 20자 안쪽 명사형으로 하나만 써라. 따옴표·마침표·설명 없이 제목만.
${before.length ? `앞 대화:\n${before.join("\n")}\n` : ""}원래 메시지:\n${root}`;

export const summaryPrompt = (title: string, root: string, lines: string[]) =>
  `사내 메신저의 작은 대화 "${title}"가 끝났다. 무엇이 정해졌는지(결론·누가 할 일) 한국어 한 줄 40자 안쪽으로 요약하라. 따옴표·마침표·설명 없이 요약만.
원래 메시지:\n${root}\n대화:\n${lines.join("\n")}`;
