"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { refresh, revalidatePath } from "next/cache";
import { attendanceEnabled } from "@/lib/attendance/server";
import { nextStep, progress, resumeStep, setupSteps, type SetupStatus } from "@/lib/admin/setup-wizard";
import { getSetupState, SETUP_COOKIE } from "@/lib/admin/setup-wizard-server";
import { createClient } from "@/lib/supabase/server";

// 최초 1회 설정(D-300) — 권한·회사 확인은 DB 함수(setup_wizard_*)가 한다. 여기서는 기록·쿠키·다음 화면 이동만
const ID = /^[0-9a-f-]{36}$/;
const base = (companyId: string) => `/workspace/${companyId}/admin`;

async function barOn(on: boolean) {
  const jar = await cookies();
  if (on) jar.set(SETUP_COOKIE, "1", { path: "/", httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 60 * 60 * 24 * 60 });
  else jar.delete(SETUP_COOKIE);
}

// [지금 시작]·[이어서 하기]·[처음부터 보기]·[설정 마법사] — mode first = 첫 단계부터
export async function startSetupAction(companyId: string, mode: "resume" | "first" = "resume") {
  if (!ID.test(companyId)) return;
  const supabase = await createClient();
  await supabase.rpc("setup_wizard_answer_intro");
  const [state, att] = await Promise.all([getSetupState(), attendanceEnabled()]);
  const target = mode === "first" ? setupSteps(att)[0] : resumeStep(state, att);
  await barOn(true);
  revalidatePath(base(companyId), "layout"); // 관리자 틀(진행 띠·메뉴 표시)도 새 기록으로
  redirect(target ? `${base(companyId)}${target.href}` : `${base(companyId)}/setup`);
}

// 시작 안내 창 [나중에 할게요]: 다시 안 뜨게 기록만
export async function laterSetupAction() {
  const supabase = await createClient();
  await supabase.rpc("setup_wizard_answer_intro");
  refresh();
}

// [잠시 멈추기]: 진행 띠만 내린다(기록은 그대로)
export async function pauseSetupAction() {
  await barOn(false);
  refresh();
}

// [완료하고 다음]·[건너뛰기]·[설정 완료]
export async function markSetupStepAction(companyId: string, stepKey: string, status: SetupStatus) {
  if (!ID.test(companyId)) return;
  const att = await attendanceEnabled();
  if (!setupSteps(att).some((s) => s.key === stepKey)) return;
  const state = await getSetupState();
  const statuses = { ...state.statuses, [stepKey]: state.statuses[stepKey] === "done" ? "done" : status } as Record<string, SetupStatus>;
  const finished = progress({ statuses }, att).allHandled;
  const supabase = await createClient();
  const { error } = await supabase.rpc("setup_wizard_mark", { p_step: stepKey, p_status: status, p_finished: finished });
  if (error) return;
  revalidatePath(base(companyId), "layout");
  const next = nextStep(stepKey, statuses, att);
  if (!next) {
    await barOn(false);
    redirect(`${base(companyId)}/setup?done=1`);
  }
  redirect(`${base(companyId)}${next.href}`);
}
