"""
Test suite for Cash Flow Projection and Recurring Transaction features
- GET /api/recurring/list - Returns list of recurring transactions
- POST /api/transactions/{id}/toggle-recurring - Toggle is_recurring on/off
- GET /api/cashflow/projection - Returns 24-month cash flow projection
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test session token - created fresh for testing
TEST_TOKEN = os.environ.get('TEST_TOKEN', 'tsess_1775860811021')


@pytest.fixture
def api_client():
    """Shared requests session with auth"""
    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {TEST_TOKEN}"
    })
    return session


class TestRecurringList:
    """Tests for GET /api/recurring/list endpoint"""

    def test_recurring_list_returns_200(self, api_client):
        """Recurring list endpoint returns 200 OK"""
        response = api_client.get(f"{BASE_URL}/api/recurring/list")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"

    def test_recurring_list_structure(self, api_client):
        """Recurring list returns correct structure with transactions and total"""
        response = api_client.get(f"{BASE_URL}/api/recurring/list")
        assert response.status_code == 200
        data = response.json()
        
        assert "transactions" in data, "Response should have 'transactions' key"
        assert "total" in data, "Response should have 'total' key"
        assert isinstance(data["transactions"], list), "transactions should be a list"
        assert isinstance(data["total"], int), "total should be an integer"

    def test_recurring_list_only_approved_recurring(self, api_client):
        """Recurring list only returns transactions with is_recurring=true and status=approved"""
        response = api_client.get(f"{BASE_URL}/api/recurring/list")
        assert response.status_code == 200
        data = response.json()
        
        for txn in data["transactions"]:
            assert txn.get("is_recurring") is True, f"Transaction {txn.get('transaction_id')} should have is_recurring=true"
            assert txn.get("status") == "approved", f"Transaction {txn.get('transaction_id')} should have status=approved"

    def test_recurring_list_has_required_fields(self, api_client):
        """Each recurring transaction has required fields"""
        response = api_client.get(f"{BASE_URL}/api/recurring/list")
        assert response.status_code == 200
        data = response.json()
        
        required_fields = ["transaction_id", "transaction_type", "amount", "date", "is_recurring", "recurring_frequency"]
        for txn in data["transactions"]:
            for field in required_fields:
                assert field in txn, f"Transaction missing required field: {field}"

    def test_recurring_list_requires_auth(self):
        """Recurring list requires authentication"""
        response = requests.get(f"{BASE_URL}/api/recurring/list")
        assert response.status_code == 401, "Should return 401 without auth"


class TestToggleRecurring:
    """Tests for POST /api/transactions/{id}/toggle-recurring endpoint"""

    def test_toggle_recurring_on(self, api_client):
        """Can toggle a transaction to recurring with frequency"""
        # First get a non-recurring transaction
        txns_response = api_client.get(f"{BASE_URL}/api/transactions?status=approved&limit=50")
        assert txns_response.status_code == 200
        txns = txns_response.json().get("transactions", [])
        
        # Find a non-recurring transaction
        non_recurring = next((t for t in txns if not t.get("is_recurring") and t.get("transaction_type") != "transfer"), None)
        
        if non_recurring:
            txn_id = non_recurring["transaction_id"]
            
            # Toggle ON with monthly frequency
            response = api_client.post(
                f"{BASE_URL}/api/transactions/{txn_id}/toggle-recurring",
                json={"is_recurring": True, "recurring_frequency": "monthly"}
            )
            assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
            
            data = response.json()
            assert data["is_recurring"] is True, "is_recurring should be True"
            assert data["recurring_frequency"] == "monthly", "recurring_frequency should be 'monthly'"
            
            # Clean up - toggle back off
            api_client.post(
                f"{BASE_URL}/api/transactions/{txn_id}/toggle-recurring",
                json={"is_recurring": False}
            )
        else:
            pytest.skip("No non-recurring transactions available for testing")

    def test_toggle_recurring_off_removes_frequency(self, api_client):
        """Toggling recurring off sets recurring_frequency to null"""
        # Use the known recurring transaction
        txn_id = "txn_3a301f9ed2b3"
        
        # First ensure it's recurring
        api_client.post(
            f"{BASE_URL}/api/transactions/{txn_id}/toggle-recurring",
            json={"is_recurring": True, "recurring_frequency": "weekly"}
        )
        
        # Toggle OFF
        response = api_client.post(
            f"{BASE_URL}/api/transactions/{txn_id}/toggle-recurring",
            json={"is_recurring": False}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["is_recurring"] is False, "is_recurring should be False"
        assert data["recurring_frequency"] is None, "recurring_frequency should be null when toggled off"
        
        # Restore original state
        api_client.post(
            f"{BASE_URL}/api/transactions/{txn_id}/toggle-recurring",
            json={"is_recurring": True, "recurring_frequency": "weekly"}
        )

    def test_toggle_recurring_different_frequencies(self, api_client):
        """Can set different recurring frequencies"""
        txn_id = "txn_3a301f9ed2b3"
        
        frequencies = ["weekly", "monthly", "quarterly", "yearly"]
        for freq in frequencies:
            response = api_client.post(
                f"{BASE_URL}/api/transactions/{txn_id}/toggle-recurring",
                json={"is_recurring": True, "recurring_frequency": freq}
            )
            assert response.status_code == 200, f"Failed for frequency {freq}"
            assert response.json()["recurring_frequency"] == freq, f"Expected {freq}"
        
        # Restore to weekly
        api_client.post(
            f"{BASE_URL}/api/transactions/{txn_id}/toggle-recurring",
            json={"is_recurring": True, "recurring_frequency": "weekly"}
        )

    def test_toggle_recurring_not_found(self, api_client):
        """Toggle recurring returns 404 for non-existent transaction"""
        response = api_client.post(
            f"{BASE_URL}/api/transactions/txn_nonexistent/toggle-recurring",
            json={"is_recurring": True, "recurring_frequency": "monthly"}
        )
        assert response.status_code == 404

    def test_toggle_recurring_requires_auth(self):
        """Toggle recurring requires authentication"""
        response = requests.post(
            f"{BASE_URL}/api/transactions/txn_test/toggle-recurring",
            json={"is_recurring": True}
        )
        assert response.status_code == 401


class TestCashFlowProjection:
    """Tests for GET /api/cashflow/projection endpoint"""

    def test_projection_returns_200(self, api_client):
        """Cash flow projection endpoint returns 200 OK"""
        response = api_client.get(f"{BASE_URL}/api/cashflow/projection")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"

    def test_projection_structure(self, api_client):
        """Projection returns all required fields"""
        response = api_client.get(f"{BASE_URL}/api/cashflow/projection")
        assert response.status_code == 200
        data = response.json()
        
        required_fields = [
            "current_balance",
            "monthly_recurring_income",
            "monthly_recurring_expense",
            "monthly_net",
            "recurring_items",
            "projection"
        ]
        for field in required_fields:
            assert field in data, f"Response missing required field: {field}"

    def test_projection_has_24_months(self, api_client):
        """Projection array has exactly 24 months"""
        response = api_client.get(f"{BASE_URL}/api/cashflow/projection")
        assert response.status_code == 200
        data = response.json()
        
        projection = data.get("projection", [])
        assert len(projection) == 24, f"Expected 24 months, got {len(projection)}"

    def test_projection_month_structure(self, api_client):
        """Each month in projection has required fields"""
        response = api_client.get(f"{BASE_URL}/api/cashflow/projection")
        assert response.status_code == 200
        data = response.json()
        
        required_month_fields = ["month", "label", "projected_income", "projected_expense", "net", "running_balance"]
        for month in data.get("projection", []):
            for field in required_month_fields:
                assert field in month, f"Month missing required field: {field}"

    def test_projection_recurring_items_structure(self, api_client):
        """Recurring items have required fields including monthly_amount"""
        response = api_client.get(f"{BASE_URL}/api/cashflow/projection")
        assert response.status_code == 200
        data = response.json()
        
        required_item_fields = ["transaction_id", "description", "transaction_type", "amount", "frequency", "monthly_amount"]
        for item in data.get("recurring_items", []):
            for field in required_item_fields:
                assert field in item, f"Recurring item missing required field: {field}"

    def test_projection_frequency_multipliers(self, api_client):
        """Frequency multipliers are applied correctly"""
        response = api_client.get(f"{BASE_URL}/api/cashflow/projection")
        assert response.status_code == 200
        data = response.json()
        
        # Expected multipliers: weekly=4.33, monthly=1, quarterly=0.33, yearly=0.083
        for item in data.get("recurring_items", []):
            freq = item.get("frequency", "monthly")
            amount = item.get("amount", 0)
            monthly_amount = item.get("monthly_amount", 0)
            
            if freq == "weekly":
                expected = round(amount * 4.33, 2)
                assert abs(monthly_amount - expected) < 1, f"Weekly multiplier incorrect: {monthly_amount} vs {expected}"
            elif freq == "monthly":
                assert monthly_amount == amount, f"Monthly should equal amount: {monthly_amount} vs {amount}"
            elif freq == "quarterly":
                expected = round(amount / 3, 2)
                assert abs(monthly_amount - expected) < 1, f"Quarterly multiplier incorrect: {monthly_amount} vs {expected}"
            elif freq == "yearly":
                expected = round(amount / 12, 2)
                assert abs(monthly_amount - expected) < 1, f"Yearly multiplier incorrect: {monthly_amount} vs {expected}"

    def test_projection_monthly_net_calculation(self, api_client):
        """Monthly net equals income minus expense"""
        response = api_client.get(f"{BASE_URL}/api/cashflow/projection")
        assert response.status_code == 200
        data = response.json()
        
        income = data.get("monthly_recurring_income", 0)
        expense = data.get("monthly_recurring_expense", 0)
        net = data.get("monthly_net", 0)
        
        expected_net = income - expense
        assert abs(net - expected_net) < 0.01, f"Monthly net incorrect: {net} vs {expected_net}"

    def test_projection_running_balance_increases(self, api_client):
        """Running balance increases by monthly_net each month (when net > 0)"""
        response = api_client.get(f"{BASE_URL}/api/cashflow/projection")
        assert response.status_code == 200
        data = response.json()
        
        current_balance = data.get("current_balance", 0)
        monthly_net = data.get("monthly_net", 0)
        projection = data.get("projection", [])
        
        if len(projection) >= 2 and monthly_net != 0:
            # Check first month
            first_month = projection[0]
            expected_first = current_balance + monthly_net
            assert abs(first_month["running_balance"] - expected_first) < 0.01, \
                f"First month balance incorrect: {first_month['running_balance']} vs {expected_first}"
            
            # Check second month
            second_month = projection[1]
            expected_second = first_month["running_balance"] + monthly_net
            assert abs(second_month["running_balance"] - expected_second) < 0.01, \
                f"Second month balance incorrect: {second_month['running_balance']} vs {expected_second}"

    def test_projection_requires_auth(self):
        """Cash flow projection requires authentication"""
        response = requests.get(f"{BASE_URL}/api/cashflow/projection")
        assert response.status_code == 401


class TestRegressionExistingEndpoints:
    """Regression tests for existing endpoints"""

    def test_auth_me(self, api_client):
        """GET /api/auth/me still works"""
        response = api_client.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 200
        data = response.json()
        assert "user_id" in data
        assert "email" in data

    def test_accounts_list(self, api_client):
        """GET /api/accounts still works"""
        response = api_client.get(f"{BASE_URL}/api/accounts")
        assert response.status_code == 200
        assert isinstance(response.json(), list)

    def test_transactions_list(self, api_client):
        """GET /api/transactions still works"""
        response = api_client.get(f"{BASE_URL}/api/transactions")
        assert response.status_code == 200
        data = response.json()
        assert "transactions" in data
        assert "total" in data

    def test_gmail_status(self, api_client):
        """GET /api/gmail/status still works"""
        response = api_client.get(f"{BASE_URL}/api/gmail/status")
        assert response.status_code == 200
        data = response.json()
        assert "accounts" in data

    def test_outlook_status(self, api_client):
        """GET /api/outlook/status still works"""
        response = api_client.get(f"{BASE_URL}/api/outlook/status")
        assert response.status_code == 200
        data = response.json()
        assert "accounts" in data

    def test_sms_stats(self, api_client):
        """GET /api/sms/stats still works"""
        response = api_client.get(f"{BASE_URL}/api/sms/stats")
        assert response.status_code == 200
        data = response.json()
        assert "total_synced" in data

    def test_dashboard_summary(self, api_client):
        """GET /api/dashboard/summary still works"""
        response = api_client.get(f"{BASE_URL}/api/dashboard/summary")
        assert response.status_code == 200
        data = response.json()
        assert "net_worth" in data
        assert "accounts" in data
