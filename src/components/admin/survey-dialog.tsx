"use client";

import { Gift, Loader2, Star, X } from "lucide-react";
import { useState, useTransition } from "react";
import { submitFeedbackSurveyAction } from "@/app/workspace/[id]/admin/billing/actions";
import { measureAction } from "@/lib/perf/client";
import { COMPANY_SIZES, INDUSTRIES, JOB_ROLES, REVIEW_MAX, SURVEY_BONUS, USEFUL_FEATURES } from "@/lib/feedback-survey";

// 후기·설문 → +100 크레딧 (7차 개선사항 7, D-130). 관리자 이상, 회사당 1회.
// done: 이미 참여한 회사면 버튼 대신 "참여 완료". preview: 반응형 점검용(제출하지 않음)
export function SurveyButton({ done, emphasize = false, preview = false }: { done: boolean; emphasize?: boolean; preview?: boolean }) {
  const [open, setOpen] = useState(false);
  const [finished, setFinished] = useState<number | null>(null);
  if (done || finished !== null) {
    return (
      <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
        <Gift className="mr-1 inline size-4" />
        {finished !== null ? `설문 고마워요! ${SURVEY_BONUS}장을 충전했어요. 남은 장수 ${finished.toLocaleString("ko-KR")}장` : `설문에 참여해 ${SURVEY_BONUS}장을 받았어요.`}
      </p>
    );
  }
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl px-4 text-sm font-semibold ${emphasize ? "bg-brand-600 text-white hover:bg-brand-700" : "border border-brand-200 bg-brand-50 text-brand-700 hover:bg-brand-100"}`}
      >
        <Gift className="size-4" />
        추가 크레딧 받기 (설문 1분 · +{SURVEY_BONUS}장)
      </button>
      {open && <SurveyDialog onClose={() => setOpen(false)} onDone={(left) => setFinished(left)} preview={preview} />}
    </>
  );
}

const chip = (on: boolean) => `inline-flex min-h-11 items-center rounded-xl border px-3 text-sm ${on ? "border-brand-500 bg-brand-50 font-semibold text-brand-700" : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"}`;
const selectClass = "min-h-11 w-full rounded-xl border border-zinc-300 bg-white px-3 text-base lg:text-sm";

function SurveyDialog({ onClose, onDone, preview }: { onClose: () => void; onDone: (left: number) => void; preview: boolean }) {
  const [rating, setRating] = useState(0);
  const [usefulFeature, setUseful] = useState("");
  const [industry, setIndustry] = useState("");
  const [companySize, setSize] = useState("");
  const [jobRole, setRole] = useState("");
  const [review, setReview] = useState("");
  const [displayConsent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const ready = rating > 0 && usefulFeature && industry && companySize && jobRole;

  const submit = () =>
    start(async () => {
      setError(null);
      if (preview) return setError("미리보기에서는 제출하지 않아요.");
      const r = await measureAction("billing.submit_survey", () => submitFeedbackSurveyAction({ rating, usefulFeature, industry, companySize, jobRole, review, displayConsent }));
      if (r.error) return setError(r.error);
      onDone(r.left ?? 0);
      onClose();
    });

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal aria-labelledby="survey-title">
      <button type="button" className="absolute inset-0 bg-black/40" aria-label="닫기" onClick={onClose} />
      <div className="relative flex max-h-[92dvh] w-full max-w-lg flex-col rounded-t-2xl bg-white shadow-xl sm:rounded-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-zinc-100 px-5 pb-3 pt-5">
          <div>
            <h2 id="survey-title" className="text-lg font-semibold">
              1분 설문하고 영수증 {SURVEY_BONUS}장 받기
            </h2>
            <p className="mt-0.5 text-sm text-zinc-600">제출하면 바로 충전돼요. 회사당 한 번만 받을 수 있어요.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="닫기" className="-mr-2 -mt-2 inline-flex size-11 shrink-0 items-center justify-center rounded-xl hover:bg-zinc-100">
            <X className="size-5" />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-5 py-4">
          <fieldset>
            <legend className="text-sm font-semibold">만족도</legend>
            <div className="mt-1 flex gap-1" role="radiogroup" aria-label="만족도 별점">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n}점`} onClick={() => setRating(n)} className="inline-flex size-11 items-center justify-center rounded-xl hover:bg-amber-50">
                  <Star className={`size-7 ${n <= rating ? "fill-amber-400 text-amber-400" : "text-zinc-300"}`} />
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-sm font-semibold">가장 유용한 기능</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {USEFUL_FEATURES.map(([k, label]) => (
                <button key={k} type="button" aria-pressed={usefulFeature === k} onClick={() => setUseful(k)} className={chip(usefulFeature === k)}>
                  {label}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5 text-sm font-semibold">
              업종
              <select value={industry} onChange={(e) => setIndustry(e.target.value)} className={selectClass}>
                <option value="">골라 주세요</option>
                {INDUSTRIES.map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-semibold">
              직무
              <select value={jobRole} onChange={(e) => setRole(e.target.value)} className={selectClass}>
                <option value="">골라 주세요</option>
                {JOB_ROLES.map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <fieldset>
            <legend className="text-sm font-semibold">회사(현장) 규모</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {COMPANY_SIZES.map(([k, label]) => (
                <button key={k} type="button" aria-pressed={companySize === k} onClick={() => setSize(k)} className={chip(companySize === k)}>
                  {label}
                </button>
              ))}
            </div>
          </fieldset>

          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            <span>
              한 줄 후기 <span className="font-normal text-zinc-500">(선택)</span>
            </span>
            <input
              value={review}
              onChange={(e) => setReview(e.target.value.slice(0, REVIEW_MAX))}
              maxLength={REVIEW_MAX}
              placeholder="예: 현장 영수증 정리가 정말 편해졌어요"
              className="min-h-11 rounded-xl border border-zinc-300 px-3 text-base font-normal lg:text-sm"
            />
          </label>
          <label className="-my-2 flex min-h-11 items-center gap-2 text-sm text-zinc-700">
            <input type="checkbox" checked={displayConsent} onChange={(e) => setConsent(e.target.checked)} className="size-5 shrink-0" />
            <span>후기를 홈페이지에 소개해도 좋아요 (회사명·이름 없이 업종·직무로만 표시)</span>
          </label>
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        </div>

        <div className="border-t border-zinc-100 px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3">
          <button
            type="button"
            disabled={!ready || pending}
            onClick={submit}
            className="inline-flex min-h-12 w-full items-center justify-center gap-1.5 rounded-xl bg-brand-600 font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {pending && <Loader2 className="size-4 animate-spin" />}
            제출하고 {SURVEY_BONUS}장 받기
          </button>
          {!ready && <p className="mt-2 text-center text-xs text-zinc-500">별점·기능·업종·직무·규모를 골라 주세요</p>}
        </div>
      </div>
    </div>
  );
}
