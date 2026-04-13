"""
SMS Integration Tests for Ledger AI
Tests: POST /api/sms/upload, GET /api/sms/stats, POST /api/sms/retry-pending
Also tests existing endpoints to ensure no regression
"""
import pytest
import requests
import os
import time
import hashlib

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
TOKEN = os.environ.get('TEST_SESSION_TOKEN', 'tsess_1775853054571')

@pytest.fixture
def auth_headers():
    return {"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"}


class TestAuthAndExistingEndpoints:
    """Verify existing endpoints still work (regression tests)"""
    
    def test_auth_me(self, auth_headers):
        """GET /api/auth/me - Should return user info"""
        response = requests.get(f"{BASE_URL}/api/auth/me", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "user_id" in data
        assert "email" in data
        print(f"✓ Auth works - user: {data['email']}")
    
    def test_accounts_list(self, auth_headers):
        """GET /api/accounts - Should return accounts list"""
        response = requests.get(f"{BASE_URL}/api/accounts", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Accounts endpoint works - {len(data)} accounts")
    
    def test_gmail_status(self, auth_headers):
        """GET /api/gmail/status - Should return Gmail status"""
        response = requests.get(f"{BASE_URL}/api/gmail/status", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "accounts" in data
        print(f"✓ Gmail status works - {len(data['accounts'])} accounts")
    
    def test_outlook_status(self, auth_headers):
        """GET /api/outlook/status - Should return Outlook status"""
        response = requests.get(f"{BASE_URL}/api/outlook/status", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "accounts" in data
        print(f"✓ Outlook status works - {len(data['accounts'])} accounts")
    
    def test_dashboard_summary(self, auth_headers):
        """GET /api/dashboard/summary - Should return dashboard data"""
        response = requests.get(f"{BASE_URL}/api/dashboard/summary", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "total_assets" in data
        assert "net_worth" in data
        assert "accounts" in data
        print(f"✓ Dashboard summary works - net_worth: {data['net_worth']}")


class TestSmsUpload:
    """Tests for POST /api/sms/upload endpoint"""
    
    def test_sms_upload_success(self, auth_headers):
        """POST /api/sms/upload - Should accept batch SMS messages"""
        unique_ts = f"2025-01-15T10:30:00+0530"
        payload = {
            "messages": [
                {
                    "sender": "TEST-BANK",
                    "body": f"TEST: Rs.500 debited from A/c XX1234 on 15-01-25. Avl Bal Rs.10000. Ref: TEST{int(time.time())}",
                    "timestamp": unique_ts,
                    "phone_number": "+919876543210"
                }
            ]
        }
        response = requests.post(f"{BASE_URL}/api/sms/upload", json=payload, headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "stored" in data
        assert "skipped" in data
        assert "message" in data
        print(f"✓ SMS upload works - stored: {data['stored']}, skipped: {data['skipped']}")
    
    def test_sms_upload_empty_messages_error(self, auth_headers):
        """POST /api/sms/upload - Empty messages list should return 400"""
        payload = {"messages": []}
        response = requests.post(f"{BASE_URL}/api/sms/upload", json=payload, headers=auth_headers)
        assert response.status_code == 400
        data = response.json()
        assert "detail" in data
        assert "No SMS messages provided" in data["detail"]
        print(f"✓ Empty messages validation works - error: {data['detail']}")
    
    def test_sms_upload_duplicate_detection(self, auth_headers):
        """POST /api/sms/upload - Same sender + timestamp + body_hash should be skipped"""
        # First upload
        unique_body = f"TEST DUPLICATE: Rs.100 debited. Ref: DUP{int(time.time())}"
        payload = {
            "messages": [
                {
                    "sender": "TEST-DUPLICATE-BANK",
                    "body": unique_body,
                    "timestamp": "2025-01-15T11:00:00+0530",
                    "phone_number": "+919876543210"
                }
            ]
        }
        response1 = requests.post(f"{BASE_URL}/api/sms/upload", json=payload, headers=auth_headers)
        assert response1.status_code == 200
        data1 = response1.json()
        first_stored = data1["stored"]
        
        # Second upload with same data - should be skipped
        response2 = requests.post(f"{BASE_URL}/api/sms/upload", json=payload, headers=auth_headers)
        assert response2.status_code == 200
        data2 = response2.json()
        
        # If first was stored, second should be skipped
        if first_stored > 0:
            assert data2["skipped"] >= 1
            print(f"✓ Duplicate SMS detection works - first stored: {first_stored}, second skipped: {data2['skipped']}")
        else:
            # Already existed from previous test run
            assert data2["skipped"] >= 1
            print(f"✓ Duplicate SMS detection works - both skipped (already existed)")
    
    def test_sms_upload_multiple_messages(self, auth_headers):
        """POST /api/sms/upload - Should handle multiple SMS in one request"""
        ts = int(time.time())
        payload = {
            "messages": [
                {
                    "sender": "TEST-MULTI-1",
                    "body": f"TEST MULTI 1: Rs.100 debited. Ref: M1-{ts}",
                    "timestamp": "2025-01-15T12:00:00+0530"
                },
                {
                    "sender": "TEST-MULTI-2",
                    "body": f"TEST MULTI 2: Rs.200 credited. Ref: M2-{ts}",
                    "timestamp": "2025-01-15T12:01:00+0530"
                }
            ]
        }
        response = requests.post(f"{BASE_URL}/api/sms/upload", json=payload, headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        total = data["stored"] + data["skipped"]
        assert total == 2  # Both messages processed
        print(f"✓ Multiple SMS upload works - stored: {data['stored']}, skipped: {data['skipped']}")
    
    def test_sms_upload_requires_auth(self):
        """POST /api/sms/upload - Should require authentication"""
        payload = {"messages": [{"sender": "TEST", "body": "test", "timestamp": "2025-01-15T10:00:00+0530"}]}
        response = requests.post(f"{BASE_URL}/api/sms/upload", json=payload)
        assert response.status_code == 401
        print("✓ SMS upload requires auth - returns 401 without token")


class TestSmsStats:
    """Tests for GET /api/sms/stats endpoint"""
    
    def test_sms_stats_success(self, auth_headers):
        """GET /api/sms/stats - Should return SMS sync statistics"""
        response = requests.get(f"{BASE_URL}/api/sms/stats", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        # Verify all expected fields
        assert "total_synced" in data
        assert "processed_by_ai" in data
        assert "no_transaction" in data
        assert "ai_pending" in data
        assert "ai_failed" in data
        assert "transactions_created" in data
        assert "pending_review" in data
        
        # All values should be integers >= 0
        assert isinstance(data["total_synced"], int) and data["total_synced"] >= 0
        assert isinstance(data["processed_by_ai"], int) and data["processed_by_ai"] >= 0
        assert isinstance(data["ai_pending"], int) and data["ai_pending"] >= 0
        assert isinstance(data["ai_failed"], int) and data["ai_failed"] >= 0
        
        print(f"✓ SMS stats works - total_synced: {data['total_synced']}, ai_pending: {data['ai_pending']}, ai_failed: {data['ai_failed']}")
    
    def test_sms_stats_requires_auth(self):
        """GET /api/sms/stats - Should require authentication"""
        response = requests.get(f"{BASE_URL}/api/sms/stats")
        assert response.status_code == 401
        print("✓ SMS stats requires auth - returns 401 without token")


class TestSmsRetryPending:
    """Tests for POST /api/sms/retry-pending endpoint"""
    
    def test_sms_retry_pending_success(self, auth_headers):
        """POST /api/sms/retry-pending - Should trigger retry of pending/failed SMS"""
        response = requests.post(f"{BASE_URL}/api/sms/retry-pending", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert "count" in data
        assert isinstance(data["count"], int)
        print(f"✓ SMS retry-pending works - count: {data['count']}, message: {data['message']}")
    
    def test_sms_retry_pending_requires_auth(self):
        """POST /api/sms/retry-pending - Should require authentication"""
        response = requests.post(f"{BASE_URL}/api/sms/retry-pending")
        assert response.status_code == 401
        print("✓ SMS retry-pending requires auth - returns 401 without token")


class TestPendingReviewWithSource:
    """Tests for pending review transactions with source column"""
    
    def test_pending_review_includes_source(self, auth_headers):
        """GET /api/email/pending-review - Should include source field for SMS/Email distinction"""
        response = requests.get(f"{BASE_URL}/api/email/pending-review", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "transactions" in data
        assert "total" in data
        
        # If there are pending transactions, verify source field exists
        if data["transactions"]:
            for txn in data["transactions"]:
                assert "source" in txn
                assert txn["source"] in ["email", "sms"]
            print(f"✓ Pending review includes source - {data['total']} transactions, sources: {set(t['source'] for t in data['transactions'])}")
        else:
            print(f"✓ Pending review endpoint works - no pending transactions")


class TestCrossSourceDuplicateDetection:
    """Tests for smart cross-source duplicate detection logic"""
    
    def test_create_manual_transaction_for_duplicate_test(self, auth_headers):
        """Create a manual transaction to test duplicate detection"""
        # First get accounts and categories
        accounts_resp = requests.get(f"{BASE_URL}/api/accounts", headers=auth_headers)
        accounts = accounts_resp.json()
        
        categories_resp = requests.get(f"{BASE_URL}/api/categories?category_type=expense", headers=auth_headers)
        categories = categories_resp.json()
        
        if not accounts or not categories:
            pytest.skip("No accounts or categories available")
        
        # Create a transaction that could be detected as duplicate
        payload = {
            "transaction_type": "expense",
            "amount": 999.99,  # Specific amount for testing
            "date": "2025-01-15",
            "account_id": accounts[0]["account_id"],
            "category_id": categories[0]["category_id"],
            "description": "TEST DUPLICATE DETECTION - Amazon Purchase",
            "source": "manual",
            "status": "approved"
        }
        response = requests.post(f"{BASE_URL}/api/transactions", json=payload, headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "transaction_id" in data
        print(f"✓ Created test transaction for duplicate detection - id: {data['transaction_id']}")
        return data["transaction_id"]


class TestHealthCheck:
    """Health check endpoint test"""
    
    def test_health_check(self):
        """GET /api/health - Should return ok status"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        print("✓ Health check works")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
