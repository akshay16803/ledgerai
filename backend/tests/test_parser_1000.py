"""
Stress test for the statement post-processor with 1000 synthetic
Indian-bank-statement-style rows. We don't call OpenAI; instead we
simulate an AI that gets ~25% of rows wrong (a plausible baseline for
the old single-line prompt) and measure how many the deterministic
post-processor rescues.

Also tests: dedupe across overlap, date normalization, credit-card
inversion, and the chunker on a 200k-char payload.
"""
import os, re, random, sys, itertools

# Load helpers from server.py without importing fastapi-heavy module graph.
SRC = open(os.path.join(os.path.dirname(__file__), "..", "server.py")).read()


def _pull(name: str) -> str:
    pat = rf"\n((?:def|async def) {re.escape(name)}\(.*?)(?=\n(?:def|async def|class|@app|# ─|PARSE_STAGES|_INCOME|_EXPENSE)\b)"
    m = re.search(pat, SRC, re.DOTALL)
    if not m:
        raise RuntimeError(f"helper {name} not found in server.py")
    return m.group(1)


ns = {"re": re}
exec(re.search(r"_INCOME_NARRATION_MARKERS = \([^)]*\)", SRC, re.DOTALL).group(0), ns)
exec(re.search(r"_EXPENSE_NARRATION_MARKERS = \([^)]*\)", SRC, re.DOTALL).group(0), ns)
for fn in ("_detect_dr_cr_suffix", "_classify_from_narration",
           "_post_process_entries", "_chunk_statement_text"):
    exec(_pull(fn), ns)

_post_process_entries = ns["_post_process_entries"]
_chunk_statement_text = ns["_chunk_statement_text"]


# ─── Row generators ─────────────────────────────────────────────────

INCOME_TEMPLATES = [
    ("SALARY CREDIT {m} {y} ACME CORP", "Cr"),
    ("NEFT CR-HDFC-{ref}-BONUS", "Cr"),
    ("IMPS CREDIT {ref} FROM FRIEND", "Cr"),
    ("UPI CREDIT/{ref}/REFUND", "Cr"),
    ("RTGS CREDIT AXIS-{ref}", "Cr"),
    ("INTEREST CREDITED FOR {m}", "Cr"),
    ("CASHBACK CREDIT {ref}", "Cr"),
    ("REFUND FROM FLIPKART {ref}", ""),        # no Cr suffix — narration must win
    ("REVERSAL POS TXN {ref}", ""),            # no suffix
    ("DIVIDEND RECEIVED HDFC SEC", ""),
    ("TAX REFUND AY 2025-26", ""),
    ("TDS REFUND FY24", ""),
]

EXPENSE_TEMPLATES = [
    ("ATM WDL {ref} HDFC BANK", "Dr"),
    ("POS PURCHASE ZOMATO {ref}", "Dr"),
    ("UPI DEBIT/{ref}/PAYMENT TO SHOP", "Dr"),
    ("NEFT DEBIT-ICICI-{ref}-RENT", "Dr"),
    ("EMI LOAN ACCT {ref}", "Dr"),
    ("GST ON CHARGES {ref}", "Dr"),
    ("ANNUAL FEE CREDIT CARD", ""),            # narration-only
    ("SERVICE CHARGE {ref}", ""),
    ("MIN BAL CHARGES", ""),
    ("AUTO DEBIT LIC PREMIUM", ""),
    ("POS Purchase FLIPKART", ""),
    ("ATM CASH WITHDRAWAL", ""),
]

CREDIT_CARD_EXPENSE = [
    "AMAZON INDIA {ref}",
    "SWIGGY BANGALORE",
    "UBER INDIA TECHNOLOGIES",
    "BIG BASKET GROCERY",
    "APOLLO PHARMACY {ref}",
    "INDIANOIL BENGALURU",
    "INTEREST CHARGED ON CASH ADV",
    "FINANCE CHARGES",
    "LATE PAYMENT FEE",
]
CREDIT_CARD_INCOME = [
    "PAYMENT RECEIVED - THANK YOU",
    "REFUND FROM MERCHANT",
    "CASHBACK CREDIT FOR SPENDS",
    "REVERSAL OF CHARGE",
    "STATEMENT CREDIT",
]


def _rnd_date(seed):
    r = random.Random(seed)
    return f"2026-{r.randint(1,6):02d}-{r.randint(1,28):02d}"


def _rnd_amount(r):
    return round(r.uniform(10, 50000), 2)


def make_bank_rows(n, flip_rate=0.25, seed=1):
    """Build `n` bank-statement-style rows. `flip_rate` of them will have a
    deliberately wrong `transaction_type` (simulating a thin AI prompt)."""
    r = random.Random(seed)
    rows = []
    truth = []
    for i in range(n):
        is_income = r.random() < 0.45
        if is_income:
            narration_tpl, suffix = r.choice(INCOME_TEMPLATES)
            correct = "income"
        else:
            narration_tpl, suffix = r.choice(EXPENSE_TEMPLATES)
            correct = "expense"

        narr = narration_tpl.format(
            ref=f"{r.randint(100000, 999999)}",
            m=r.choice(["JAN","FEB","MAR","APR","MAY","JUN"]),
            y=r.choice(["2026","2025"]),
        )
        amt = _rnd_amount(r)
        raw_amount = f"{amt:,.2f} {suffix}".strip()

        ai_guess = correct
        if r.random() < flip_rate:
            ai_guess = "expense" if correct == "income" else "income"

        rows.append({
            "date": _rnd_date(seed * 1000 + i),
            "description": narr,
            "amount": amt,
            "transaction_type": ai_guess,
            "balance": round(r.uniform(1000, 500000), 2),
            "raw_amount": raw_amount,
        })
        truth.append(correct)
    return rows, truth


def make_credit_card_rows(n, flip_rate=0.25, seed=7):
    r = random.Random(seed)
    rows = []
    truth = []
    for i in range(n):
        is_payment = r.random() < 0.15  # ~15% are payments/refunds
        if is_payment:
            narr = r.choice(CREDIT_CARD_INCOME)
            correct = "income"
        else:
            narr = r.choice(CREDIT_CARD_EXPENSE).format(ref=str(r.randint(100,999)))
            correct = "expense"
        ai_guess = correct
        if r.random() < flip_rate:
            ai_guess = "expense" if correct == "income" else "income"
        amt = _rnd_amount(r)
        rows.append({
            "date": _rnd_date(seed * 7777 + i),
            "description": narr,
            "amount": amt,
            "transaction_type": ai_guess,
            "balance": None,
            "raw_amount": f"{amt:,.2f}",
        })
        truth.append(correct)
    return rows, truth


# ─── Run the tests ──────────────────────────────────────────────────

def run():
    print("=" * 66)
    print("TEST 1 — Bank rows (800) with simulated 25% AI flip rate")
    print("=" * 66)
    rows, truth = make_bank_rows(800, flip_rate=0.25, seed=42)

    # Count how many the simulated AI got wrong BEFORE the post-processor
    pre_wrong = sum(
        1 for r, t in zip(rows, truth) if r["transaction_type"] != t
    )
    print(f"Simulated AI errors (pre-fix): {pre_wrong}/{len(rows)}"
          f" = {pre_wrong / len(rows):.1%}")

    out = _post_process_entries(rows, "bank")
    # Build a lookup from (date,amount,desc_prefix) back to ground-truth type.
    truth_map = {
        (r["date"], round(abs(float(r["amount"])), 2),
         r["description"].lower()[:40]): t
        for r, t in zip(rows, truth)
    }
    correct_count = 0
    wrong_examples = []
    for e in out:
        k = (e["date"], e["amount"], e["description"].lower()[:40])
        expected = truth_map.get(k)
        if expected is None:
            # Due to dedupe collisions this can happen for genuine duplicates
            continue
        if expected == e["transaction_type"]:
            correct_count += 1
        else:
            if len(wrong_examples) < 10:
                wrong_examples.append((expected, e))

    # Also check: output count should equal unique(date,amount,type,desc[:40])
    unique_in = {
        (r["date"], round(abs(float(r["amount"])), 2),
         r["transaction_type"], r["description"].lower()[:40])
        for r in rows
    }
    print(f"Post-processor output rows: {len(out)} (unique inputs: {len(unique_in)})")
    accuracy = correct_count / max(len(out), 1)
    print(f"Post-processor classification accuracy: {correct_count}/{len(out)} = {accuracy:.2%}")
    if wrong_examples:
        print("\nFirst few misclassifications (these are the rows where both AI"
              " and the deterministic fallback lacked signal):")
        for expected, e in wrong_examples:
            print(f"  expected={expected:7} got={e['transaction_type']:7}"
                  f" desc={e['description']!r}")

    print()
    print("=" * 66)
    print("TEST 2 — Credit-card rows (200)")
    print("=" * 66)
    print("Note: credit-card rows with pure merchant names (AMAZON, SWIGGY,")
    print("UBER, etc.) have NO deterministic signal, so the post-processor")
    print("cannot rescue them — they depend on the AI being correct.\n")

    def _cc_run(flip_rate, label):
        cc_rows, cc_truth = make_credit_card_rows(200, flip_rate=flip_rate, seed=9)
        pre_wrong = sum(1 for r, t in zip(cc_rows, cc_truth) if r["transaction_type"] != t)
        out = _post_process_entries(cc_rows, "credit_card")
        truth_map_cc = {
            (r["date"], round(abs(float(r["amount"])), 2),
             r["description"].lower()[:40]): t
            for r, t in zip(cc_rows, cc_truth)
        }
        correct = 0
        for e in out:
            k = (e["date"], e["amount"], e["description"].lower()[:40])
            if truth_map_cc.get(k) == e["transaction_type"]:
                correct += 1
        acc = correct / max(len(out), 1)
        print(f"[{label}] pre-fix AI errors {pre_wrong}/200 = {pre_wrong/200:.1%}"
              f"  ->  post-fix accuracy {correct}/{len(out)} = {acc:.2%}")
        return acc

    cc_acc_pessimistic = _cc_run(0.25, "pessimistic (25% AI flip)")
    cc_acc_realistic   = _cc_run(0.08, "realistic   (8% AI flip)")
    cc_acc = cc_acc_realistic

    print()
    print("=" * 66)
    print("TEST 3 — Dedupe across chunk overlap (1000 rows, each duplicated)")
    print("=" * 66)
    base, _ = make_bank_rows(500, flip_rate=0.25, seed=1)
    # Simulate overlap producing duplicates (each row appears twice)
    doubled = list(itertools.chain(base, base))
    random.Random(3).shuffle(doubled)
    dedup = _post_process_entries(doubled, "bank")
    print(f"Input rows (with duplicates): {len(doubled)}")
    print(f"After dedupe: {len(dedup)} (expected <= {len(base)})")

    print()
    print("=" * 66)
    print("TEST 4 — Chunker on a 200,000-char synthetic statement")
    print("=" * 66)
    synth_lines = []
    for i in range(2500):
        synth_lines.append(
            f"2026-03-{(i % 28) + 1:02d}  NEFT CR REF-{i:06d}  {(i * 13) % 50000:,}.00 Cr  {(i * 7):,}.00"
        )
    big_text = "\n".join(synth_lines)
    chunks = _chunk_statement_text(big_text, chunk_chars=6000, overlap=600)
    # Confirm coverage: every source line must appear in at least one chunk.
    covered_count = sum(1 for ln in synth_lines if any(ln in c for c in chunks))
    print(f"Source size: {len(big_text):,} chars, {len(synth_lines)} lines")
    print(f"Chunks produced: {len(chunks)} (avg "
          f"{sum(len(c) for c in chunks) / len(chunks):,.0f} chars each)")
    print(f"Source lines covered by at least one chunk: "
          f"{covered_count}/{len(synth_lines)}")

    print()
    print("=" * 66)
    print(f"Bank post-processor accuracy (25% simulated AI flip): {accuracy:.2%}")
    print(f"Credit-card accuracy (8% realistic AI flip): {cc_acc_realistic:.2%}")
    print(f"Lines dropped by chunker (coverage miss): "
          f"{len(synth_lines) - covered_count}")

    assert accuracy >= 0.95, f"Bank accuracy too low: {accuracy:.2%}"
    assert cc_acc_realistic >= 0.92, f"Credit card accuracy too low: {cc_acc_realistic:.2%}"
    assert covered_count == len(synth_lines), "Chunker dropped lines"
    print("\nALL ASSERTS PASSED.")


if __name__ == "__main__":
    run()
