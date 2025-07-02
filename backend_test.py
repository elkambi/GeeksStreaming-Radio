import requests
import sys
import json
import uuid
from datetime import datetime

class RadioAdminAPITester:
    def __init__(self, base_url="https://ff64b66c-5292-4eb0-834c-111efc959b09.preview.emergentagent.com"):
        self.base_url = base_url
        self.token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_client_id = None
        self.test_stream_id = None

    def run_test(self, name, method, endpoint, expected_status, data=None):
        """Run a single API test"""
        url = f"{self.base_url}{endpoint}"
        headers = {'Content-Type': 'application/json'}
        if self.token:
            headers['Authorization'] = f'Bearer {self.token}'

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    return success, response.json()
                except:
                    return success, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    print(f"Response: {response.json()}")
                except:
                    print(f"Response: {response.text}")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_login(self, username="admin", password="admin123"):
        """Test login and get token"""
        success, response = self.run_test(
            "Login",
            "POST",
            "/api/auth/login",
            200,
            data={"username": username, "password": password}
        )
        if success and 'access_token' in response:
            self.token = response['access_token']
            print(f"Token received: {self.token[:10]}...")
            return True
        return False

    def test_get_current_user(self):
        """Test getting current user info"""
        success, response = self.run_test(
            "Get Current User",
            "GET",
            "/api/auth/me",
            200
        )
        return success

    def test_dashboard_stats(self):
        """Test getting dashboard stats"""
        success, response = self.run_test(
            "Get Dashboard Stats",
            "GET",
            "/api/dashboard/stats",
            200
        )
        if success:
            print(f"Dashboard stats: {json.dumps(response, indent=2)}")
        return success

    def test_recent_activity(self):
        """Test getting recent activity"""
        success, response = self.run_test(
            "Get Recent Activity",
            "GET",
            "/api/dashboard/recent-activity",
            200
        )
        return success

    def test_create_client(self):
        """Test creating a client"""
        client_data = {
            "name": f"Test Client {uuid.uuid4().hex[:8]}",
            "email": f"test{uuid.uuid4().hex[:8]}@example.com",
            "phone": "123-456-7890",
            "company": "Test Company",
            "max_streams": 3,
            "max_listeners": 200,
            "bandwidth_limit": 256
        }
        success, response = self.run_test(
            "Create Client",
            "POST",
            "/api/clients",
            200,
            data=client_data
        )
        if success and 'client' in response:
            self.test_client_id = response['client']['id']
            print(f"Created client with ID: {self.test_client_id}")
            return True
        return False

    def test_get_clients(self):
        """Test getting all clients"""
        success, response = self.run_test(
            "Get All Clients",
            "GET",
            "/api/clients",
            200
        )
        if success:
            print(f"Found {len(response)} clients")
        return success

    def test_get_client(self):
        """Test getting a specific client"""
        if not self.test_client_id:
            print("❌ No test client ID available")
            return False
        
        success, response = self.run_test(
            "Get Client",
            "GET",
            f"/api/clients/{self.test_client_id}",
            200
        )
        return success

    def test_update_client(self):
        """Test updating a client"""
        if not self.test_client_id:
            print("❌ No test client ID available")
            return False
        
        update_data = {
            "name": f"Updated Client {uuid.uuid4().hex[:8]}",
            "max_streams": 5
        }
        success, _ = self.run_test(
            "Update Client",
            "PUT",
            f"/api/clients/{self.test_client_id}",
            200,
            data=update_data
        )
        return success

    def test_create_stream(self):
        """Test creating a stream"""
        if not self.test_client_id:
            print("❌ No test client ID available")
            return False
        
        stream_data = {
            "client_id": self.test_client_id,  # Added client_id to the request body
            "name": f"Test Stream {uuid.uuid4().hex[:8]}",
            "description": "Test stream description",
            "port": 8000 + (uuid.uuid4().int % 1000),  # Random port to avoid conflicts
            "mount_point": "/test-stream",
            "bitrate": 128,
            "max_listeners": 100,
            "format": "mp3"
        }
        success, response = self.run_test(
            "Create Stream",
            "POST",
            f"/api/clients/{self.test_client_id}/streams",
            200,
            data=stream_data
        )
        if success and 'stream' in response:
            self.test_stream_id = response['stream']['id']
            print(f"Created stream with ID: {self.test_stream_id}")
            return True
        return False

    def test_get_streams(self):
        """Test getting all streams"""
        success, response = self.run_test(
            "Get All Streams",
            "GET",
            "/api/streams",
            200
        )
        if success:
            print(f"Found {len(response)} streams")
        return success

    def test_get_client_streams(self):
        """Test getting streams for a specific client"""
        if not self.test_client_id:
            print("❌ No test client ID available")
            return False
        
        success, response = self.run_test(
            "Get Client Streams",
            "GET",
            f"/api/clients/{self.test_client_id}/streams",
            200
        )
        if success:
            print(f"Found {len(response)} streams for client")
        return success

    def test_update_stream(self):
        """Test updating a stream"""
        if not self.test_stream_id:
            print("❌ No test stream ID available")
            return False
        
        update_data = {
            "name": f"Updated Stream {uuid.uuid4().hex[:8]}",
            "bitrate": 192
        }
        success, _ = self.run_test(
            "Update Stream",
            "PUT",
            f"/api/streams/{self.test_stream_id}",
            200,
            data=update_data
        )
        return success

    def test_stream_control(self):
        """Test stream control (start/stop)"""
        if not self.test_stream_id:
            print("❌ No test stream ID available")
            return False
        
        # Start stream
        start_success, _ = self.run_test(
            "Start Stream",
            "POST",
            f"/api/streams/{self.test_stream_id}/start",
            200,
            data={}
        )
        
        # Check stream status
        if start_success:
            success, response = self.run_test(
                "Get Streams After Start",
                "GET",
                "/api/streams",
                200
            )
            if success:
                for stream in response:
                    if stream['id'] == self.test_stream_id:
                        print(f"Stream status after start: {stream['status']}")
        
        # Stop stream
        stop_success, _ = self.run_test(
            "Stop Stream",
            "POST",
            f"/api/streams/{self.test_stream_id}/stop",
            200,
            data={}
        )
        
        return start_success and stop_success

    def test_delete_stream(self):
        """Test deleting a stream"""
        if not self.test_stream_id:
            print("❌ No test stream ID available")
            return False
        
        success, _ = self.run_test(
            "Delete Stream",
            "DELETE",
            f"/api/streams/{self.test_stream_id}",
            200
        )
        if success:
            self.test_stream_id = None
        return success

    def test_delete_client(self):
        """Test deleting a client"""
        if not self.test_client_id:
            print("❌ No test client ID available")
            return False
        
        success, _ = self.run_test(
            "Delete Client",
            "DELETE",
            f"/api/clients/{self.test_client_id}",
            200
        )
        if success:
            self.test_client_id = None
        return success

def main():
    # Get backend URL from frontend .env file
    tester = RadioAdminAPITester()
    
    print("=" * 50)
    print("RADIO ADMIN PANEL API TESTING")
    print("=" * 50)
    
    # Authentication tests
    if not tester.test_login():
        print("❌ Login failed, stopping tests")
        return 1
    
    tester.test_get_current_user()
    
    # Dashboard tests
    tester.test_dashboard_stats()
    tester.test_recent_activity()
    
    # Client management tests
    if not tester.test_create_client():
        print("❌ Client creation failed, stopping tests")
        return 1
    
    tester.test_get_clients()
    tester.test_get_client()
    tester.test_update_client()
    
    # Stream management tests
    if not tester.test_create_stream():
        print("❌ Stream creation failed, stopping tests")
        return 1
    
    tester.test_get_streams()
    tester.test_get_client_streams()
    tester.test_update_stream()
    
    # Stream control tests
    tester.test_stream_control()
    
    # Cleanup
    tester.test_delete_stream()
    tester.test_delete_client()
    
    # Print results
    print("\n" + "=" * 50)
    print(f"TESTS PASSED: {tester.tests_passed}/{tester.tests_run}")
    print("=" * 50)
    
    if tester.tests_passed == tester.tests_run:
        print("\n✅ SUCCESS: All tests passed!")
        print("1. Authentication endpoints work correctly")
        print("2. Dashboard endpoints work correctly")
        print("3. Client creation works correctly")
        print("4. Stream creation works correctly")
        print("5. Stream control (start/stop) works correctly")
    else:
        print(f"\n⚠️ ISSUE SUMMARY: {tester.tests_run - tester.tests_passed} tests failed")
    
    return 0

if __name__ == "__main__":
    sys.exit(main())