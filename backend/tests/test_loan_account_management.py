"""
Test Loan Account Management with EMI Tracking
Tests:
- POST /api/accounts with loan fields creates account and stores loan details
- POST /api/accounts with loan details auto-creates a monthly recurring EMI transaction
- PUT /api/accounts/{id} with loan fields updates loan details and creates recurring EMI
- GET /api/accounts/{id}/amortization returns correct reducing-balance schedule
- Amortization endpoint returns 400 if loan details missing
- Recurring EMI transaction appears in GET /api/recurring/list
- Recurring EMI feeds into GET /api/cashflow/projection
"""
import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test session token - created fresh for testing
SESSION_TOKEN = None

@pytest.fixture(scope="module", autouse=True)
def setup_session():
    """Create a fresh test session for all tests"""
    global SESSION_TOKEN
    import subprocess
    result = subprocess.run([
        'mongosh', '--quiet', '--eval',
        "use('spentyai'); var t='tsess_loan_test_'+Date.now(); db.user_sessions.deleteMany({user_id:'test-user-demo', session_token: {$regex: /^tsess_loan_test_/}}); db.user_sessions.insertOne({user_id:'test-user-demo',session_token:t,expires_at:new Date(Date.now()+7*24*60*60*1000),created_at:new Date()}); print(t);"
    ], capture_output=True, text=True)
    SESSION_TOKEN = result.stdout.strip()
    print(f"Created test session: {SESSION_TOKEN}")
    yield
    # Cleanup: delete test accounts created during tests
    subprocess.run([
        'mongosh', '--quiet', '--eval',
        "use('spentyai'); db.accounts.deleteMany({user_id:'test-user-demo', name: {$regex: /^TEST_/}}); db.transactions.deleteMany({user_id:'test-user-demo', description: {$regex: /^EMI - TEST_/}});"
    ], capture_output=True, text=True)


@pytest.fixture
def api_client():
    """Shared requests session with auth"""
    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "Cookie": f"session_token={SESSION_TOKEN}"
    })
    return session


class TestLoanAccountCreation:
    """Test creating loan accounts with loan details"""
    
    def test_create_loan_account_with_loan_details(self, api_client):
        """POST /api/accounts with loan fields creates account and stores loan details"""
        payload = {
            "name": "TEST_Home_Loan_1",
            "account_type": "liability",
            "sub_type": "loan",
            "opening_balance": -3000000,
            "balance_as_of_date": "2026-01-01",
            "currency": "INR",
            "loan_interest_rate": 9.0,
            "loan_tenure_months": 180,
            "loan_emi_amount": 30000,
            "loan_start_date": "2026-01-01"
        }
        response = api_client.post(f"{BASE_URL}/api/accounts", json=payload)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify loan fields are stored
        assert data["name"] == "TEST_Home_Loan_1"
        assert data["account_type"] == "liability"
        assert data["sub_type"] == "loan"
        assert data["loan_interest_rate"] == 9.0
        assert data["loan_tenure_months"] == 180
        assert data["loan_emi_amount"] == 30000
        assert data["loan_start_date"] == "2026-01-01"
        assert "account_id" in data
        
        # Store account_id for cleanup
        self.__class__.test_account_id_1 = data["account_id"]
        print(f"Created loan account: {data['account_id']}")
    
    def test_create_loan_account_auto_creates_recurring_emi(self, api_client):
        """POST /api/accounts with loan details auto-creates a monthly recurring EMI transaction"""
        payload = {
            "name": "TEST_Car_Loan_1",
            "account_type": "liability",
            "sub_type": "loan",
            "opening_balance": -500000,
            "balance_as_of_date": "2026-01-15",
            "currency": "INR",
            "loan_interest_rate": 10.5,
            "loan_tenure_months": 60,
            "loan_emi_amount": 10750
        }
        response = api_client.post(f"{BASE_URL}/api/accounts", json=payload)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        account_id = data["account_id"]
        self.__class__.test_account_id_2 = account_id
        
        # Check that a recurring EMI transaction was created
        txn_response = api_client.get(f"{BASE_URL}/api/transactions?account_id={account_id}")
        assert txn_response.status_code == 200
        txn_data = txn_response.json()
        
        # Find the EMI transaction
        emi_txns = [t for t in txn_data["transactions"] if t.get("source") == "loan_emi"]
        assert len(emi_txns) >= 1, "Expected at least one loan_emi transaction"
        
        emi_txn = emi_txns[0]
        assert emi_txn["is_recurring"] == True
        assert emi_txn["recurring_frequency"] == "monthly"
        assert emi_txn["amount"] == 10750
        assert emi_txn["transaction_type"] == "expense"
        assert "EMI - TEST_Car_Loan_1" in emi_txn["description"]
        print(f"Auto-created EMI transaction: {emi_txn['transaction_id']}")
    
    def test_create_loan_without_details_no_emi_created(self, api_client):
        """POST /api/accounts without loan details does NOT create recurring EMI"""
        payload = {
            "name": "TEST_Simple_Loan_1",
            "account_type": "liability",
            "sub_type": "loan",
            "opening_balance": -100000,
            "balance_as_of_date": "2026-01-01",
            "currency": "INR"
            # No loan_interest_rate, loan_tenure_months, loan_emi_amount
        }
        response = api_client.post(f"{BASE_URL}/api/accounts", json=payload)
        
        assert response.status_code == 200
        data = response.json()
        account_id = data["account_id"]
        self.__class__.test_account_id_3 = account_id
        
        # Check that NO recurring EMI transaction was created
        txn_response = api_client.get(f"{BASE_URL}/api/transactions?account_id={account_id}")
        assert txn_response.status_code == 200
        txn_data = txn_response.json()
        
        emi_txns = [t for t in txn_data["transactions"] if t.get("source") == "loan_emi"]
        assert len(emi_txns) == 0, "Expected no loan_emi transaction for account without loan details"
        print("Verified: No EMI transaction created for loan without details")


class TestLoanAccountUpdate:
    """Test updating loan accounts with loan details"""
    
    def test_update_loan_account_adds_loan_details(self, api_client):
        """PUT /api/accounts/{id} with loan fields updates loan details and creates recurring EMI"""
        # First create a loan without details
        create_payload = {
            "name": "TEST_Update_Loan_1",
            "account_type": "liability",
            "sub_type": "loan",
            "opening_balance": -200000,
            "balance_as_of_date": "2026-02-01",
            "currency": "INR"
        }
        create_response = api_client.post(f"{BASE_URL}/api/accounts", json=create_payload)
        assert create_response.status_code == 200
        account_id = create_response.json()["account_id"]
        self.__class__.test_account_id_4 = account_id
        
        # Now update with loan details
        update_payload = {
            "loan_interest_rate": 8.0,
            "loan_tenure_months": 120,
            "loan_emi_amount": 2500
        }
        update_response = api_client.put(f"{BASE_URL}/api/accounts/{account_id}", json=update_payload)
        
        assert update_response.status_code == 200
        updated_data = update_response.json()
        
        # Verify loan fields are updated
        assert updated_data["loan_interest_rate"] == 8.0
        assert updated_data["loan_tenure_months"] == 120
        assert updated_data["loan_emi_amount"] == 2500
        
        # Verify recurring EMI was created
        txn_response = api_client.get(f"{BASE_URL}/api/transactions?account_id={account_id}")
        assert txn_response.status_code == 200
        txn_data = txn_response.json()
        
        emi_txns = [t for t in txn_data["transactions"] if t.get("source") == "loan_emi"]
        assert len(emi_txns) >= 1, "Expected EMI transaction after adding loan details"
        assert emi_txns[0]["amount"] == 2500
        print(f"Updated loan account and created EMI transaction")


class TestAmortizationSchedule:
    """Test amortization schedule generation"""
    
    def test_get_amortization_schedule_success(self, api_client):
        """GET /api/accounts/{id}/amortization returns correct reducing-balance schedule"""
        # Use the existing test loan account
        # First, get accounts to find one with loan details
        accounts_response = api_client.get(f"{BASE_URL}/api/accounts")
        assert accounts_response.status_code == 200
        accounts = accounts_response.json()
        
        # Find a loan account with loan details
        loan_account = None
        for acc in accounts:
            if acc.get("sub_type") in ["loan", "mortgage"] and acc.get("loan_emi_amount"):
                loan_account = acc
                break
        
        if not loan_account:
            pytest.skip("No loan account with details found for testing")
        
        account_id = loan_account["account_id"]
        response = api_client.get(f"{BASE_URL}/api/accounts/{account_id}/amortization")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "account_id" in data
        assert "account_name" in data
        assert "outstanding_balance" in data
        assert "interest_rate" in data
        assert "tenure_months" in data
        assert "emi_amount" in data
        assert "total_interest" in data
        assert "total_payment" in data
        assert "payments_made" in data
        assert "months_remaining" in data
        assert "schedule" in data
        
        # Verify schedule structure
        schedule = data["schedule"]
        assert len(schedule) > 0, "Schedule should have at least one entry"
        
        first_entry = schedule[0]
        assert "month" in first_entry
        assert "due_date" in first_entry
        assert "emi" in first_entry
        assert "principal" in first_entry
        assert "interest" in first_entry
        assert "outstanding" in first_entry
        
        # Verify reducing balance - each month's outstanding should decrease
        for i in range(1, min(5, len(schedule))):
            assert schedule[i]["outstanding"] <= schedule[i-1]["outstanding"], \
                f"Outstanding balance should decrease: month {i} has {schedule[i]['outstanding']} vs month {i-1} has {schedule[i-1]['outstanding']}"
        
        print(f"Amortization schedule has {len(schedule)} entries")
        print(f"Total interest: {data['total_interest']}, Total payment: {data['total_payment']}")
    
    def test_amortization_returns_400_without_loan_details(self, api_client):
        """GET /api/accounts/{id}/amortization returns 400 if loan details missing"""
        # Create a loan account without loan details
        create_payload = {
            "name": "TEST_No_Details_Loan",
            "account_type": "liability",
            "sub_type": "loan",
            "opening_balance": -50000,
            "balance_as_of_date": "2026-01-01",
            "currency": "INR"
        }
        create_response = api_client.post(f"{BASE_URL}/api/accounts", json=create_payload)
        assert create_response.status_code == 200
        account_id = create_response.json()["account_id"]
        self.__class__.test_account_id_5 = account_id
        
        # Try to get amortization - should fail
        response = api_client.get(f"{BASE_URL}/api/accounts/{account_id}/amortization")
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
        data = response.json()
        assert "detail" in data
        assert "required" in data["detail"].lower() or "loan" in data["detail"].lower()
        print(f"Correctly returned 400: {data['detail']}")
    
    def test_amortization_returns_404_for_nonexistent_account(self, api_client):
        """GET /api/accounts/{id}/amortization returns 404 for non-existent account"""
        response = api_client.get(f"{BASE_URL}/api/accounts/acc_nonexistent123/amortization")
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("Correctly returned 404 for non-existent account")


class TestRecurringEMIInCashFlow:
    """Test that recurring EMI appears in recurring list and cash flow projection"""
    
    def test_recurring_emi_appears_in_recurring_list(self, api_client):
        """Recurring EMI transaction appears in GET /api/recurring/list"""
        response = api_client.get(f"{BASE_URL}/api/recurring/list")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert "transactions" in data
        assert "total" in data
        
        # Find loan_emi transactions
        emi_txns = [t for t in data["transactions"] if t.get("source") == "loan_emi"]
        assert len(emi_txns) >= 1, "Expected at least one loan_emi in recurring list"
        
        # Verify EMI transaction properties
        emi_txn = emi_txns[0]
        assert emi_txn["is_recurring"] == True
        assert emi_txn["recurring_frequency"] == "monthly"
        assert emi_txn["transaction_type"] == "expense"
        print(f"Found {len(emi_txns)} loan EMI transactions in recurring list")
    
    def test_recurring_emi_feeds_into_cashflow_projection(self, api_client):
        """Recurring EMI feeds into GET /api/cashflow/projection"""
        response = api_client.get(f"{BASE_URL}/api/cashflow/projection")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "current_balance" in data
        assert "monthly_recurring_income" in data
        assert "monthly_recurring_expense" in data
        assert "monthly_net" in data
        assert "recurring_items" in data
        assert "projection" in data
        
        # Find loan EMI in recurring items
        emi_items = [item for item in data["recurring_items"] if "EMI" in item.get("description", "")]
        
        # The monthly_recurring_expense should include EMI amounts
        assert data["monthly_recurring_expense"] > 0, "Expected some recurring expenses (including EMI)"
        
        # Verify projection has 24 months
        assert len(data["projection"]) == 24, f"Expected 24 months projection, got {len(data['projection'])}"
        
        # Each month should have projected expense
        for month in data["projection"][:3]:
            assert "projected_expense" in month
            assert "running_balance" in month
        
        print(f"Cash flow projection: monthly expense = {data['monthly_recurring_expense']}")
        print(f"Found {len(emi_items)} EMI items in recurring_items")


class TestMortgageSubType:
    """Test mortgage sub-type works same as loan"""
    
    def test_create_mortgage_account_with_details(self, api_client):
        """POST /api/accounts with mortgage sub-type and loan details works correctly"""
        payload = {
            "name": "TEST_Mortgage_1",
            "account_type": "liability",
            "sub_type": "mortgage",
            "opening_balance": -10000000,
            "balance_as_of_date": "2026-01-01",
            "currency": "INR",
            "loan_interest_rate": 7.5,
            "loan_tenure_months": 300,
            "loan_emi_amount": 75000
        }
        response = api_client.post(f"{BASE_URL}/api/accounts", json=payload)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert data["sub_type"] == "mortgage"
        assert data["loan_interest_rate"] == 7.5
        assert data["loan_emi_amount"] == 75000
        
        account_id = data["account_id"]
        self.__class__.test_account_id_6 = account_id
        
        # Verify amortization works for mortgage
        amort_response = api_client.get(f"{BASE_URL}/api/accounts/{account_id}/amortization")
        assert amort_response.status_code == 200
        amort_data = amort_response.json()
        assert len(amort_data["schedule"]) > 0
        print(f"Mortgage account created with {len(amort_data['schedule'])} month schedule")


# Cleanup fixture to delete test accounts after all tests
@pytest.fixture(scope="module", autouse=True)
def cleanup_test_accounts():
    yield
    # Cleanup is handled in setup_session fixture
    pass


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
