-- LedgerAI SMS Schema Migration
-- Goal: Add SMS message storage, AI analysis results, and transaction deduplication
-- Date: 2026-03-31

begin;

-- Table 1: ledger_sms_messages
-- Purpose: Persistent storage of raw SMS messages received from device
-- 16 columns with indexes for efficient querying by user, date, phone, status

create table if not exists public.ledger_sms_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  client_id text,
  phone_number text not null,
  message_body text not null,
  message_date date not null default current_date,
  message_timestamp timestamptz not null,
  sms_thread_id text,
  is_processed boolean not null default false,
  processing_started_at timestamptz,
  processing_completed_at timestamptz,
  analysis_status text check (analysis_status in ('pending', 'processing', 'completed', 'failed')),
  analysis_error text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

-- Indexes for efficient SMS message querying
create index if not exists ledger_sms_messages_user_date_idx
  on public.ledger_sms_messages(user_id, message_date desc);
create index if not exists ledger_sms_messages_user_phone_idx
  on public.ledger_sms_messages(user_id, phone_number);
create index if not exists ledger_sms_messages_user_status_idx
  on public.ledger_sms_messages(user_id, analysis_status);
create index if not exists ledger_sms_messages_user_thread_idx
  on public.ledger_sms_messages(user_id, sms_thread_id)
  where sms_thread_id is not null;

-- Attach triggers to ledger_sms_messages
create trigger trg_ledger_sms_messages_defaults
before insert or update on public.ledger_sms_messages
for each row execute function public.ledger_apply_row_defaults();

create trigger trg_ledger_sms_messages_user_lock
before update on public.ledger_sms_messages
for each row execute function public.ledger_prevent_user_id_change();

-- Table 2: ledger_sms_analysis
-- Purpose: AI-generated analysis results from SMS messages
-- 18 columns storing extracted transaction metadata (amount, vendor, category, etc.)

create table if not exists public.ledger_sms_analysis (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  client_id text,
  sms_message_id uuid not null references public.ledger_sms_messages(id) on delete cascade,
  input_text text not null,
  analysis_model text default 'gpt-4',
  extracted_amount numeric(18,2),
  extracted_currency text check (extracted_currency is null or extracted_currency ~ '^[A-Z]{3}$'),
  extracted_entry_type text check (extracted_entry_type in ('income', 'expense', 'transfer', 'borrow')),
  extracted_vendor text,
  extracted_category text,
  extracted_description text,
  confidence_score numeric(5,3) check (confidence_score is null or confidence_score between 0 and 1),
  raw_response jsonb not null default '{}'::jsonb,
  extraction_succeeded boolean not null default false,
  extraction_error text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

-- Indexes for efficient SMS analysis querying
create index if not exists ledger_sms_analysis_user_sms_idx
  on public.ledger_sms_analysis(user_id, sms_message_id);
create index if not exists ledger_sms_analysis_user_status_idx
  on public.ledger_sms_analysis(user_id, extraction_succeeded);
create index if not exists ledger_sms_analysis_user_vendor_idx
  on public.ledger_sms_analysis(user_id, extracted_vendor);

-- Attach triggers to ledger_sms_analysis
create trigger trg_ledger_sms_analysis_defaults
before insert or update on public.ledger_sms_analysis
for each row execute function public.ledger_apply_row_defaults();

create trigger trg_ledger_sms_analysis_user_lock
before update on public.ledger_sms_analysis
for each row execute function public.ledger_prevent_user_id_change();

-- Table 3: ledger_transaction_deduplication
-- Purpose: Track deduplication records to prevent duplicate transactions across email and SMS
-- 16 columns with signature-based matching and user decision tracking

create table if not exists public.ledger_transaction_deduplication (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  client_id text,
  dedup_signature text not null,
  source_type text not null check (source_type in ('email', 'sms', 'manual')),
  source_reference_id uuid,
  matched_inbox_item_id uuid references public.ledger_inbox_items(id) on delete set null,
  matched_transaction_id uuid references public.ledger_transactions(id) on delete set null,
  match_confidence numeric(5,3) check (match_confidence is null or match_confidence between 0 and 1),
  match_reason text,
  is_acknowledged boolean not null default false,
  decision text check (decision is null or decision in ('keep_both', 'discard_new', 'discard_existing', 'merge')),
  decided_at timestamptz,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (user_id, dedup_signature, source_type, source_reference_id)
);

-- Indexes for efficient deduplication querying
create index if not exists ledger_transaction_dedup_user_sig_idx
  on public.ledger_transaction_deduplication(user_id, dedup_signature);
create index if not exists ledger_transaction_dedup_user_source_idx
  on public.ledger_transaction_deduplication(user_id, source_type, source_reference_id);
create index if not exists ledger_transaction_dedup_user_pending_idx
  on public.ledger_transaction_deduplication(user_id, is_acknowledged)
  where is_acknowledged = false;

-- Attach triggers to ledger_transaction_deduplication
create trigger trg_ledger_transaction_dedup_defaults
before insert or update on public.ledger_transaction_deduplication
for each row execute function public.ledger_apply_row_defaults();

create trigger trg_ledger_transaction_dedup_user_lock
before update on public.ledger_transaction_deduplication
for each row execute function public.ledger_prevent_user_id_change();

-- Enable RLS and create policies for all three SMS tables
do $$
declare
  t text;
begin
  foreach t in array array[
    'ledger_sms_messages',
    'ledger_sms_analysis',
    'ledger_transaction_deduplication'
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

-- Grant permissions to authenticated role
grant usage on schema public to authenticated;
do $$
declare
  t text;
begin
  foreach t in array array[
    'ledger_sms_messages',
    'ledger_sms_analysis',
    'ledger_transaction_deduplication'
  ] loop
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end
$$;

commit;
