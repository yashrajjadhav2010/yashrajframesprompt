-- ============================================================================
-- YASHRAJ FRAMES – AI STUDIO
-- Supabase Realtime Database Schema + Clerk Auth Row-Level Security (RLS)
-- Includes Admin Console Telemetry, Prompt Copy Tracking & Approve/Pause Control
--
-- Setup Steps:
-- 1. In Clerk Dashboard -> Integrations -> Supabase, enable Supabase Third-Party
--    Auth integration.
-- 2. (Recommended) In Clerk Dashboard -> Sessions -> Customize session token,
--    add:  { "email": "{{user.primary_email_address}}" }
--    (Or add your Clerk user_id to public.studio_admins below.)
-- 3. In Supabase Dashboard -> Authentication -> Sign In / Providers -> Add
--    Third-Party Auth -> Clerk (https://picked-gannet-9233.clerk.accounts.dev).
-- 4. Paste and run this entire SQL script in Supabase SQL Editor.
-- ============================================================================

-- 1. STUDIO CUSTOM STYLES & PROMPTS (Real-time Mobile <-> Desktop Sync)
create table if not exists public.studio_styles (
  id bigint primary key,
  user_id text not null default (auth.jwt()->>'sub'),
  title text not null,
  category text not null default 'Other',
  prompt text not null,
  reference_image text,
  thumbnail text,
  aspect_ratio text default '2:3',
  description text,
  tags text[] not null default '{}',
  is_custom boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_studio_styles_user_created
  on public.studio_styles (user_id, created_at desc);

-- 2. SHOP ORDERS & WORKSHOP JOB SLIPS
create table if not exists public.shop_orders (
  id uuid primary key default gen_random_uuid(),
  user_id text not null default (auth.jwt()->>'sub'),
  order_num text not null,
  customer_name text not null,
  customer_phone text,
  style_name text,
  photo_url text,
  frame_details text,
  media_label text,
  price numeric not null default 0,
  advance numeric not null default 0,
  balance numeric not null default 0,
  delivery text,
  notes text,
  status text not null default 'in-progress'
    check (status in ('in-progress', 'ready', 'delivered')),
  order_date text,
  contact jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, order_num)
);

create index if not exists idx_shop_orders_user_updated
  on public.shop_orders (user_id, updated_at desc);

-- 3. USER SUBSCRIPTIONS & ADMIN CONTROLLED ACCESS
create table if not exists public.user_subscriptions (
  user_id text primary key default (auth.jwt()->>'sub'),
  email text,
  full_name text,
  avatar_url text,
  plan_tier text not null default 'free'
    check (plan_tier in ('free', 'studio_pro', 'enterprise')),
  plan_status text not null default 'active'
    check (plan_status in ('active', 'paused', 'pending', 'trialing', 'past_due', 'canceled')),
  style_limit integer not null default 25,
  order_limit integer not null default 50,
  prompt_copy_count integer not null default 0,
  ai_redirect_count integer not null default 0,
  last_prompt_title text,
  last_active_at timestamptz default now(),
  admin_note text,
  approved_at timestamptz,
  paused_at timestamptz,
  billing_cycle text default 'monthly',
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Safe migrations if user_subscriptions already existed from earlier setup
alter table public.user_subscriptions add column if not exists full_name text;
alter table public.user_subscriptions add column if not exists avatar_url text;
alter table public.user_subscriptions add column if not exists prompt_copy_count integer not null default 0;
alter table public.user_subscriptions add column if not exists ai_redirect_count integer not null default 0;
alter table public.user_subscriptions add column if not exists last_prompt_title text;
alter table public.user_subscriptions add column if not exists last_active_at timestamptz default now();
alter table public.user_subscriptions add column if not exists admin_note text;
alter table public.user_subscriptions add column if not exists approved_at timestamptz;
alter table public.user_subscriptions add column if not exists paused_at timestamptz;

-- Ensure plan_status constraint supports 'paused' and 'pending'
alter table public.user_subscriptions drop constraint if exists user_subscriptions_plan_status_check;
alter table public.user_subscriptions
  add constraint user_subscriptions_plan_status_check
  check (plan_status in ('active', 'paused', 'pending', 'trialing', 'past_due', 'canceled'));

-- 4. USER PREFERENCES (Favorites, History, AI App Target, Shop Contact Card)
create table if not exists public.user_preferences (
  user_id text primary key default (auth.jwt()->>'sub'),
  favorites bigint[] not null default '{}',
  recent_ids bigint[] not null default '{}',
  default_ai_app text,
  shop_contact jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- 5. PROMPT COPY & AI REDIRECT ACTIVITY LOGS (For Admin Telemetry)
create table if not exists public.prompt_activity_logs (
  id bigint generated always as identity primary key,
  user_id text not null default (auth.jwt()->>'sub'),
  user_email text,
  pin_id bigint,
  pin_title text,
  category text,
  action_type text not null default 'copy'
    check (action_type in ('copy', 'ai_redirect')),
  ai_target text,
  created_at timestamptz not null default now()
);

create index if not exists idx_prompt_activity_user_created
  on public.prompt_activity_logs (user_id, created_at desc);

-- 6. ADMIN ALLOWLIST TABLE (Backup binding alongside JWT email claim)
create table if not exists public.studio_admins (
  user_id text primary key,
  email text not null unique,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- ADMIN HELPER FUNCTION (yashrajart1999@gmail.com)
-- ============================================================================
create or replace function public.is_studio_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    lower(coalesce(auth.jwt()->>'email', auth.jwt()->'user_metadata'->>'email', '')) = 'yashrajart1999@gmail.com'
    or exists (
      select 1
      from public.studio_admins sa
      where sa.user_id = (auth.jwt()->>'sub')
        and lower(sa.email) = 'yashrajart1999@gmail.com'
    );
$$;

-- Protect plan_status & plan_tier from client-side tampering by non-admins
create or replace function public.guard_subscription_mutation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_user in ('postgres', 'service_role') or public.is_studio_admin() then
    new.updated_at := now();
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- New signups start as free/active unless admin later pauses them
    new.plan_tier := 'free';
    new.plan_status := 'active';
    new.style_limit := 25;
    new.order_limit := 50;
    new.prompt_copy_count := 0;
    new.ai_redirect_count := 0;
    new.admin_note := null;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    -- Regular users cannot unpause themselves or escalate limits
    if old.plan_status = 'paused' then
      new.plan_status := 'paused';
    elsif new.plan_status is distinct from old.plan_status then
      -- Users may only move themselves into 'pending' (requesting upgrade approval)
      if new.plan_status <> 'pending' then
        new.plan_status := old.plan_status;
      end if;
    end if;

    -- Users cannot raise their own limits or overwrite admin notes
    if new.plan_status <> 'pending' then
      new.plan_tier := old.plan_tier;
    end if;
    new.style_limit := old.style_limit;
    new.order_limit := old.order_limit;
    new.admin_note := old.admin_note;
    new.approved_at := old.approved_at;
    new.paused_at := old.paused_at;
    new.updated_at := now();
    return new;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_subscription_mutation on public.user_subscriptions;
create trigger trg_guard_subscription_mutation
  before insert or update on public.user_subscriptions
  for each row execute function public.guard_subscription_mutation();

-- Atomic telemetry RPC called whenever a user copies a prompt or redirects to AI
create or replace function public.track_prompt_usage(
  p_email text default null,
  p_full_name text default null,
  p_avatar_url text default null,
  p_pin_id bigint default null,
  p_pin_title text default null,
  p_category text default null,
  p_action_type text default 'copy',
  p_ai_target text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid text := auth.jwt()->>'sub';
  v_action text := case when p_action_type = 'ai_redirect' then 'ai_redirect' else 'copy' end;
begin
  if v_uid is null or v_uid = '' then
    return;
  end if;

  insert into public.user_subscriptions (
    user_id, email, full_name, avatar_url, plan_tier, plan_status,
    prompt_copy_count, ai_redirect_count, last_prompt_title, last_active_at
  )
  values (
    v_uid,
    nullif(trim(coalesce(p_email, '')), ''),
    nullif(trim(coalesce(p_full_name, '')), ''),
    nullif(trim(coalesce(p_avatar_url, '')), ''),
    'free',
    'active',
    case when v_action = 'copy' then 1 else 0 end,
    case when v_action = 'ai_redirect' then 1 else 0 end,
    nullif(trim(coalesce(p_pin_title, '')), ''),
    now()
  )
  on conflict (user_id) do update set
    email = coalesce(nullif(trim(coalesce(p_email, '')), ''), public.user_subscriptions.email),
    full_name = coalesce(nullif(trim(coalesce(p_full_name, '')), ''), public.user_subscriptions.full_name),
    avatar_url = coalesce(nullif(trim(coalesce(p_avatar_url, '')), ''), public.user_subscriptions.avatar_url),
    prompt_copy_count = public.user_subscriptions.prompt_copy_count + (case when v_action = 'copy' then 1 else 0 end),
    ai_redirect_count = public.user_subscriptions.ai_redirect_count + (case when v_action = 'ai_redirect' then 1 else 0 end),
    last_prompt_title = coalesce(nullif(trim(coalesce(p_pin_title, '')), ''), public.user_subscriptions.last_prompt_title),
    last_active_at = now(),
    updated_at = now();

  insert into public.prompt_activity_logs (
    user_id, user_email, pin_id, pin_title, category, action_type, ai_target
  )
  values (
    v_uid,
    nullif(trim(coalesce(p_email, '')), ''),
    p_pin_id,
    nullif(trim(coalesce(p_pin_title, '')), ''),
    nullif(trim(coalesce(p_category, '')), ''),
    v_action,
    nullif(trim(coalesce(p_ai_target, '')), '')
  );
end;
$$;

grant execute on function public.track_prompt_usage(text, text, text, bigint, text, text, text, text) to authenticated;

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================
alter table public.studio_styles enable row level security;
alter table public.shop_orders enable row level security;
alter table public.user_subscriptions enable row level security;
alter table public.user_preferences enable row level security;
alter table public.prompt_activity_logs enable row level security;
alter table public.studio_admins enable row level security;

-- Studio Styles Policies
drop policy if exists "Users read own studio styles" on public.studio_styles;
create policy "Users read own studio styles"
  on public.studio_styles for select
  to authenticated
  using ((auth.jwt()->>'sub') = user_id or public.is_studio_admin());

drop policy if exists "Users insert own studio styles" on public.studio_styles;
create policy "Users insert own studio styles"
  on public.studio_styles for insert
  to authenticated
  with check ((auth.jwt()->>'sub') = user_id);

drop policy if exists "Users update own studio styles" on public.studio_styles;
create policy "Users update own studio styles"
  on public.studio_styles for update
  to authenticated
  using ((auth.jwt()->>'sub') = user_id)
  with check ((auth.jwt()->>'sub') = user_id);

drop policy if exists "Users delete own studio styles" on public.studio_styles;
create policy "Users delete own studio styles"
  on public.studio_styles for delete
  to authenticated
  using ((auth.jwt()->>'sub') = user_id);

-- Shop Orders Policies
drop policy if exists "Users manage own shop orders" on public.shop_orders;
create policy "Users manage own shop orders"
  on public.shop_orders for all
  to authenticated
  using ((auth.jwt()->>'sub') = user_id or public.is_studio_admin())
  with check ((auth.jwt()->>'sub') = user_id);

-- User Subscriptions Policies
drop policy if exists "Users read own subscription" on public.user_subscriptions;
drop policy if exists "Users and admin read subscriptions" on public.user_subscriptions;
create policy "Users and admin read subscriptions"
  on public.user_subscriptions for select
  to authenticated
  using ((auth.jwt()->>'sub') = user_id or public.is_studio_admin());

drop policy if exists "Users initialize free subscription" on public.user_subscriptions;
create policy "Users initialize free subscription"
  on public.user_subscriptions for insert
  to authenticated
  with check ((auth.jwt()->>'sub') = user_id);

drop policy if exists "Users update own profile or admin manages all" on public.user_subscriptions;
create policy "Users update own profile or admin manages all"
  on public.user_subscriptions for update
  to authenticated
  using ((auth.jwt()->>'sub') = user_id or public.is_studio_admin())
  with check ((auth.jwt()->>'sub') = user_id or public.is_studio_admin());

-- User Preferences Policies
drop policy if exists "Users manage own preferences" on public.user_preferences;
create policy "Users manage own preferences"
  on public.user_preferences for all
  to authenticated
  using ((auth.jwt()->>'sub') = user_id)
  with check ((auth.jwt()->>'sub') = user_id);

-- Prompt Activity Logs Policies
drop policy if exists "Users and admin read prompt logs" on public.prompt_activity_logs;
create policy "Users and admin read prompt logs"
  on public.prompt_activity_logs for select
  to authenticated
  using ((auth.jwt()->>'sub') = user_id or public.is_studio_admin());

drop policy if exists "Users insert own prompt logs" on public.prompt_activity_logs;
create policy "Users insert own prompt logs"
  on public.prompt_activity_logs for insert
  to authenticated
  with check ((auth.jwt()->>'sub') = user_id);

-- Studio Admins Policies (read-only for authenticated check)
drop policy if exists "Admins read allowlist" on public.studio_admins;
create policy "Admins read allowlist"
  on public.studio_admins for select
  to authenticated
  using ((auth.jwt()->>'sub') = user_id or public.is_studio_admin());

-- ============================================================================
-- ENABLE SUPABASE REALTIME FOR CROSS-DEVICE LIVE SYNC
-- ============================================================================
alter table public.studio_styles replica identity full;
alter table public.shop_orders replica identity full;
alter table public.user_subscriptions replica identity full;
alter table public.user_preferences replica identity full;
alter table public.prompt_activity_logs replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'studio_styles'
  ) then
    alter publication supabase_realtime add table public.studio_styles;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'shop_orders'
  ) then
    alter publication supabase_realtime add table public.shop_orders;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'user_subscriptions'
  ) then
    alter publication supabase_realtime add table public.user_subscriptions;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'user_preferences'
  ) then
    alter publication supabase_realtime add table public.user_preferences;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'prompt_activity_logs'
  ) then
    alter publication supabase_realtime add table public.prompt_activity_logs;
  end if;
end $$;
