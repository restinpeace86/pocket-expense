-- =============================================================================
-- 048_claim_category.sql — 지출 카테고리를 결의서 단위로 (todo_improvement(2차) 5, D-098)
-- - 결의서(expense_claims)에 대표 카테고리 1개와 카테고리별 입력값(미팅 목적·거래처·참석자 / 구매 세부 유형·목적·품목 / 기본 인원)을 둔다.
--   한 전표 = 한 계정과목(회계 기장 표준). 출장비를 고르면 is_business_trip = true(출장 결의서).
-- - 영수증 항목은 계산·세무 엑셀을 위해 category를 그대로 갖되, 결의서에 카테고리가 있으면 항상 결의서를 따른다(트리거).
--   자차 유류비(trip/own_car)는 경로 함수만 다루므로 건드리지 않는다.
-- - 새 컬럼은 직원이 직접 update할 수 없고(컬럼 권한 없음) set_claim_category()로만 바꾼다(본인 작성 중 결의서만).
-- - 상신 검증: 카테고리별 필수 칸은 결의서 칸으로 묻는다. 카테고리가 없는 예전 결의서는 영수증 카테고리가 모두 같으면 그대로 상신 가능,
--   섞여 있으면 "지출 카테고리"를 고르게 한다.
-- =============================================================================

alter table public.expense_claims
  add column category public.expense_category,
  add column purchase_type public.purchase_type,
  add column meeting_purpose text check (char_length(meeting_purpose) <= 200),
  add column client_name text check (char_length(client_name) <= 100),
  add column attendees text check (char_length(attendees) <= 200),
  add column purchase_purpose text check (char_length(purchase_purpose) <= 200),
  add column purchase_items text check (char_length(purchase_items) <= 200),
  add column headcount integer check (headcount between 1 and 99);

comment on column public.expense_claims.category is '결의서 대표 지출 카테고리(D-098). 있으면 자차 외 모든 영수증 항목의 category가 이 값을 따른다';
comment on column public.expense_claims.headcount is '식대·미팅 기본 인원. 바꾸면 영수증 인원에 한 번 반영(영수증별로 다시 고칠 수 있음)';

-- 영수증 항목이 결의서 카테고리를 따르게 한다(업로드·AI 다시 읽기·직접 수정 어느 경로든)
create or replace function private.item_follow_claim_category()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare c public.expense_claims;
begin
  select * into c from public.expense_claims where id = new.claim_id;
  if c.category is null then return new; end if;
  if new.category = 'trip' and new.trip_type = 'own_car' then return new; end if;
  new.category := c.category;
  if c.category <> 'trip' then new.trip_type := null; end if;
  if c.category = 'purchase' then
    new.purchase_type := c.purchase_type;
    new.purpose := nullif(concat_ws(' · ', nullif(btrim(coalesce(c.purchase_purpose, '')), ''), nullif(btrim(coalesce(c.purchase_items, '')), '')), '');
  else
    new.purchase_type := null;
  end if;
  if c.category = 'meeting' then
    new.purpose := nullif(btrim(coalesce(c.meeting_purpose, '')), '');
    new.client_name := nullif(btrim(coalesce(c.client_name, '')), '');
    new.attendees := nullif(btrim(coalesce(c.attendees, '')), '');
  else
    new.client_name := null;
    new.attendees := null;
  end if;
  return new;
end;
$$;
revoke all on function private.item_follow_claim_category() from public, anon, authenticated;

-- 이름 순서상 expense_items_guard_own_car(자차 허용 검사)보다 먼저 실행된다
create trigger expense_items_follow_claim_category before insert or update on public.expense_items
  for each row execute function private.item_follow_claim_category();

-- 결의서 카테고리·카테고리별 입력값 저장 + 영수증 반영 + 금액 재계산
create or replace function public.set_claim_category(
  p_claim_id uuid,
  p_category public.expense_category,
  p_purchase_type public.purchase_type default null,
  p_meeting_purpose text default null,
  p_client_name text default null,
  p_attendees text default null,
  p_purchase_purpose text default null,
  p_purchase_items text default null,
  p_headcount integer default null
)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_claim public.expense_claims := private.lock_my_editable_claim(p_claim_id);
  t text[] := array[btrim(coalesce(p_meeting_purpose, '')), btrim(coalesce(p_client_name, '')), btrim(coalesce(p_attendees, '')), btrim(coalesce(p_purchase_purpose, '')), btrim(coalesce(p_purchase_items, ''))];
begin
  if p_category is null then raise exception 'INVALID_CATEGORY'; end if;
  if char_length(t[1]) > 200 or char_length(t[2]) > 100 or char_length(t[3]) > 200 or char_length(t[4]) > 200 or char_length(t[5]) > 200 then
    raise exception 'INVALID_ITEM_TEXT';
  end if;
  if p_headcount is not null and (p_headcount < 1 or p_headcount > 99) then raise exception 'INVALID_HEADCOUNT'; end if;
  -- 자차 유류비는 출장 결의서에만 있을 수 있다: 출장비가 아닌 카테고리로 바꾸려면 자차 이동을 먼저 지운다
  if p_category <> 'trip' and exists (select 1 from public.expense_items where claim_id = p_claim_id and category = 'trip' and trip_type = 'own_car') then
    raise exception 'OWN_CAR_ITEMS_EXIST';
  end if;

  update public.expense_claims
     set category = p_category,
         is_business_trip = (p_category = 'trip'),
         purchase_type = p_purchase_type,
         meeting_purpose = nullif(t[1], ''),
         client_name = nullif(t[2], ''),
         attendees = nullif(t[3], ''),
         purchase_purpose = nullif(t[4], ''),
         purchase_items = nullif(t[5], ''),
         headcount = p_headcount
   where id = p_claim_id;

  -- 트리거가 결의서 값을 다시 입힌다(자차 제외)
  update public.expense_items set category = p_category
   where claim_id = p_claim_id and not (category is not distinct from 'trip' and trip_type is not distinct from 'own_car');
  -- 기본 인원을 바꾸면 식대·미팅 영수증 인원에 한 번 반영
  if p_headcount is not null and p_headcount is distinct from v_claim.headcount and p_category in ('meal', 'meeting') then
    update public.expense_items set headcount = p_headcount where claim_id = p_claim_id;
  end if;
  return private.recompute_claim(p_claim_id);
end;
$$;
revoke all on function public.set_claim_category(uuid, public.expense_category, public.purchase_type, text, text, text, text, text, integer) from public, anon;
grant execute on function public.set_claim_category(uuid, public.expense_category, public.purchase_type, text, text, text, text, text, integer) to authenticated;

-- 상신 검증 (033 정의 + 결의서 카테고리)
create or replace function private.claim_problems(p_claim_id uuid)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_claim public.expense_claims;
  v_header text[] := '{}';
  v_count integer;
  v_has_cards boolean;
  v_items jsonb;
  v_by_claim boolean;
begin
  select * into v_claim from public.expense_claims where id = p_claim_id;
  v_by_claim := v_claim.category is not null;
  if length(btrim(coalesce(v_claim.title, ''))) = 0 then v_header := array_append(v_header, 'title'); end if;
  if length(btrim(coalesce(v_claim.description, ''))) = 0 then v_header := array_append(v_header, 'description'); end if;
  -- 카테고리 없는 예전 결의서: 영수증 카테고리가 섞여 있으면 하나를 고르게 한다
  if not v_by_claim and (select count(distinct category) from public.expense_items where claim_id = p_claim_id and category is not null) > 1 then
    v_header := array_append(v_header, 'category');
  end if;
  if v_claim.category = 'meeting' and length(btrim(coalesce(v_claim.meeting_purpose, ''))) = 0 then v_header := array_append(v_header, 'meeting_purpose'); end if;
  if v_claim.category = 'purchase' then
    if v_claim.purchase_type is null then v_header := array_append(v_header, 'purchase_type'); end if;
    if length(btrim(coalesce(v_claim.purchase_purpose, ''))) = 0 then v_header := array_append(v_header, 'purchase_purpose'); end if;
  end if;
  if v_claim.is_business_trip then
    if length(btrim(coalesce(v_claim.trip_destination, ''))) = 0 then v_header := array_append(v_header, 'trip_destination'); end if;
    if v_claim.trip_start_date is null or v_claim.trip_end_date is null then v_header := array_append(v_header, 'trip_period');
    elsif v_claim.trip_end_date < v_claim.trip_start_date then v_header := array_append(v_header, 'trip_period_order'); end if;
    if length(btrim(coalesce(v_claim.trip_purpose, ''))) = 0 then v_header := array_append(v_header, 'trip_purpose'); end if;
  end if;
  select count(*) into v_count from public.expense_items where claim_id = p_claim_id;
  if v_count = 0 then v_header := array_append(v_header, 'no_items'); end if;
  if v_count > 30 then v_header := array_append(v_header, 'too_many_items'); end if;
  select exists (select 1 from public.corporate_cards where company_id = v_claim.company_id and is_active) into v_has_cards;

  select coalesce(jsonb_agg(jsonb_build_object('item_id', id, 'sort_order', sort_order, 'fields', to_jsonb(f)) order by sort_order), '[]'::jsonb)
    into v_items
    from (
      select i.id, i.sort_order, array_remove(array[
        case when i.parse_status = 'parsing' then 'parsing' end,
        case when i.category is null then 'category' end,
        case when i.payment_method = 'corporate_card' and v_has_cards and i.corporate_card_id is null then 'corporate_card' end,
        case when i.evidence_type is null then 'evidence_type' end,
        case when i.expense_date is null then 'expense_date' end,
        case when i.amount is null or i.amount <= 0 then 'amount' end,
        -- 영수증이 필요한 분류 (자차 유류비만 영수증 선택)
        case when i.receipt_path is null and not (i.category = 'trip' and i.trip_type = 'own_car') then 'receipt' end,
        case when (i.category = 'meal' or (i.category = 'trip' and i.trip_type = 'meal')) and coalesce(i.headcount, 1) < 1 then 'headcount' end, -- 비어 있으면 기본 1명(금액 계산과 같음)
        -- 미팅 목적·구매 유형·목적은 결의서 카테고리가 있으면 결의서 칸에서 묻는다(위 header)
        case when not v_by_claim and i.category = 'meeting' and length(btrim(coalesce(i.purpose, ''))) = 0 then 'purpose' end,
        case when not v_by_claim and i.category = 'purchase' and i.purchase_type is null then 'purchase_type' end,
        case when not v_by_claim and i.category = 'purchase' and length(btrim(coalesce(i.purpose, ''))) = 0 then 'purpose' end,
        case when i.category = 'trip' and i.trip_type is null then 'trip_type' end,
        case when i.category = 'trip' and i.trip_type = 'lodging' and (i.trip_start_date is null or i.trip_end_date is null) then 'lodging_period' end,
        case when i.category = 'trip' and i.trip_type = 'other' and length(btrim(coalesce(i.purpose, ''))) = 0 then 'purpose' end,
        case when i.category = 'trip' and i.trip_type = 'own_car' and (i.start_location is null or i.end_location is null or coalesce(i.distance_km, 0) <= 0) then 'own_car_route' end
      ], null) as f
      from public.expense_items i
      where i.claim_id = p_claim_id
    ) x
   where cardinality(f) > 0;
  return jsonb_build_object('header', to_jsonb(v_header), 'items', v_items);
end;
$$;
revoke all on function private.claim_problems(uuid) from public, anon, authenticated;
