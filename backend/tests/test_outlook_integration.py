"""
Phase 3: Microsoft Outlook Integration Tests
Tests for Outlook OAuth, status, disconnect, start-sync, retry-pending endpoints
Also verifies existing Gmail and core endpoints still work
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
SESSION_TOKEN = os.environ.get('TEST_SESSION_TOKEN', 'tsess_1775853054571')

@pytest.fixture
def api_client():
    """Shared requests session with auth"""
    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {SESSION_TOKEN}"
    })
    return session

@pytest.fixture
def unauthenticated_client():
    """Session without auth for testing auth enforcement"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


class TestOutlookConnect:
    """Test GET /api/outlook/connect - Should return Microsoft OAuth URL"""
    
    def test_outlook_connect_returns_auth_url(self, api_client):
        """Verify /api/outlook/connect returns valid MS OAuth URL"""
        response = api_client.get(f"{BASE_URL}/api/outlook/connect")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "auth_url" in data, "Response should contain auth_url"
        
        auth_url = data["auth_url"]
        # Verify it's a Microsoft login URL
        assert "login.microsoftonline.com" in auth_url, f"URL should contain login.microsoftonline.com: {auth_url}"
        # Verify client_id is present
        assert "client_id=" in auth_url, f"URL should contain client_id: {auth_url}"
        # Verify Mail.Read scope
        assert "Mail.Read" in auth_url, f"URL should contain Mail.Read scope: {auth_url}"
        # Verify offline_access scope
        assert "offline_access" in auth_url, f"URL should contain offline_access scope: {auth_url}"
        print(f"✓ Outlook connect returns valid MS OAuth URL")


class TestOutlookStatus:
    """Test GET /api/outlook/status - Should return accounts array"""
    
    def test_outlook_status_returns_empty_accounts(self, api_client):
        """Verify /api/outlook/status returns empty accounts when none connected"""
        response = api_client.get(f"{BASE_URL}/api/outlook/status")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "accounts" in data, "Response should contain accounts array"
        assert isinstance(data["accounts"], list), "accounts should be a list"
        # Since no Outlook is connected, should be empty
        print(f"✓ Outlook status returns accounts array (count: {len(data['accounts'])})")


class TestOutlookDisconnect:
    """Test POST /api/outlook/disconnect - Should accept outlook_email param"""
    
    def test_outlook_disconnect_requires_email(self, api_client):
        """Verify /api/outlook/disconnect requires outlook_email"""
        response = api_client.post(f"{BASE_URL}/api/outlook/disconnect", json={})
        assert response.status_code == 400, f"Expected 400 for missing email, got {response.status_code}"
        print(f"✓ Outlook disconnect validates required outlook_email param")
    
    def test_outlook_disconnect_with_email(self, api_client):
        """Verify /api/outlook/disconnect accepts outlook_email and returns success"""
        response = api_client.post(f"{BASE_URL}/api/outlook/disconnect", json={
            "outlook_email": "test@outlook.com"
        })
        # Should return 200 even if email not connected (idempotent)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "message" in data, "Response should contain message"
        print(f"✓ Outlook disconnect accepts outlook_email param")


class TestOutlookStartSync:
    """Test POST /api/outlook/start-sync - Should require outlook_email and sync_from_date"""
    
    def test_start_sync_requires_params(self, api_client):
        """Verify /api/outlook/start-sync requires outlook_email and sync_from_date"""
        response = api_client.post(f"{BASE_URL}/api/outlook/start-sync", json={})
        assert response.status_code == 400, f"Expected 400 for missing params, got {response.status_code}"
        print(f"✓ Outlook start-sync validates required params")
    
    def test_start_sync_requires_both_params(self, api_client):
        """Verify /api/outlook/start-sync requires both params"""
        # Missing sync_from_date
        response = api_client.post(f"{BASE_URL}/api/outlook/start-sync", json={
            "outlook_email": "test@outlook.com"
        })
        assert response.status_code == 400, f"Expected 400 for missing sync_from_date, got {response.status_code}"
        
        # Missing outlook_email
        response = api_client.post(f"{BASE_URL}/api/outlook/start-sync", json={
            "sync_from_date": "2025-01-01"
        })
        assert response.status_code == 400, f"Expected 400 for missing outlook_email, got {response.status_code}"
        print(f"✓ Outlook start-sync requires both outlook_email and sync_from_date")
    
    def test_start_sync_returns_error_if_not_connected(self, api_client):
        """Verify /api/outlook/start-sync returns error if Outlook not connected"""
        response = api_client.post(f"{BASE_URL}/api/outlook/start-sync", json={
            "outlook_email": "notconnected@outlook.com",
            "sync_from_date": "2025-01-01"
        })
        assert response.status_code == 400, f"Expected 400 for not connected, got {response.status_code}"
        data = response.json()
        assert "detail" in data, "Response should contain error detail"
        assert "not connected" in data["detail"].lower(), f"Error should mention not connected: {data['detail']}"
        print(f"✓ Outlook start-sync returns error if Outlook not connected")


class TestOutlookRetryPending:
    """Test POST /api/outlook/retry-pending - Should handle retry for pending emails"""
    
    def test_retry_pending_works(self, api_client):
        """Verify /api/outlook/retry-pending handles retry request"""
        response = api_client.post(f"{BASE_URL}/api/outlook/retry-pending", json={
            "outlook_email": "test@outlook.com"
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "message" in data, "Response should contain message"
        assert "count" in data, "Response should contain count"
        print(f"✓ Outlook retry-pending works (count: {data['count']})")
    
    def test_retry_pending_without_email(self, api_client):
        """Verify /api/outlook/retry-pending works without specific email"""
        response = api_client.post(f"{BASE_URL}/api/outlook/retry-pending", json={})
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print(f"✓ Outlook retry-pending works without specific email")


class TestOutlookCallback:
    """Test GET /api/outlook/callback - Should redirect on error or missing params"""
    
    def test_callback_redirects_on_missing_params(self, api_client):
        """Verify /api/outlook/callback redirects when params missing"""
        response = api_client.get(f"{BASE_URL}/api/outlook/callback", allow_redirects=False)
        assert response.status_code in [302, 307], f"Expected redirect, got {response.status_code}"
        location = response.headers.get("location", "")
        assert "outlook_error" in location, f"Redirect should contain outlook_error: {location}"
        print(f"✓ Outlook callback redirects on missing params")
    
    def test_callback_redirects_on_error(self, api_client):
        """Verify /api/outlook/callback redirects when error param present"""
        response = api_client.get(f"{BASE_URL}/api/outlook/callback?error=access_denied", allow_redirects=False)
        assert response.status_code in [302, 307], f"Expected redirect, got {response.status_code}"
        location = response.headers.get("location", "")
        assert "outlook_error" in location, f"Redirect should contain outlook_error: {location}"
        print(f"✓ Outlook callback redirects on error param")


class TestExistingGmailEndpoints:
    """Verify existing Gmail endpoints still work"""
    
    def test_gmail_connect_still_works(self, api_client):
        """Verify /api/gmail/connect still returns auth URL"""
        response = api_client.get(f"{BASE_URL}/api/gmail/connect")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "auth_url" in data, "Response should contain auth_url"
        assert "accounts.google.com" in data["auth_url"], "Should be Google OAuth URL"
        print(f"✓ Gmail connect still works")
    
    def test_gmail_status_still_works(self, api_client):
        """Verify /api/gmail/status still returns accounts"""
        response = api_client.get(f"{BASE_URL}/api/gmail/status")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "accounts" in data, "Response should contain accounts"
        print(f"✓ Gmail status still works")


class TestExistingCoreEndpoints:
    """Verify existing core endpoints still work"""
    
    def test_auth_me_works(self, api_client):
        """Verify /api/auth/me returns user info"""
        response = api_client.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "user_id" in data, "Response should contain user_id"
        assert "email" in data, "Response should contain email"
        print(f"✓ Auth me works - user: {data.get('email')}")
    
    def test_accounts_endpoint_works(self, api_client):
        """Verify /api/accounts returns accounts list"""
        response = api_client.get(f"{BASE_URL}/api/accounts")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"✓ Accounts endpoint works (count: {len(data)})")
    
    def test_dashboard_summary_works(self, api_client):
        """Verify /api/dashboard/summary returns summary data"""
        response = api_client.get(f"{BASE_URL}/api/dashboard/summary")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "total_assets" in data, "Response should contain total_assets"
        assert "net_worth" in data, "Response should contain net_worth"
        print(f"✓ Dashboard summary works")


class TestAuthEnforcement:
    """Test that endpoints require authentication"""
    
    def test_outlook_connect_requires_auth(self, unauthenticated_client):
        """Verify /api/outlook/connect requires authentication"""
        response = unauthenticated_client.get(f"{BASE_URL}/api/outlook/connect")
        assert response.status_code == 401, f"Expected 401 without auth, got {response.status_code}"
        print(f"✓ Outlook connect requires authentication")
    
    def test_outlook_status_requires_auth(self, unauthenticated_client):
        """Verify /api/outlook/status requires authentication"""
        response = unauthenticated_client.get(f"{BASE_URL}/api/outlook/status")
        assert response.status_code == 401, f"Expected 401 without auth, got {response.status_code}"
        print(f"✓ Outlook status requires authentication")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
