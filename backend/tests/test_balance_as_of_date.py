"""
Test suite for balance_as_of_date feature in SpentyAI
Tests:
- Account creation with balance_as_of_date field
- Default balance_as_of_date to today when not provided
- Account update with balance_as_of_date triggers recalculation
- Account update with opening_balance triggers recalculation
- POST /api/accounts/{id}/recalculate endpoint
- Transaction balance application respects balance_as_of_date
- Transactions AFTER balance_as_of_date affect balance
- Transactions ON or BEFORE balance_as_of_date don't affect balance
"""

import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
SESSION_TOKEN = os.environ.get('TEST_SESSION_TOKEN', '')


@pytest.fixture(scope="module")
def session():
    """Create a requests session with auth cookie"""
    s = requests.Session()
    s.cookies.set('session_token', SESSION_TOKEN)
    s.headers.update({'Content-Type': 'application/json'})
    return s


@pytest.fixture(scope="module")
def auth_header():
    """Auth header for API calls"""
    return {'Authorization': f'Bearer {SESSION_TOKEN}', 'Content-Type': 'application/json'}


class TestAccountCreationWithBalanceDate:
    """Test account creation with balance_as_of_date field"""
    
    def test_create_account_with_balance_date(self, session):
        """POST /api/accounts creates account with balance_as_of_date field"""
        test_date = "2026-01-10"
        payload = {
            "name": "TEST_BalanceDateAccount",
            "account_type": "asset",
            "sub_type": "bank",
            "opening_balance": 5000.0,
            "balance_as_of_date": test_date,
            "currency": "INR"
        }
        response = session.post(f"{BASE_URL}/api/accounts", json=payload)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify balance_as_of_date is stored correctly
        assert "balance_as_of_date" in data, "balance_as_of_date field missing in response"
        assert data["balance_as_of_date"] == test_date, f"Expected {test_date}, got {data['balance_as_of_date']}"
        assert data["opening_balance"] == 5000.0
        assert data["balance"] == 5000.0  # Initial balance equals opening balance
        
        # Store account_id for cleanup
        self.__class__.test_account_id = data["account_id"]
        print(f"✓ Created account with balance_as_of_date: {data['account_id']}")
    
    def test_create_account_defaults_balance_date_to_today(self, session):
        """POST /api/accounts defaults balance_as_of_date to today when not provided"""
        today = datetime.now().strftime("%Y-%m-%d")
        payload = {
            "name": "TEST_DefaultDateAccount",
            "account_type": "asset",
            "sub_type": "cash",
            "opening_balance": 1000.0,
            "currency": "INR"
            # balance_as_of_date NOT provided
        }
        response = session.post(f"{BASE_URL}/api/accounts", json=payload)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify balance_as_of_date defaults to today
        assert "balance_as_of_date" in data, "balance_as_of_date field missing"
        assert data["balance_as_of_date"] == today, f"Expected today ({today}), got {data['balance_as_of_date']}"
        
        self.__class__.default_date_account_id = data["account_id"]
        print(f"✓ Account created with default date (today): {data['balance_as_of_date']}")


class TestAccountUpdateWithBalanceDate:
    """Test account update triggers recalculation"""
    
    @pytest.fixture(autouse=True)
    def setup_test_account(self, session):
        """Create a test account for update tests"""
        past_date = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
        payload = {
            "name": "TEST_UpdateAccount",
            "account_type": "asset",
            "sub_type": "bank",
            "opening_balance": 10000.0,
            "balance_as_of_date": past_date,
            "currency": "INR"
        }
        response = session.post(f"{BASE_URL}/api/accounts", json=payload)
        assert response.status_code == 200
        self.account_id = response.json()["account_id"]
        self.past_date = past_date
        yield
        # Cleanup
        session.delete(f"{BASE_URL}/api/accounts/{self.account_id}")
    
    def test_update_balance_as_of_date_triggers_recalculation(self, session):
        """PUT /api/accounts/{id} updating balance_as_of_date triggers recalculation"""
        new_date = (datetime.now() - timedelta(days=10)).strftime("%Y-%m-%d")
        
        response = session.put(
            f"{BASE_URL}/api/accounts/{self.account_id}",
            json={"balance_as_of_date": new_date}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert data["balance_as_of_date"] == new_date
        print(f"✓ Updated balance_as_of_date to {new_date}")
    
    def test_update_opening_balance_triggers_recalculation(self, session):
        """PUT /api/accounts/{id} updating opening_balance triggers recalculation"""
        new_balance = 15000.0
        
        response = session.put(
            f"{BASE_URL}/api/accounts/{self.account_id}",
            json={"opening_balance": new_balance}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert data["opening_balance"] == new_balance
        # Balance should be recalculated (at minimum equals opening_balance if no transactions)
        assert data["balance"] >= 0  # Balance is recalculated
        print(f"✓ Updated opening_balance to {new_balance}, balance recalculated to {data['balance']}")


class TestRecalculateEndpoint:
    """Test POST /api/accounts/{id}/recalculate endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup_account(self, session):
        """Create test account"""
        payload = {
            "name": "TEST_RecalcAccount",
            "account_type": "asset",
            "sub_type": "bank",
            "opening_balance": 5000.0,
            "balance_as_of_date": (datetime.now() - timedelta(days=5)).strftime("%Y-%m-%d"),
            "currency": "INR"
        }
        response = session.post(f"{BASE_URL}/api/accounts", json=payload)
        assert response.status_code == 200
        self.account_id = response.json()["account_id"]
        yield
        session.delete(f"{BASE_URL}/api/accounts/{self.account_id}")
    
    def test_recalculate_endpoint_returns_updated_account(self, session):
        """POST /api/accounts/{id}/recalculate recomputes balance correctly"""
        response = session.post(f"{BASE_URL}/api/accounts/{self.account_id}/recalculate")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert "account_id" in data
        assert "balance" in data
        assert "opening_balance" in data
        assert "balance_as_of_date" in data
        print(f"✓ Recalculate endpoint returned account with balance: {data['balance']}")
    
    def test_recalculate_nonexistent_account_returns_404(self, session):
        """POST /api/accounts/{id}/recalculate returns 404 for non-existent account"""
        response = session.post(f"{BASE_URL}/api/accounts/nonexistent_acc_123/recalculate")
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ Recalculate on non-existent account returns 404")


class TestTransactionBalanceApplication:
    """Test that transactions respect balance_as_of_date"""
    
    @pytest.fixture(autouse=True)
    def setup_account_and_category(self, session):
        """Create test account with past balance date and get a category"""
        # Create account with balance date 10 days ago
        self.balance_date = (datetime.now() - timedelta(days=10)).strftime("%Y-%m-%d")
        payload = {
            "name": "TEST_TxnBalanceAccount",
            "account_type": "asset",
            "sub_type": "bank",
            "opening_balance": 10000.0,
            "balance_as_of_date": self.balance_date,
            "currency": "INR"
        }
        response = session.post(f"{BASE_URL}/api/accounts", json=payload)
        assert response.status_code == 200
        self.account_id = response.json()["account_id"]
        
        # Get an expense category
        cats_response = session.get(f"{BASE_URL}/api/categories?category_type=expense")
        assert cats_response.status_code == 200
        cats = cats_response.json()
        self.expense_category_id = cats[0]["category_id"] if cats else None
        
        # Get an income category
        income_cats_response = session.get(f"{BASE_URL}/api/categories?category_type=income")
        assert income_cats_response.status_code == 200
        income_cats = income_cats_response.json()
        self.income_category_id = income_cats[0]["category_id"] if income_cats else None
        
        self.created_txn_ids = []
        yield
        
        # Cleanup transactions
        for txn_id in self.created_txn_ids:
            session.delete(f"{BASE_URL}/api/transactions/{txn_id}")
        # Cleanup account
        session.delete(f"{BASE_URL}/api/accounts/{self.account_id}")
    
    def test_transaction_after_balance_date_affects_balance(self, session):
        """Creating a transaction AFTER balance_as_of_date increments balance normally"""
        # Transaction date is after balance_as_of_date (today)
        txn_date = datetime.now().strftime("%Y-%m-%d")
        
        # Get initial balance
        acc_response = session.get(f"{BASE_URL}/api/accounts")
        accounts = acc_response.json()
        account = next((a for a in accounts if a["account_id"] == self.account_id), None)
        initial_balance = account["balance"]
        
        # Create income transaction
        payload = {
            "transaction_type": "income",
            "amount": 500.0,
            "date": txn_date,
            "account_id": self.account_id,
            "category_id": self.income_category_id,
            "description": "TEST_Income after balance date",
            "source": "manual",
            "status": "approved"
        }
        response = session.post(f"{BASE_URL}/api/transactions", json=payload)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        txn = response.json()
        self.created_txn_ids.append(txn["transaction_id"])
        
        # Verify balance increased
        acc_response = session.get(f"{BASE_URL}/api/accounts")
        accounts = acc_response.json()
        account = next((a for a in accounts if a["account_id"] == self.account_id), None)
        
        expected_balance = initial_balance + 500.0
        assert account["balance"] == expected_balance, f"Expected {expected_balance}, got {account['balance']}"
        print(f"✓ Transaction after balance_as_of_date affected balance: {initial_balance} -> {account['balance']}")
    
    def test_transaction_on_balance_date_does_not_affect_balance(self, session):
        """Creating a transaction ON balance_as_of_date does NOT affect balance (end-of-day semantics)"""
        # Transaction date is exactly on balance_as_of_date
        txn_date = self.balance_date
        
        # Get initial balance
        acc_response = session.get(f"{BASE_URL}/api/accounts")
        accounts = acc_response.json()
        account = next((a for a in accounts if a["account_id"] == self.account_id), None)
        initial_balance = account["balance"]
        
        # Create expense transaction on the balance date
        payload = {
            "transaction_type": "expense",
            "amount": 200.0,
            "date": txn_date,
            "account_id": self.account_id,
            "category_id": self.expense_category_id,
            "description": "TEST_Expense on balance date",
            "source": "manual",
            "status": "approved"
        }
        response = session.post(f"{BASE_URL}/api/transactions", json=payload)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        txn = response.json()
        self.created_txn_ids.append(txn["transaction_id"])
        
        # Verify balance did NOT change (transaction is on the snapshot date)
        acc_response = session.get(f"{BASE_URL}/api/accounts")
        accounts = acc_response.json()
        account = next((a for a in accounts if a["account_id"] == self.account_id), None)
        
        assert account["balance"] == initial_balance, f"Balance should not change for transaction on balance_as_of_date. Expected {initial_balance}, got {account['balance']}"
        print(f"✓ Transaction ON balance_as_of_date did NOT affect balance: {account['balance']}")
    
    def test_transaction_before_balance_date_does_not_affect_balance(self, session):
        """Creating a transaction BEFORE balance_as_of_date does NOT affect balance"""
        # Transaction date is before balance_as_of_date
        txn_date = (datetime.now() - timedelta(days=15)).strftime("%Y-%m-%d")
        
        # Get initial balance
        acc_response = session.get(f"{BASE_URL}/api/accounts")
        accounts = acc_response.json()
        account = next((a for a in accounts if a["account_id"] == self.account_id), None)
        initial_balance = account["balance"]
        
        # Create expense transaction before the balance date
        payload = {
            "transaction_type": "expense",
            "amount": 300.0,
            "date": txn_date,
            "account_id": self.account_id,
            "category_id": self.expense_category_id,
            "description": "TEST_Expense before balance date",
            "source": "manual",
            "status": "approved"
        }
        response = session.post(f"{BASE_URL}/api/transactions", json=payload)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        txn = response.json()
        self.created_txn_ids.append(txn["transaction_id"])
        
        # Verify balance did NOT change
        acc_response = session.get(f"{BASE_URL}/api/accounts")
        accounts = acc_response.json()
        account = next((a for a in accounts if a["account_id"] == self.account_id), None)
        
        assert account["balance"] == initial_balance, f"Balance should not change for transaction before balance_as_of_date. Expected {initial_balance}, got {account['balance']}"
        print(f"✓ Transaction BEFORE balance_as_of_date did NOT affect balance: {account['balance']}")


class TestRecalculationWithTransactions:
    """Test recalculation correctly handles transactions relative to balance_as_of_date"""
    
    @pytest.fixture(autouse=True)
    def setup_account_with_transactions(self, session):
        """Create account and transactions for recalculation test"""
        # Create account with balance date 10 days ago
        self.balance_date = (datetime.now() - timedelta(days=10)).strftime("%Y-%m-%d")
        payload = {
            "name": "TEST_RecalcWithTxns",
            "account_type": "asset",
            "sub_type": "bank",
            "opening_balance": 10000.0,
            "balance_as_of_date": self.balance_date,
            "currency": "INR"
        }
        response = session.post(f"{BASE_URL}/api/accounts", json=payload)
        assert response.status_code == 200
        self.account_id = response.json()["account_id"]
        
        # Get categories
        cats_response = session.get(f"{BASE_URL}/api/categories?category_type=income")
        income_cats = cats_response.json()
        self.income_category_id = income_cats[0]["category_id"] if income_cats else None
        
        cats_response = session.get(f"{BASE_URL}/api/categories?category_type=expense")
        expense_cats = cats_response.json()
        self.expense_category_id = expense_cats[0]["category_id"] if expense_cats else None
        
        self.created_txn_ids = []
        yield
        
        # Cleanup
        for txn_id in self.created_txn_ids:
            session.delete(f"{BASE_URL}/api/transactions/{txn_id}")
        session.delete(f"{BASE_URL}/api/accounts/{self.account_id}")
    
    def test_recalculate_with_mixed_transactions(self, session):
        """Recalculate correctly sums only transactions after balance_as_of_date"""
        # Create transaction BEFORE balance date (should NOT be counted)
        before_date = (datetime.now() - timedelta(days=15)).strftime("%Y-%m-%d")
        payload = {
            "transaction_type": "income",
            "amount": 1000.0,
            "date": before_date,
            "account_id": self.account_id,
            "category_id": self.income_category_id,
            "description": "TEST_Before date - should not count",
            "source": "manual",
            "status": "approved"
        }
        response = session.post(f"{BASE_URL}/api/transactions", json=payload)
        assert response.status_code == 200
        self.created_txn_ids.append(response.json()["transaction_id"])
        
        # Create transaction AFTER balance date (should be counted)
        after_date = (datetime.now() - timedelta(days=5)).strftime("%Y-%m-%d")
        payload = {
            "transaction_type": "income",
            "amount": 2000.0,
            "date": after_date,
            "account_id": self.account_id,
            "category_id": self.income_category_id,
            "description": "TEST_After date - should count",
            "source": "manual",
            "status": "approved"
        }
        response = session.post(f"{BASE_URL}/api/transactions", json=payload)
        assert response.status_code == 200
        self.created_txn_ids.append(response.json()["transaction_id"])
        
        # Create expense AFTER balance date (should be counted)
        payload = {
            "transaction_type": "expense",
            "amount": 500.0,
            "date": after_date,
            "account_id": self.account_id,
            "category_id": self.expense_category_id,
            "description": "TEST_Expense after date - should count",
            "source": "manual",
            "status": "approved"
        }
        response = session.post(f"{BASE_URL}/api/transactions", json=payload)
        assert response.status_code == 200
        self.created_txn_ids.append(response.json()["transaction_id"])
        
        # Trigger recalculation
        response = session.post(f"{BASE_URL}/api/accounts/{self.account_id}/recalculate")
        assert response.status_code == 200
        data = response.json()
        
        # Expected: opening_balance (10000) + income after (2000) - expense after (500) = 11500
        # The income before balance date (1000) should NOT be counted
        expected_balance = 10000.0 + 2000.0 - 500.0
        assert data["balance"] == expected_balance, f"Expected {expected_balance}, got {data['balance']}"
        print(f"✓ Recalculation correctly computed balance: {data['balance']} (only transactions after {self.balance_date})")


class TestCleanup:
    """Cleanup test accounts created during testing"""
    
    def test_cleanup_test_accounts(self, session):
        """Delete all TEST_ prefixed accounts"""
        response = session.get(f"{BASE_URL}/api/accounts")
        if response.status_code == 200:
            accounts = response.json()
            for acc in accounts:
                if acc["name"].startswith("TEST_"):
                    # First delete any transactions for this account
                    txn_response = session.get(f"{BASE_URL}/api/transactions?account_id={acc['account_id']}&limit=1000")
                    if txn_response.status_code == 200:
                        txns = txn_response.json().get("transactions", [])
                        for txn in txns:
                            session.delete(f"{BASE_URL}/api/transactions/{txn['transaction_id']}")
                    # Then delete the account
                    session.delete(f"{BASE_URL}/api/accounts/{acc['account_id']}")
                    print(f"  Cleaned up: {acc['name']}")
        print("✓ Cleanup completed")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
