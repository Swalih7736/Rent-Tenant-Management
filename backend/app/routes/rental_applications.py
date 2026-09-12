"""
Rental Application, ID Proof Verification, and Tenant Rental Management routes.
"""

import json
import os
import shutil
import uuid
from datetime import date, datetime
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from postgrest.exceptions import APIError

from app.config import get_supabase_client
from app.models import (
    AuthUserOut,
    MonthlyRentScheduleItem,
    MyRentalDetailsOut,
    RentalApplicationOut,
    RentalApplicationReview,
)
from app.services.auth import (
    get_current_user,
    get_optional_current_user,
    require_manager_or_admin,
)
from app.services.tenant_documents import get_uploads_root
from app.services.validation import get_property_or_404


router = APIRouter(prefix="/api/rental-applications", tags=["Rental Applications"])

ALLOWED_ID_EXTENSIONS = {".pdf", ".png", ".jpg", ".jpeg", ".webp"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB

LOCAL_STORAGE_FILE = get_uploads_root() / "rental-applications" / "applications_data.json"


def _ensure_local_storage_dir():
    LOCAL_STORAGE_FILE.parent.mkdir(parents=True, exist_ok=True)
    if not LOCAL_STORAGE_FILE.exists():
        LOCAL_STORAGE_FILE.write_text("[]", encoding="utf-8")


def _read_local_applications() -> list[dict]:
    _ensure_local_storage_dir()
    try:
        return json.loads(LOCAL_STORAGE_FILE.read_text(encoding="utf-8"))
    except Exception:
        return []


def _write_local_applications(apps: list[dict]):
    _ensure_local_storage_dir()
    LOCAL_STORAGE_FILE.write_text(json.dumps(apps, default=str, indent=2), encoding="utf-8")


def _save_app_record(sb, record: dict) -> dict:
    try:
        res = sb.table("rental_applications").insert(record).execute()
        if res.data:
            return res.data[0]
    except Exception as exc:
        print(f"Supabase rental_applications table insert fallback: {exc}")
    
    # Local fallback
    apps = _read_local_applications()
    apps.append(record)
    _write_local_applications(apps)
    return record


def _update_app_record(sb, app_id: str, updates: dict) -> dict:
    updates["updated_at"] = datetime.now().isoformat()
    try:
        res = sb.table("rental_applications").update(updates).eq("id", app_id).execute()
        if res.data:
            return res.data[0]
    except Exception as exc:
        print(f"Supabase rental_applications table update fallback: {exc}")

    # Local fallback
    apps = _read_local_applications()
    updated = None
    for app in apps:
        if app["id"] == app_id:
            app.update(updates)
            updated = app
            break
    if updated:
        _write_local_applications(apps)
        return updated
    raise HTTPException(status_code=404, detail="Rental application not found.")


def _get_app_record(sb, app_id: str) -> dict:
    try:
        res = sb.table("rental_applications").select("*").eq("id", app_id).execute()
        if res.data:
            return res.data[0]
    except Exception:
        pass

    # Local fallback
    apps = _read_local_applications()
    for app in apps:
        if app["id"] == app_id:
            return app
    raise HTTPException(status_code=404, detail="Rental application not found.")


def _list_app_records(sb, filter_fn=None, user_id=None, owner_id=None) -> list[dict]:
    try:
        query = sb.table("rental_applications").select("*")
        if user_id:
            query = query.eq("user_id", user_id)
        if owner_id:
            query = query.eq("owner_id", owner_id)
        res = query.order("created_at", desc=True).execute()
        if res.data:
            return res.data
    except Exception:
        pass

    # Local fallback
    apps = _read_local_applications()
    if user_id:
        apps = [a for a in apps if a.get("user_id") == user_id]
    if owner_id:
        apps = [a for a in apps if a.get("owner_id") == owner_id]
    if filter_fn:
        apps = [a for a in apps if filter_fn(a)]
    return sorted(apps, key=lambda x: str(x.get("created_at", "")), reverse=True)


def _enrich_application(sb, app_row: dict) -> dict:
    enriched = dict(app_row)
    
    # 1. Fetch Property
    prop_id = enriched.get("property_id")
    if prop_id:
        try:
            prop_res = sb.table("properties").select("*").eq("id", prop_id).execute()
            if prop_res.data:
                enriched["property"] = prop_res.data[0]
        except Exception:
            pass

    # 2. Fetch Listing (if any)
    listing_id = enriched.get("listing_id")
    if listing_id:
        try:
            list_res = sb.table("listings").select("*").eq("id", listing_id).execute()
            if list_res.data:
                enriched["listing"] = list_res.data[0]
        except Exception:
            pass

    # 3. Fetch Owner
    owner_id = enriched.get("owner_id")
    if owner_id:
        try:
            owner_res = sb.table("app_users").select("id, full_name, email, phone, role").eq("id", owner_id).execute()
            if owner_res.data:
                enriched["owner"] = owner_res.data[0]
        except Exception:
            pass

    # 4. Fetch Applicant
    user_id = enriched.get("user_id")
    if user_id:
        try:
            user_res = sb.table("app_users").select("id, full_name, email, phone, role").eq("id", user_id).execute()
            if user_res.data:
                enriched["applicant"] = user_res.data[0]
        except Exception:
            pass

    return enriched


# ── 1. Submit Rental Application (with Mandatory ID Proof) ───────────
@router.post("", response_model=RentalApplicationOut)
@router.post("/", response_model=RentalApplicationOut)
async def submit_rental_application(
    property_id: Optional[str] = Form(default=None),
    listing_id: Optional[str] = Form(default=None),
    full_name: str = Form(...),
    email: str = Form(...),
    phone: str = Form(...),
    address: Optional[str] = Form(default=None),
    date_of_birth: Optional[str] = Form(default=None),
    occupation: Optional[str] = Form(default=None),
    monthly_income: Optional[float] = Form(default=None),
    emergency_contact_name: Optional[str] = Form(default=None),
    emergency_contact_phone: Optional[str] = Form(default=None),
    lease_start: str = Form(...),
    lease_end: Optional[str] = Form(default=None),
    unit_number: Optional[str] = Form(default=None),
    rent_amount: float = Form(...),
    rent_due_day: int = Form(default=1),
    id_proof: UploadFile = File(...),
    current_user: Optional[AuthUserOut] = Depends(get_optional_current_user),
):
    """
    Submit a rental application for a property or marketplace listing with mandatory ID proof upload.
    Initial status is 'Pending' with verification status 'Submitted'.
    """
    sb = get_supabase_client()

    # 0. Resolve applicant user ID (from auth or lookup/create by email)
    applicant_user_id = current_user.id if current_user else None
    if not applicant_user_id:
        try:
            u_check = sb.table("app_users").select("id").eq("email", email.strip().lower()).limit(1).execute()
            if u_check.data:
                applicant_user_id = u_check.data[0]["id"]
            else:
                new_uid = str(uuid.uuid4())
                sb.table("app_users").insert({
                    "id": new_uid,
                    "email": email.strip().lower(),
                    "full_name": full_name.strip(),
                    "phone": phone.strip(),
                    "role": "user",
                    "is_active": True
                }).execute()
                applicant_user_id = new_uid
        except Exception:
            applicant_user_id = str(uuid.uuid4())

    # 1. Validate property existence & find owner
    owner_id = None
    prop = None
    target_prop_id = property_id

    if target_prop_id:
        try:
            prop_res = sb.table("properties").select("*").eq("id", target_prop_id).execute()
            if prop_res.data:
                prop = prop_res.data[0]
                owner_id = prop.get("owner_id")
        except Exception:
            pass

    target_listing_id = listing_id or (target_prop_id if not prop else None)
    if target_listing_id:
        try:
            list_res = sb.table("listings").select("*").eq("id", target_listing_id).execute()
            if list_res.data:
                listing_data = list_res.data[0]
                owner_id = listing_data.get("seller_id")
                listing_id = target_listing_id

                # If no existing property was found, link or create one for this listing
                if not prop:
                    title_address = listing_data.get("title") or "Marketplace Rental Unit"
                    try:
                        p_check = sb.table("properties").select("*").eq("address", title_address).limit(1).execute()
                        if p_check.data:
                            prop = p_check.data[0]
                            target_prop_id = prop["id"]
                        else:
                            p_ins = sb.table("properties").insert({
                                "address": title_address,
                                "total_units": 1,
                                "rent_amount": float(rent_amount or listing_data.get("price") or 10000),
                                "owner_id": owner_id,
                                "note": "Auto-created from marketplace listing"
                            }).execute()
                            if p_ins.data:
                                prop = p_ins.data[0]
                                target_prop_id = prop["id"]
                    except Exception:
                        pass
        except Exception:
            pass

    if not owner_id:
        # Fallback to admin or system owner
        try:
            admin_res = sb.table("app_users").select("id").eq("role", "admin").limit(1).execute()
            owner_id = admin_res.data[0]["id"] if admin_res.data else applicant_user_id
        except Exception:
            owner_id = applicant_user_id

    if not target_prop_id:
        target_prop_id = str(uuid.uuid4())


    # 2. Validate mandatory ID proof file
    original_filename = id_proof.filename or ""
    ext = Path(original_filename).suffix.lower()
    if ext not in ALLOWED_ID_EXTENSIONS:
        allowed = ", ".join(sorted(ALLOWED_ID_EXTENSIONS))
        raise HTTPException(
            status_code=400,
            detail=f"Invalid ID proof file format: '{ext}'. Allowed formats: {allowed}.",
        )

    content = await id_proof.read()
    if not content:
        raise HTTPException(status_code=400, detail="Uploaded ID proof document is empty.")
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="ID proof document must be 10 MB or smaller.")

    # 3. Store ID proof file securely under uploads/rental-applications/<app_id>
    app_id = str(uuid.uuid4())
    app_dir = get_uploads_root() / "rental-applications" / app_id
    app_dir.mkdir(parents=True, exist_ok=True)

    stored_file_name = f"id_proof_{uuid.uuid4().hex[:12]}{ext}"
    target_path = app_dir / stored_file_name
    target_path.write_bytes(content)

    id_proof_url = f"/uploads/rental-applications/{app_id}/{stored_file_name}"

    # 4. Create application record
    now_iso = datetime.now().isoformat()
    record = {
        "id": app_id,
        "user_id": applicant_user_id,
        "property_id": target_prop_id,
        "listing_id": listing_id or None,
        "owner_id": owner_id,


        "full_name": full_name.strip(),
        "email": email.strip().lower(),
        "phone": phone.strip(),
        "address": address.strip() if address else None,
        "date_of_birth": date_of_birth if date_of_birth else None,
        "occupation": occupation.strip() if occupation else None,
        "monthly_income": monthly_income,
        "emergency_contact_name": emergency_contact_name.strip() if emergency_contact_name else None,
        "emergency_contact_phone": emergency_contact_phone.strip() if emergency_contact_phone else None,
        "lease_start": lease_start,
        "lease_end": lease_end if lease_end else None,
        "unit_number": unit_number.strip() if unit_number else "Unit-1",
        "rent_amount": rent_amount,
        "rent_due_day": max(1, min(31, int(rent_due_day or 1))),
        "id_proof_file_name": original_filename,
        "id_proof_file_url": id_proof_url,
        "status": "Pending",
        "id_verification_status": "Submitted",
        "rejection_reason": None,
        "created_at": now_iso,
        "updated_at": now_iso,
    }

    saved = _save_app_record(sb, record)

    # 5. Automatically create or link Tenant record using the submitted application
    try:
        tenant_name = full_name.strip()
        tenant_email = email.strip().lower()
        tenant_phone = phone.strip()
        assigned_unit = unit_number.strip() if unit_number else "Unit-1"
        
        # Check if tenant exists
        t_check = sb.table("tenants").select("*").eq("property_id", target_prop_id).eq("email", tenant_email).execute()
        if t_check.data:
            t_id = t_check.data[0]["id"]
            sb.table("tenants").update({
                "name": tenant_name,
                "phone": tenant_phone,
                "unit_number": assigned_unit,
                "lease_start": lease_start,
                "lease_end": lease_end if lease_end else None,
                "status": "active",
                "proof_file_url": id_proof_url,
                "proof_file_name": original_filename,
                "user_id": applicant_user_id
            }).eq("id", t_id).execute()
        else:
            sb.table("tenants").insert({
                "property_id": target_prop_id,
                "name": tenant_name,
                "email": tenant_email,
                "phone": tenant_phone,
                "unit_number": assigned_unit,
                "lease_start": lease_start,
                "lease_end": lease_end if lease_end else None,
                "status": "active",
                "proof_file_url": id_proof_url,
                "proof_file_name": original_filename,
                "user_id": applicant_user_id
            }).execute()


        # Update listing status to RENTED if applying from a listing
        if listing_id:
            try:
                sb.table("listings").update({"status": "RENTED"}).eq("id", listing_id).execute()
            except Exception:
                pass
    except Exception as e:
        print(f"Tenant auto-creation notice: {e}")

    return _enrich_application(sb, saved)



# ── 2. Get Current User's Applications ────────────────────────────────
@router.get("/my", response_model=list[RentalApplicationOut])
async def list_my_applications(current_user: AuthUserOut = Depends(get_current_user)):
    """Return all rental applications submitted by the current user."""
    sb = get_supabase_client()
    apps = _list_app_records(sb, user_id=current_user.id)
    return [_enrich_application(sb, a) for a in apps]


# ── 3. Get Owner's Incoming Rental Requests ───────────────────────────
@router.get("/owner-requests", response_model=list[RentalApplicationOut])
async def list_owner_rental_requests(
    status: Optional[str] = Query(default=None),
    current_user: AuthUserOut = Depends(get_current_user),
):
    """
    Return all rental requests for properties owned by the current owner.
    Admins can view all applications.
    """
    sb = get_supabase_client()
    user_role = (current_user.role or "").lower()

    if user_role == "admin":
        apps = _list_app_records(sb)
    elif user_role in ("owner", "manager"):
        # Fetch properties owned by owner
        prop_res = sb.table("properties").select("id").eq("owner_id", current_user.id).execute()
        owned_ids = set(p["id"] for p in prop_res.data) if prop_res.data else set()

        apps = _list_app_records(
            sb,
            filter_fn=lambda a: a.get("owner_id") == current_user.id or a.get("property_id") in owned_ids
        )
    else:
        raise HTTPException(status_code=403, detail="Owner or Admin access required.")

    if status:
        apps = [a for a in apps if a.get("status", "").lower() == status.lower()]

    return [_enrich_application(sb, a) for a in apps]


# ── 4. Get Single Application Details ─────────────────────────────────
@router.get("/{app_id}", response_model=RentalApplicationOut)
async def get_rental_application_detail(
    app_id: str,
    current_user: AuthUserOut = Depends(get_current_user),
):
    """Return application details with strict ownership access control."""
    sb = get_supabase_client()
    app_row = _get_app_record(sb, app_id)

    user_role = (current_user.role or "").lower()
    is_applicant = app_row.get("user_id") == current_user.id
    is_owner = app_row.get("owner_id") == current_user.id
    is_admin = user_role == "admin"

    if not (is_applicant or is_owner or is_admin):
        raise HTTPException(status_code=403, detail="Access denied to this application.")

    return _enrich_application(sb, app_row)


# ── 5. Owner Approves Rental Application ──────────────────────────────
@router.post("/{app_id}/approve", response_model=RentalApplicationOut)
async def approve_rental_application(
    app_id: str,
    review: Optional[RentalApplicationReview] = None,
    current_user: AuthUserOut = Depends(get_current_user),
):
    """
    Owner or Admin approves application:
    1. Sets application status to 'Approved' and ID verification to 'Verified'.
    2. Creates or links the active tenant record.
    3. Updates property/listing status to 'RENTED'.
    4. Makes active rental visible on User Dashboard.
    """
    sb = get_supabase_client()
    app_row = _get_app_record(sb, app_id)

    user_role = (current_user.role or "").lower()
    if not (app_row.get("owner_id") == current_user.id or user_role in ("admin", "manager", "owner")):
        raise HTTPException(status_code=403, detail="Only the property owner or admin can approve applications.")

    # Override custom fields if provided in review
    lease_start = review.lease_start.isoformat() if review and review.lease_start else app_row.get("lease_start")
    lease_end = review.lease_end.isoformat() if review and review.lease_end else app_row.get("lease_end")
    unit_number = review.unit_number if review and review.unit_number else app_row.get("unit_number")
    rent_amount = review.rent_amount if review and review.rent_amount is not None else app_row.get("rent_amount")
    rent_due_day = review.rent_due_day if review and review.rent_due_day is not None else app_row.get("rent_due_day", 1)

    # 1. Update Application record
    updated_app = _update_app_record(sb, app_id, {
        "status": "Approved",
        "id_verification_status": "Verified",
        "rejection_reason": None,
        "unit_number": unit_number,
        "rent_amount": rent_amount,
        "rent_due_day": rent_due_day,
        "lease_start": lease_start,
        "lease_end": lease_end,
    })

    # 2. Create or Link Tenant Record
    property_id = app_row.get("property_id")
    tenant_email = app_row.get("email")
    tenant_user_id = app_row.get("user_id")

    # Check existing active tenant
    existing_tenant = None
    try:
        t_res = sb.table("tenants").select("*").eq("property_id", property_id).eq("email", tenant_email).execute()
        if t_res.data:
            existing_tenant = t_res.data[0]
    except Exception:
        pass

    tenant_payload = {
        "name": app_row.get("full_name"),
        "email": tenant_email,
        "phone": app_row.get("phone"),
        "property_id": property_id,
        "unit_number": unit_number,
        "lease_start": lease_start,
        "lease_end": lease_end,
        "status": "active",
        "rent_due_day": rent_due_day,
        "proof_file_name": app_row.get("id_proof_file_name"),
        "proof_file_url": app_row.get("id_proof_file_url"),
        "outstanding_dues": 0,
    }

    try:
        if existing_tenant:
            sb.table("tenants").update(tenant_payload).eq("id", existing_tenant["id"]).execute()
        else:
            sb.table("tenants").insert(tenant_payload).execute()
    except Exception as exc:
        print(f"Tenant table sync notice: {exc}")

    # 3. Update Property status to RENTED
    try:
        sb.table("properties").update({"status": "RENTED"}).eq("id", property_id).execute()
    except Exception:
        pass

    # 4. If listing exists, update listing status to RENTED
    if app_row.get("listing_id"):
        try:
            sb.table("listings").update({"status": "RENTED"}).eq("id", app_row["listing_id"]).execute()
        except Exception:
            pass

    return _enrich_application(sb, updated_app)


# ── 6. Owner Rejects Rental Application ───────────────────────────────
@router.post("/{app_id}/reject", response_model=RentalApplicationOut)
async def reject_rental_application(
    app_id: str,
    review: Optional[RentalApplicationReview] = None,
    current_user: AuthUserOut = Depends(get_current_user),
):
    """Owner or Admin rejects application with optional reason."""
    sb = get_supabase_client()
    app_row = _get_app_record(sb, app_id)

    user_role = (current_user.role or "").lower()
    if not (app_row.get("owner_id") == current_user.id or user_role in ("admin", "manager", "owner")):
        raise HTTPException(status_code=403, detail="Only the property owner or admin can reject applications.")

    rejection_reason = review.rejection_reason if review and review.rejection_reason else "Application criteria did not meet requirements."

    updated_app = _update_app_record(sb, app_id, {
        "status": "Rejected",
        "id_verification_status": "Rejected",
        "rejection_reason": rejection_reason,
    })

    return _enrich_application(sb, updated_app)


# ── 7. Resubmit ID Proof ──────────────────────────────────────────────
@router.post("/{app_id}/resubmit-id", response_model=RentalApplicationOut)
async def resubmit_application_id_proof(
    app_id: str,
    id_proof: UploadFile = File(...),
    current_user: AuthUserOut = Depends(get_current_user),
):
    """User uploads a new ID proof document for an application."""
    sb = get_supabase_client()
    app_row = _get_app_record(sb, app_id)

    if app_row.get("user_id") != current_user.id:
        raise HTTPException(status_code=403, detail="You can only resubmit ID for your own application.")

    original_filename = id_proof.filename or ""
    ext = Path(original_filename).suffix.lower()
    if ext not in ALLOWED_ID_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Invalid file format.")

    content = await id_proof.read()
    if not content or len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="Invalid file size or content.")

    app_dir = get_uploads_root() / "rental-applications" / app_id
    app_dir.mkdir(parents=True, exist_ok=True)
    stored_file_name = f"id_proof_{uuid.uuid4().hex[:12]}{ext}"
    (app_dir / stored_file_name).write_bytes(content)

    new_url = f"/uploads/rental-applications/{app_id}/{stored_file_name}"

    updated_app = _update_app_record(sb, app_id, {
        "id_proof_file_name": original_filename,
        "id_proof_file_url": new_url,
        "id_verification_status": "Submitted",
        "status": "Under Review" if app_row.get("status") == "Rejected" else app_row.get("status"),
        "rejection_reason": None,
    })

    return _enrich_application(sb, updated_app)


# ── 8. User Active Rental & Monthly Payment Status ────────────────────
@router.get("/my-rental/overview", response_model=MyRentalDetailsOut)
async def get_my_rental_details(current_user: AuthUserOut = Depends(get_current_user)):
    """
    Return the logged-in user's active rental property details:
    - Property name, image, address, unit number
    - Owner name and contact info
    - Monthly rent amount, rent due date, lease start and end dates
    - Complete Monthly Rent Payment Status table (PAID, PENDING, OVERDUE, UPCOMING)
    - Recent applications
    """
    sb = get_supabase_client()

    # 1. Fetch user's applications
    user_apps = _list_app_records(sb, user_id=current_user.id)
    enriched_apps = [_enrich_application(sb, a) for a in user_apps]

    # 2. Find active tenant record matching current user's email or user_id
    active_tenant = None
    try:
        t_res = sb.table("tenants").select("*").eq("email", current_user.email).eq("status", "active").execute()
        if t_res.data:
            active_tenant = t_res.data[0]
    except Exception:
        pass

    if not active_tenant:
        # Check approved rental application
        approved_apps = [a for a in user_apps if a.get("status") in ("Approved", "Active")]
        if approved_apps:
            latest_approved = approved_apps[0]
            # Construct active tenant representation from approved application
            active_tenant = {
                "id": latest_approved.get("id"),
                "name": latest_approved.get("full_name"),
                "email": latest_approved.get("email"),
                "phone": latest_approved.get("phone"),
                "property_id": latest_approved.get("property_id"),
                "unit_number": latest_approved.get("unit_number") or "Unit-1",
                "lease_start": latest_approved.get("lease_start"),
                "lease_end": latest_approved.get("lease_end"),
                "status": "active",
                "rent_due_day": latest_approved.get("rent_due_day", 1),
            }

    if not active_tenant:
        return MyRentalDetailsOut(
            has_active_rental=False,
            applications=enriched_apps,
        )

    # 3. Fetch linked Property
    property_id = active_tenant.get("property_id")
    property_data = None
    if property_id:
        try:
            prop_res = sb.table("properties").select("*").eq("id", property_id).execute()
            if prop_res.data:
                property_data = prop_res.data[0]
        except Exception:
            pass

    # 4. Fetch Owner details
    owner_data = None
    owner_id = property_data.get("owner_id") if property_data else None
    if not owner_id and user_apps:
        owner_id = user_apps[0].get("owner_id")
        
    if owner_id:
        try:
            owner_res = sb.table("app_users").select("id, full_name, email, phone, role").eq("id", owner_id).execute()
            if owner_res.data:
                owner_data = owner_res.data[0]
        except Exception:
            pass

    if not owner_data:
        owner_data = {
            "full_name": "Property Management Office",
            "email": "support@rentflow.com",
            "phone": "+1 (555) 019-2834",
        }

    # 5. Fetch linked Payments
    payments_list = []
    try:
        p_res = sb.table("payments").select("*").eq("tenant_id", active_tenant.get("id")).execute()
        if p_res.data:
            payments_list = p_res.data
    except Exception:
        pass

    # Index payments by month_covered
    payments_by_month = {}
    for p in payments_list:
        m = p.get("month_covered")
        if m:
            payments_by_month[m] = p

    # 6. Calculate monthly payment schedule
    # Generate 6 months timeline: 3 previous months, current month, 2 upcoming months
    today = date.today()
    current_year = today.year
    current_month = today.month
    rent_due_day = int(active_tenant.get("rent_due_day") or 1)
    monthly_rent = float(
        (property_data.get("rent_amount") if property_data else None)
        or active_tenant.get("rent_amount")
        or 10000.0
    )

    schedule: list[MonthlyRentScheduleItem] = []

    
    for offset in range(-3, 3):
        # Calculate target month & year
        target_month_val = current_month + offset
        target_year = current_year
        while target_month_val <= 0:
            target_month_val += 12
            target_year -= 1
        while target_month_val > 12:
            target_month_val -= 12
            target_year += 1

        month_str = f"{target_year:04d}-{target_month_val:02d}"
        month_date_obj = date(target_year, target_month_val, 1)
        month_label = month_date_obj.strftime("%B %Y")
        
        # Calculate exact due date
        due_day_clamped = min(rent_due_day, 28)
        due_date_str = f"{target_year:04d}-{target_month_val:02d}-{due_day_clamped:02d}"
        due_date_obj = date(target_year, target_month_val, due_day_clamped)

        # Check payment record
        payment_record = payments_by_month.get(month_str)

        if payment_record and float(payment_record.get("amount_paid", 0)) >= monthly_rent:
            status = "PAID"
            payment_date = str(payment_record.get("payment_date", ""))
            amount_paid = float(payment_record.get("amount_paid", 0))
            payment_id = payment_record.get("id")
        elif payment_record and float(payment_record.get("amount_paid", 0)) > 0:
            status = "PARTIALLY_PAID" if today <= due_date_obj else "OVERDUE"
            payment_date = str(payment_record.get("payment_date", ""))
            amount_paid = float(payment_record.get("amount_paid", 0))
            payment_id = payment_record.get("id")
        else:
            payment_date = None
            amount_paid = 0.0
            payment_id = None
            if month_date_obj > date(current_year, current_month, 1):
                status = "UPCOMING"
            elif month_str == f"{current_year:04d}-{current_month:02d}":
                status = "OVERDUE" if today > due_date_obj else "PENDING"
            else:
                status = "OVERDUE"

        schedule.append(MonthlyRentScheduleItem(
            month=month_str,
            month_label=month_label,
            rent_amount=monthly_rent,
            due_date=due_date_str,
            status=status,
            payment_date=payment_date,
            amount_paid=amount_paid,
            payment_id=payment_id,
        ))

    # Determine next due date and current month status
    current_month_str = f"{current_year:04d}-{current_month:02d}"
    current_item = next((s for s in schedule if s.month == current_month_str), None)
    current_month_status = current_item.status if current_item else "PENDING"
    next_due_date = f"{current_year:04d}-{current_month:02d}-{min(rent_due_day, 28):02d}"

    return MyRentalDetailsOut(
        has_active_rental=True,
        tenant=active_tenant,
        property=property_data,
        owner=owner_data,
        monthly_rent=monthly_rent,
        rent_due_day=rent_due_day,
        next_due_date=next_due_date,
        current_month_status=current_month_status,
        payment_schedule=schedule,
        applications=enriched_apps,
    )
