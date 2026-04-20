# Invoice Feature — Comprehensive Test Cases

## BACKEND TEST CASES

### B1. GET /api/invoices (List)
| # | Test | Expected |
|---|------|----------|
| B1.1 | Call with no params | Returns `{ items: [...], total: N }`, sorted by created_at desc |
| B1.2 | Call with `?status=paid` | Returns only paid invoices |
| B1.3 | Call with `?status=unpaid` | Returns only unpaid invoices |
| B1.4 | Call with `?status=partial` | Returns only partial invoices |
| B1.5 | Call with `?customer_id=xxx` | Returns only that customer's invoices |
| B1.6 | Call with `?from_date=2026-01-01&to_date=2026-12-31` | Returns invoices in date range |
| B1.7 | Call with `?limit=1&skip=0` | Returns exactly 1 invoice |
| B1.8 | Call with no auth token | Returns 401 |

### B2. POST /api/invoices (Create)
| # | Test | Expected |
|---|------|----------|
| B2.1 | Create simple invoice with 1 line item | Returns invoice with auto-generated number, computed totals |
| B2.2 | Create GST invoice with CGST/SGST (same state) | CGST = SGST = tax/2, IGST = 0 |
| B2.3 | Create GST invoice with IGST (different state) | IGST = full tax, CGST = SGST = 0 |
| B2.4 | Create with payment_status="paid" | amount_paid = grand_total, transaction auto-posted |
| B2.5 | Create with payment_status="partial" | amount_paid < grand_total, transaction auto-posted |
| B2.6 | Create with no line_items | Returns 400 error |
| B2.7 | Create with discount on line items | Taxable = qty * rate * (1 - disc/100), totals correct |
| B2.8 | Invoice number auto-increments | Second invoice gets next number |
| B2.9 | Round-off applied | Grand total rounded to nearest integer |
| B2.10 | Create with customer_id | Customer linked correctly |

### B3. GET /api/invoices/:id (Single)
| # | Test | Expected |
|---|------|----------|
| B3.1 | Valid ID | Returns full camelised invoice |
| B3.2 | Invalid ID | Returns 404 |

### B4. PUT /api/invoices/:id (Update)
| # | Test | Expected |
|---|------|----------|
| B4.1 | Update customer_name | Name updated, other fields unchanged |
| B4.2 | Update line_items | Totals recalculated |
| B4.3 | Update payment_status to "paid" | amount_paid set to grand_total |
| B4.4 | Update non-existent ID | Returns 404 |

### B5. DELETE /api/invoices/:id
| # | Test | Expected |
|---|------|----------|
| B5.1 | Delete existing invoice | Returns success, invoice gone |
| B5.2 | Delete invoice with linked transaction | Transaction also deleted, account balance recalculated |
| B5.3 | Delete non-existent ID | Returns 404 |

### B6. POST /api/invoices/:id/record-payment
| # | Test | Expected |
|---|------|----------|
| B6.1 | Record partial payment | amount_paid increases, status becomes "partial" |
| B6.2 | Record payment equal to balance | Status becomes "paid" |
| B6.3 | Record payment exceeding balance | Capped at grand_total |
| B6.4 | Record with amount = 0 | Returns 400 |
| B6.5 | Payment appended to payments array | Payment history grows |

### B7. POST /api/invoices/:id/mark-paid
| # | Test | Expected |
|---|------|----------|
| B7.1 | Mark unpaid invoice as paid | Status = "paid", amount_paid = grand_total |
| B7.2 | Mark already-paid invoice | Returns 400 |

### B8. POST /api/invoices/:id/duplicate
| # | Test | Expected |
|---|------|----------|
| B8.1 | Duplicate an invoice | New invoice with new ID, new number, today's date, unpaid status |

### B9. GET /api/invoices/stats
| # | Test | Expected |
|---|------|----------|
| B9.1 | With mixed invoices | Correct counts and sums for total/paid/unpaid/partial/overdue |

### B10. GET /api/invoices/next-number
| # | Test | Expected |
|---|------|----------|
| B10.1 | Call before any invoice | Returns "INV-0001" (or current prefix + next number) |

### B11. GET /api/invoices/debtors
| # | Test | Expected |
|---|------|----------|
| B11.1 | With unpaid invoices | Returns customers with outstanding amounts |

### B12. GET /api/invoices/aging
| # | Test | Expected |
|---|------|----------|
| B12.1 | With overdue invoices | Returns 5 buckets (Current, 1-30, 31-60, 61-90, 90+) |

### B13. GET /api/invoices/:id/pdf
| # | Test | Expected |
|---|------|----------|
| B13.1 | Valid invoice | Returns invoice data + settings for PDF rendering |

---

## iOS FRONTEND TEST CASES

### F1. Invoice List View — Navigation & Loading
| # | Test | Expected |
|---|------|----------|
| F1.1 | Navigate to Invoices tab | List loads with spinner, then shows invoices or empty state |
| F1.2 | Pull to refresh | Data reloads, spinner shows briefly |
| F1.3 | Search bar visible | Searchable modifier active at top |
| F1.4 | Back button works | Returns to previous screen |

### F2. Stats Cards (2x2 Grid)
| # | Test | Expected |
|---|------|----------|
| F2.1 | All 4 cards visible | Total Invoiced, Paid, Outstanding, Overdue |
| F2.2 | Card values match API data | Numbers formatted in Indian currency (₹) |
| F2.3 | Card colors correct | Primary, Green, Warning/Orange, Red |
| F2.4 | Cards aligned in 2x2 grid | Equal width, no overflow, proper spacing |
| F2.5 | Zero values display correctly | Shows ₹0.00, not blank or error |

### F3. Status Filter Bar
| # | Test | Expected |
|---|------|----------|
| F3.1 | All filter pills visible | All, Paid, Partial, Unpaid, Overdue |
| F3.2 | "All" selected by default | Highlighted/filled appearance |
| F3.3 | Tap "Paid" | Only paid invoices shown, pill highlighted |
| F3.4 | Tap "Unpaid" | Only unpaid invoices shown |
| F3.5 | Tap "Partial" | Only partial invoices shown |
| F3.6 | Tap "Overdue" | Only overdue invoices shown |
| F3.7 | Tap "All" again | All invoices shown again |
| F3.8 | Filter pills horizontally scrollable | Can scroll if they overflow |
| F3.9 | Filter + search combined | Both filters apply simultaneously |

### F4. Invoice List Rows
| # | Test | Expected |
|---|------|----------|
| F4.1 | Each row shows invoice number | e.g., "INV-0001" |
| F4.2 | Status badge color matches status | Green=paid, Orange=partial, Red=unpaid |
| F4.3 | Customer name displayed | Below or next to invoice number |
| F4.4 | Date shown | Invoice date formatted correctly |
| F4.5 | Grand total displayed | Right-aligned, Indian currency format |
| F4.6 | Amount paid shown for partial | Shows how much paid vs total |
| F4.7 | "Record Payment" button visible | For unpaid/partial invoices only |
| F4.8 | "Record Payment" button NOT visible for paid | Hidden for paid invoices |
| F4.9 | Tap invoice row | Pushes to InvoicePreviewView |
| F4.10 | Row text alignment | Left labels, right amounts, vertically centered |
| F4.11 | Long customer name | Truncated with ellipsis, no layout break |
| F4.12 | Many invoices | List scrolls smoothly |

### F5. Swipe Actions
| # | Test | Expected |
|---|------|----------|
| F5.1 | Swipe left → Delete button | Red destructive button appears |
| F5.2 | Swipe left → Edit button | Blue/default edit button appears |
| F5.3 | Tap Delete | Confirmation alert, then removes invoice |
| F5.4 | Tap Edit | Opens InvoiceFormView in edit mode |
| F5.5 | Swipe right → Mark Paid | Green button (only if not already paid) |
| F5.6 | Swipe right → Duplicate | Blue button appears |
| F5.7 | Mark Paid on paid invoice | Button should NOT appear |
| F5.8 | Duplicate creates new invoice | New row appears at top of list |

### F6. Empty State
| # | Test | Expected |
|---|------|----------|
| F6.1 | No invoices exist | Empty state view with icon and message |
| F6.2 | "Create Invoice" button in empty state | Tapping opens create form |

### F7. Create Invoice Form
| # | Test | Expected |
|---|------|----------|
| F7.1 | Tap "+" or "New Invoice" | Form sheet appears |
| F7.2 | Invoice number auto-populated | Fetched from /next-number endpoint |
| F7.3 | Invoice number field editable | Can type custom number |
| F7.4 | Customer picker opens | Shows list of customers from API |
| F7.5 | Customer search works | Filters customer list |
| F7.6 | Select customer | Name appears in form |
| F7.7 | Invoice date defaults to today | Date picker shows today |
| F7.8 | Due date defaults to +30 days | 30 days from today |
| F7.9 | Date pickers open and work | Can select any date |
| F7.10 | Default line item present | 1 empty line item row |
| F7.11 | Line item fields editable | Description, HSN/SAC, Qty, Rate, Tax% |
| F7.12 | Line item amount auto-calculated | qty * rate shown |
| F7.13 | Add Item button | Adds new empty row |
| F7.14 | Delete line item | X button removes row (only if >1 items) |
| F7.15 | Delete last line item | X button hidden or disabled |
| F7.16 | GST summary section | Shows Subtotal, CGST/SGST or IGST, Total, Grand Total |
| F7.17 | Notes field editable | Free text area |
| F7.18 | Terms field editable | Free text area |
| F7.19 | Cancel button | Dismisses sheet without saving |
| F7.20 | Save with valid data | Creates invoice, dismisses, appears in list |
| F7.21 | Save with empty description | Validation error shown |
| F7.22 | Save with zero rate | Validation error shown |
| F7.23 | Save with no customer | Validation error shown |
| F7.24 | Saving spinner shown | Button shows loading state |
| F7.25 | Multiple line items | Totals aggregate correctly |
| F7.26 | Tax calculation correct | 18% of taxable = tax amount |
| F7.27 | Grand total = subtotal + tax | Math checks out |

### F8. Edit Invoice Form
| # | Test | Expected |
|---|------|----------|
| F8.1 | Swipe edit opens form | Pre-populated with invoice data |
| F8.2 | Invoice number pre-filled | Shows existing number |
| F8.3 | Customer pre-selected | Shows customer name |
| F8.4 | Line items pre-filled | All existing items loaded |
| F8.5 | Dates pre-filled | Correct dates shown |
| F8.6 | Edit a field and save | Updates correctly |
| F8.7 | Add new line item and save | Total recalculated |
| F8.8 | Remove line item and save | Total recalculated |

### F9. Invoice Preview View
| # | Test | Expected |
|---|------|----------|
| F9.1 | Tap invoice row | Pushes to preview screen |
| F9.2 | Loading spinner while fetching PDF | Spinner visible |
| F9.3 | PDF renders if available | PDFKit view shows rendered invoice |
| F9.4 | Fallback view if no PDF | Shows structured detail view |
| F9.5 | Fallback shows invoice number | Correct number displayed |
| F9.6 | Fallback shows customer info | Name, address, GSTIN |
| F9.7 | Fallback shows line items | Table with description, qty, rate, amount |
| F9.8 | Fallback shows totals | Subtotal, tax, grand total |
| F9.9 | Share button in toolbar | Opens share sheet with PDF data |
| F9.10 | Print button in toolbar | Opens print dialog (if available) |
| F9.11 | Back button works | Returns to invoice list |

### F10. Record Payment View
| # | Test | Expected |
|---|------|----------|
| F10.1 | Tap "Record Payment" on unpaid invoice | Payment sheet opens |
| F10.2 | Invoice summary shown | Number, customer, total, paid, balance |
| F10.3 | Amount pre-filled with balance | Remaining amount shown |
| F10.4 | Amount field editable | Can type different amount |
| F10.5 | Date picker works | Defaults to today |
| F10.6 | Payment method picker | Shows Cash, Bank Transfer, UPI, etc. |
| F10.7 | Account picker | Shows accounts from API |
| F10.8 | Notes field editable | Optional text |
| F10.9 | Save valid payment | Records payment, updates invoice status |
| F10.10 | Save with zero amount | Validation error |
| F10.11 | Save with amount > balance | Validation error |
| F10.12 | Cancel button | Dismisses without saving |
| F10.13 | After recording, invoice status updates | List reflects new status |

### F11. Debtors Section
| # | Test | Expected |
|---|------|----------|
| F11.1 | Section visible below list | "Debtors" header shown |
| F11.2 | Collapsible/expandable | Tap header toggles |
| F11.3 | Shows customer names | With outstanding amounts |
| F11.4 | Invoice count per customer | Correct count |
| F11.5 | Empty if no outstanding | Section hidden or shows empty |

### F12. Aging Section
| # | Test | Expected |
|---|------|----------|
| F12.1 | Section visible | "Aging" header shown |
| F12.2 | Shows 5 buckets | Current, 1-30, 31-60, 61-90, 90+ |
| F12.3 | Amounts correct | Match backend aging data |
| F12.4 | Counts correct | Number of invoices per bucket |

### F13. Search
| # | Test | Expected |
|---|------|----------|
| F13.1 | Type invoice number | Filters to matching invoices |
| F13.2 | Type customer name | Filters to matching invoices |
| F13.3 | Type non-matching text | Shows empty filtered list |
| F13.4 | Clear search | All invoices shown again |
| F13.5 | Search + status filter | Both apply together |

### F14. UI Alignment & Visual
| # | Test | Expected |
|---|------|----------|
| F14.1 | Font consistency | Uses SpentyFonts throughout |
| F14.2 | Color consistency | Uses spentyPrimary, spentySuccess, spentyError, spentyWarning |
| F14.3 | Card style consistent | .cardStyle() modifier matches other tabs |
| F14.4 | Spacing consistent | Same padding as other feature tabs |
| F14.5 | Currency formatting | Indian ₹ format with commas (1,00,000) |
| F14.6 | Date formatting | Consistent format (e.g., "21 Apr 2026") |
| F14.7 | Status badge styling | Rounded capsule, correct colors |
| F14.8 | Form field labels aligned | Left-aligned labels, right-aligned values |
| F14.9 | Keyboard dismissal | Tapping outside fields dismisses keyboard |
| F14.10 | Dark mode support | All colors adapt to dark mode |
| F14.11 | Toolbar items properly placed | Cancel left, Save right |
| F14.12 | Loading states | Spinner during all async operations |
| F14.13 | Error alerts | Show meaningful error messages |

---

## WEB FRONTEND TEST CASES

### W1. Invoice Page Load
| # | Test | Expected |
|---|------|----------|
| W1.1 | Navigate to /invoices | Page loads, fetches invoice list |
| W1.2 | Settings check on load | Checks firm_name exists |
| W1.3 | Empty state | Dashed placeholder with "Create Invoice" button |

### W2. Invoice Table
| # | Test | Expected |
|---|------|----------|
| W2.1 | Table columns | Invoice #, Customer, Date, Amount, Status, Actions |
| W2.2 | Row hover effect | Background color changes |
| W2.3 | Status badge colors | Green=paid, Amber=partial, Red=unpaid |
| W2.4 | Amount formatting | Correct currency format |

### W3. Action Buttons (per row)
| # | Test | Expected |
|---|------|----------|
| W3.1 | Eye icon | Opens print preview modal |
| W3.2 | Pencil icon | Opens edit modal with data pre-filled |
| W3.3 | Trash icon | Confirm dialog, then deletes |
| W3.4 | Currency icon (unpaid/partial only) | Opens record payment modal |
| W3.5 | Currency icon NOT shown for paid | Hidden for paid invoices |

### W4. Create Invoice Modal
| # | Test | Expected |
|---|------|----------|
| W4.1 | Click "New Invoice" | Modal opens (SalesInvoiceModal for India) |
| W4.2 | Settings gate | If firm_name missing, redirects to /settings |
| W4.3 | Simple/GST tab toggle | Fields change based on selection |
| W4.4 | Customer search | Debounced API search, dropdown results |
| W4.5 | Quick-create customer | Inline form, creates customer via API |
| W4.6 | Line items CRUD | Add, edit, remove items |
| W4.7 | Totals auto-calculate | Subtotal, tax, grand total update live |
| W4.8 | Place of Supply (GST) | Dropdown of Indian states |
| W4.9 | Payment status radio buttons | Paid/Partial/Unpaid |
| W4.10 | Payment fields shown conditionally | Only when paid/partial selected |
| W4.11 | GST warning if settings missing | Yellow banner with "Go to Settings" |
| W4.12 | Validation on submit | Customer required, line items required |
| W4.13 | Save creates invoice | POST API, refreshes list |

### W5. Print Preview Modal
| # | Test | Expected |
|---|------|----------|
| W5.1 | Modal opens with invoice data | Full preview rendered |
| W5.2 | Firm details shown | From settings |
| W5.3 | Customer details shown | Name, address, GSTIN |
| W5.4 | Line items table | All items with columns |
| W5.5 | Totals section | Subtotal, tax breakdown, grand total |
| W5.6 | Bank details shown | From settings |
| W5.7 | Print button | Opens browser print dialog |
| W5.8 | Close button | Dismisses modal |

### W6. Record Payment Modal
| # | Test | Expected |
|---|------|----------|
| W6.1 | Amount pre-filled with balance | Remaining = grand_total - amount_paid |
| W6.2 | Account dropdown | Lists accounts |
| W6.3 | Validation | Amount > 0, account required |
| W6.4 | Submit records payment | POST API, refreshes list |

### W7. International Invoice Modal
| # | Test | Expected |
|---|------|----------|
| W7.1 | Non-India country uses InternationalInvoiceModal | Correct modal opens |
| W7.2 | Country-specific tax labels | e.g., VAT for UK, GST for Australia |
| W7.3 | Country-specific tax rates | Dropdown shows correct rates |
| W7.4 | Custom tax rate (US/CA/BR) | Extra input field appears |
| W7.5 | Per-rate tax breakdown (UK/DE/FR) | Totals show tax by rate |
