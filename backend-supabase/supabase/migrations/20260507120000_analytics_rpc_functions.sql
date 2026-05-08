-- Analytics dashboard support for Light Story.
-- Provides normalized RPC functions for engagement, content performance, and cached infrastructure snapshots.

create table if not exists public.chapter_views (
  id uuid primary key default gen_random_uuid(),
  chapter_id uuid not null references public.chapters(id) on delete cascade,
  viewed_by uuid not null references public.profiles(id) on delete cascade,
  viewed_at timestamptz not null default timezone('utc'::text, now())
);

create unique index if not exists idx_chapter_views_unique_hour on public.chapter_views (
  chapter_id,
  viewed_by,
  (date_trunc('hour', viewed_at))
);

create index if not exists idx_chapter_views_chapter_id_viewed_at on public.chapter_views (chapter_id, viewed_at desc);
create index if not exists idx_chapter_views_viewed_by_viewed_at on public.chapter_views (viewed_by, viewed_at desc);

create table if not exists public.analytics_snapshots (
  id uuid primary key default gen_random_uuid(),
  source text not null default 'cloudflare',
  range_key text not null check (range_key in ('24h', '7d', '30d')),
  metrics jsonb not null default '{}'::jsonb,
  recorded_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists idx_analytics_snapshots_source_range_recorded_at
  on public.analytics_snapshots (source, range_key, recorded_at desc);

create or replace function public.analytics_time_range_key(p_time_range interval)
returns text
language sql
immutable
as $$
  select case
    when p_time_range <= interval '1 day' then '24h'
    when p_time_range <= interval '7 days' then '7d'
    else '30d'
  end;
$$;

create or replace function public.increment_chapter_views(chapter_id_param uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid;
begin
  current_user_id := auth.uid();

  if current_user_id is null then
    return;
  end if;

  insert into public.chapter_views (chapter_id, viewed_by)
  values (chapter_id_param, current_user_id)
  on conflict do nothing;
end;
$$;

create or replace function public.get_user_engagement_metrics(
  p_time_range interval default interval '7 days'
)
returns table (
  total_users bigint,
  new_users bigint,
  active_users bigint,
  total_views bigint,
  total_favorites bigint,
  growth_rate_pct numeric,
  churn_rate_pct numeric,
  avg_session_duration_minutes numeric
)
language plpgsql
stable
as $$
declare
  current_start timestamptz := timezone('utc'::text, now()) - p_time_range;
  previous_start timestamptz := timezone('utc'::text, now()) - (p_time_range * 2);
  previous_end timestamptz := current_start;
begin
  return query
  with current_period as (
    select p.id
    from public.profiles p
    where p.created_at >= current_start
  ),
  previous_period as (
    select p.id
    from public.profiles p
    where p.created_at >= previous_start and p.created_at < previous_end
  ),
  current_active as (
    select distinct sv.viewed_by as id
    from public.story_views sv
    where sv.viewed_at >= current_start
  ),
  previous_active as (
    select distinct sv.viewed_by as id
    from public.story_views sv
    where sv.viewed_at >= previous_start and sv.viewed_at < previous_end
  ),
  current_views as (
    select count(*)::bigint as total_views
    from public.story_views sv
    where sv.viewed_at >= current_start
  ),
  current_favorites as (
    select count(*)::bigint as total_favorites
    from public.story_likes sl
    where sl.created_at >= current_start
  ),
  current_sessions as (
    select avg(session_minutes)::numeric as avg_session_duration_minutes
    from (
      select
        extract(epoch from max(sv.viewed_at) - min(sv.viewed_at)) / 60.0 as session_minutes
      from public.story_views sv
      where sv.viewed_at >= current_start
      group by sv.viewed_by
      limit 500
    ) sessions
  )
  select
    (select count(*)::bigint from public.profiles),
    (select count(*)::bigint from current_period),
    (select count(*)::bigint from current_active),
    coalesce((select total_views from current_views), 0),
    coalesce((select total_favorites from current_favorites), 0),
    round(
      (
        (select count(*)::numeric from current_period) -
        (select count(*)::numeric from previous_period)
      ) / nullif((select count(*)::numeric from previous_period), 0) * 100,
      2
    ),
    round(
      (
        (select count(distinct p.id)::numeric from previous_active p
          left join current_active c on c.id = p.id
         where c.id is null)
      ) / nullif((select count(*)::numeric from previous_active), 0) * 100,
      2
    ),
    coalesce((select avg_session_duration_minutes from current_sessions), 0);
end;
$$;

create or replace function public.get_content_performance(
  p_time_range interval default interval '7 days',
  p_limit int default 5
)
returns table (
  top_chapters jsonb,
  total_views bigint,
  total_favorites bigint,
  avg_views_per_chapter numeric,
  engagement_score numeric
)
language plpgsql
stable
as $$
declare
  current_start timestamptz := timezone('utc'::text, now()) - p_time_range;
begin
  return query
  with chapter_stats as (
    select
      c.id as chapter_id,
      c.story_id,
      c.chapter_number,
      c.title,
      count(cv.id)::bigint as views,
      count(distinct sl.user_id)::bigint as favorites,
      round((count(cv.id)::numeric + count(distinct sl.user_id)::numeric * 2), 2) as engagement_score,
      row_number() over (order by count(cv.id) desc, count(distinct sl.user_id) desc, c.chapter_number asc) as rank
    from public.chapters c
    left join public.chapter_views cv
      on cv.chapter_id = c.id
     and cv.viewed_at >= current_start
    left join public.story_likes sl
      on sl.story_id = c.story_id
     and sl.created_at >= current_start
    group by c.id, c.story_id, c.chapter_number, c.title
  )
  select
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'chapter_id', chapter_id,
          'story_id', story_id,
          'chapter_number', chapter_number,
          'title', title,
          'views', views,
          'favorites', favorites,
          'engagement_score', engagement_score,
          'growth_rate_pct', 0
        )
        order by rank asc
      ) filter (where rank <= p_limit),
      '[]'::jsonb
    ) as top_chapters,
    coalesce(sum(views), 0) as total_views,
    coalesce(sum(favorites), 0) as total_favorites,
    coalesce(avg(views)::numeric, 0) as avg_views_per_chapter,
    coalesce(avg(engagement_score), 0) as engagement_score
  from chapter_stats;
end;
$$;

create or replace function public.get_storage_metrics(
  p_time_range interval default interval '30 days'
)
returns table (
  r2_usage_gb numeric,
  r2_allocated_gb numeric,
  r2_object_count bigint,
  r2_egress_gb numeric,
  d1_queries_count bigint,
  d1_avg_latency_ms numeric,
  page_views bigint,
  bandwidth_gb numeric,
  cache_hit_ratio_pct numeric,
  storage_efficiency_pct numeric,
  device_mobile bigint,
  device_desktop bigint,
  device_tablet bigint,
  top_zones jsonb
)
language plpgsql
stable
as $$
declare
  target_range_key text := public.analytics_time_range_key(p_time_range);
begin
  return query
  select
    coalesce((metrics ->> 'r2_usage_gb')::numeric, 0),
    coalesce((metrics ->> 'r2_allocated_gb')::numeric, 0),
    coalesce((metrics ->> 'r2_object_count')::bigint, 0),
    coalesce((metrics ->> 'r2_egress_gb')::numeric, 0),
    coalesce((metrics ->> 'd1_queries_count')::bigint, 0),
    coalesce((metrics ->> 'd1_avg_latency_ms')::numeric, 0),
    coalesce((metrics ->> 'page_views')::bigint, 0),
    coalesce((metrics ->> 'bandwidth_gb')::numeric, 0),
    coalesce((metrics ->> 'cache_hit_ratio_pct')::numeric, 0),
    coalesce((metrics ->> 'storage_efficiency_pct')::numeric, 0),
    coalesce((metrics ->> 'device_mobile')::bigint, 0),
    coalesce((metrics ->> 'device_desktop')::bigint, 0),
    coalesce((metrics ->> 'device_tablet')::bigint, 0),
    coalesce((metrics ->> 'top_zones')::jsonb, '[]'::jsonb)
  from public.analytics_snapshots
  where source = 'cloudflare'
    and range_key = target_range_key
  order by recorded_at desc
  limit 1;

  if not found then
    return query select 0::numeric, 0::numeric, 0::bigint, 0::numeric, 0::bigint, 0::numeric, 0::bigint, 0::numeric, 0::numeric, 0::numeric, 0::bigint, 0::bigint, 0::bigint, '[]'::jsonb;
  end if;
end;
$$;

grant execute on function public.analytics_time_range_key(interval) to authenticated, service_role;
grant execute on function public.increment_chapter_views(uuid) to authenticated, service_role;
grant execute on function public.get_user_engagement_metrics(interval) to authenticated, service_role;
grant execute on function public.get_content_performance(interval, int) to authenticated, service_role;
grant execute on function public.get_storage_metrics(interval) to authenticated, service_role;
