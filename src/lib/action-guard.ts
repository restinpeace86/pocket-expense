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

// Supabase 호출이 '서버가 거절'한 게 아니라 '인터넷이 안 돼서' 실패했는지(비정상 사용 점검 2026-11-14).
// 끊김을 '없는 방·권한 없음'으로 보여 주면 사용자가 보던 화면·쓰던 글을 잃는다
export function isNetworkFailure(e: { message?: string } | null | undefined): boolean {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  return /failed to fetch|networkerror|load failed|network request failed|fetch failed/i.test(e?.message ?? "");
}

// 감싼 서버 작업(guarded): import한 작업을 그대로 바꿔 끼워, 인터넷 끊김·서버 응답 없음이 화면 전체 오류가 되지 않게 한다
export function guarded<A extends unknown[], R>(fn: (...args: A) => Promise<R>): (...args: A) => Promise<R | { ok: false; error: string }> {
  return (...args: A) => guardAction(() => fn(...args));
}

// <form action>(useActionState)용: 실패하면 안내 + 사용자가 친 값을 그대로 돌려줘 칸이 비지 않게 한다
type FormLikeState = { error: string | null; values?: Record<string, string> };
export function guardedForm<S extends FormLikeState>(fn: (prev: S, form: FormData) => Promise<S>): (prev: S, form: FormData) => Promise<S> {
  return async (prev, form) => {
    try {
      return await fn(prev, form);
    } catch (e) {
      if (isNavigationSignal(e)) throw e;
      const values: Record<string, string> = {};
      form.forEach((v, k) => {
        if (typeof v === "string" && !k.startsWith("$ACTION")) values[k] = v;
      });
      return { ...prev, error: thrownActionMessage(), values };
    }
  };
}
