import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = resolve(
  "/Users/akshaychouhan/ledgerai/supabase/migrations/20260317201500_ledgerai_auth_foundation.sql",
);
const sql = readFileSync(migrationPath, "utf8");

const requiredTables = [
  "ledger_transactions",
  "ledger_inbox_items",
  "ledger_email_accounts",
  "ledger_bookkeeping_accounts",
  "ledger_activities",
  "ledger_categories",
  "ledger_recurring_items",
  "ledger_app_settings",
  "ledger_ai_pending_items",
  "ledger_reconciliation_runs",
  "ledger_reconciliation_items",
  "ledger_currency_settings",
  "ledger_fx_rates",
];

describe("LedgerAI auth foundation migration", () => {
  it("defines every required ledger table", () => {
    requiredTables.forEach((table) => {
      expect(sql).toContain(`create table if not exists public.${table}`);
    });
  });

  it("forces row-level security across all ledger launch tables", () => {
    const rlsBlock = sql.match(
      /foreach t in array array\[(.*?)\]\s+loop\s+execute format\('alter table public\.%I enable row level security', t\);/s,
    )?.[1] || "";

    requiredTables.forEach((table) => {
      expect(rlsBlock).toContain(`'${table}'`);
    });
    expect(sql).toContain("alter table public.%I enable row level security");
    expect(sql).toContain("alter table public.%I force row level security");
  });

  it("creates own-row select/insert/update/delete policies", () => {
    expect(sql).toContain("create policy sel_own on public.%I for select using (auth.uid() = user_id)");
    expect(sql).toContain("create policy ins_own on public.%I for insert with check (auth.uid() is not null and auth.uid() = user_id)");
    expect(sql).toContain("create policy upd_own on public.%I for update using (auth.uid() = user_id) with check (auth.uid() = user_id)");
    expect(sql).toContain("create policy del_own on public.%I for delete using (auth.uid() = user_id)");
  });

  it("locks ownership changes after insert/update", () => {
    expect(sql).toContain("create or replace function public.ledger_prevent_user_id_change()");
    expect(sql).toContain("raise exception 'ledger row ownership cannot be changed'");
    expect(sql).toContain("before update on public.ledger_transactions");
    expect(sql).toContain("before update on public.ledger_reconciliation_items");
  });

  it("hardens reconciliation items to their owning run and user", () => {
    expect(sql).toContain("unique (id, user_id)");
    expect(sql).toContain("foreign key (run_id, user_id)");
    expect(sql).toContain("references public.ledger_reconciliation_runs(id, user_id)");
  });
});
