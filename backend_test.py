#!/usr/bin/env python3
"""
Ledger AI Backend API Testing Suite
Tests all backend endpoints for the accounting SaaS application
"""

import requests
import sys
import json
from datetime import datetime, timezone
from typing import Dict, Any, Optional

class LedgerAITester:
    def __init__(self, base_url: str = "https://ai-bookkeeper-test.preview.emergentagent.com"):
        self.base_url = base_url
        self.session_token = None
        self.user_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []
        
        # Test data storage
        self.test_account_id = None
        self.test_category_id = None
        self.test_transaction_id = None

    def log_test(self, name: str, success: bool, details: str = ""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
        
        result = {
            "test_name": name,
            "success": success,
            "details": details,
            "timestamp": datetime.now().isoformat()
        }
        self.test_results.append(result)
        
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} - {name}")
        if details:
            print(f"    {details}")

    def run_test(self, name: str, method: str, endpoint: str, expected_status: int, 
                 data: Optional[Dict] = None, headers: Optional[Dict] = None) -> tuple[bool, Dict]:
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint.lstrip('/')}"
        
        # Default headers
        req_headers = {'Content-Type': 'application/json'}
        if self.session_token:
            req_headers['Authorization'] = f'Bearer {self.session_token}'
        if headers:
            req_headers.update(headers)

        try:
            if method == 'GET':
                response = requests.get(url, headers=req_headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=req_headers, timeout=10)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=req_headers, timeout=10)
            elif method == 'DELETE':
                response = requests.delete(url, headers=req_headers, timeout=10)
            else:
                raise ValueError(f"Unsupported method: {method}")

            success = response.status_code == expected_status
            response_data = {}
            
            try:
                response_data = response.json()
            except:
                response_data = {"raw_response": response.text}

            details = f"Status: {response.status_code}, Expected: {expected_status}"
            if not success:
                details += f", Response: {response.text[:200]}"
            
            self.log_test(name, success, details)
            return success, response_data

        except Exception as e:
            self.log_test(name, False, f"Error: {str(e)}")
            return False, {}

    def test_health_check(self):
        """Test health endpoint"""
        success, data = self.run_test(
            "Health Check",
            "GET",
            "/api/health",
            200
        )
        return success

    def create_test_session(self):
        """Create a test session for auth testing"""
        print("\n🔧 Setting up test session for auth testing...")
        
        # Use the session token from test credentials
        self.session_token = "test_session_1775849707278"
        self.user_id = "test-user-demo"
        
        if self.session_token:
            self.log_test("Test Session Setup", True, f"Using session token: {self.session_token[:20]}...")
            return True
        else:
            self.log_test("Test Session Setup", False, "No session token available")
            return False

    def test_auth_endpoints(self):
        """Test authentication endpoints"""
        print("\n🔐 Testing Authentication Endpoints...")
        
        # Test /api/auth/me without token (should fail)
        self.run_test(
            "Auth Me - No Token",
            "GET",
            "/api/auth/me",
            401
        )
        
        # Test /api/auth/me with valid token (should succeed)
        if self.session_token:
            success, data = self.run_test(
                "Auth Me - With Token",
                "GET",
                "/api/auth/me",
                200
            )
            if success and data.get('user_id'):
                self.log_test("Auth Me - User Data", True, f"Retrieved user: {data.get('email', 'N/A')}")
        
        # Test session creation (requires session_id)
        self.run_test(
            "Auth Session - Missing session_id",
            "POST",
            "/api/auth/session",
            400,
            data={}
        )

    def test_accounts_crud(self):
        """Test accounts CRUD operations"""
        print("\n💰 Testing Accounts CRUD...")
        
        # Test GET accounts without auth
        self.run_test(
            "List Accounts - No Auth",
            "GET",
            "/api/accounts",
            401
        )
        
        # Test with auth
        if self.session_token:
            # List accounts (should work with default seeded accounts)
            success, data = self.run_test(
                "List Accounts - With Auth",
                "GET",
                "/api/accounts",
                200
            )
            if success:
                accounts = data if isinstance(data, list) else []
                self.log_test("Default Accounts Check", len(accounts) > 0, f"Found {len(accounts)} default accounts")
            
            # Create new account
            success, account_data = self.run_test(
                "Create Account - With Auth",
                "POST",
                "/api/accounts",
                200,
                data={
                    "name": "Test Savings Account",
                    "account_type": "asset",
                    "sub_type": "bank",
                    "opening_balance": 5000.0,
                    "currency": "INR",
                    "description": "Test account for API testing"
                }
            )
            if success and account_data.get('account_id'):
                self.test_account_id = account_data['account_id']
                self.log_test("Account Creation", True, f"Created account: {self.test_account_id}")
        
        # Test POST accounts without auth
        self.run_test(
            "Create Account - No Auth",
            "POST",
            "/api/accounts",
            401,
            data={
                "name": "Test Account",
                "account_type": "asset",
                "sub_type": "bank",
                "opening_balance": 1000.0,
                "currency": "INR"
            }
        )

    def test_categories_crud(self):
        """Test categories CRUD operations"""
        print("\n📂 Testing Categories CRUD...")
        
        # Test GET categories without auth
        self.run_test(
            "List Categories - No Auth",
            "GET",
            "/api/categories",
            401
        )
        
        # Test with auth
        if self.session_token:
            # List categories (should work with default seeded categories)
            success, data = self.run_test(
                "List Categories - With Auth",
                "GET",
                "/api/categories",
                200
            )
            if success:
                categories = data if isinstance(data, list) else []
                self.log_test("Default Categories Check", len(categories) > 0, f"Found {len(categories)} default categories")
            
            # Create new category
            success, category_data = self.run_test(
                "Create Category - With Auth",
                "POST",
                "/api/categories",
                200,
                data={
                    "name": "Test API Category",
                    "category_type": "expense"
                }
            )
            if success and category_data.get('category_id'):
                self.test_category_id = category_data['category_id']
                self.log_test("Category Creation", True, f"Created category: {self.test_category_id}")
        
        # Test POST categories without auth
        self.run_test(
            "Create Category - No Auth",
            "POST",
            "/api/categories",
            401,
            data={
                "name": "Test Category",
                "category_type": "expense"
            }
        )

    def test_transactions_crud(self):
        """Test transactions CRUD operations"""
        print("\n💸 Testing Transactions CRUD...")
        
        # Test GET transactions without auth
        self.run_test(
            "List Transactions - No Auth",
            "GET",
            "/api/transactions",
            401
        )
        
        # Test with auth
        if self.session_token:
            # List transactions (should work, might be empty initially)
            success, data = self.run_test(
                "List Transactions - With Auth",
                "GET",
                "/api/transactions",
                200
            )
            if success:
                transactions = data.get('transactions', []) if isinstance(data, dict) else []
                self.log_test("Transactions List", True, f"Found {len(transactions)} transactions")
            
            # Create new transaction (need account and category)
            if self.test_account_id and self.test_category_id:
                success, transaction_data = self.run_test(
                    "Create Transaction - With Auth",
                    "POST",
                    "/api/transactions",
                    200,
                    data={
                        "transaction_type": "expense",
                        "amount": 250.0,
                        "date": "2024-01-15",
                        "account_id": self.test_account_id,
                        "category_id": self.test_category_id,
                        "description": "Test API transaction",
                        "status": "approved"
                    }
                )
                if success and transaction_data.get('transaction_id'):
                    self.test_transaction_id = transaction_data['transaction_id']
                    self.log_test("Transaction Creation", True, f"Created transaction: {self.test_transaction_id}")
                    
                    # Test double-entry accounting - check account balance update
                    success, account_data = self.run_test(
                        "Account Balance Update Check",
                        "GET",
                        "/api/accounts",
                        200
                    )
                    if success:
                        accounts = account_data if isinstance(account_data, list) else []
                        test_account = next((acc for acc in accounts if acc.get('account_id') == self.test_account_id), None)
                        if test_account:
                            expected_balance = 5000.0 - 250.0  # opening_balance - expense
                            actual_balance = test_account.get('balance', 0)
                            balance_correct = abs(actual_balance - expected_balance) < 0.01
                            self.log_test("Double-Entry Balance Update", balance_correct, 
                                        f"Expected: {expected_balance}, Actual: {actual_balance}")
        
        # Test POST transactions without auth
        self.run_test(
            "Create Transaction - No Auth",
            "POST",
            "/api/transactions",
            401,
            data={
                "transaction_type": "expense",
                "amount": 100.0,
                "date": "2024-01-01",
                "account_id": "test_account",
                "category_id": "test_category",
                "description": "Test transaction"
            }
        )

    def test_dashboard_endpoints(self):
        """Test dashboard endpoints"""
        print("\n📊 Testing Dashboard Endpoints...")
        
        # Test dashboard summary without auth
        self.run_test(
            "Dashboard Summary - No Auth",
            "GET",
            "/api/dashboard/summary",
            401
        )
        
        # Test with auth
        if self.session_token:
            success, data = self.run_test(
                "Dashboard Summary - With Auth",
                "GET",
                "/api/dashboard/summary",
                200
            )
            if success:
                # Verify dashboard data structure
                required_fields = ['total_assets', 'total_liabilities', 'net_worth', 
                                 'income_this_month', 'expense_this_month', 'accounts']
                missing_fields = [field for field in required_fields if field not in data]
                
                if not missing_fields:
                    self.log_test("Dashboard Data Structure", True, "All required fields present")
                    
                    # Check if our test transaction affected the summary
                    if data.get('expense_this_month', 0) > 0:
                        self.log_test("Dashboard Expense Tracking", True, 
                                    f"Expense this month: {data['expense_this_month']}")
                else:
                    self.log_test("Dashboard Data Structure", False, f"Missing fields: {missing_fields}")

    def test_feature_requests(self):
        """Test feature requests endpoints"""
        print("\n💡 Testing Feature Requests...")
        
        # Test GET feature requests without auth
        self.run_test(
            "List Feature Requests - No Auth",
            "GET",
            "/api/feature-requests",
            401
        )
        
        # Test with auth
        if self.session_token:
            # List feature requests
            success, data = self.run_test(
                "List Feature Requests - With Auth",
                "GET",
                "/api/feature-requests",
                200
            )
            if success:
                requests_list = data if isinstance(data, list) else []
                self.log_test("Feature Requests List", True, f"Found {len(requests_list)} feature requests")
            
            # Create feature request
            success, request_data = self.run_test(
                "Create Feature Request - With Auth",
                "POST",
                "/api/feature-requests",
                200,
                data={
                    "title": "API Test Feature Request",
                    "description": "This is a test feature request created during API testing",
                    "category": "testing"
                }
            )
            if success and request_data.get('request_id'):
                self.log_test("Feature Request Creation", True, f"Created request: {request_data['request_id']}")
        
        # Test POST feature requests without auth
        self.run_test(
            "Create Feature Request - No Auth",
            "POST",
            "/api/feature-requests",
            401,
            data={
                "title": "Test Feature",
                "description": "Test feature description",
                "category": "general"
            }
        )

    def test_gmail_oauth_endpoints(self):
        """Test Gmail OAuth endpoints (Phase 2)"""
        print("\n📧 Testing Gmail OAuth Endpoints...")
        
        # Test Gmail connect without auth
        self.run_test(
            "Gmail Connect - No Auth",
            "GET",
            "/api/gmail/connect",
            401
        )
        
        # Test with auth
        if self.session_token:
            # Test Gmail connect (should return auth_url)
            success, data = self.run_test(
                "Gmail Connect - With Auth",
                "GET",
                "/api/gmail/connect",
                200
            )
            if success and data.get('auth_url'):
                self.log_test("Gmail Auth URL", True, f"Auth URL received: {data['auth_url'][:50]}...")
            
            # Test Gmail status (should return accounts array)
            success, data = self.run_test(
                "Gmail Status - With Auth",
                "GET",
                "/api/gmail/status",
                200
            )
            if success and 'accounts' in data:
                accounts = data.get('accounts', [])
                self.log_test("Gmail Status Structure", True, f"Found {len(accounts)} connected accounts")
            
            # Test Gmail disconnect (should require gmail_email)
            self.run_test(
                "Gmail Disconnect - Missing Email",
                "POST",
                "/api/gmail/disconnect",
                400,
                data={}
            )

    def test_email_sync_endpoints(self):
        """Test Email Sync endpoints (Phase 2)"""
        print("\n📨 Testing Email Sync Endpoints...")
        
        # Test email sync stats without auth
        self.run_test(
            "Email Sync Stats - No Auth",
            "GET",
            "/api/email/sync-stats",
            401
        )
        
        # Test with auth
        if self.session_token:
            # Test email sync stats (should return stats object)
            success, data = self.run_test(
                "Email Sync Stats - With Auth",
                "GET",
                "/api/email/sync-stats",
                200
            )
            if success:
                required_stats = ['total_synced', 'processed_by_ai', 'no_transaction', 'ai_pending', 'ai_failed', 'transactions_created', 'pending_review']
                missing_stats = [stat for stat in required_stats if stat not in data]
                if not missing_stats:
                    self.log_test("Email Sync Stats Structure", True, "All required stats fields present")
                else:
                    self.log_test("Email Sync Stats Structure", False, f"Missing stats: {missing_stats}")
            
            # Test pending review (should return transactions array and total)
            success, data = self.run_test(
                "Email Pending Review - With Auth",
                "GET",
                "/api/email/pending-review",
                200
            )
            if success and 'transactions' in data and 'total' in data:
                transactions = data.get('transactions', [])
                total = data.get('total', 0)
                self.log_test("Email Pending Review Structure", True, f"Found {len(transactions)} pending transactions, total: {total}")
            
            # Test start sync without required fields (should return 400)
            self.run_test(
                "Email Start Sync - Missing Fields",
                "POST",
                "/api/email/start-sync",
                400,
                data={}
            )
            
            # Test start sync with missing gmail_email
            self.run_test(
                "Email Start Sync - Missing Gmail Email",
                "POST",
                "/api/email/start-sync",
                400,
                data={"sync_from_date": "2024-01-01"}
            )
            
            # Test start sync with missing sync_from_date
            self.run_test(
                "Email Start Sync - Missing Sync Date",
                "POST",
                "/api/email/start-sync",
                400,
                data={"gmail_email": "test@example.com"}
            )
            
            # Test retry pending (should work even with no pending emails)
            success, data = self.run_test(
                "Email Retry Pending - With Auth",
                "POST",
                "/api/email/retry-pending",
                200,
                data={"gmail_email": "test@example.com"}
            )
            if success:
                self.log_test("Email Retry Pending Response", True, f"Response: {data.get('message', 'No message')}")

    def test_transaction_approval_endpoints(self):
        """Test transaction approval/rejection endpoints (Phase 2)"""
        print("\n✅ Testing Transaction Approval Endpoints...")
        
        if self.session_token and self.test_transaction_id:
            # Test approve transaction
            success, data = self.run_test(
                "Approve Transaction - With Auth",
                "POST",
                f"/api/transactions/{self.test_transaction_id}/approve",
                200
            )
            if success:
                self.log_test("Transaction Approval", True, f"Transaction approved: {self.test_transaction_id}")
            
            # Test approve already approved transaction (should fail)
            self.run_test(
                "Approve Already Approved Transaction",
                "POST",
                f"/api/transactions/{self.test_transaction_id}/approve",
                400
            )
        
        # Test approve non-existent transaction
        if self.session_token:
            self.run_test(
                "Approve Non-existent Transaction",
                "POST",
                "/api/transactions/nonexistent_id/approve",
                404
            )

    def run_all_tests(self):
        """Run all backend tests"""
        print("🚀 Starting Ledger AI Phase 2 Backend API Tests")
        print(f"📍 Testing against: {self.base_url}")
        print("=" * 60)
        
        # Basic connectivity
        if not self.test_health_check():
            print("❌ Health check failed - stopping tests")
            return False
        
        # Auth setup
        self.create_test_session()
        
        # Test all endpoints
        self.test_auth_endpoints()
        self.test_accounts_crud()
        self.test_categories_crud()
        self.test_transactions_crud()
        self.test_dashboard_endpoints()
        self.test_feature_requests()
        
        # Phase 2 specific tests
        self.test_gmail_oauth_endpoints()
        self.test_email_sync_endpoints()
        self.test_transaction_approval_endpoints()
        
        # Summary
        print("\n" + "=" * 60)
        print(f"📊 Test Results: {self.tests_passed}/{self.tests_run} passed")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All tests passed!")
            return True
        else:
            print(f"⚠️  {self.tests_run - self.tests_passed} tests failed")
            return False

    def get_test_summary(self) -> Dict[str, Any]:
        """Get test summary for reporting"""
        return {
            "total_tests": self.tests_run,
            "passed_tests": self.tests_passed,
            "failed_tests": self.tests_run - self.tests_passed,
            "success_rate": (self.tests_passed / self.tests_run * 100) if self.tests_run > 0 else 0,
            "test_results": self.test_results
        }

def main():
    """Main test execution"""
    tester = LedgerAITester()
    success = tester.run_all_tests()
    
    # Save detailed results
    summary = tester.get_test_summary()
    with open('/tmp/backend_test_results.json', 'w') as f:
        json.dump(summary, f, indent=2)
    
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())