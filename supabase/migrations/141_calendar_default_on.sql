-- 141: 사내 캘린더 기본 켜짐 (D-251, todo_improvement 개선사항 1)
-- 메신저처럼 company_features 줄이 없으면 켜짐. 관리자가 [설정 › 기능 사용]에서 끈 회사(enabled=false 줄)는 그대로 꺼짐.
-- 데이터·화면은 그대로이고 기본값만 바뀐다.
create or replace function private.feature_enabled(p_company uuid, p_feature text)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select coalesce(
    (select f.enabled from public.company_features f where f.company_id = p_company and f.feature = p_feature),
    p_feature in ('messenger', 'calendar') -- D-206 메신저, D-251 캘린더: 줄이 없으면 켜짐. 나머지(근태·알림톡 등)는 꺼짐
  )
$$;
