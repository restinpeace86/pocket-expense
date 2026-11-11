import "server-only";
import { attendanceEnabled } from "@/lib/attendance/server";
import { getCompanyNearby } from "@/lib/bus/server";
import { calendarEnabled } from "@/lib/calendar/server";
import { chatEnabled } from "@/lib/chat/server";
import type { HelpFeatures } from "./guides";

// 도움말에서 보일 글을 고르려고 회사가 쓰는 기능을 읽는다(D-251 개선사항 7)
export async function helpFeatures(): Promise<HelpFeatures> {
  const [attendance, calendar, chat, nearby] = await Promise.all([attendanceEnabled(), calendarEnabled(), chatEnabled(), getCompanyNearby()]);
  return { attendance, calendar, chat, bus: !!nearby?.seoul };
}
