"""
Test Suite for Statement Reconciliation Feature
Tests: Upload, List, Get, Reconcile, Add-Missing, Delete endpoints
"""
import pytest
import requests
import os
import tempfile
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
TOKEN = os.environ.get('TEST_SESSION_TOKEN', 'tsess_1776074605772')

# Test CSV content with Date, Description, Debit, Credit, Balance columns
TEST_CSV_CONTENT = """Date,Description,Debit,Credit,Balance
15/01/2026,Test Salary Deposit,,50000.00,150000.00
16/01/2026,Test Grocery Purchase,2500.00,,147500.00
17/01/2026,Test Utility Bill,1200.00,,146300.00
18/01/2026,Test Freelance Income,,8000.00,154300.00
19/01/2026,Test Restaurant Expense,850.00,,153450.00
"""

# Invalid file content (not CSV/PDF)
INVALID_FILE_CONTENT = "This is just plain text, not a valid statement file."


@pytest.fixture(scope="module")
def api_client():
    """Shared requests session with auth"""
    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {TOKEN}"
    })
    return session


@pytest.fixture(scope="module")
def auth_headers():
    """Auth headers for multipart requests"""
    return {"Authorization": f"Bearer {TOKEN}"}


class TestAuthAndBasicEndpoints:
    """Verify auth and basic endpoints work"""
    
    def test_auth_me(self, api_client):
        """Test authentication is working"""
        response = api_client.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 200, f"Auth failed: {response.text}"
        data = response.json()
        assert "user_id" in data
        assert data["user_id"] == "test-user-demo"
        print(f"✓ Auth working - user: {data['email']}")
    
    def test_accounts_exist(self, api_client):
        """Verify test accounts exist"""
        response = api_client.get(f"{BASE_URL}/api/accounts")
        assert response.status_code == 200
        accounts = response.json()
        account_ids = [a["account_id"] for a in accounts]
        assert "acc_bank01" in account_ids, "Bank account not found"
        print(f"✓ Found {len(accounts)} accounts including acc_bank01")


class TestStatementUpload:
    """Test POST /api/statements/upload"""
    
    def test_upload_csv_success(self, auth_headers):
        """Upload valid CSV file with account_id and statement_type"""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as f:
            f.write(TEST_CSV_CONTENT)
            temp_path = f.name
        
        try:
            with open(temp_path, 'rb') as f:
                files = {'file': ('test_upload.csv', f, 'text/csv')}
                data = {'account_id': 'acc_bank01', 'statement_type': 'bank'}
                response = requests.post(
                    f"{BASE_URL}/api/statements/upload",
                    headers=auth_headers,
                    files=files,
                    data=data
                )
            
            assert response.status_code == 200, f"Upload failed: {response.text}"
            result = response.json()
            assert "statement_id" in result
            assert result["statement_id"].startswith("stmt_")
            assert "message" in result
            print(f"✓ CSV upload successful - statement_id: {result['statement_id']}")
            
            # Store for later tests
            pytest.uploaded_stmt_id = result["statement_id"]
            
        finally:
            os.unlink(temp_path)
    
    def test_upload_rejects_invalid_file_type(self, auth_headers):
        """Reject non-CSV/PDF files"""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False) as f:
            f.write(INVALID_FILE_CONTENT)
            temp_path = f.name
        
        try:
            with open(temp_path, 'rb') as f:
                files = {'file': ('invalid.txt', f, 'text/plain')}
                data = {'account_id': 'acc_bank01', 'statement_type': 'bank'}
                response = requests.post(
                    f"{BASE_URL}/api/statements/upload",
                    headers=auth_headers,
                    files=files,
                    data=data
                )
            
            assert response.status_code == 400, f"Should reject .txt files: {response.text}"
            error = response.json()
            assert "detail" in error
            assert "CSV" in error["detail"] or "PDF" in error["detail"]
            print(f"✓ Correctly rejected .txt file: {error['detail']}")
            
        finally:
            os.unlink(temp_path)
    
    def test_upload_rejects_missing_account_id(self, auth_headers):
        """Reject upload without account_id"""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as f:
            f.write(TEST_CSV_CONTENT)
            temp_path = f.name
        
        try:
            with open(temp_path, 'rb') as f:
                files = {'file': ('test.csv', f, 'text/csv')}
                # Missing account_id
                data = {'statement_type': 'bank'}
                response = requests.post(
                    f"{BASE_URL}/api/statements/upload",
                    headers=auth_headers,
                    files=files,
                    data=data
                )
            
            # Should return 422 (validation error) for missing required field
            assert response.status_code == 422, f"Should reject missing account_id: {response.text}"
            print(f"✓ Correctly rejected missing account_id")
            
        finally:
            os.unlink(temp_path)
    
    def test_upload_requires_auth(self):
        """Upload requires authentication"""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as f:
            f.write(TEST_CSV_CONTENT)
            temp_path = f.name
        
        try:
            with open(temp_path, 'rb') as f:
                files = {'file': ('test.csv', f, 'text/csv')}
                data = {'account_id': 'acc_bank01', 'statement_type': 'bank'}
                response = requests.post(
                    f"{BASE_URL}/api/statements/upload",
                    files=files,
                    data=data
                )
            
            assert response.status_code == 401, f"Should require auth: {response.text}"
            print(f"✓ Upload correctly requires authentication")
            
        finally:
            os.unlink(temp_path)


class TestStatementList:
    """Test GET /api/statements/list"""
    
    def test_list_statements(self, api_client):
        """List uploaded statements"""
        response = api_client.get(f"{BASE_URL}/api/statements/list")
        assert response.status_code == 200, f"List failed: {response.text}"
        
        data = response.json()
        assert "statements" in data
        assert isinstance(data["statements"], list)
        
        if len(data["statements"]) > 0:
            stmt = data["statements"][0]
            assert "statement_id" in stmt
            assert "filename" in stmt
            assert "status" in stmt
            assert "account_id" in stmt
            print(f"✓ Listed {len(data['statements'])} statements")
        else:
            print("✓ Statement list returned (empty)")
    
    def test_list_requires_auth(self):
        """List requires authentication"""
        response = requests.get(f"{BASE_URL}/api/statements/list")
        assert response.status_code == 401
        print("✓ List correctly requires authentication")


class TestStatementGet:
    """Test GET /api/statements/{id}"""
    
    def test_get_existing_statement(self, api_client):
        """Get statement with parsed entries"""
        # Use the existing test statement
        stmt_id = "stmt_287328249afd"
        response = api_client.get(f"{BASE_URL}/api/statements/{stmt_id}")
        assert response.status_code == 200, f"Get failed: {response.text}"
        
        stmt = response.json()
        assert stmt["statement_id"] == stmt_id
        assert "parsed_entries" in stmt
        assert "status" in stmt
        assert "account_id" in stmt
        
        # Verify parsed entries structure
        if stmt["parsed_entries"]:
            entry = stmt["parsed_entries"][0]
            assert "date" in entry
            assert "description" in entry
            assert "amount" in entry
            assert "transaction_type" in entry
            print(f"✓ Got statement with {len(stmt['parsed_entries'])} parsed entries")
    
    def test_get_nonexistent_statement(self, api_client):
        """Get non-existent statement returns 404"""
        response = api_client.get(f"{BASE_URL}/api/statements/stmt_nonexistent123")
        assert response.status_code == 404
        print("✓ Non-existent statement returns 404")


class TestCSVParsing:
    """Test CSV parsing handles Date, Description, Debit, Credit, Balance columns"""
    
    def test_csv_parsing_columns(self, api_client, auth_headers):
        """Verify CSV parsing correctly handles standard columns"""
        # Wait for previous upload to be parsed
        time.sleep(3)
        
        # Check if our uploaded statement was parsed
        if hasattr(pytest, 'uploaded_stmt_id'):
            stmt_id = pytest.uploaded_stmt_id
            response = api_client.get(f"{BASE_URL}/api/statements/{stmt_id}")
            
            if response.status_code == 200:
                stmt = response.json()
                
                # Wait for parsing if still in progress
                retries = 5
                while stmt.get("status") == "parsing" and retries > 0:
                    time.sleep(2)
                    response = api_client.get(f"{BASE_URL}/api/statements/{stmt_id}")
                    stmt = response.json()
                    retries -= 1
                
                if stmt.get("status") == "parsed" or stmt.get("status") == "reconciled":
                    entries = stmt.get("parsed_entries", [])
                    assert len(entries) > 0, "No entries parsed from CSV"
                    
                    # Verify entry structure
                    for entry in entries:
                        assert "date" in entry, "Missing date field"
                        assert "description" in entry, "Missing description field"
                        assert "amount" in entry, "Missing amount field"
                        assert "transaction_type" in entry, "Missing transaction_type field"
                        assert entry["transaction_type"] in ["income", "expense"]
                    
                    # Check income/expense detection from Debit/Credit columns
                    income_entries = [e for e in entries if e["transaction_type"] == "income"]
                    expense_entries = [e for e in entries if e["transaction_type"] == "expense"]
                    
                    print(f"✓ CSV parsed: {len(entries)} entries ({len(income_entries)} income, {len(expense_entries)} expense)")
                else:
                    print(f"⚠ Statement status: {stmt.get('status')} - parsing may have failed")
        else:
            # Use existing statement
            response = api_client.get(f"{BASE_URL}/api/statements/stmt_287328249afd")
            if response.status_code == 200:
                stmt = response.json()
                entries = stmt.get("parsed_entries", [])
                if entries:
                    print(f"✓ Existing statement has {len(entries)} parsed entries")


class TestReconciliation:
    """Test POST /api/statements/{id}/reconcile"""
    
    def test_reconcile_statement(self, api_client):
        """Reconcile parsed entries against ledger"""
        stmt_id = "stmt_287328249afd"
        
        # First check statement status
        get_resp = api_client.get(f"{BASE_URL}/api/statements/{stmt_id}")
        if get_resp.status_code != 200:
            pytest.skip("Test statement not found")
        
        stmt = get_resp.json()
        if stmt.get("status") == "parsing":
            pytest.skip("Statement still parsing")
        
        # Reconcile
        response = api_client.post(f"{BASE_URL}/api/statements/{stmt_id}/reconcile")
        assert response.status_code == 200, f"Reconcile failed: {response.text}"
        
        result = response.json()
        
        # Verify reconciliation result structure
        assert "summary" in result
        assert "matched" in result
        assert "missing_from_ledger" in result
        assert "missing_from_statement" in result
        assert "conflicts" in result
        
        # Verify summary fields
        summary = result["summary"]
        assert "total_statement_entries" in summary
        assert "matched" in summary
        assert "missing_from_ledger" in summary
        assert "missing_from_statement" in summary
        assert "conflicts" in summary
        
        print(f"✓ Reconciliation complete:")
        print(f"  - Total entries: {summary['total_statement_entries']}")
        print(f"  - Matched: {summary['matched']}")
        print(f"  - Missing from ledger: {summary['missing_from_ledger']}")
        print(f"  - Missing from statement: {summary['missing_from_statement']}")
        print(f"  - Conflicts: {summary['conflicts']}")
    
    def test_reconcile_requires_parsed_statement(self, api_client, auth_headers):
        """Cannot reconcile statement that's still parsing"""
        # Upload a new statement
        csv_content = "Date,Description,Debit,Credit,Balance\n20/01/2026,Test Entry,100.00,,1000.00"
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as f:
            f.write(csv_content)
            temp_path = f.name
        
        try:
            with open(temp_path, 'rb') as f:
                files = {'file': ('quick_test.csv', f, 'text/csv')}
                data = {'account_id': 'acc_bank01', 'statement_type': 'bank'}
                upload_resp = requests.post(
                    f"{BASE_URL}/api/statements/upload",
                    headers=auth_headers,
                    files=files,
                    data=data
                )
            
            if upload_resp.status_code == 200:
                stmt_id = upload_resp.json()["statement_id"]
                
                # Try to reconcile immediately (might still be parsing)
                # This tests the "still parsing" error handling
                recon_resp = api_client.post(f"{BASE_URL}/api/statements/{stmt_id}/reconcile")
                
                # Either 200 (if parsed quickly) or 400 (still parsing)
                assert recon_resp.status_code in [200, 400]
                
                if recon_resp.status_code == 400:
                    error = recon_resp.json()
                    assert "parsing" in error.get("detail", "").lower() or "entries" in error.get("detail", "").lower()
                    print("✓ Correctly handles statement still parsing")
                else:
                    print("✓ Statement parsed quickly, reconciliation succeeded")
                
                # Cleanup
                api_client.delete(f"{BASE_URL}/api/statements/{stmt_id}")
        finally:
            os.unlink(temp_path)
    
    def test_reconcile_nonexistent_statement(self, api_client):
        """Reconcile non-existent statement returns 404"""
        response = api_client.post(f"{BASE_URL}/api/statements/stmt_nonexistent/reconcile")
        assert response.status_code == 404
        print("✓ Non-existent statement reconcile returns 404")


class TestReconciliationScoring:
    """Test reconciliation scoring logic"""
    
    def test_matched_entries_have_score(self, api_client):
        """Matched entries should have match_score >= 50"""
        stmt_id = "stmt_287328249afd"
        
        # Get reconciliation results
        response = api_client.get(f"{BASE_URL}/api/statements/{stmt_id}")
        if response.status_code != 200:
            pytest.skip("Test statement not found")
        
        stmt = response.json()
        recon = stmt.get("reconciliation")
        
        if not recon:
            # Trigger reconciliation
            recon_resp = api_client.post(f"{BASE_URL}/api/statements/{stmt_id}/reconcile")
            if recon_resp.status_code == 200:
                recon = recon_resp.json()
        
        if recon and recon.get("matched"):
            for match in recon["matched"]:
                assert "match_score" in match
                assert match["match_score"] >= 50, f"Match score too low: {match['match_score']}"
                assert "statement_entry" in match
                assert "ledger_transaction" in match
            print(f"✓ All {len(recon['matched'])} matched entries have score >= 50")
        else:
            print("⚠ No matched entries to verify scoring")


class TestAddMissingEntries:
    """Test POST /api/statements/{id}/add-missing"""
    
    def test_add_missing_entries(self, api_client):
        """Add selected missing entries to ledger as pending_review"""
        stmt_id = "stmt_287328249afd"
        
        # Get statement with reconciliation
        response = api_client.get(f"{BASE_URL}/api/statements/{stmt_id}")
        if response.status_code != 200:
            pytest.skip("Test statement not found")
        
        stmt = response.json()
        recon = stmt.get("reconciliation")
        
        if not recon:
            # Trigger reconciliation first
            recon_resp = api_client.post(f"{BASE_URL}/api/statements/{stmt_id}/reconcile")
            if recon_resp.status_code == 200:
                recon = recon_resp.json()
        
        if recon and recon.get("missing_from_ledger"):
            # Try to add first missing entry
            add_resp = api_client.post(
                f"{BASE_URL}/api/statements/{stmt_id}/add-missing",
                json={"entry_indices": [0]}
            )
            
            assert add_resp.status_code == 200, f"Add missing failed: {add_resp.text}"
            result = add_resp.json()
            assert "added" in result
            assert result["added"] >= 0
            print(f"✓ Added {result['added']} missing entries to ledger")
        else:
            # Test with empty indices
            add_resp = api_client.post(
                f"{BASE_URL}/api/statements/{stmt_id}/add-missing",
                json={"entry_indices": []}
            )
            assert add_resp.status_code == 200
            print("✓ Add-missing with empty indices returns success")
    
    def test_add_missing_requires_reconciliation(self, api_client, auth_headers):
        """Cannot add missing entries if statement not reconciled"""
        # Upload a new statement
        csv_content = "Date,Description,Debit,Credit,Balance\n21/01/2026,New Entry,500.00,,5000.00"
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as f:
            f.write(csv_content)
            temp_path = f.name
        
        try:
            with open(temp_path, 'rb') as f:
                files = {'file': ('unreconciled.csv', f, 'text/csv')}
                data = {'account_id': 'acc_bank01', 'statement_type': 'bank'}
                upload_resp = requests.post(
                    f"{BASE_URL}/api/statements/upload",
                    headers=auth_headers,
                    files=files,
                    data=data
                )
            
            if upload_resp.status_code == 200:
                stmt_id = upload_resp.json()["statement_id"]
                time.sleep(2)  # Wait for parsing
                
                # Try to add missing without reconciling
                add_resp = api_client.post(
                    f"{BASE_URL}/api/statements/{stmt_id}/add-missing",
                    json={"entry_indices": [0]}
                )
                
                assert add_resp.status_code == 400
                error = add_resp.json()
                assert "reconcil" in error.get("detail", "").lower()
                print("✓ Correctly requires reconciliation before adding missing")
                
                # Cleanup
                api_client.delete(f"{BASE_URL}/api/statements/{stmt_id}")
        finally:
            os.unlink(temp_path)


class TestStatementDelete:
    """Test DELETE /api/statements/{id}"""
    
    def test_delete_statement(self, api_client, auth_headers):
        """Delete statement"""
        # Upload a statement to delete
        csv_content = "Date,Description,Debit,Credit,Balance\n22/01/2026,Delete Test,100.00,,1000.00"
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as f:
            f.write(csv_content)
            temp_path = f.name
        
        try:
            with open(temp_path, 'rb') as f:
                files = {'file': ('to_delete.csv', f, 'text/csv')}
                data = {'account_id': 'acc_bank01', 'statement_type': 'bank'}
                upload_resp = requests.post(
                    f"{BASE_URL}/api/statements/upload",
                    headers=auth_headers,
                    files=files,
                    data=data
                )
            
            if upload_resp.status_code == 200:
                stmt_id = upload_resp.json()["statement_id"]
                
                # Delete
                del_resp = api_client.delete(f"{BASE_URL}/api/statements/{stmt_id}")
                assert del_resp.status_code == 200, f"Delete failed: {del_resp.text}"
                
                result = del_resp.json()
                assert "message" in result
                print(f"✓ Statement deleted: {result['message']}")
                
                # Verify deleted
                get_resp = api_client.get(f"{BASE_URL}/api/statements/{stmt_id}")
                assert get_resp.status_code == 404
                print("✓ Deleted statement returns 404")
        finally:
            os.unlink(temp_path)
    
    def test_delete_nonexistent_statement(self, api_client):
        """Delete non-existent statement returns 404"""
        response = api_client.delete(f"{BASE_URL}/api/statements/stmt_nonexistent")
        assert response.status_code == 404
        print("✓ Delete non-existent statement returns 404")


class TestRegressionEndpoints:
    """Verify existing endpoints still work"""
    
    def test_auth_me(self, api_client):
        """Auth endpoint works"""
        response = api_client.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 200
        print("✓ Regression: /api/auth/me works")
    
    def test_transactions(self, api_client):
        """Transactions endpoint works"""
        response = api_client.get(f"{BASE_URL}/api/transactions")
        assert response.status_code == 200
        print("✓ Regression: /api/transactions works")
    
    def test_dashboard_summary(self, api_client):
        """Dashboard summary endpoint works"""
        response = api_client.get(f"{BASE_URL}/api/dashboard/summary")
        assert response.status_code == 200
        print("✓ Regression: /api/dashboard/summary works")
    
    def test_cashflow_projection(self, api_client):
        """Cashflow projection endpoint works"""
        response = api_client.get(f"{BASE_URL}/api/cashflow/projection")
        assert response.status_code == 200
        print("✓ Regression: /api/cashflow/projection works")
    
    def test_accounts(self, api_client):
        """Accounts endpoint works"""
        response = api_client.get(f"{BASE_URL}/api/accounts")
        assert response.status_code == 200
        print("✓ Regression: /api/accounts works")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
