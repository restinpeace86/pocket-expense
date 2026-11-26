import { connection, NextResponse, type NextRequest } from "next/server";
import { runMonthlyReports } from "@/lib/report/monthly-server";

// 지난달 지출 리포트(D-319) 한 회사만 보내기 — 시험·재발송용. 매월 1일 정기 발송은 morning cron이 한다.
// CRON_SECRET이 없거나 맞지 않으면 아무것도 하지 않는다. company·month 둘 다 있어야 한다
export async function GET(request: NextRequest) {
  await connection();
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new NextResponse("Not Found", { status: 404 });
  }
  const company = request.nextUrl.searchParams.get("company") ?? "";
  const month = request.nextUrl.searchParams.get("month") ?? "";
  if (!/^[0-9a-f-]{36}$/.test(company) || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return NextResponse.json({ ok: false, error: "company·month" }, { status: 400 });
  return NextResponse.json({ ok: true, ...(await runMonthlyReports({ companyId: company, month })) });
}
