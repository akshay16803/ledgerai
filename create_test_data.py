"""
Create test data for reconciliation testing.
Uses the dev simulator login to get auth, then creates transactions
that will produce matched/conflict/missing scenarios against the HDFC bank statement.
"""
import requests
import json

BASE_URL = "https://api.spentyai.com"
EMAIL = "akshaychouhan16803@gmail.com"

# Step 1: Login
print("=== Logging in ===")
resp = requests.post(f"{BASE_URL}/api/auth/dev/simulator-login", json={
    "email": EMAIL,
    "dev_secret": "spenty-sim-bypass-2026"
})
if resp.status_code != 200:
    print(f"Login failed: {resp.status_code} {resp.text}")
    exit(1)
session_token = resp.json()["session_token"]
headers = {"Authorization": f"Bearer {session_token}"}
print(f"  Logged in. Token: {session_token[:20]}...")

# Step 2: Get accounts
print("\n=== Fetching accounts ===")
resp = requests.get(f"{BASE_URL}/api/accounts", headers=headers)
accounts = resp.json()
if isinstance(accounts, dict):
    accounts = accounts.get("items", accounts.get("accounts", []))
print(f"  Found {len(accounts)} accounts:")
for acc in accounts:
    print(f"    {acc.get('account_id', acc.get('accountId', '?'))}: {acc.get('name', '?')} ({acc.get('sub_type', acc.get('subType', '?'))})")

# Step 3: Get categories
print("\n=== Fetching categories ===")
resp = requests.get(f"{BASE_URL}/api/categories", headers=headers)
categories = resp.json()
if isinstance(categories, dict):
    categories = categories.get("items", categories.get("categories", []))
print(f"  Found {len(categories)} categories")

# Find an expense category to use
expense_cat_id = None
income_cat_id = None
for cat in categories:
    cat_id = cat.get("category_id", cat.get("categoryId", ""))
    cat_type = cat.get("type", "")
    if cat_type == "expense" and not expense_cat_id:
        expense_cat_id = cat_id
        print(f"  Using expense category: {cat.get('name', '?')} ({cat_id})")
    elif cat_type == "income" and not income_cat_id:
        income_cat_id = cat_id
        print(f"  Using income category: {cat.get('name', '?')} ({cat_id})")

# Find savings account (HDFC type)
savings_account_id = None
for acc in accounts:
    acc_id = acc.get('account_id', acc.get('accountId', ''))
    sub_type = (acc.get('sub_type', acc.get('subType', '')) or '').lower()
    if sub_type == "savings" or "savings" in (acc.get('name', '') or '').lower():
        savings_account_id = acc_id
        print(f"\n  Using savings account: {acc.get('name', '?')} ({acc_id})")
        break

if not savings_account_id:
    # Use first account
    if accounts:
        savings_account_id = accounts[0].get('account_id', accounts[0].get('accountId', ''))
        print(f"\n  No savings account found, using first: {accounts[0].get('name','?')} ({savings_account_id})")
    else:
        print("\n  ERROR: No accounts found! Need to create one first.")
        exit(1)

if not expense_cat_id:
    print("  ERROR: No expense category found!")
    exit(1)

# Step 4: Create test transactions
# Based on real HDFC bank statement entries (Apr 1-15, 2026)
print("\n=== Creating test transactions ===")

test_transactions = [
    # --- EXACT MATCHES (10) - These should match perfectly ---
    {"date": "2026-04-01", "amount": 100000.00, "type": "income", "desc": "NEFT CR ZERODHA BROKING LIMITED", "cat": income_cat_id},
    {"date": "2026-04-02", "amount": 227.00, "type": "expense", "desc": "UPI APPLE COM BILL", "cat": expense_cat_id},
    {"date": "2026-04-03", "amount": 100000.00, "type": "income", "desc": "NEFT CR ZERODHA BROKING LIMITED", "cat": income_cat_id},
    {"date": "2026-04-04", "amount": 144.00, "type": "expense", "desc": "UPI ZOMATO", "cat": expense_cat_id},
    {"date": "2026-04-05", "amount": 499.00, "type": "expense", "desc": "UPI SWIGGY", "cat": expense_cat_id},
    {"date": "2026-04-07", "amount": 200000.00, "type": "income", "desc": "NEFT CR ZERODHA BROKING LIMITED", "cat": income_cat_id},
    {"date": "2026-04-08", "amount": 29500.00, "type": "expense", "desc": "ATM CASH WITHDRAWAL SAMARQAND", "cat": expense_cat_id},
    {"date": "2026-04-10", "amount": 5000.00, "type": "expense", "desc": "IMPS TRANSFER TO SAVINGS", "cat": expense_cat_id},
    {"date": "2026-04-12", "amount": 1299.00, "type": "expense", "desc": "UPI GOOGLE PLAY STORE", "cat": expense_cat_id},
    {"date": "2026-04-15", "amount": 159800.18, "type": "income", "desc": "NEFT CR SALARY CREDIT", "cat": income_cat_id},
    
    # --- AMOUNT CONFLICTS (3) - Same date, different amounts ---
    {"date": "2026-04-02", "amount": 250.00, "type": "expense", "desc": "UPI GOOGLE PAY MERCHANT", "cat": expense_cat_id},  # Statement has 243
    {"date": "2026-04-06", "amount": 520.00, "type": "expense", "desc": "UPI PAYTM RECHARGE", "cat": expense_cat_id},  # Statement has 499
    {"date": "2026-04-11", "amount": 3100.00, "type": "expense", "desc": "UPI FLIPKART PURCHASE", "cat": expense_cat_id},  # Statement has 2999
    
    # --- DATE-SHIFTED MATCHES (3) - Amount matches but date off by 1-2 days ---
    {"date": "2026-04-03", "amount": 399.00, "type": "expense", "desc": "UPI SPOTIFY SUBSCRIPTION", "cat": expense_cat_id},  # Statement has this on Apr 4
    {"date": "2026-04-09", "amount": 750.00, "type": "expense", "desc": "UPI UBER TRIP", "cat": expense_cat_id},  # Statement has this on Apr 10
    {"date": "2026-04-14", "amount": 2500.00, "type": "expense", "desc": "UPI ELECTRICITY BILL", "cat": expense_cat_id},  # Statement has this on Apr 15
    
    # --- MISSING FROM STATEMENT (5) - These exist in ledger but NOT on bank statement ---
    {"date": "2026-04-02", "amount": 15000.00, "type": "expense", "desc": "CASH PAYMENT TO VENDOR", "cat": expense_cat_id},
    {"date": "2026-04-05", "amount": 8500.00, "type": "expense", "desc": "CHEQUE DEPOSIT PENDING", "cat": expense_cat_id},
    {"date": "2026-04-08", "amount": 3200.00, "type": "expense", "desc": "MANUAL ENTRY OFFICE SUPPLIES", "cat": expense_cat_id},
    {"date": "2026-04-11", "amount": 45000.00, "type": "income", "desc": "EXPECTED CLIENT PAYMENT", "cat": income_cat_id},
    {"date": "2026-04-14", "amount": 6700.00, "type": "expense", "desc": "PETTY CASH WITHDRAWAL", "cat": expense_cat_id},
]

created = 0
failed = 0
for txn in test_transactions:
    payload = {
        "date": txn["date"],
        "amount": txn["amount"],
        "transaction_type": txn["type"],
        "description": txn["desc"],
        "category_id": txn["cat"],
        "account_id": savings_account_id,
        "status": "approved",
        "payment_method": "bank_transfer",
    }
    resp = requests.post(f"{BASE_URL}/api/transactions", headers=headers, json=payload)
    if resp.status_code == 200:
        created += 1
        txn_id = resp.json().get("transaction_id", "?")
        print(f"  ✓ Created: {txn['desc'][:40]} | ₹{txn['amount']} | {txn_id}")
    else:
        failed += 1
        print(f"  ✗ FAILED: {txn['desc'][:40]} | {resp.status_code}: {resp.text[:100]}")

print(f"\n=== DONE: {created} created, {failed} failed ===")
print(f"\nAccount ID for upload: {savings_account_id}")
