// 다른 회계 프로그램 양식 접수 (D-180): 회사 세무 마감 화면에서 등록, 운영자가 확인해 맞는 파일을 준비한다(지금은 접수만)
export const FORMAT_PROGRAMS = ["ecount", "sesarang"] as const;
export type FormatProgram = (typeof FORMAT_PROGRAMS)[number];
export const FORMAT_PROGRAM_LABEL: Record<FormatProgram, string> = { ecount: "이카운트 ERP", sesarang: "뉴젠 세무사랑" };
export const FORMAT_BUCKET = "accounting-format-files";
export const FORMAT_MAX_BYTES = 5 * 1024 * 1024;
export const FORMAT_EXT = /\.(xlsx|xls|csv)$/i;

export type FormatRequest = { id: string; program: FormatProgram; file_name: string; memo: string | null; status: "received" | "done"; created_at: string; done_at: string | null };
