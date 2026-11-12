"use client";

import { ImagePlus, Loader2, Siren, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { submitFeedbackAction } from "@/app/workspace/[id]/feedback/actions";
import {
  FEEDBACK_CATEGORY,
  FEEDBACK_DAILY_LIMIT,
  FEEDBACK_DONE,
  FEEDBACK_ERROR,
  FEEDBACK_MAX,
  FEEDBACK_PLACEHOLDER,
  FEEDBACK_SHOT_MAX_BYTES,
  FEEDBACK_SHOT_TYPES,
  feedbackInputError,
  viewportLabel,
  type FeedbackCategory,
} from "@/lib/feedback-desk/format";
import { processFeedbackShot } from "@/lib/receipts/image";
import { createClient } from "@/lib/supabase/client";
import { BRAND } from "@/lib/brand";

const DRAFT_KEY = "workon-feedback-draft"; // 저장 키는 예전 이름 그대로(D-251)

// 의견 보내기(D-246, spec/features/improvement-2026-11.md §C): 머리글 아이콘 → 버그 신고 / 기능 개선 → 운영자에게
// variant: icon = 머리글 아이콘, row = 관리자 휴대폰 메뉴(서랍) 안 한 줄(머리글이 좁아 회사 이름이 가려지지 않게)
export function FeedbackButton({
  variant = "icon",
  className = "",
}: {
  variant?: "icon" | "row";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {variant === "row" ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={`flex min-h-12 w-full items-center gap-3 rounded-xl px-4 text-left text-sm font-medium hover:bg-sidebar-hover ${className}`}
          data-feedback-open
        >
          <Siren className="size-5" aria-hidden />
          의견 보내기{" "}
          <span className="text-xs opacity-75">버그 신고 · 기능 개선</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="의견 보내기"
          title="의견 보내기 (버그 신고 · 기능 개선)"
          className={`size-11 items-center justify-center rounded-xl border border-zinc-300 text-zinc-700 hover:bg-zinc-50 ${className || "inline-flex"}`}
          data-feedback-open
        >
          <Siren className="size-5" aria-hidden />
        </button>
      )}
      {open && <FeedbackDialog onClose={() => setOpen(false)} />}
    </>
  );
}

// 로그인이 풀려 못 보냈던 내용 다시 채우기(한 번 쓰면 지움)
function readDraft(): { category: FeedbackCategory | null; content: string } {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return { category: null, content: "" };
    sessionStorage.removeItem(DRAFT_KEY);
    const d = JSON.parse(raw) as { category?: string; content?: unknown };
    return {
      category:
        d.category === "bug" || d.category === "feature" ? d.category : null,
      content: typeof d.content === "string" ? d.content : "",
    };
  } catch {
    return { category: null, content: "" };
  }
}

function FeedbackDialog({ onClose }: { onClose: () => void }) {
  const pathname = usePathname();
  const [draft] = useState(readDraft);
  const [category, setCategory] = useState<FeedbackCategory | null>(
    draft.category,
  );
  const [content, setContent] = useState(draft.content);
  const [shot, setShot] = useState<Blob | null>(null);
  const [shotUrl, setShotUrl] = useState<string | null>(null);
  const [nudged, setNudged] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [login, setLogin] = useState(false);
  const [today, setToday] = useState<number | null>(null);
  const [done, setDone] = useState<FeedbackCategory | null>(null);
  const [busy, start] = useTransition();
  const [shotBusy, setShotBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void createClient()
      .rpc("feedback_today_count")
      .then(({ data }) => typeof data === "number" && setToday(data));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(
    () => () => {
      if (shotUrl) URL.revokeObjectURL(shotUrl);
    },
    [shotUrl],
  );

  const takeShot = useCallback(async (file: Blob | null | undefined) => {
    if (!file) return;
    if (!FEEDBACK_SHOT_TYPES[file.type] && !file.type.startsWith("image/"))
      return setError(FEEDBACK_ERROR.shotType);
    setError(null);
    setShotBusy(true);
    try {
      const out = await processFeedbackShot(file, FEEDBACK_SHOT_MAX_BYTES);
      if (out.size > FEEDBACK_SHOT_MAX_BYTES)
        return setError(FEEDBACK_ERROR.shotSize);
      setShot(out);
      setShotUrl(URL.createObjectURL(out));
    } catch {
      setError(FEEDBACK_ERROR.shotType);
    } finally {
      setShotBusy(false);
    }
  }, []);

  // PC: 캡처한 화면을 Ctrl+V로 붙여넣기(버그 신고일 때)
  const onPaste = (e: React.ClipboardEvent) => {
    if (category !== "bug") return;
    const item = [...e.clipboardData.items].find(
      (i) => i.kind === "file" && i.type.startsWith("image/"),
    );
    if (!item) return;
    e.preventDefault();
    void takeShot(item.getAsFile());
  };

  const removeShot = () => {
    setShot(null);
    setShotUrl(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const limitReached = today !== null && today >= FEEDBACK_DAILY_LIMIT;

  const submit = () => {
    const invalid = feedbackInputError(category, content);
    if (invalid) return setError(invalid);
    // 버그 신고에 캡처가 없으면 한 번만 권하고, 다시 누르면 그대로 보낸다(막지 않음)
    if (category === "bug" && !shot && !nudged) {
      setNudged(true);
      setError(null);
      return;
    }
    start(async () => {
      setError(null);
      const fd = new FormData();
      fd.set("category", category!);
      fd.set("content", content);
      fd.set("page", window.location.href);
      fd.set("viewport", viewportLabel(window.innerWidth, window.innerHeight));
      if (category === "bug" && shot)
        fd.set(
          "shot",
          new File([shot], "capture.jpg", { type: shot.type || "image/jpeg" }),
        );
      try {
        const r = await submitFeedbackAction(fd);
        if (!r.ok) {
          if (r.login) {
            try {
              sessionStorage.setItem(
                DRAFT_KEY,
                JSON.stringify({ category, content }),
              );
            } catch {
              // 저장 못 해도 안내는 보임
            }
            setLogin(true);
          }
          return setError(r.error);
        }
        setDone(category);
      } catch {
        setError(FEEDBACK_ERROR.failed);
      }
    });
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/30 md:items-center"
      onClick={onClose}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="feedback-title"
        onClick={(e) => e.stopPropagation()}
        onPaste={onPaste}
        className="flex max-h-[92dvh] w-full max-w-md flex-col gap-3.5 overflow-y-auto rounded-t-3xl bg-white px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-5 text-zinc-900 md:rounded-3xl"
        data-feedback-dialog
      >
        {done ? (
          <div className="flex flex-col gap-3.5" data-feedback-done={done}>
            <span
              className="flex size-14 items-center justify-center self-center rounded-2xl bg-brand-50 text-3xl"
              aria-hidden
            >
              {FEEDBACK_CATEGORY[done].emoji}
            </span>
            <h2 id="feedback-title" className="text-center text-lg font-bold">
              {FEEDBACK_DONE[done].title}
            </h2>
            <div
              className={`flex flex-col gap-2.5 text-[14px] leading-relaxed text-zinc-700 ${done === "bug" ? "text-center" : ""}`}
            >
              {FEEDBACK_DONE[done].paragraphs.map((p) => (
                <p key={p} className="break-keep">
                  {p}
                </p>
              ))}
            </div>
            <button
              type="button"
              onClick={onClose}
              autoFocus
              className="flex h-12 items-center justify-center rounded-xl bg-brand-600 font-semibold text-white hover:bg-brand-700"
            >
              확인
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center">
              <h2 id="feedback-title" className="text-lg font-bold">
                의견 보내기
              </h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="닫기"
                className="ml-auto flex size-10 items-center justify-center rounded-lg text-zinc-600 hover:bg-zinc-100"
              >
                <X className="size-5" />
              </button>
            </div>
            <p className="-mt-2 break-keep text-[13px] text-zinc-600">
              {BRAND.name} 만드는 사람들에게 바로 전달돼요. 회사 관리자는 보지 않아요.
            </p>
            <fieldset className="grid grid-cols-2 gap-2">
              <legend className="mb-2 text-sm font-bold">
                어떤 의견인가요?
              </legend>
              {(["bug", "feature"] as const).map((c) => (
                <label
                  key={c}
                  className={`flex cursor-pointer flex-col items-center rounded-2xl border px-2 py-3 text-center has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-500 ${category === c ? "border-2 border-brand-600 bg-brand-50" : "border-zinc-200"}`}
                >
                  <input
                    type="radio"
                    name="feedback-category"
                    value={c}
                    checked={category === c}
                    onChange={() => {
                      setCategory(c);
                      setError(null);
                      setNudged(false);
                    }}
                    className="sr-only"
                    data-feedback-category={c}
                  />
                  <span className="text-2xl" aria-hidden>
                    {FEEDBACK_CATEGORY[c].emoji}
                  </span>
                  <b className="mt-1 text-[15px]">
                    {FEEDBACK_CATEGORY[c].label}
                  </b>
                  <span className="text-xs text-zinc-600">
                    {FEEDBACK_CATEGORY[c].sub}
                  </span>
                </label>
              ))}
            </fieldset>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-bold">내용</span>
              <textarea
                value={content}
                onChange={(e) =>
                  setContent(e.target.value.slice(0, FEEDBACK_MAX))
                }
                placeholder={FEEDBACK_PLACEHOLDER}
                rows={5}
                className="min-h-32 resize-y rounded-xl border border-zinc-300 p-3 text-[15px] leading-relaxed focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                data-feedback-content
              />
              <span className="flex justify-between gap-2 text-xs text-zinc-600">
                <span className="break-keep">
                  개인정보(주민번호·계좌 등)는 적지 말아 주세요.
                </span>
                <span className="shrink-0 tabular-nums">
                  {content.length.toLocaleString("ko-KR")} /{" "}
                  {FEEDBACK_MAX.toLocaleString("ko-KR")}
                </span>
              </span>
            </label>
            {category === "bug" && (
              <div className="flex flex-col gap-2" data-feedback-shot-area>
                <span className="text-sm font-bold">
                  화면 캡처{" "}
                  <span className="font-normal text-zinc-600">
                    (1장, 있으면 훨씬 빨리 고칠 수 있어요)
                  </span>
                </span>
                {shotUrl ? (
                  <div className="flex items-center gap-3 rounded-xl border border-zinc-200 p-2">
                    {/* eslint-disable-next-line @next/next/no-img-element -- 브라우저 안 임시 미리보기 */}
                    <img
                      src={shotUrl}
                      alt="붙인 화면 캡처"
                      className="h-20 w-28 rounded-lg bg-zinc-100 object-contain"
                      data-feedback-shot-preview
                    />
                    <span className="min-w-0 flex-1 text-xs text-zinc-600">
                      캡처를 붙였어요.
                    </span>
                    <button
                      type="button"
                      onClick={removeShot}
                      className="h-10 rounded-lg border border-zinc-300 px-3 text-sm font-medium hover:bg-zinc-50"
                      data-feedback-shot-remove
                    >
                      빼기
                    </button>
                  </div>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      disabled={shotBusy}
                      className="flex h-12 items-center justify-center gap-2 rounded-xl border-2 border-dashed border-zinc-300 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-70"
                      data-feedback-shot-pick
                    >
                      {shotBusy ? (
                        <Loader2 className="size-4 animate-spin" aria-hidden />
                      ) : (
                        <ImagePlus className="size-4" aria-hidden />
                      )}
                      화면 캡처 붙이기
                    </button>
                    <span className="hidden text-xs text-zinc-600 md:block">
                      PC에서는 캡처한 뒤 이 창에서 Ctrl+V로 붙여 넣어도 돼요.
                    </span>
                  </>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  tabIndex={-1}
                  aria-hidden
                  onChange={(e) => void takeShot(e.target.files?.[0])}
                  data-feedback-shot-input
                />
              </div>
            )}
            <p className="break-keep rounded-xl bg-zinc-100 px-3 py-2 text-xs leading-relaxed text-zinc-700">
              보내면 지금 보고 있는 <b>화면 주소</b>와 <b>브라우저·기기 정보</b>
              가 함께 전달돼요. 문제를 빨리 찾는 데 써요.
            </p>
            {nudged && category === "bug" && !shot && (
              <p
                role="status"
                className="break-keep rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] text-amber-950"
                data-feedback-nudge
              >
                캡처가 있으면 훨씬 빨리 고칠 수 있어요. 그래도 보낼까요? 한 번
                더 누르면 캡처 없이 보내요.
              </p>
            )}
            {limitReached && (
              <p
                role="status"
                className="text-[13px] font-semibold text-amber-800"
              >
                오늘 회사 의견을 {FEEDBACK_DAILY_LIMIT}건 모두 보냈어요. 내일
                다시 보내 주세요.
              </p>
            )}
            {error && (
              <p
                role="alert"
                className="text-sm font-semibold text-red-700"
                data-feedback-error
              >
                {error}{" "}
                {login && (
                  <a
                    href={`/login?next=${encodeURIComponent(pathname)}`}
                    className="underline"
                  >
                    다시 로그인
                  </a>
                )}
              </p>
            )}
            <button
              type="button"
              onClick={submit}
              disabled={busy || shotBusy || limitReached}
              className="flex h-12 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-brand-600 font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
              data-feedback-submit
            >
              {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
              {nudged && category === "bug" && !shot
                ? "캡처 없이 보내기"
                : "보내기"}
            </button>
            {today !== null && !limitReached && (
              <p className="-mt-1.5 text-center text-xs text-zinc-500">
                오늘 회사에서 보낸 의견 {today}/{FEEDBACK_DAILY_LIMIT}건
              </p>
            )}
          </>
        )}
      </section>
    </div>
  );
}
