-- =============================================================================
-- 089_payout_proof.sql — 지급 완료 때 송금 확인증 첨부(선택) (D-164, reference 4-1 ⑥)
-- - 관리자가 [지급 완료] 처리 때(또는 지급 완료 탭에서 나중에) 이체 확인 화면 캡처·PDF 1개를 붙인다. 한 번 이체로 여러 결의서를 냈으면 같은 파일을 함께 쓴다
-- - 비공개 보관함 payout-proofs/{회사}/{uuid}.{확장자}. 파일은 서버가 운영 키로만 읽고 쓴다
-- - 세무 마감 ZIP·세무사무소 증빙 묶음에 지급확인증/ 폴더로 들어간다
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit)
values ('payout-proofs', 'payout-proofs', false, 10485760)
on conflict (id) do nothing;

alter table public.expense_claims
  add column payout_proof_path text check (payout_proof_path is null or split_part(payout_proof_path, '/', 1) = company_id::text),
  add column payout_proof_name text check (payout_proof_name is null or char_length(payout_proof_name) between 1 and 200);

-- 관리자: 지급 완료된 자기 회사 결의서에 확인증 붙이기(바꾸기). 바뀐 결의서 수
create or replace function public.set_payout_proof(p_claim_ids uuid[], p_path text, p_name text)
returns integer
language plpgsql security definer
set search_path = ''
as $$
declare
  v_admin public.members := private.require_admin();
  v_n integer;
begin
  if split_part(coalesce(p_path, ''), '/', 1) <> v_admin.company_id::text then raise exception 'INVALID_PAYOUT_PROOF'; end if;
  update public.expense_claims
     set payout_proof_path = p_path, payout_proof_name = left(btrim(p_name), 200), updated_at = now()
   where id = any(coalesce(p_claim_ids, '{}')) and company_id = v_admin.company_id and status = 'paid';
  get diagnostics v_n = row_count;
  if v_n = 0 then raise exception 'NOT_FOUND'; end if;
  return v_n;
end;
$$;
revoke all on function public.set_payout_proof(uuid[], text, text) from public, anon;
grant execute on function public.set_payout_proof(uuid[], text, text) to authenticated;
