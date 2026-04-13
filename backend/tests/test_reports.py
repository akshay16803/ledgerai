"""
Test suite for Reports Dashboard feature
Tests: GET /api/reports/summary, /api/reports/by-period, /api/reports/by-category
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
SESSION_TOKEN = os.environ.get('TEST_SESSION_TOKEN', 'tsess_1776075250617')

@pytest.fixture(scope="module")
def api_client():
    """Shared requests session with auth"""
    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {SESSION_TOKEN}"
    })
    session.cookies.set("session_token", SESSION_TOKEN, domain="email-sync-ledger.preview.emergentagent.com")
    return session


class TestReportsSummary:
    """Tests for GET /api/reports/summary endpoint"""
    
    def test_reports_summary_returns_200(self, api_client):
        """GET /api/reports/summary - Returns 200 with summary data"""
        response = api_client.get(f"{BASE_URL}/api/reports/summary")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        # Verify required fields
        assert "total_income" in data, "Missing total_income field"
        assert "total_expense" in data, "Missing total_expense field"
        assert "net" in data, "Missing net field"
        assert "transaction_count" in data, "Missing transaction_count field"
        
        # Verify data types
        assert isinstance(data["total_income"], (int, float)), "total_income should be numeric"
        assert isinstance(data["total_expense"], (int, float)), "total_expense should be numeric"
        assert isinstance(data["net"], (int, float)), "net should be numeric"
        assert isinstance(data["transaction_count"], int), "transaction_count should be integer"
        
        print(f"Summary: income={data['total_income']}, expense={data['total_expense']}, net={data['net']}, count={data['transaction_count']}")
    
    def test_reports_summary_with_date_filter(self, api_client):
        """GET /api/reports/summary?start_date=X&end_date=Y - Date filtering works"""
        response = api_client.get(f"{BASE_URL}/api/reports/summary?start_date=2024-01-01&end_date=2026-12-31")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "total_income" in data
        assert "total_expense" in data
        assert "net" in data
        assert "transaction_count" in data
        assert data.get("start_date") == "2024-01-01", "start_date should be echoed back"
        assert data.get("end_date") == "2026-12-31", "end_date should be echoed back"
        
        print(f"Filtered summary: income={data['total_income']}, expense={data['total_expense']}, count={data['transaction_count']}")
    
    def test_reports_summary_this_month(self, api_client):
        """GET /api/reports/summary - This month filter"""
        from datetime import datetime
        now = datetime.now()
        start = f"{now.year}-{now.month:02d}-01"
        end = now.strftime("%Y-%m-%d")
        
        response = api_client.get(f"{BASE_URL}/api/reports/summary?start_date={start}&end_date={end}")
        assert response.status_code == 200
        
        data = response.json()
        assert "total_income" in data
        assert "total_expense" in data
        print(f"This month: income={data['total_income']}, expense={data['total_expense']}")
    
    def test_reports_summary_requires_auth(self, api_client):
        """GET /api/reports/summary - Requires authentication"""
        unauth_session = requests.Session()
        response = unauth_session.get(f"{BASE_URL}/api/reports/summary")
        assert response.status_code == 401, f"Expected 401 for unauthenticated request, got {response.status_code}"


class TestReportsByPeriod:
    """Tests for GET /api/reports/by-period endpoint"""
    
    def test_reports_by_period_returns_200(self, api_client):
        """GET /api/reports/by-period - Returns monthly breakdown"""
        response = api_client.get(f"{BASE_URL}/api/reports/by-period")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "periods" in data, "Missing periods field"
        assert isinstance(data["periods"], list), "periods should be a list"
        
        if len(data["periods"]) > 0:
            period = data["periods"][0]
            assert "month" in period, "Period missing month field"
            assert "income" in period, "Period missing income field"
            assert "expense" in period, "Period missing expense field"
            assert "net" in period, "Period missing net field"
            assert "count" in period, "Period missing count field"
            
            print(f"First period: {period['month']} - income={period['income']}, expense={period['expense']}, net={period['net']}")
        
        print(f"Total periods: {len(data['periods'])}")
    
    def test_reports_by_period_with_date_filter(self, api_client):
        """GET /api/reports/by-period?start_date=X&end_date=Y - Date filtering works"""
        response = api_client.get(f"{BASE_URL}/api/reports/by-period?start_date=2024-01-01&end_date=2026-12-31")
        assert response.status_code == 200
        
        data = response.json()
        assert "periods" in data
        
        # Verify periods are sorted
        if len(data["periods"]) > 1:
            months = [p["month"] for p in data["periods"]]
            assert months == sorted(months), "Periods should be sorted by month"
        
        print(f"Filtered periods count: {len(data['periods'])}")
    
    def test_reports_by_period_requires_auth(self, api_client):
        """GET /api/reports/by-period - Requires authentication"""
        unauth_session = requests.Session()
        response = unauth_session.get(f"{BASE_URL}/api/reports/by-period")
        assert response.status_code == 401


class TestReportsByCategory:
    """Tests for GET /api/reports/by-category endpoint"""
    
    def test_reports_by_category_expense(self, api_client):
        """GET /api/reports/by-category?transaction_type=expense - Returns expense categories"""
        response = api_client.get(f"{BASE_URL}/api/reports/by-category?transaction_type=expense")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "categories" in data, "Missing categories field"
        assert isinstance(data["categories"], list), "categories should be a list"
        
        if len(data["categories"]) > 0:
            cat = data["categories"][0]
            assert "category_id" in cat, "Category missing category_id"
            assert "category_name" in cat, "Category missing category_name"
            assert "expense" in cat, "Category missing expense field"
            assert "income" in cat, "Category missing income field"
            assert "total" in cat, "Category missing total field"
            assert "count" in cat, "Category missing count field"
            assert "subcategories" in cat, "Category missing subcategories field"
            
            print(f"First expense category: {cat['category_name']} - expense={cat['expense']}, count={cat['count']}")
        
        print(f"Total expense categories: {len(data['categories'])}")
    
    def test_reports_by_category_income(self, api_client):
        """GET /api/reports/by-category?transaction_type=income - Returns income categories"""
        response = api_client.get(f"{BASE_URL}/api/reports/by-category?transaction_type=income")
        assert response.status_code == 200
        
        data = response.json()
        assert "categories" in data
        
        if len(data["categories"]) > 0:
            cat = data["categories"][0]
            assert "category_id" in cat
            assert "category_name" in cat
            assert "income" in cat
            
            print(f"First income category: {cat['category_name']} - income={cat['income']}, count={cat['count']}")
        
        print(f"Total income categories: {len(data['categories'])}")
    
    def test_reports_by_category_all(self, api_client):
        """GET /api/reports/by-category - Without type filter returns all"""
        response = api_client.get(f"{BASE_URL}/api/reports/by-category")
        assert response.status_code == 200
        
        data = response.json()
        assert "categories" in data
        
        print(f"All categories count: {len(data['categories'])}")
    
    def test_reports_by_category_with_subcategories(self, api_client):
        """GET /api/reports/by-category - Subcategories are included"""
        response = api_client.get(f"{BASE_URL}/api/reports/by-category?transaction_type=expense")
        assert response.status_code == 200
        
        data = response.json()
        
        # Find a category with subcategories
        for cat in data["categories"]:
            if len(cat.get("subcategories", [])) > 0:
                sub = cat["subcategories"][0]
                assert "subcategory_id" in sub, "Subcategory missing subcategory_id"
                assert "subcategory_name" in sub, "Subcategory missing subcategory_name"
                assert "total" in sub, "Subcategory missing total"
                assert "count" in sub, "Subcategory missing count"
                
                print(f"Found subcategory: {sub['subcategory_name']} under {cat['category_name']}")
                break
    
    def test_reports_by_category_with_date_filter(self, api_client):
        """GET /api/reports/by-category?start_date=X&end_date=Y - Date filtering works"""
        response = api_client.get(f"{BASE_URL}/api/reports/by-category?start_date=2024-01-01&end_date=2026-12-31&transaction_type=expense")
        assert response.status_code == 200
        
        data = response.json()
        assert "categories" in data
        
        print(f"Filtered expense categories: {len(data['categories'])}")
    
    def test_reports_by_category_requires_auth(self, api_client):
        """GET /api/reports/by-category - Requires authentication"""
        unauth_session = requests.Session()
        response = unauth_session.get(f"{BASE_URL}/api/reports/by-category")
        assert response.status_code == 401


class TestReportsDataIntegrity:
    """Tests for data integrity and calculations"""
    
    def test_summary_net_calculation(self, api_client):
        """Verify net = total_income - total_expense"""
        response = api_client.get(f"{BASE_URL}/api/reports/summary")
        assert response.status_code == 200
        
        data = response.json()
        expected_net = round(data["total_income"] - data["total_expense"], 2)
        actual_net = round(data["net"], 2)
        
        assert abs(expected_net - actual_net) < 0.01, f"Net calculation mismatch: expected {expected_net}, got {actual_net}"
        print(f"Net calculation verified: {data['total_income']} - {data['total_expense']} = {data['net']}")
    
    def test_period_totals_match_summary(self, api_client):
        """Verify period totals match summary totals"""
        summary_resp = api_client.get(f"{BASE_URL}/api/reports/summary")
        period_resp = api_client.get(f"{BASE_URL}/api/reports/by-period")
        
        assert summary_resp.status_code == 200
        assert period_resp.status_code == 200
        
        summary = summary_resp.json()
        periods = period_resp.json()["periods"]
        
        period_income = sum(p["income"] for p in periods)
        period_expense = sum(p["expense"] for p in periods)
        
        # Allow small floating point differences
        assert abs(period_income - summary["total_income"]) < 0.01, f"Income mismatch: periods={period_income}, summary={summary['total_income']}"
        assert abs(period_expense - summary["total_expense"]) < 0.01, f"Expense mismatch: periods={period_expense}, summary={summary['total_expense']}"
        
        print(f"Period totals match summary: income={period_income}, expense={period_expense}")


class TestRegressionEndpoints:
    """Regression tests for existing endpoints"""
    
    def test_auth_me_still_works(self, api_client):
        """Regression: GET /api/auth/me - Still works"""
        response = api_client.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 200
        data = response.json()
        assert "user_id" in data
        print(f"Auth verified: {data.get('email')}")
    
    def test_accounts_still_works(self, api_client):
        """Regression: GET /api/accounts - Still works"""
        response = api_client.get(f"{BASE_URL}/api/accounts")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Accounts count: {len(data)}")
    
    def test_transactions_still_works(self, api_client):
        """Regression: GET /api/transactions - Still works"""
        response = api_client.get(f"{BASE_URL}/api/transactions?limit=10")
        assert response.status_code == 200
        data = response.json()
        assert "transactions" in data
        print(f"Transactions count: {data.get('total', 0)}")
    
    def test_cashflow_still_works(self, api_client):
        """Regression: GET /api/cashflow/projection - Still works"""
        response = api_client.get(f"{BASE_URL}/api/cashflow/projection")
        assert response.status_code == 200
        data = response.json()
        assert "current_balance" in data
        print(f"Cashflow current balance: {data.get('current_balance')}")
    
    def test_dashboard_summary_still_works(self, api_client):
        """Regression: GET /api/dashboard/summary - Still works"""
        response = api_client.get(f"{BASE_URL}/api/dashboard/summary")
        assert response.status_code == 200
        data = response.json()
        assert "net_worth" in data
        print(f"Dashboard net worth: {data.get('net_worth')}")
    
    def test_categories_still_works(self, api_client):
        """Regression: GET /api/categories - Still works"""
        response = api_client.get(f"{BASE_URL}/api/categories")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Categories count: {len(data)}")
    
    def test_statements_list_still_works(self, api_client):
        """Regression: GET /api/statements/list - Still works"""
        response = api_client.get(f"{BASE_URL}/api/statements/list")
        assert response.status_code == 200
        data = response.json()
        assert "statements" in data
        print(f"Statements count: {len(data.get('statements', []))}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
