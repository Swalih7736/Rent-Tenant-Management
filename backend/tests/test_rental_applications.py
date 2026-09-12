import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_routes_registered():
    response = client.get("/openapi.json")
    assert response.status_code == 200
    assert "Rental Applications" in response.text
    print("test_routes_registered passed!")


def test_my_rental_overview_unauthorized():
    response = client.get("/api/rental-applications/my-rental/overview")
    assert response.status_code in (401, 403)
    print("test_my_rental_overview_unauthorized passed!")

if __name__ == "__main__":
    test_routes_registered()
    test_my_rental_overview_unauthorized()
    print("All backend tests passed successfully!")

