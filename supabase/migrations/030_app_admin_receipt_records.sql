-- =============================================================================
-- 030_app_admin_receipt_records.sql — 앱관리자(운영자) 화면 + 크레딧 사용 영수증 기록 (D-080)
-- - app_admins: 운영자 계정. 화면에서 추가·삭제하지 않고 SQL로만 등록한다.
-- - receipt_usage_records: 크레딧 1장을 쓴 영수증마다 1행. 직원이 항목·소명서를 지워도 남는다
--   (삭제 시점의 항목·소명서 내용을 그대로 복사해 둔다). 사진은 receipt-archive 버킷으로 옮겨 3개월 뒤 자동 삭제.
-- - 두 테이블과 보관 버킷은 고객(anon·authenticated)이 전혀 읽거나 쓸 수 없다. 운영자 화면 서버 코드가
--   운영자 계정을 확인한 뒤 service role로만 읽는다(읽기 전용).
-- =============================================================================

create table public.app_admins (
  auth_user_id uuid primary key references auth.users (id) on delete cascade,
  note text,
  created_at timestamptz not null default now()
);

create table public.receipt_usage_records (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  item_id uuid not null unique,           -- 항목이 지워져도 값은 남긴다(FK 없음)
  claim_id uuid not null,
  member_id uuid,
  member_name text,
  ledger_id uuid,
  credited_at timestamptz not null,       -- 크레딧 차감 시각
  receipt_path text,
  thumb_path text,
  parse_status text,
  parsed_at timestamptz,
  ai_parsed_payload jsonb,                -- AI가 읽은 전체 결과(원본)
  claim_title text,
  claim_status text,
  item_deleted_at timestamptz,            -- 직원이 항목(또는 소명서)을 지운 시각
  item_snapshot jsonb,                    -- 지울 때의 항목 행 전체
  archived_receipt_path text,             -- receipt-archive 버킷으로 옮긴 사진
  archived_thumb_path text,
  photo_purge_after timestamptz,          -- 이 시각이 지나면 보관 사진 자동 삭제(삭제 후 3개월)
  photo_purged_at timestamptz,
  created_at timestamptz not null default now()
);
create index receipt_usage_records_company_idx on public.receipt_usage_records (company_id, credited_at desc);
create index receipt_usage_records_purge_idx on public.receipt_usage_records (photo_purge_after) where photo_purged_at is null and photo_purge_after is not null;

alter table public.app_admins enable row level security;
alter table public.app_admins force row level security;
alter table public.receipt_usage_records enable row level security;
alter table public.receipt_usage_records force row level security;
revoke all on public.app_admins, public.receipt_usage_records from anon, authenticated;
-- 정책을 만들지 않는다: 고객 역할로는 0행. service role만 읽는다.

-- 운영 보관함(삭제된 영수증 사진). 정책 없음 = 고객은 접근 불가
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('receipt-archive', 'receipt-archive', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do update set public = false;

-- 1) 크레딧 차감 → 기록 생성
create or replace function private.on_receipt_credit_used()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_item public.expense_items;
  v_claim public.expense_claims;
begin
  if new.reason <> 'receipt_upload' or new.item_id is null then return new; end if;
  select * into v_item from public.expense_items where id = new.item_id;
  if not found then return new; end if;
  select * into v_claim from public.expense_claims where id = v_item.claim_id;
  insert into public.receipt_usage_records
    (company_id, item_id, claim_id, member_id, member_name, ledger_id, credited_at, receipt_path, thumb_path, parse_status, claim_title, claim_status)
  values
    (new.company_id, v_item.id, v_item.claim_id, new.member_id, (select name from public.members where id = new.member_id), new.id, new.created_at,
     v_item.receipt_path, v_item.receipt_thumb_path, v_item.parse_status::text, v_claim.title, v_claim.status::text)
  on conflict (item_id) do nothing;
  return new;
end;
$$;
create trigger credit_ledger_receipt_record after insert on public.credit_ledger
  for each row execute function private.on_receipt_credit_used();

-- 2) AI 인식 결과 → 기록에도 복사
create or replace function private.on_item_parsed()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  update public.receipt_usage_records
     set ai_parsed_payload = new.ai_parsed_payload, parse_status = new.parse_status::text, parsed_at = now()
   where item_id = new.id;
  return new;
end;
$$;
create trigger expense_items_parsed_record after update of ai_parsed_payload, parse_status on public.expense_items
  for each row when (new.ai_parsed_payload is distinct from old.ai_parsed_payload or new.parse_status is distinct from old.parse_status)
  execute function private.on_item_parsed();

-- 3) 소명서 삭제 → 그 소명서 항목들의 기록에 제목·상태를 남긴다(항목은 뒤이어 연쇄 삭제된다)
create or replace function private.on_claim_deleted()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  update public.receipt_usage_records set claim_title = old.title, claim_status = old.status::text where claim_id = old.id;
  return old;
end;
$$;
create trigger expense_claims_deleted_record before delete on public.expense_claims
  for each row execute function private.on_claim_deleted();

-- 4) 항목 삭제 → 삭제 시각과 항목 전체를 남긴다
create or replace function private.on_item_deleted()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if not old.credit_charged then return old; end if;
  update public.receipt_usage_records r
     set item_deleted_at = now(),
         item_snapshot = to_jsonb(old),
         claim_title = coalesce((select c.title from public.expense_claims c where c.id = old.claim_id), r.claim_title),
         claim_status = coalesce((select c.status::text from public.expense_claims c where c.id = old.claim_id), r.claim_status)
   where r.item_id = old.id;
  return old;
end;
$$;
create trigger expense_items_deleted_record before delete on public.expense_items
  for each row execute function private.on_item_deleted();

revoke all on function private.on_receipt_credit_used(), private.on_item_parsed(), private.on_claim_deleted(), private.on_item_deleted() from public, anon, authenticated;

-- 이미 쓴 크레딧도 기록으로 옮긴다
insert into public.receipt_usage_records
  (company_id, item_id, claim_id, member_id, member_name, ledger_id, credited_at, receipt_path, thumb_path, parse_status, parsed_at, ai_parsed_payload, claim_title, claim_status)
select l.company_id, i.id, i.claim_id, l.member_id, m.name, l.id, l.created_at, i.receipt_path, i.receipt_thumb_path, i.parse_status::text,
       case when i.ai_parsed_payload is not null then i.updated_at end, i.ai_parsed_payload, c.title, c.status::text
  from public.credit_ledger l
  join public.expense_items i on i.id = l.item_id
  join public.expense_claims c on c.id = i.claim_id
  left join public.members m on m.id = l.member_id
 where l.reason = 'receipt_upload'
on conflict (item_id) do nothing;
