"""
End-to-end test that actually calls OpenAI gpt-4o-mini with the real
chunked prompt, to measure how the deployed parser behaves on a
synthetic but realistic Indian bank statement.

Requires OPENAI_API_KEY in the environment. Does NOT commit the key.

Measures:
- Completeness: of N input transactions, how many did the AI find?
- Classification accuracy: of the found ones, how many income/expense
  matches the ground truth (after post-processor)?
- Amount accuracy: amounts match to within 0.01?
- Date accuracy: dates match?
"""
import os, re, random, sys, asyncio, time

HERE = os.path.dirname(__file__)
SRC = open(os.path.join(HERE, "..", "server.py")).read()


def _pull(name: str) -> str:
    pat = rf"\n((?:def|async def) {re.escape(name)}\(.*?)(?=\n(?:def|async def|class|@app|# ─|PARSE_STAGES|_INCOME|_EXPENSE)\b)"
    m = re.search(pat, SRC, re.DOTALL)
    if not m:
        raise RuntimeError(f"helper {name} not found in server.py")
    return m.group(1)


# Build a minimal namespace with the real helpers from server.py.
import json, logging
logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
from openai import OpenAI, AsyncOpenAI

sync_client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])
async_client = AsyncOpenAI(api_key=os.environ["OPENAI_API_KEY"])

ns = {
    "re": re, "json": json, "asyncio": asyncio,
    "logger": logging.getLogger("test"),
    "openai_client": sync_client,
    "async_openai_client": async_client,
    "_parse_ai_json_response": lambda c: json.loads(
        re.sub(r'\s*```$', '', re.sub(r'^```json\s*', '', c.strip()))
    ),
}
exec(re.search(r"_INCOME_NARRATION_MARKERS = \([^)]*\)", SRC, re.DOTALL).group(0), ns)
exec(re.search(r"_EXPENSE_NARRATION_MARKERS = \([^)]*\)", SRC, re.DOTALL).group(0), ns)
for fn in ("_detect_dr_cr_suffix", "_classify_from_narration",
           "_post_process_entries", "_chunk_statement_text",
           "_ai_parse_chunk", "parse_statement_text_with_ai"):
    exec(_pull(fn), ns)

parse_statement_text_with_ai = ns["parse_statement_text_with_ai"]
_chunk_statement_text = ns["_chunk_statement_text"]


# ─── Build a realistic synthetic statement ──────────────────────────

INCOME_NARRATIONS = [
    ("SALARY CREDIT ACME CORPORATION", "Cr"),
    ("NEFT-CR-HDFC0001234-{ref}-BONUS", "Cr"),
    ("IMPS CREDIT {ref} FROM FRIEND-PAYBACK", "Cr"),
    ("UPI-CR/{ref}/REFUND AMAZON", "Cr"),
    ("RTGS CR-AXIS-{ref}", "Cr"),
    ("INT. CREDIT FOR MAR 2026", "Cr"),
    ("CASHBACK REWARD {ref}", "Cr"),
    ("REFUND FROM FLIPKART ORDER {ref}", "Cr"),
    ("REVERSAL OF POS TXN {ref}", "Cr"),
    ("DIVIDEND HDFC SEC - TCS", "Cr"),
]

EXPENSE_NARRATIONS = [
    ("ATM WDL HDFC BANK {ref}", "Dr"),
    ("POS PURCHASE ZOMATO LIMITED {ref}", "Dr"),
    ("UPI-DR/{ref}/SWIGGY BANGALORE", "Dr"),
    ("NEFT DEBIT-ICICI-{ref}-RENT TO OWNER", "Dr"),
    ("EMI AUTO DEBIT LOAN ACCT LN{ref}", "Dr"),
    ("GST ON CHARGES FOR {ref}", "Dr"),
    ("ANNUAL MAINTENANCE CHARGE - HDFC CREDIT CARD", "Dr"),
    ("AUTO DEBIT LIC PREMIUM POLICY {ref}", "Dr"),
    ("POS PURCHASE BIGBASKET GROCERY {ref}", "Dr"),
    ("UPI-DR/{ref}/PAYTM RECHARGE", "Dr"),
]


def build_statement(n=1000, seed=42):
    """Return (statement_text, ground_truth_entries)."""
    r = random.Random(seed)
    lines = []
    # Realistic header
    lines.append("HDFC BANK LIMITED")
    lines.append("Statement of Account")
    lines.append("Account No: XXXXXXXX1234   Account Type: Savings")
    lines.append("Statement Period: 01-Mar-2026 to 31-Mar-2026")
    lines.append("")
    lines.append("Date        Narration                                          Withdrawal   Deposit      Balance")
    lines.append("-" * 110)

    truth = []
    balance = 100000.0
    for i in range(n):
        # Mix: ~45% income, ~55% expense
        is_income = r.random() < 0.45
        if is_income:
            tpl, suffix = r.choice(INCOME_NARRATIONS)
            txn_type = "income"
        else:
            tpl, suffix = r.choice(EXPENSE_NARRATIONS)
            txn_type = "expense"

        amount = round(r.uniform(50, 30000), 2)
        narr = tpl.format(ref=r.randint(100000, 999999))

        d = r.randint(1, 28)
        date_str = f"{d:02d}-03-2026"
        date_iso = f"2026-03-{d:02d}"

        if txn_type == "income":
            balance += amount
        else:
            balance -= amount

        # Render in a realistic Indian-bank style: amount with " Cr" / " Dr"
        # suffix. Keep narration padded for look.
        amt_str = f"{amount:>11,.2f} {suffix}"
        lines.append(
            f"{date_str}  {narr[:48]:<48}  {amt_str:>16}  {balance:>12,.2f}"
        )

        truth.append({
            "date": date_iso,
            "description": narr[:48].strip(),
            "amount": round(amount, 2),
            "transaction_type": txn_type,
        })

    return "\n".join(lines), truth


# ─── Run ────────────────────────────────────────────────────────────

async def main():
    N = int(os.environ.get("TEST_N", "1000"))
    print(f"Generating synthetic statement with {N} transactions...")
    text, truth = build_statement(n=N, seed=42)
    print(f"Statement size: {len(text):,} chars, {text.count(chr(10))} lines")
    chunks = _chunk_statement_text(text, chunk_chars=6000, overlap=600)
    print(f"Will send {len(chunks)} chunks to gpt-4o-mini...")

    t0 = time.time()
    parsed = await parse_statement_text_with_ai(text, "bank")
    elapsed = time.time() - t0
    print(f"AI parse complete in {elapsed:.1f}s -> {len(parsed)} entries")

    # Match parsed entries back to truth by (date, amount) — that's the
    # primary key we'd use for reconciliation. If the AI dropped or added
    # rows, we'll see it.
    truth_index = {}
    for t in truth:
        truth_index.setdefault((t["date"], t["amount"]), []).append(t)

    matched = 0
    type_correct = 0
    type_wrong_examples = []
    for e in parsed:
        key = (e["date"], e["amount"])
        candidates = truth_index.get(key) or []
        if not candidates:
            continue
        matched += 1
        # Pop the best description-matching candidate
        best = min(
            candidates,
            key=lambda c: 0 if c["description"][:20].lower() in e["description"].lower() else 1,
        )
        if best["transaction_type"] == e["transaction_type"]:
            type_correct += 1
        else:
            if len(type_wrong_examples) < 15:
                type_wrong_examples.append((best, e))

    # Completeness = of truth rows, how many were found by the AI?
    found_truth_keys = {(e["date"], e["amount"]) for e in parsed}
    truth_keys = {(t["date"], t["amount"]) for t in truth}
    completeness = len(found_truth_keys & truth_keys) / max(len(truth_keys), 1)

    print()
    print("=" * 72)
    print(f"RESULTS on {N} synthetic transactions")
    print("=" * 72)
    print(f"Statement chars sent:      {len(text):,}")
    print(f"Chunks:                    {len(chunks)}")
    print(f"AI call wall-clock time:   {elapsed:.1f}s")
    print(f"AI returned rows:          {len(parsed)}")
    print(f"Completeness (rows found): {len(found_truth_keys & truth_keys)}/{len(truth_keys)} "
          f"= {completeness:.2%}")
    print(f"Classification correct:    {type_correct}/{matched} = "
          f"{(type_correct / matched if matched else 0):.2%}")
    if len(parsed) > len(truth):
        print(f"Extra rows (possible dupes/hallucinations): {len(parsed) - len(truth)}")
    if type_wrong_examples:
        print("\nMisclassifications (first 15):")
        for t, e in type_wrong_examples:
            print(f"  expected={t['transaction_type']:7} got={e['transaction_type']:7} "
                  f"amt={e['amount']:>9.2f}  desc={e['description']!r}")

    print()
    print("PASS thresholds: completeness >= 99%, classification >= 98%")
    assert completeness >= 0.99, f"Completeness too low: {completeness:.2%}"
    assert (type_correct / max(matched, 1)) >= 0.98, \
        f"Classification accuracy too low: {(type_correct / max(matched, 1)):.2%}"
    print("PASSED.")


if __name__ == "__main__":
    asyncio.run(main())
