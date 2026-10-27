// 서버 작업이 응답 없이 실패했을 때(인터넷 끊김·서버가 엉뚱한 응답을 줌 등) 예외 대신 실패 결과로 바꾼다(7-15).
// 예외가 그대로 올라가면 화면 전체가 오류 화면으로 바뀌어 작성 중이던 내용이 사라지므로, 입력이 많은 화면에서 감싼다.
// 화면 이동(redirect·notFound)은 Next가 처리해야 하므로 그대로 던진다.

export const OFFLINE_MESSAGE = "인터넷 연결이 끊겨 저장하지 못했어요. 연결을 확인한 뒤 다시 시도해 주세요.";
export const UNREACHABLE_MESSAGE = "서버와 연결하지 못했어요. 잠시 뒤 다시 시도하거나, 계속되면 새로고침해 주세요.";

export function thrownActionMessage(): string {
  return typeof navigator !== "undefined" && navigator.onLine === false ? OFFLINE_MESSAGE : UNREACHABLE_MESSAGE;
}

function isNavigationSignal(e: unknown): boolean {
  const digest = (e as { digest?: unknown } | null)?.digest;
  return typeof digest === "string" && digest.startsWith("NEXT_");
}

export async function guardAction<T>(run: () => Promise<T>): Promise<T | { ok: false; error: string }> {
  try {
    return await run();
  } catch (e) {
    if (isNavigationSignal(e)) throw e;
    return { ok: false, error: thrownActionMessage() };
  }
}
