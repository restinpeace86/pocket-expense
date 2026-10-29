import { NextResponse, type NextRequest } from "next/server";
import { requireWorkspace } from "@/lib/auth/guards";
import { signPayoutProof } from "@/lib/claims/payout-proof-server";
import { createClient } from "@/lib/supabase/server";

// 관리자: 송금 확인증 보기 (D-164). ?claim= — 자기 회사 결의서인지는 RLS로 확인하고 10분짜리 링크로 보낸다
export async function GET(request: NextRequest, ctx: RouteContext<"/workspace/[id]/admin/payouts/proof">) {
  const { id } = await ctx.params;
  const membership = await requireWorkspace(id, { admin: true });
  const claimId = request.nextUrl.searchParams.get("claim") ?? "";
  if (!/^[0-9a-f-]{36}$/.test(claimId)) return new NextResponse("Bad Request", { status: 400 });
  const supabase = await createClient();
  const { data } = await supabase.from("expense_claims").select("payout_proof_path").eq("id", claimId).eq("company_id", membership.company_id).maybeSingle();
  const path = data?.payout_proof_path;
  const url = path && path.startsWith(`${membership.company_id}/`) ? await signPayoutProof(path) : null;
  if (!url) return new NextResponse("Not Found", { status: 404 });
  return NextResponse.redirect(url);
}
