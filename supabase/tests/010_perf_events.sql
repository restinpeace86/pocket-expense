-- =============================================================================
-- 010_perf_events.sql — 체감 성능 기록 표 격리·검증 테스트 (D-075, migration 022)
-- =============================================================================
begin;

insert into auth.users (id, instance_id, aud, role, email) values
  ('a9900000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'perf_a@test.local');
insert into public.companies (id, name, invite_code, business_number) values ('c9900000-0000-0000-0000-00000000000a', '성능회사A', 'PERFAAAA', '1000000071');
insert into public.members (id, auth_user_id, company_id, name, phone, role, status, privacy_agreed_at) values
  ('a9800000-0000-0000-0000-000000000001', 'a9900000-0000-0000-0000-000000000001', 'c9900000-0000-0000-0000-00000000000a', 'A대표', '01093001000', 'super_admin', 'approved', now());

-- 비로그인: 함수 실행 불가
set local role anon;
do $$
declare v_ok boolean;
begin
  begin perform public.record_perf_events('[{"route":"/x","metric":"LCP","value":1,"device":"mobile"}]'); v_ok := false;
  exception when insufficient_privilege then v_ok := true; end;
  if not v_ok then raise exception 'FAIL [ANON] anon recorded perf events'; end if;
end $$;
reset role;

-- 로그인 사용자: 기록 가능, 표는 읽기·직접 쓰기 불가, 잘못된 값 거부
select set_config('request.jwt.claims', '{"sub":"a9900000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
do $$
declare v_ok boolean; n integer;
begin
  n := public.record_perf_events('[{"route":"/workspace/[id]/admin","metric":"LCP","value":812.5,"nav":"navigate","device":"desktop","conn":"4g","build":"abc1234"},
                                    {"route":"/workspace/[id]/admin/settings","metric":"ACTION","action":"settings.save","value":430,"device":"mobile"}]');
  if n <> 2 then raise exception 'FAIL [AUTH] events not recorded: %', n; end if;

  begin perform count(*) from public.perf_events; v_ok := false;
  exception when insufficient_privilege then v_ok := true; end;
  if not v_ok then raise exception 'FAIL [AUTH] app user can read perf_events'; end if;

  begin insert into public.perf_events (created_by, route, metric, value, device) values (gen_random_uuid(), '/x', 'LCP', 1, 'mobile'); v_ok := false;
  exception when insufficient_privilege then v_ok := true; end;
  if not v_ok then raise exception 'FAIL [AUTH] app user inserted directly'; end if;

  begin perform public.record_perf_events('[{"route":"/x","metric":"HACK","value":1,"device":"mobile"}]'); v_ok := false;
  exception when check_violation then v_ok := true; end;
  if not v_ok then raise exception 'FAIL [AUTH] invalid metric accepted'; end if;

  begin perform public.record_perf_events('[{"route":"/x","metric":"ACTION","action":"<script>","value":1,"device":"mobile"}]'); v_ok := false;
  exception when check_violation then v_ok := true; end;
  if not v_ok then raise exception 'FAIL [AUTH] invalid action name accepted'; end if;

  begin perform public.record_perf_events((select jsonb_agg(jsonb_build_object('route', '/x', 'metric', 'LCP', 'value', 1, 'device', 'mobile')) from generate_series(1, 31))); v_ok := false;
  exception when others then v_ok := sqlerrm = 'TOO_MANY_EVENTS'; end;
  if not v_ok then raise exception 'FAIL [AUTH] more than 30 events accepted'; end if;
end $$;
reset role;

do $$
begin
  if (select count(*) from public.perf_events where created_by = 'a9900000-0000-0000-0000-000000000001' and company_id = 'c9900000-0000-0000-0000-00000000000a') <> 2 then
    raise exception 'FAIL [FINAL] events not stored with company';
  end if;
end $$;

select 'PERF_EVENTS_OK' as result;
rollback;
