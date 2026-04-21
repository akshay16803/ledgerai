# Reconciliation Tab — Comprehensive Test Cases

## A. BACKEND TEST CASES

### A1. Statement Upload (`POST /api/statements/upload`)
| # | Test Case | Expected |
|---|-----------|----------|
| 1 | Upload valid PDF with correct account_id, sub_type, period dates | 200, status=parsing, background parse starts |
| 2 | Upload valid CSV | 200, status=parsing |
| 3 | Upload file > 10MB | 400/413 error |
| 4 | Upload non-PDF/CSV (e.g. .xlsx) | 400 invalid file type |
| 5 | Upload with account_id belonging to another user | 403/404 |
| 6 | Upload with missing account_id | 400/422 |
| 7 | Upload password-protected PDF (correct password not provided) | 200, status=password_required |
| 8 | Upload with empty file | 400 |

### A2. Statement List (`GET /api/statements/list`)
| # | Test Case | Expected |
|---|-----------|----------|
| 9 | List with no statements | 200, empty items array |
| 10 | List with multiple statements | 200, sorted by uploaded_at desc, max 50 |
| 11 | List only returns current user's statements | Other user's data not visible |

### A3. Statement Detail (`GET /api/statements/{id}`)
| # | Test Case | Expected |
|---|-----------|----------|
| 12 | Fetch existing statement | 200, all fields present, no file_path exposed |
| 13 | Fetch non-existent ID | 404 |
| 14 | Fetch another user's statement | 403/404 |

### A4. Reconciliation (`POST /api/statements/{id}/reconcile`)
| # | Test Case | Expected |
|---|-----------|----------|
| 15 | Reconcile parsed statement with matching ledger transactions | 200, matched entries populated, status=reconciled |
| 16 | Reconcile with NO matching ledger transactions | 200, all entries in missing_from_ledger |
| 17 | Reconcile with partial matches (some match, some don't) | 200, mix of matched + missing_from_ledger + missing_from_statement |
| 18 | Reconcile with amount conflicts (date matches, amount differs) | 200, conflict entries with amount_difference |
| 19 | Reconcile statement still in "parsing" status | 400/409 |
| 20 | Reconcile with empty parsed_entries | 400 |
| 21 | Re-reconcile an already reconciled statement | 200, fresh results replace old |

### A5. Matching Algorithm
| # | Test Case | Expected |
|---|-----------|----------|
| 22 | Exact date + exact amount + description overlap | Score ~100, classified as matched |
| 23 | Exact date + exact amount + no description overlap | Score 80, classified as matched |
| 24 | Date within 1 day + exact amount | Score 70, classified as matched |
| 25 | Date within 3 days + exact amount | Score 55, classified as matched |
| 26 | Date > 3 days + exact amount | Score 40, below threshold, no match |
| 27 | Exact date + amount within 2% | Score 65, classified as conflict (amounts differ) |
| 28 | Exact date + amount differs > 2% | Score 40, below threshold, no match |
| 29 | Multiple statement entries that could match same ledger txn | First-come-first-served, second entry unmatched |

### A6. Add Missing to Ledger (`POST /api/statements/{id}/add-missing`)
| # | Test Case | Expected |
|---|-----------|----------|
| 30 | Add valid entry indices | 200, transactions created with pending_review status |
| 31 | Add with out-of-range indices | Out-of-range silently skipped |
| 32 | Add from non-reconciled statement | 400 |
| 33 | Add empty indices array | 400 |

### A7. Bulk Categorize (`POST /api/statements/{id}/bulk-categorize`)
| # | Test Case | Expected |
|---|-----------|----------|
| 34 | Categorize multiple entries with valid category IDs | 200, entries updated with category names |
| 35 | Categorize with invalid category ID | Category reset to nil |
| 36 | Empty updates array | 400 |
| 37 | Invalid entry indices | Silently skipped |

### A8. Single Entry Update (`PATCH /api/statements/{id}/entries/{index}`)
| # | Test Case | Expected |
|---|-----------|----------|
| 38 | Update category on valid index | 200, category name resolved |
| 39 | Update transaction_type (income→expense) | 200, category cleared on type flip |
| 40 | Index out of bounds | 400 |
| 41 | Invalid transaction_type value | Ignored/rejected |

### A9. Unlock (`POST /api/statements/{id}/unlock`)
| # | Test Case | Expected |
|---|-----------|----------|
| 42 | Correct password for locked PDF | 200, re-parses, status→parsing |
| 43 | Wrong password | 400, password_required persists |
| 44 | Unlock non-PDF statement | 400 |
| 45 | Unlock when original file is gone | 410 |

### A10. Approve/Reject
| # | Test Case | Expected |
|---|-----------|----------|
| 46 | Approve reconciled statement | 200, status=approved, transactions created |
| 47 | Approve non-reconciled statement | 400 |
| 48 | Reject reconciled statement | 200, status=rejected |
| 49 | Approve statement with 0 entries | 400 |

### A11. Re-audit (`POST /api/statements/{id}/reaudit`)
| # | Test Case | Expected |
|---|-----------|----------|
| 50 | Re-audit existing statement | 200, status=parsing, fresh parse starts |
| 51 | Re-audit when file is missing | 410/500 |

### A12. Delete (`DELETE /api/statements/{id}`)
| # | Test Case | Expected |
|---|-----------|----------|
| 52 | Delete existing statement | 200, file + DB doc removed |
| 53 | Delete non-existent statement | 404 |
| 54 | Delete another user's statement | 403/404 |

---

## B. FRONTEND TEST CASES

### B1. Reconciliation List Screen
| # | Test Case | Expected |
|---|-----------|----------|
| 55 | Screen loads with no statements | Empty state with "Upload Statement" button visible |
| 56 | Screen loads with statements | List shows each statement with name, status badge, date |
| 57 | Pull-to-refresh | Reloads statement list |
| 58 | Tap "+" button | Opens upload sheet |
| 59 | Tap empty-state upload button | Opens upload sheet |
| 60 | Swipe left on statement row | Delete option appears |
| 61 | Confirm delete | Statement removed from list |
| 62 | Cancel delete | Statement remains |
| 63 | Tap statement row | Navigates to StatementDetailView |
| 64 | Status badge colors correct | parsing=orange, parsed=blue, reconciled=purple, approved=green, rejected=red |
| 65 | Screen scrolls with many statements | Smooth scrolling |

### B2. Upload Screen
| # | Test Case | Expected |
|---|-----------|----------|
| 66 | All form fields visible | Sub-type picker, account picker, period from/to, file picker, upload button |
| 67 | Select sub-type → accounts filter | Only accounts of that sub-type shown |
| 68 | Select PDF file | Filename displayed, upload button enabled |
| 69 | Select CSV file | Filename displayed, upload button enabled |
| 70 | Try to upload with no file | Error "Please select a file" or button disabled |
| 71 | Try to upload with no account | Button disabled |
| 72 | Upload button shows spinner during upload | Loading indicator visible |
| 73 | Successful upload | Sheet dismisses, list refreshes, new statement appears |
| 74 | Upload failure | Error banner with message |
| 75 | Cancel button dismisses sheet | Sheet closes, no upload |
| 76 | Period From > Period To | Should warn (currently NOT validated — potential bug) |
| 77 | Scroll form when keyboard appears | All fields accessible |

### B3. Statement Detail — General
| # | Test Case | Expected |
|---|-----------|----------|
| 78 | Detail loads for parsed statement | Header card, workflow stepper, action buttons visible |
| 79 | Detail loads for parsing statement | Progress bar visible, polling active |
| 80 | Detail loads for approved statement | Terminal "Approved" banner, no action buttons |
| 81 | Detail loads for rejected statement | Terminal "Rejected" banner, no action buttons |
| 82 | Detail loads for password_required | "Unlock" button visible |
| 83 | Workflow stepper shows correct current step | Step highlighted matches status |
| 84 | Entire detail view is scrollable | Can scroll through all sections |
| 85 | Error banner appears on error | Red banner with message, dismissible |
| 86 | Success banner appears on action success | Green banner, auto-dismisses after 3s |

### B4. Statement Detail — Reconciliation
| # | Test Case | Expected |
|---|-----------|----------|
| 87 | Tap "Reconcile" button | Runs reconciliation, results appear |
| 88 | Reconciliation results summary card | Shows matched/missing/conflict counts |
| 89 | Balance info displays | Opening, closing, computed closing, difference |
| 90 | Matched section expandable | DisclosureGroup opens, shows matched pairs |
| 91 | Missing from Ledger section expandable | Shows entries with checkboxes |
| 92 | Missing from Statement section expandable | Shows ledger txns not on statement |
| 93 | Conflicts section expandable | Shows entries with amount differences |
| 94 | Select individual missing entry checkbox | Checkbox toggles, "Add Selected (N)" updates count |
| 95 | Select All checkbox | All missing entries selected |
| 96 | Tap "Add Selected" | Selected entries added to ledger, success message |
| 97 | Tap "Add All Missing" | All missing entries added |

### B5. Statement Detail — Actions
| # | Test Case | Expected |
|---|-----------|----------|
| 98 | Tap "Bulk Categorize" | Sheet opens with category list |
| 99 | Select category in bulk categorize | Applied to entries, sheet dismisses |
| 100 | Tap "Re-audit" | Statement re-parses, status goes to parsing |
| 101 | Tap "Approve" | Confirmation dialog, then status=approved |
| 102 | Tap "Reject" | Confirmation dialog, then status=rejected |
| 103 | Tap "Unlock" | Unlock sheet opens with password field |
| 104 | Enter correct password + submit | Statement unlocks, re-parses |
| 105 | Enter wrong password + submit | Error shown |

### B6. Statement Detail — Parsed Entries
| # | Test Case | Expected |
|---|-----------|----------|
| 106 | Entries display with date, description, amount | All fields formatted correctly |
| 107 | Category picker per entry | Menu shows categories, selection updates entry |
| 108 | Large number of entries scrollable | LazyVStack renders efficiently |
| 109 | No entries parsed state | "No entries parsed yet" message |
| 110 | Date formatting correct | Dates show as human-readable (e.g., "Apr 5, 2026") |
| 111 | Amount formatting correct | Currency symbol, proper decimal places |

### B7. Polling Behavior
| # | Test Case | Expected |
|---|-----------|----------|
| 112 | Statement in parsing status | Polls every 2s, updates progress |
| 113 | Parsing completes | Polling stops, status updates to parsed |
| 114 | Parse error occurs | Polling stops, error status shown |
| 115 | Navigate away during parsing | Polling stops (no background timer leak) |

### B8. Cross-Feature Impact
| # | Test Case | Expected |
|---|-----------|----------|
| 116 | After "Add Missing" — check Transactions tab | New transactions appear with pending_review status |
| 117 | After "Approve" — check account balances | Balances updated correctly |
| 118 | After deleting statement — check Transactions tab | Related pending_review txns still exist (no cascade delete) |
| 119 | Reconcile against account with many transactions | Performance acceptable, no timeout |

---

## C. TEST DATA PLAN

Using the HDFC bank statement (Apr 1-15, 2026), create these scenarios:

1. **Exact matches (10 entries):** Create ledger transactions matching 10 bank statement entries exactly (same date, amount, description).
2. **Amount conflicts (3 entries):** Create ledger transactions with same date but slightly different amounts (e.g., UPI ₹227 vs ledger ₹230).
3. **Date-shifted matches (3 entries):** Ledger transactions with amounts matching but dates off by 1-2 days.
4. **Missing from ledger (many):** Most bank statement entries won't have matching ledger transactions — these should appear as "missing from ledger."
5. **Missing from statement (5 entries):** Create ledger transactions in the same period that DON'T appear on the bank statement — these should appear as "missing from statement."
6. **Duplicate amounts (2 entries):** Two bank statement entries with identical amounts on same day to test ID collision risk.

Total: ~23 pre-loaded ledger transactions + the full bank statement PDF upload.
