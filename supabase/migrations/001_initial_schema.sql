-- 0. 자동 updated_at 갱신용 트리거 함수 생성
create or replace function update_updated_at_column()
returns trigger as $$
begin
    new.updated_at = timezone('utc'::text, now());
    return new;
end;
$$ language plpgsql;

-- 1. ENUM 타입 정의
create type user_role as enum ('admin', 'employee');
create type expense_category as enum ('meal', 'travel', 'meeting');
create type expense_status as enum ('draft', 'submitted', 'approved', 'paid');

-- 2. companies (회사 / Workspace)
create table companies (
    id uuid primary key default gen_random_uuid(),
    name text not null,                          -- 회사명
    business_number text,                        -- 사업자등록번호
    max_meal_amount numeric default 10000,       -- 기본 식대 지원 한도 (원)
    fuel_rate_per_km numeric default 200,        -- 자차 km당 유류비 단가 (원)
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create trigger update_companies_updated_at
    before update on companies
    for each row
    execute function update_updated_at_column();

-- 3. users (사용자 / 직원)
create table users (
    id uuid primary key default gen_random_uuid(),
    company_id uuid references companies(id) on delete cascade,
    name text not null,                          -- 사용자 이름
    phone text not null unique,                  -- 휴대폰 번호 (로그인/식별용)
    role user_role default 'employee',           -- 권한 (관리자 vs 일반 직원)
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create trigger update_users_updated_at
    before update on users
    for each row
    execute function update_updated_at_column();

-- 4. expenses (경비 청구 내역)
create table expenses (
    id uuid primary key default gen_random_uuid(),
    company_id uuid references companies(id) on delete cascade,
    user_id uuid references users(id) on delete cascade,
    category expense_category not null,          -- 카테고리 (식대, 출장비, 미팅비)
    amount numeric not null,                     -- 총 결제 금액
    company_supported_amount numeric,            -- 회사 지원금 (식대 한도 자동 분할 등)
    personal_burden_amount numeric default 0,    -- 개인 부담금 (초과분 등)
    merchant_name text,                          -- 상호명 (AI 파싱 결과)
    expense_date date not null,                  -- 결제/사용 일자
    receipt_image_url text,                      -- Supabase Storage 원본 영수증 이미지 경로
    
    -- [출장비 전용 메타데이터 (자차/내비 연동)]
    start_location text,                         -- 출발지
    end_location text,                           -- 도착지
    distance_km numeric,                         -- 주행 거리 (km)
    
    status expense_status default 'draft',       -- 진행 상태
    memo text,                                   -- 직원 메모 / 접대 사유 등
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create trigger update_expenses_updated_at
    before update on expenses
    for each row
    execute function update_updated_at_column();

-- 5. Row Level Security (RLS) 기본 설정
alter table companies enable row level security;
alter table users enable row level security;
alter table expenses enable row level security;