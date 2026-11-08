-- =============================================================================
-- 129_attendance_leave_admin_volatile.sql — 직원별 연차 조회 고침 (D-240)
-- attendance_leave_admin·my_attendance_month는 근태 설정 줄이 없으면 만들어 두는 private.attendance_settings_row를 부른다.
-- stable(읽기 전용)이면 그 줄을 만들 때 오류가 나므로 volatile로 바꾼다(근태를 켜기 전 회사 등)
-- =============================================================================
alter function public.attendance_leave_admin(integer) volatile;
alter function public.my_attendance_month(text) volatile;
