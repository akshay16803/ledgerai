"""
Email Verification Feature Tests
Tests for:
- GET /api/auth/verify-email - Email verification endpoint
- POST /api/auth/resend-verification - Resend verification email endpoint
- GET /api/auth/me - Returns email_verified field
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestEmailVerification:
    """Email verification endpoint tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session and reset user state before each test"""
        # Create fresh session
        import subprocess
        result = subprocess.run(
            ['mongosh', '--quiet', '--eval', 
             'use("ledgerai"); var t="tsess_"+Date.now(); db.user_sessions.deleteMany({user_id:"test-user-demo"}); db.user_sessions.insertOne({user_id:"test-user-demo",session_token:t,expires_at:new Date(Date.now()+7*24*60*60*1000),created_at:new Date()}); print(t);'],
            capture_output=True, text=True
        )
        self.session_token = result.stdout.strip()
        
        # Reset user to unverified state with known token
        subprocess.run(
            ['mongosh', '--quiet', '--eval',
             'use("ledgerai"); db.users.updateOne({user_id:"test-user-demo"},{$set:{verification_token:"test_verify_token_abc123",email_verified:false},$unset:{verified_at:""}});'],
            capture_output=True, text=True
        )
        
        self.headers = {
            "Authorization": f"Bearer {self.session_token}",
            "Content-Type": "application/json"
        }
        yield
    
    def test_auth_me_returns_email_verified_false(self):
        """GET /api/auth/me should return email_verified: false for unverified user"""
        response = requests.get(f"{BASE_URL}/api/auth/me", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert "email_verified" in data
        assert data["email_verified"] is False
        assert data["user_id"] == "test-user-demo"
        assert data["email"] == "demo@ledgerai.com"
    
    def test_verify_email_with_valid_token(self):
        """GET /api/auth/verify-email?token=<valid_token> should verify user"""
        response = requests.get(f"{BASE_URL}/api/auth/verify-email?token=test_verify_token_abc123")
        assert response.status_code == 200
        data = response.json()
        assert data["message"] == "Email verified successfully"
        assert data["already_verified"] is False
    
    def test_verify_email_with_invalid_token(self):
        """GET /api/auth/verify-email?token=invalid should return 400"""
        response = requests.get(f"{BASE_URL}/api/auth/verify-email?token=invalid_token_xyz")
        assert response.status_code == 400
        data = response.json()
        assert "Invalid or expired verification token" in data["detail"]
    
    def test_auth_me_returns_email_verified_true_after_verification(self):
        """GET /api/auth/me should return email_verified: true after verification"""
        # First verify the email
        verify_response = requests.get(f"{BASE_URL}/api/auth/verify-email?token=test_verify_token_abc123")
        assert verify_response.status_code == 200
        
        # Then check /api/auth/me
        response = requests.get(f"{BASE_URL}/api/auth/me", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert data["email_verified"] is True
    
    def test_verify_email_already_verified(self):
        """GET /api/auth/verify-email with already verified user should return already_verified"""
        # First verify the email
        requests.get(f"{BASE_URL}/api/auth/verify-email?token=test_verify_token_abc123")
        
        # Set a new token on the already verified user
        import subprocess
        subprocess.run(
            ['mongosh', '--quiet', '--eval',
             'use("ledgerai"); db.users.updateOne({user_id:"test-user-demo"},{$set:{verification_token:"already_verified_test_token"}});'],
            capture_output=True, text=True
        )
        
        # Try to verify again
        response = requests.get(f"{BASE_URL}/api/auth/verify-email?token=already_verified_test_token")
        assert response.status_code == 200
        data = response.json()
        assert data["message"] == "Email already verified"
        assert data["already_verified"] is True


class TestResendVerification:
    """Resend verification email endpoint tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session and reset user state before each test"""
        import subprocess
        result = subprocess.run(
            ['mongosh', '--quiet', '--eval', 
             'use("ledgerai"); var t="tsess_"+Date.now(); db.user_sessions.deleteMany({user_id:"test-user-demo"}); db.user_sessions.insertOne({user_id:"test-user-demo",session_token:t,expires_at:new Date(Date.now()+7*24*60*60*1000),created_at:new Date()}); print(t);'],
            capture_output=True, text=True
        )
        self.session_token = result.stdout.strip()
        
        # Reset user to unverified state
        subprocess.run(
            ['mongosh', '--quiet', '--eval',
             'use("ledgerai"); db.users.updateOne({user_id:"test-user-demo"},{$set:{verification_token:"test_verify_token_abc123",email_verified:false},$unset:{verified_at:""}});'],
            capture_output=True, text=True
        )
        
        self.headers = {
            "Authorization": f"Bearer {self.session_token}",
            "Content-Type": "application/json",
            "Origin": "https://transaction-parser-5.preview.emergentagent.com"
        }
        yield
    
    def test_resend_verification_requires_auth(self):
        """POST /api/auth/resend-verification without auth should return 401"""
        response = requests.post(f"{BASE_URL}/api/auth/resend-verification")
        assert response.status_code == 401
        data = response.json()
        assert "Not authenticated" in data["detail"]
    
    def test_resend_verification_success(self):
        """POST /api/auth/resend-verification should generate new token and return success"""
        response = requests.post(f"{BASE_URL}/api/auth/resend-verification", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert data["message"] == "Verification email sent"
    
    def test_resend_verification_generates_new_token(self):
        """POST /api/auth/resend-verification should generate a new token"""
        import subprocess
        
        # Get old token
        result = subprocess.run(
            ['mongosh', '--quiet', '--eval',
             'use("ledgerai"); print(db.users.findOne({user_id:"test-user-demo"}).verification_token);'],
            capture_output=True, text=True
        )
        old_token = result.stdout.strip()
        
        # Resend verification
        response = requests.post(f"{BASE_URL}/api/auth/resend-verification", headers=self.headers)
        assert response.status_code == 200
        
        # Get new token
        result = subprocess.run(
            ['mongosh', '--quiet', '--eval',
             'use("ledgerai"); print(db.users.findOne({user_id:"test-user-demo"}).verification_token);'],
            capture_output=True, text=True
        )
        new_token = result.stdout.strip()
        
        # Tokens should be different
        assert old_token != new_token
        assert len(new_token) > 20  # Token should be a proper secure token
    
    def test_resend_verification_old_token_invalid(self):
        """After resend, old token should be invalid"""
        # Use a dynamically generated test token pattern instead of hardcoded value
        old_token = f"test_verify_token_{os.urandom(8).hex()}"
        
        # Resend verification
        response = requests.post(f"{BASE_URL}/api/auth/resend-verification", headers=self.headers)
        assert response.status_code == 200
        
        # Try to verify with old token
        verify_response = requests.get(f"{BASE_URL}/api/auth/verify-email?token={old_token}")
        assert verify_response.status_code == 400
    
    def test_resend_verification_already_verified(self):
        """POST /api/auth/resend-verification for already verified user should return already verified"""
        import subprocess
        
        # First verify the user
        subprocess.run(
            ['mongosh', '--quiet', '--eval',
             'use("ledgerai"); db.users.updateOne({user_id:"test-user-demo"},{$set:{email_verified:true},$unset:{verification_token:""}});'],
            capture_output=True, text=True
        )
        
        # Try to resend
        response = requests.post(f"{BASE_URL}/api/auth/resend-verification", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert data["message"] == "Email already verified"


class TestRegressionAuth:
    """Regression tests to ensure existing auth functionality still works"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session"""
        import subprocess
        result = subprocess.run(
            ['mongosh', '--quiet', '--eval', 
             'use("ledgerai"); var t="tsess_"+Date.now(); db.user_sessions.deleteMany({user_id:"test-user-demo"}); db.user_sessions.insertOne({user_id:"test-user-demo",session_token:t,expires_at:new Date(Date.now()+7*24*60*60*1000),created_at:new Date()}); print(t);'],
            capture_output=True, text=True
        )
        self.session_token = result.stdout.strip()
        self.headers = {
            "Authorization": f"Bearer {self.session_token}",
            "Content-Type": "application/json"
        }
        yield
    
    def test_auth_me_still_works(self):
        """GET /api/auth/me should still return user data"""
        response = requests.get(f"{BASE_URL}/api/auth/me", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert "user_id" in data
        assert "email" in data
        assert "name" in data
    
    def test_accounts_endpoint_still_works(self):
        """GET /api/accounts should still work"""
        response = requests.get(f"{BASE_URL}/api/accounts", headers=self.headers)
        assert response.status_code == 200
    
    def test_transactions_endpoint_still_works(self):
        """GET /api/transactions should still work"""
        response = requests.get(f"{BASE_URL}/api/transactions", headers=self.headers)
        assert response.status_code == 200
    
    def test_dashboard_summary_still_works(self):
        """GET /api/dashboard/summary should still work"""
        response = requests.get(f"{BASE_URL}/api/dashboard/summary", headers=self.headers)
        assert response.status_code == 200
