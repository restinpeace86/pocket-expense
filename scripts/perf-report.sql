-- 사용자 체감 성능 요약 (D-075): 최근 7일, 화면·지표별 중간값(p50)·p75·p95, 건수. 단위 ms (CLS는 점수)
select route, metric, coalesce(action, '') as action, device, count(*) as n,
       round(percentile_cont(0.5) within group (order by value)::numeric, 0) as p50,
       round(percentile_cont(0.75) within group (order by value)::numeric, 0) as p75,
       round(percentile_cont(0.95) within group (order by value)::numeric, 0) as p95
from public.perf_events
where created_at > now() - interval '7 days'
group by route, metric, action, device
order by route, metric, device;
