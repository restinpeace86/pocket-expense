-- =============================================================================
-- 050_extra_categories_enum.sql — 지출 카테고리 추가 (todo_improvement(2차) 9, D-102)
-- enum 값 추가는 같은 트랜잭션에서 바로 쓸 수 없어 별도 파일로 둔다. 사용(기본 계정과목·매핑)은 051에서.
--   team_dinner 회식비 / condolence 경조사비 / seminar 세미나·컨퍼런스 참가 / books 업무용 도서 구입 /
--   training 교육·훈련 / company_car 회사차량 / saas 온라인 SaaS 구독료
-- =============================================================================
alter type public.expense_category add value if not exists 'team_dinner';
alter type public.expense_category add value if not exists 'condolence';
alter type public.expense_category add value if not exists 'seminar';
alter type public.expense_category add value if not exists 'books';
alter type public.expense_category add value if not exists 'training';
alter type public.expense_category add value if not exists 'company_car';
alter type public.expense_category add value if not exists 'saas';
