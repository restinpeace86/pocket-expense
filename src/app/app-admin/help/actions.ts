"use server";

import { refresh } from "next/cache";
import { getAppAdmin } from "@/lib/app-admin/guard";

// 운영자 도움말 글 고치기(D-255 §A-5). 쓰기는 운영자만(서버 키). 화면 그림은 공개 버킷 help-images
export type AdminArticle = {
  id: string;
  category: string;
  audience: "all" | "admin";
  needs: string | null;
  title: string;
  summary: string;
  keywords: string[];
  path: string | null;
  admin_path: string | null;
  path_label: string | null;
  sim: string | null;
  published: boolean;
  steps: { body: string; image_path: string | null }[];
};

const ID = /^[a-z0-9][a-z0-9-]{1,59}$/;
const PATH = /^\/[A-Za-z0-9/_?=&.-]{1,120}$/;
const clean = (v: string | null) => (v && v.trim() ? v.trim() : null);

export async function saveHelpArticleAction(a: AdminArticle): Promise<{ error: string | null }> {
  const ok = await getAppAdmin();
  if (!ok) return { error: "운영자만 바꿀 수 있어요." };
  if (!ID.test(a.id)) return { error: "글 키는 영어 소문자·숫자·-로 2~60자예요." };
  if (a.title.trim().length < 2) return { error: "제목을 적어 주세요." };
  const steps = a.steps.map((s) => ({ body: s.body.trim(), image_path: clean(s.image_path) })).filter((s) => s.body);
  if (!steps.length) return { error: "단계를 하나 이상 적어 주세요." };
  if (steps.length > 20 || steps.some((s) => s.body.length > 500)) return { error: "단계는 20개, 단계마다 500자까지예요." };
  for (const p of [a.path, a.admin_path]) if (clean(p) && !PATH.test(clean(p)!)) return { error: "이동 주소는 /로 시작하는 화면 주소예요(예: /employee/vacation)." };
  const { data: me } = await ok.admin.from("app_admins").select("auth_user_id").eq("auth_user_id", ok.userId).maybeSingle();
  const { error } = await ok.admin.from("help_articles").upsert({
    id: a.id,
    category: a.category,
    audience: a.audience,
    needs: clean(a.needs),
    title: a.title.trim(),
    summary: a.summary.trim().slice(0, 200),
    keywords: a.keywords.map((k) => k.trim()).filter(Boolean).slice(0, 30),
    path: clean(a.path),
    admin_path: clean(a.admin_path),
    path_label: clean(a.path_label),
    sim: clean(a.sim),
    published: a.published,
    updated_at: new Date().toISOString(),
    updated_by_name: me ? "운영자" : null,
  });
  if (error) return { error: "저장하지 못했어요. 값을 확인해 주세요." };
  await ok.admin.from("help_steps").delete().eq("article_id", a.id);
  const { error: se } = await ok.admin.from("help_steps").insert(steps.map((s, idx) => ({ article_id: a.id, idx, body: s.body, image_path: s.image_path })));
  if (se) return { error: "단계를 저장하지 못했어요." };
  refresh();
  return { error: null };
}

export async function deleteHelpArticleAction(id: string): Promise<{ error: string | null }> {
  const ok = await getAppAdmin();
  if (!ok) return { error: "운영자만 지울 수 있어요." };
  const { error } = await ok.admin.from("help_articles").delete().eq("id", id);
  if (error) return { error: "지우지 못했어요." };
  refresh();
  return { error: null };
}

// 단계 화면 그림 올리기 → 공개 버킷 경로를 돌려준다(저장은 [저장]을 눌러야)
export async function uploadHelpImageAction(form: FormData): Promise<{ path: string } | { error: string }> {
  const ok = await getAppAdmin();
  if (!ok) return { error: "운영자만 올릴 수 있어요." };
  const file = form.get("file");
  const id = String(form.get("id") ?? "");
  if (!(file instanceof File) || !ID.test(id)) return { error: "파일을 골라 주세요." };
  if (file.size > 2 * 1024 * 1024) return { error: "그림은 2MB까지예요." };
  const ext = file.type === "image/png" ? "png" : file.type === "image/jpeg" ? "jpg" : file.type === "image/webp" ? "webp" : null;
  if (!ext) return { error: "PNG·JPG·WEBP만 올릴 수 있어요." };
  const path = `${id}/${Date.now().toString(36)}.${ext}`;
  const { error } = await ok.admin.storage.from("help-images").upload(path, file, { contentType: file.type, upsert: false });
  if (error) return { error: "올리지 못했어요." };
  return { path };
}
