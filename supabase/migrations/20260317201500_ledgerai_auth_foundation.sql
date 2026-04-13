-- LedgerAI Supabase foundation
-- Goal: migration-friendly schema for current App.jsx objects with typed columns + payload JSONB.

begin;

create extension if not exists pgcrypto;

create or replace function public.ledger_apply_row_defaults()
returns trigger
language plpgsql
as $$
begin
  if new.user_id is null then
    new.user_id := auth.uid();
  end if;

  if new.user_id is null then
    raise exception 'ledger row requires user_id or authenticated session';
  end if;

  if tg_op = 'INSERT' and new.created_at is null then
    new.created_at := timezone('utc', now());
  end if;

  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

create or replace function public.ledger_prevent_user_id_change()
returns trigger
language plpgsql
as $$
begin
  if new.user_id is distinct from old.user_id then
    raise exception 'ledger row ownership cannot be changed';
  end if;
  return new;
end;
$$;

create table if not exists public.ledger_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  client_id text,
  entry_type text not null check (entry_type in ('income','expense','transfer','borrow')),
  tx_date date not null default current_date,
  description text default '',
  amount numeric(18,2) not null default 0 check (amount >= 0),
  original_amount numeric(18,2),
  base_amount numeric(18,2),
  currency_code text not null default 'INR' check (currency_code ~ '^[A-Z]{3}$'),
  base_currency_code text not null default 'INR' check (base_currency_code ~ '^[A-Z]{3}$'),
  fx_rate numeric(18,8) not null default 1 check (fx_rate > 0),
  fx_date date,
  fx_rate_date date,
  fx_source text,
  business_activity text,
  category text,
  sub_category text,
  vendor text,
  track_vendor boolean not null default false,
  payment_method text,
  account_client_id text,
  account_name text,
  target_account_client_id text,
  target_account_name text,
  liability_account_client_id text,
  liability_account_name text,
  borrow_source text,
  notes text,
  source text,
  review_status text,
  email_provider text,
  email_subject text,
  email_from text,
  email_account_client_id text,
  email_msg_id text,
  journal_entries jsonb not null default '[]'::jsonb,
  payload jsonb not null default '{}'::jsonb,
  created_at_source timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists ledger_transactions_user_client_uidx
  on public.ledger_transactions(user_id, client_id)
  where client_id is not null and client_id <> '';
create index if not exists ledger_transactions_user_date_idx
  on public.ledger_transactions(user_id, tx_date desc);
create index if not exists ledger_transactions_user_activity_idx
  on public.ledger_transactions(user_id, business_activity, category);
create index if not exists ledger_transactions_user_vendor_idx
  on public.ledger_transactions(user_id, vendor)
  where track_vendor is true and vendor is not null and vendor <> '';
create index if not exists ledger_transactions_user_email_msg_idx
  on public.ledger_transactions(user_id, email_account_client_id, email_msg_id);

create table if not exists public.ledger_inbox_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  client_id text,
  item_type text not null check (item_type in ('income','expense','transfer','borrow')),
  tx_date date not null default current_date,
  description text default '',
  amount numeric(18,2) not null default 0 check (amount >= 0),
  original_amount numeric(18,2),
  base_amount numeric(18,2),
  currency_code text not null default 'INR' check (currency_code ~ '^[A-Z]{3}$'),
  base_currency_code text not null default 'INR' check (base_currency_code ~ '^[A-Z]{3}$'),
  fx_rate numeric(18,8) not null default 1 check (fx_rate > 0),
  fx_date date,
  fx_rate_date date,
  fx_source text,
  business_activity text,
  category text,
  sub_category text,
  vendor text,
  track_vendor boolean not null default false,
  payment_method text,
  account_client_id text,
  account_name text,
  target_account_client_id text,
  target_account_name text,
  liability_account_client_id text,
  liability_account_name text,
  borrow_source text,
  notes text,
  source text,
  review_status text not null default 'pending' check (review_status in ('pending','approved','discarded')),
  sort_ts bigint,
  queued_at timestamptz,
  email_provider text,
  email_subject text,
  email_from text,
  email_account_client_id text,
  email_msg_id text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists ledger_inbox_items_user_client_uidx
  on public.ledger_inbox_items(user_id, client_id)
  where client_id is not null and client_id <> '';
create index if not exists ledger_inbox_items_user_status_date_idx
  on public.ledger_inbox_items(user_id, review_status, tx_date desc);
create index if not exists ledger_inbox_items_user_email_msg_idx
  on public.ledger_inbox_items(user_id, email_account_client_id, email_msg_id);

create table if not exists public.ledger_email_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  client_id text,
  provider text not null check (provider in ('google','microsoft')),
  label text,
  email text,
  sync_query text,
  max_emails integer not null default 100 check (max_emails between 1 and 5000),
  auto_post boolean not null default false,
  auto_sync_hourly boolean not null default true,
  connected boolean not null default false,
  user_disconnected boolean not null default false,
  first_sync_completed boolean not null default false,
  sync_from_date date,
  token_expires_at timestamptz,
  last_auto_sync_at timestamptz,
  last_auth_at timestamptz,
  reauth_required boolean not null default false,
  ms_client_id text,
  ms_account_id text,
  ms_username text,
  last_sync_at timestamptz,
  last_count integer not null default 0,
  enabled boolean not null default true,
  last_error text,
  last_error_at timestamptz,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists ledger_email_accounts_user_client_uidx
  on public.ledger_email_accounts(user_id, client_id)
  where client_id is not null and client_id <> '';
create unique index if not exists ledger_email_accounts_user_provider_email_uidx
  on public.ledger_email_accounts(user_id, provider, lower(email))
  where email is not null and email <> '';
create index if not exists ledger_email_accounts_user_provider_connected_idx
  on public.ledger_email_accounts(user_id, provider, connected, reauth_required);

create table if not exists public.ledger_bookkeeping_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  client_id text,
  name text not null,
  account_type text,
  class_type text check (class_type is null or class_type in ('asset','liability','equity','income','expense')),
  type_name text,
  account_number text,
  bank_name text,
  balance numeric(18,2) not null default 0,
  original_balance numeric(18,2),
  account_currency_code text not null default 'INR' check (account_currency_code ~ '^[A-Z]{3}$'),
  balance_base_currency_code text not null default 'INR' check (balance_base_currency_code ~ '^[A-Z]{3}$'),
  balance_fx_rate numeric(18,8) not null default 1 check (balance_fx_rate > 0),
  balance_fx_date date,
  balance_rate_date date,
  balance_fx_source text,
  is_active boolean not null default true,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists ledger_bookkeeping_accounts_user_client_uidx
  on public.ledger_bookkeeping_accounts(user_id, client_id)
  where client_id is not null and client_id <> '';
create index if not exists ledger_bookkeeping_accounts_user_class_idx
  on public.ledger_bookkeeping_accounts(user_id, class_type);
create index if not exists ledger_bookkeeping_accounts_user_name_idx
  on public.ledger_bookkeeping_accounts(user_id, lower(name));

create table if not exists public.ledger_activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  client_id text,
  name text not null,
  sort_order integer not null default 0,
  is_archived boolean not null default false,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists ledger_activities_user_client_uidx
  on public.ledger_activities(user_id, client_id)
  where client_id is not null and client_id <> '';
create unique index if not exists ledger_activities_user_name_uidx
  on public.ledger_activities(user_id, lower(name));

create table if not exists public.ledger_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  client_id text,
  activity_name text not null,
  name text not null,
  description text,
  sort_order integer not null default 0,
  is_archived boolean not null default false,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists ledger_categories_user_client_uidx
  on public.ledger_categories(user_id, client_id)
  where client_id is not null and client_id <> '';
create unique index if not exists ledger_categories_user_activity_name_uidx
  on public.ledger_categories(user_id, lower(activity_name), lower(name));
create index if not exists ledger_categories_user_activity_idx
  on public.ledger_categories(user_id, lower(activity_name), is_archived);

create table if not exists public.ledger_recurring_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  client_id text,
  item_type text check (item_type is null or item_type in ('income','expense','transfer','borrow')),
  title text,
  description text,
  amount numeric(18,2) not null default 0,
  original_amount numeric(18,2),
  base_amount numeric(18,2),
  currency_code text not null default 'INR' check (currency_code ~ '^[A-Z]{3}$'),
  base_currency_code text not null default 'INR' check (base_currency_code ~ '^[A-Z]{3}$'),
  fx_rate numeric(18,8) not null default 1 check (fx_rate > 0),
  fx_date date,
  fx_rate_date date,
  fx_source text,
  frequency text,
  interval_count integer not null default 1 check (interval_count > 0),
  start_date date,
  end_date date,
  next_due_date date,
  last_run_date date,
  active boolean not null default true,
  business_activity text,
  category text,
  sub_category text,
  vendor text,
  track_vendor boolean not null default false,
  payment_method text,
  account_client_id text,
  target_account_client_id text,
  liability_account_client_id text,
  notes text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists ledger_recurring_items_user_client_uidx
  on public.ledger_recurring_items(user_id, client_id)
  where client_id is not null and client_id <> '';
create index if not exists ledger_recurring_items_user_due_idx
  on public.ledger_recurring_items(user_id, active, next_due_date);

create table if not exists public.ledger_app_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  setting_key text not null,
  setting_value jsonb not null default '{}'::jsonb,
  value_text text,
  value_number numeric,
  value_boolean boolean,
  description text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (user_id, setting_key)
);

create index if not exists ledger_app_settings_user_key_idx
  on public.ledger_app_settings(user_id, setting_key);

create table if not exists public.ledger_ai_pending_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  client_id text,
  account_client_id text not null,
  provider text not null check (provider in ('google','microsoft')),
  msg_id text not null,
  subject text,
  sender text,
  email_date date,
  snippet text,
  queued_at timestamptz not null default timezone('utc', now()),
  last_tried_at timestamptz,
  attempts integer not null default 0,
  next_retry_at timestamptz,
  last_error text,
  cloud_queued boolean not null default false,
  cloud_job_id text,
  status text not null default 'pending' check (status in ('pending','processing','done','failed','cancelled')),
  resolved_at timestamptz,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists ledger_ai_pending_items_user_client_uidx
  on public.ledger_ai_pending_items(user_id, client_id)
  where client_id is not null and client_id <> '';
create unique index if not exists ledger_ai_pending_items_user_account_msg_uidx
  on public.ledger_ai_pending_items(user_id, account_client_id, msg_id);
create index if not exists ledger_ai_pending_items_user_retry_idx
  on public.ledger_ai_pending_items(user_id, status, next_retry_at);

create table if not exists public.ledger_reconciliation_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  client_id text,
  account_client_id text,
  account_name text,
  statement_from date,
  statement_to date,
  source_label text,
  source_kind text check (source_kind is null or source_kind in ('upload','paste','api','other')),
  status text not null default 'pending' check (status in ('pending','running','completed','failed')),
  matched_count integer not null default 0,
  mismatch_count integer not null default 0,
  statement_only_count integer not null default 0,
  ledger_only_count integer not null default 0,
  started_at timestamptz,
  finished_at timestamptz,
  error_message text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (id, user_id)
);

create unique index if not exists ledger_reconciliation_runs_user_client_uidx
  on public.ledger_reconciliation_runs(user_id, client_id)
  where client_id is not null and client_id <> '';
create index if not exists ledger_reconciliation_runs_user_period_idx
  on public.ledger_reconciliation_runs(user_id, account_client_id, statement_from, statement_to);
create index if not exists ledger_reconciliation_runs_user_created_idx
  on public.ledger_reconciliation_runs(user_id, created_at desc);

create table if not exists public.ledger_reconciliation_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  run_id uuid not null,
  client_id text,
  item_kind text not null check (item_kind in ('statement_row','ledger_row','matched','amount_mismatch','statement_only','ledger_only')),
  item_key text,
  hidden boolean not null default false,
  statement_row_sid text,
  ledger_transaction_client_id text,
  statement_date date,
  ledger_date date,
  statement_amount numeric(18,2),
  ledger_amount numeric(18,2),
  amount_gap numeric(18,2),
  currency_code text check (currency_code is null or currency_code ~ '^[A-Z]{3}$'),
  base_currency_code text check (base_currency_code is null or base_currency_code ~ '^[A-Z]{3}$'),
  score numeric(12,6),
  description text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint ledger_reconciliation_items_run_fk
    foreign key (run_id, user_id)
    references public.ledger_reconciliation_runs(id, user_id)
    on delete cascade
);

create unique index if not exists ledger_reconciliation_items_user_client_uidx
  on public.ledger_reconciliation_items(user_id, client_id)
  where client_id is not null and client_id <> '';
create index if not exists ledger_reconciliation_items_user_run_kind_idx
  on public.ledger_reconciliation_items(user_id, run_id, item_kind);
create index if not exists ledger_reconciliation_items_user_hidden_idx
  on public.ledger_reconciliation_items(user_id, hidden);

create table if not exists public.ledger_currency_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  base_currency_code text not null default 'INR' check (base_currency_code ~ '^[A-Z]{3}$'),
  fx_provider text not null default 'ECB via Frankfurter',
  auto_convert boolean not null default true,
  last_rebased_at timestamptz,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (user_id)
);

create table if not exists public.ledger_fx_rates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  from_currency_code text not null check (from_currency_code ~ '^[A-Z]{3}$'),
  to_currency_code text not null check (to_currency_code ~ '^[A-Z]{3}$'),
  rate_date date not null,
  rate numeric(18,8) not null check (rate > 0),
  provider text,
  fetched_at timestamptz not null default timezone('utc', now()),
  source text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (user_id, from_currency_code, to_currency_code, rate_date)
);

create index if not exists ledger_fx_rates_user_rate_date_idx
  on public.ledger_fx_rates(user_id, rate_date desc, from_currency_code, to_currency_code);

create trigger trg_ledger_transactions_defaults
before insert or update on public.ledger_transactions
for each row execute function public.ledger_apply_row_defaults();
create trigger trg_ledger_transactions_user_lock
before update on public.ledger_transactions
for each row execute function public.ledger_prevent_user_id_change();

create trigger trg_ledger_inbox_items_defaults
before insert or update on public.ledger_inbox_items
for each row execute function public.ledger_apply_row_defaults();
create trigger trg_ledger_inbox_items_user_lock
before update on public.ledger_inbox_items
for each row execute function public.ledger_prevent_user_id_change();

create trigger trg_ledger_email_accounts_defaults
before insert or update on public.ledger_email_accounts
for each row execute function public.ledger_apply_row_defaults();
create trigger trg_ledger_email_accounts_user_lock
before update on public.ledger_email_accounts
for each row execute function public.ledger_prevent_user_id_change();

create trigger trg_ledger_bookkeeping_accounts_defaults
before insert or update on public.ledger_bookkeeping_accounts
for each row execute function public.ledger_apply_row_defaults();
create trigger trg_ledger_bookkeeping_accounts_user_lock
before update on public.ledger_bookkeeping_accounts
for each row execute function public.ledger_prevent_user_id_change();

create trigger trg_ledger_activities_defaults
before insert or update on public.ledger_activities
for each row execute function public.ledger_apply_row_defaults();
create trigger trg_ledger_activities_user_lock
before update on public.ledger_activities
for each row execute function public.ledger_prevent_user_id_change();

create trigger trg_ledger_categories_defaults
before insert or update on public.ledger_categories
for each row execute function public.ledger_apply_row_defaults();
create trigger trg_ledger_categories_user_lock
before update on public.ledger_categories
for each row execute function public.ledger_prevent_user_id_change();

create trigger trg_ledger_recurring_items_defaults
before insert or update on public.ledger_recurring_items
for each row execute function public.ledger_apply_row_defaults();
create trigger trg_ledger_recurring_items_user_lock
before update on public.ledger_recurring_items
for each row execute function public.ledger_prevent_user_id_change();

create trigger trg_ledger_app_settings_defaults
before insert or update on public.ledger_app_settings
for each row execute function public.ledger_apply_row_defaults();
create trigger trg_ledger_app_settings_user_lock
before update on public.ledger_app_settings
for each row execute function public.ledger_prevent_user_id_change();

create trigger trg_ledger_ai_pending_items_defaults
before insert or update on public.ledger_ai_pending_items
for each row execute function public.ledger_apply_row_defaults();
create trigger trg_ledger_ai_pending_items_user_lock
before update on public.ledger_ai_pending_items
for each row execute function public.ledger_prevent_user_id_change();

create trigger trg_ledger_reconciliation_runs_defaults
before insert or update on public.ledger_reconciliation_runs
for each row execute function public.ledger_apply_row_defaults();
create trigger trg_ledger_reconciliation_runs_user_lock
before update on public.ledger_reconciliation_runs
for each row execute function public.ledger_prevent_user_id_change();

create trigger trg_ledger_reconciliation_items_defaults
before insert or update on public.ledger_reconciliation_items
for each row execute function public.ledger_apply_row_defaults();
create trigger trg_ledger_reconciliation_items_user_lock
before update on public.ledger_reconciliation_items
for each row execute function public.ledger_prevent_user_id_change();

create trigger trg_ledger_currency_settings_defaults
before insert or update on public.ledger_currency_settings
for each row execute function public.ledger_apply_row_defaults();
create trigger trg_ledger_currency_settings_user_lock
before update on public.ledger_currency_settings
for each row execute function public.ledger_prevent_user_id_change();

create trigger trg_ledger_fx_rates_defaults
before insert or update on public.ledger_fx_rates
for each row execute function public.ledger_apply_row_defaults();
create trigger trg_ledger_fx_rates_user_lock
before update on public.ledger_fx_rates
for each row execute function public.ledger_prevent_user_id_change();

do $$
declare
  t text;
begin
  foreach t in array array[
    'ledger_transactions',
    'ledger_inbox_items',
    'ledger_email_accounts',
    'ledger_bookkeeping_accounts',
    'ledger_activities',
    'ledger_categories',
    'ledger_recurring_items',
    'ledger_app_settings',
    'ledger_ai_pending_items',
    'ledger_reconciliation_runs',
    'ledger_reconciliation_items',
    'ledger_currency_settings',
    'ledger_fx_rates'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);

    execute format('drop policy if exists sel_own on public.%I', t);
    execute format('drop policy if exists ins_own on public.%I', t);
    execute format('drop policy if exists upd_own on public.%I', t);
    execute format('drop policy if exists del_own on public.%I', t);

    execute format('create policy sel_own on public.%I for select using (auth.uid() = user_id)', t);
    execute format('create policy ins_own on public.%I for insert with check (auth.uid() is not null and auth.uid() = user_id)', t);
    execute format('create policy upd_own on public.%I for update using (auth.uid() = user_id) with check (auth.uid() = user_id)', t);
    execute format('create policy del_own on public.%I for delete using (auth.uid() = user_id)', t);
  end loop;
end
$$;

grant usage on schema public to authenticated;
do $$
declare
  t text;
begin
  foreach t in array array[
    'ledger_transactions',
    'ledger_inbox_items',
    'ledger_email_accounts',
    'ledger_bookkeeping_accounts',
    'ledger_activities',
    'ledger_categories',
    'ledger_recurring_items',
    'ledger_app_settings',
    'ledger_ai_pending_items',
    'ledger_reconciliation_runs',
    'ledger_reconciliation_items',
    'ledger_currency_settings',
    'ledger_fx_rates'
  ] loop
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end
$$;

create or replace function public.ledger_upsert_app_setting(
  p_setting_key text,
  p_setting_value jsonb default '{}'::jsonb,
  p_value_text text default null,
  p_value_number numeric default null,
  p_value_boolean boolean default null,
  p_description text default null,
  p_payload jsonb default '{}'::jsonb
)
returns public.ledger_app_settings
language plpgsql
security invoker
as $$
declare
  v_user uuid := auth.uid();
  v_row public.ledger_app_settings;
begin
  if v_user is null then
    raise exception 'Authentication required';
  end if;

  if p_setting_key is null or btrim(p_setting_key) = '' then
    raise exception 'setting_key is required';
  end if;

  insert into public.ledger_app_settings (
    user_id,
    setting_key,
    setting_value,
    value_text,
    value_number,
    value_boolean,
    description,
    payload
  )
  values (
    v_user,
    btrim(p_setting_key),
    coalesce(p_setting_value, '{}'::jsonb),
    p_value_text,
    p_value_number,
    p_value_boolean,
    p_description,
    coalesce(p_payload, '{}'::jsonb)
  )
  on conflict (user_id, setting_key)
  do update set
    setting_value = excluded.setting_value,
    value_text = excluded.value_text,
    value_number = excluded.value_number,
    value_boolean = excluded.value_boolean,
    description = excluded.description,
    payload = coalesce(public.ledger_app_settings.payload, '{}'::jsonb) || coalesce(excluded.payload, '{}'::jsonb)
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.ledger_get_base_currency()
returns text
language plpgsql
stable
security invoker
as $$
declare
  v_user uuid := auth.uid();
  v_currency text;
begin
  if v_user is null then
    return 'INR';
  end if;

  select base_currency_code
  into v_currency
  from public.ledger_currency_settings
  where user_id = v_user
  limit 1;

  return coalesce(v_currency, 'INR');
end;
$$;

create or replace function public.ledger_set_base_currency(
  p_base_currency text,
  p_fx_provider text default 'ECB via Frankfurter',
  p_auto_convert boolean default true,
  p_payload jsonb default '{}'::jsonb
)
returns public.ledger_currency_settings
language plpgsql
security invoker
as $$
declare
  v_user uuid := auth.uid();
  v_code text := upper(btrim(coalesce(p_base_currency, '')));
  v_row public.ledger_currency_settings;
begin
  if v_user is null then
    raise exception 'Authentication required';
  end if;

  if v_code !~ '^[A-Z]{3}$' then
    raise exception 'base currency must be 3-letter ISO code';
  end if;

  insert into public.ledger_currency_settings (
    user_id,
    base_currency_code,
    fx_provider,
    auto_convert,
    last_rebased_at,
    payload
  )
  values (
    v_user,
    v_code,
    coalesce(nullif(btrim(p_fx_provider), ''), 'ECB via Frankfurter'),
    coalesce(p_auto_convert, true),
    timezone('utc', now()),
    coalesce(p_payload, '{}'::jsonb)
  )
  on conflict (user_id)
  do update set
    base_currency_code = excluded.base_currency_code,
    fx_provider = excluded.fx_provider,
    auto_convert = excluded.auto_convert,
    last_rebased_at = excluded.last_rebased_at,
    payload = coalesce(public.ledger_currency_settings.payload, '{}'::jsonb) || coalesce(excluded.payload, '{}'::jsonb)
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on function public.ledger_upsert_app_setting(text, jsonb, text, numeric, boolean, text, jsonb) to authenticated;
grant execute on function public.ledger_get_base_currency() to authenticated;
grant execute on function public.ledger_set_base_currency(text, text, boolean, jsonb) to authenticated;

commit;
