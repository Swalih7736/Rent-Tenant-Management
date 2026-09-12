import io
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from fastapi.testclient import TestClient
from app.main import app
from app.models import AuthUserOut
from app.services.auth import get_current_user

client = TestClient(app)

def test_full_rental_application_and_dashboard_flow():
    # 1. Setup mock user and owner
    mock_user = AuthUserOut(
        id="11111111-2222-3333-4444-555555555555",
        email="testtenant@example.com",
        full_name="Test Tenant",
        role="user",
        is_active=True,
        phone="+91 9876543210",
        company_or_agency=None,
    )
    mock_owner = AuthUserOut(
        id="99999999-8888-7777-6666-555555555555",
        email="testowner@example.com",
        full_name="Test Admin Owner",
        role="admin",
        is_active=True,
        phone="+91 9876500000",
        company_or_agency="Owner Corp",
    )


    # 2. Check overview before application as user
    app.dependency_overrides[get_current_user] = lambda: mock_user
    res = client.get("/api/rental-applications/my-rental/overview")
    assert res.status_code == 200
    data = res.json()
    assert "has_active_rental" in data

    # 3. Submit rental application with mock ID proof
    fake_id_content = b"%PDF-1.4 mock pdf identity proof content"
    files = {
        "id_proof": ("my_aadhaar_passport.pdf", io.BytesIO(fake_id_content), "application/pdf")
    }
    form_data = {
        "property_id": "4808cca1-7625-452e-8e1c-e5e7e53c6527",
        "full_name": "Test Tenant",
        "email": "testtenant@example.com",
        "phone": "+91 9876543210",
        "address": "456 Avenue Rd",
        "occupation": "Engineer",
        "monthly_income": "75000",
        "lease_start": "2026-08-01",
        "lease_end": "2027-07-31",
        "unit_number": "A-102",
        "rent_amount": "12000",
        "rent_due_day": "5",
    }


    res_app = client.post("/api/rental-applications/", data=form_data, files=files)
    assert res_app.status_code == 200
    app_data = res_app.json()
    assert app_data["status"] == "Pending"
    assert app_data["id_verification_status"] == "Submitted"
    assert "id_proof_file_url" in app_data
    app_id = app_data["id"]

    # 4. Owner lists requests
    app.dependency_overrides[get_current_user] = lambda: mock_owner
    res_reqs = client.get("/api/rental-applications/owner-requests")
    assert res_reqs.status_code == 200
    reqs = res_reqs.json()
    assert any(r["id"] == app_id for r in reqs)

    # 5. Owner approves application
    approve_payload = {
        "status": "Approved",
        "unit_number": "A-102",
        "rent_amount": 12000,
        "rent_due_day": 5
    }
    res_approve = client.post(f"/api/rental-applications/{app_id}/approve", json=approve_payload)
    assert res_approve.status_code == 200
    approved_data = res_approve.json()
    assert approved_data["status"] == "Approved"
    assert approved_data["id_verification_status"] == "Verified"

    # 6. User checks "My Rental Property" overview
    app.dependency_overrides[get_current_user] = lambda: mock_user
    res_overview = client.get("/api/rental-applications/my-rental/overview")
    assert res_overview.status_code == 200
    overview = res_overview.json()
    assert overview["has_active_rental"] is True
    assert overview["tenant"]["name"] == "Test Tenant"
    assert len(overview["payment_schedule"]) == 6

    # Verify payment statuses (PAID, PENDING, OVERDUE, UPCOMING) are present
    statuses = [s["status"] for s in overview["payment_schedule"]]
    assert any(s in ("PENDING", "OVERDUE", "UPCOMING", "PAID") for s in statuses)

    # Reset overrides
    app.dependency_overrides.clear()
    print("Full rental application and dashboard flow passed successfully!")


if __name__ == "__main__":
    test_full_rental_application_and_dashboard_flow()
