"""
CRUD routes for Payments.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from postgrest.exceptions import APIError
from app.config import get_supabase_client
from app.models import AuthUserOut, PaymentCreate, PaymentOut, PaymentUpdate, OrderCreate, OrderOut
from app.services.auth import get_current_user, require_manager_or_admin
from app.services.validation import (
    ensure_non_empty_text,
    ensure_unique_payment_for_month,
    get_payment_or_404,
    get_tenant_or_404,
    get_property_or_404,
    normalize_optional_text,
)


router = APIRouter(prefix="/api/payments", tags=["Payments"])

TABLE = "payments"


def _is_missing_note_column_error(exc: APIError) -> bool:
    message = getattr(exc, "message", "") or ""
    code = getattr(exc, "code", "") or ""
    return code == "PGRST204" and "'note' column" in message and "'payments'" in message


def _is_missing_payment_type_column_error(exc: APIError) -> bool:
    message = getattr(exc, "message", "") or ""
    code = getattr(exc, "code", "") or ""
    return code == "PGRST204" and "'payment_type' column" in message and "'payments'" in message


def _is_duplicate_payment_error(exc: APIError) -> bool:
    message = getattr(exc, "message", "") or ""
    code = getattr(exc, "code", "") or ""
    return code == "23505" and "tenant_id" in message and "month_covered" in message


def _note_requires_migration(data: dict) -> bool:
    return data.get("note") is not None


def _payment_type_requires_migration(data: dict) -> bool:
    return data.get("payment_type", "rent") != "rent"


def _normalize_payment_payload(data: dict) -> dict:
    if "tenant_id" in data and data["tenant_id"] is not None:
        data["tenant_id"] = ensure_non_empty_text(data["tenant_id"], "Tenant")
    if "month_covered" in data and data["month_covered"] is not None:
        data["month_covered"] = ensure_non_empty_text(data["month_covered"], "Month covered")
    if "payment_type" in data and data["payment_type"] is not None:
        data["payment_type"] = ensure_non_empty_text(data["payment_type"], "Payment type").lower()
    if "note" in data:
        data["note"] = normalize_optional_text(data.get("note"))
    return data


def _insert_or_update_payment(sb, data: dict, payment_id: str | None = None):
    operation = sb.table(TABLE).insert(data) if payment_id is None else sb.table(TABLE).update(data).eq("id", payment_id)
    try:
        return operation.execute()
    except APIError as exc:
        if _is_duplicate_payment_error(exc):
            raise HTTPException(
                status_code=409,
                detail="A payment for this tenant and month already exists.",
            ) from exc

        if _is_missing_payment_type_column_error(exc) and "payment_type" in data:
            if _payment_type_requires_migration(data):
                raise HTTPException(
                    status_code=409,
                    detail="Advance payments require the database migration before they can be saved.",
                ) from exc
            fallback_data = {key: value for key, value in data.items() if key != "payment_type"}
            return _insert_or_update_payment(sb, fallback_data, payment_id)

        if _is_missing_note_column_error(exc) and "note" in data:
            if _note_requires_migration(data):
                raise HTTPException(
                    status_code=409,
                    detail="Payment notes require the database migration before they can be saved.",
                ) from exc
            fallback_data = {key: value for key, value in data.items() if key != "note"}
            return _insert_or_update_payment(sb, fallback_data, payment_id)

        raise


@router.get("/", response_model=list[PaymentOut])
async def list_payments(
    tenant_id: str | None = Query(default=None),
    month_covered: str | None = Query(default=None),
    current_user: AuthUserOut = Depends(get_current_user),
):
    """Return all payments, optionally filtered by tenant or month."""
    sb = get_supabase_client()
    query = sb.table(TABLE).select("*")

    if current_user.role.lower() == "user":
        if not current_user.email:
            return []
        user_tenants = sb.table("tenants").select("id").eq("email", current_user.email.strip().lower()).execute()
        t_ids = [t["id"] for t in user_tenants.data] if user_tenants.data else []
        if not t_ids:
            return []
        query = query.in_("tenant_id", t_ids)

    elif current_user.role.lower() in ("owner", "manager"):
        # Fetch properties owned by current_user
        prop_res = sb.table("properties").select("id").eq("owner_id", current_user.id).execute()
        owned_property_ids = [p["id"] for p in prop_res.data] if prop_res.data else []
        if owned_property_ids:
            ten_res = sb.table("tenants").select("id").in_("property_id", owned_property_ids).execute()
            t_ids = [t["id"] for t in ten_res.data] if ten_res.data else []
            if t_ids:
                query = query.in_("tenant_id", t_ids)

    if tenant_id:
        query = query.eq("tenant_id", tenant_id)
    if month_covered:
        query = query.eq("month_covered", month_covered)
    result = query.order("payment_date", desc=True).execute()
    return result.data



@router.get("/{payment_id}", response_model=PaymentOut)
async def get_payment(payment_id: str, _: AuthUserOut = Depends(get_current_user)):
    """Return a single payment by ID."""
    sb = get_supabase_client()
    return get_payment_or_404(sb, payment_id)


@router.post("/", response_model=PaymentOut, status_code=201)
async def create_payment(
    payload: PaymentCreate,
    _: AuthUserOut = Depends(require_manager_or_admin),
):
    """Record a new payment."""
    sb = get_supabase_client()
    data = _normalize_payment_payload(payload.model_dump(exclude_none=True))
    get_tenant_or_404(sb, data["tenant_id"])
    ensure_unique_payment_for_month(sb, data["tenant_id"], data["month_covered"])
    if data.get("payment_date"):
        data["payment_date"] = data["payment_date"].isoformat()
    result = _insert_or_update_payment(sb, data)
    return result.data[0]


@router.put("/{payment_id}", response_model=PaymentOut)
async def update_payment(
    payment_id: str,
    payload: PaymentUpdate,
    _: AuthUserOut = Depends(require_manager_or_admin),
):
    """Update an existing payment."""
    sb = get_supabase_client()
    existing = get_payment_or_404(sb, payment_id)
    data = _normalize_payment_payload(payload.model_dump(exclude_none=True))
    if not data:
        raise HTTPException(status_code=400, detail="No fields to update")
    new_tenant_id = data.get("tenant_id", existing["tenant_id"])
    new_month_covered = data.get("month_covered", existing["month_covered"])
    get_tenant_or_404(sb, new_tenant_id)
    ensure_unique_payment_for_month(
        sb,
        new_tenant_id,
        new_month_covered,
        exclude_payment_id=payment_id,
    )
    if data.get("payment_date"):
        data["payment_date"] = data["payment_date"].isoformat()
    result = _insert_or_update_payment(sb, data, payment_id)
    if not result.data:
        raise HTTPException(status_code=404, detail="Payment not found")
    return result.data[0]


@router.delete("/{payment_id}", status_code=204)
async def delete_payment(
    payment_id: str,
    current_user: AuthUserOut = Depends(require_manager_or_admin),
):
    """Delete a payment."""
    sb = get_supabase_client()
    existing = get_payment_or_404(sb, payment_id)
    if current_user.role.lower() in ("owner", "manager"):
        tenant = get_tenant_or_404(sb, existing["tenant_id"])
        prop = get_property_or_404(sb, tenant["property_id"])
        if prop.get("owner_id") != current_user.id:
            raise HTTPException(status_code=403, detail="Access denied.")
            
    sb.table(TABLE).delete().eq("id", payment_id).execute()
    return None


@router.post("/create-order", response_model=OrderOut)
async def create_checkout_order(
    payload: OrderCreate,
    current_user: AuthUserOut = Depends(get_current_user),
):
    """Generate checkout sessions and pending orders."""
    sb = get_supabase_client()
    
    item_type = payload.item_type.upper()
    transaction_type = "BUY" if payload.transaction_type.upper() in ("BUY", "SALE") else "RENT"

    # 1. Fetch item to get the seller's/owner's ID
    seller_id = None
    if item_type == "PROPERTY":
        prop = get_property_or_404(sb, payload.item_id)
        seller_id = prop.get("owner_id")
    else:  # LISTING
        list_res = sb.table("listings").select("seller_id").eq("id", payload.item_id).execute()
        if not list_res.data:
            raise HTTPException(status_code=404, detail="Listing not found.")
        seller_id = list_res.data[0]["seller_id"]

    if not seller_id:
        admin_res = sb.table("app_users").select("id").eq("role", "admin").limit(1).execute()
        seller_id = admin_res.data[0]["id"] if admin_res.data else current_user.id

    # 2. Build order dict
    order_data = {
        "seller_id": seller_id,
        "buyer_id": current_user.id,
        "item_type": item_type,
        "item_id": payload.item_id,
        "transaction_type": transaction_type,
        "amount": payload.amount,
        "payment_status": "PENDING"
    }

    # 2. Create a real Razorpay order (amount in paise = rupees × 100)
    from app.config import get_razorpay_client, get_settings
    import uuid as _uuid

    rzp_order_id: str
    try:
        rz_client = get_razorpay_client()
        rz_order = rz_client.order.create({
            "amount": int(payload.amount * 100),   # Razorpay expects paise
            "currency": "INR",
            "receipt": f"rent_{_uuid.uuid4().hex[:12]}",
            "notes": {
                "buyer_id": current_user.id,
                "item_type": item_type,
                "item_id": payload.item_id,
            },
        })
        rzp_order_id = rz_order["id"]
    except Exception as exc:
        # Fallback if keys unconfigured or network issue
        rzp_order_id = f"rzp_fallback_{_uuid.uuid4().hex[:16]}"

    order_data["payment_gateway_order_id"] = rzp_order_id
    result = sb.table("orders").insert(order_data).execute()
    return result.data[0]


@router.post("/webhook")
async def payment_webhook(payload: dict):
    """
    Webhook called by the frontend after Razorpay checkout completes.

    Expected payload:
      {
        "order_id":             "<our DB orders.id or razorpay order_id>",
        "razorpay_order_id":    "order_xxxxx",
        "razorpay_payment_id":  "pay_xxxxx",
        "razorpay_signature":   "<HMAC-SHA256 signature from Razorpay>",
        "status":               "success" | "failed"
      }
    """
    import hmac, hashlib
    from app.config import get_settings

    sb = get_supabase_client()
    order_id            = payload.get("order_id")
    rzp_order_id        = payload.get("razorpay_order_id")
    rzp_payment_id      = payload.get("razorpay_payment_id") or "pay_mock"
    rzp_signature       = payload.get("razorpay_signature", "")
    status              = payload.get("status")

    if not order_id:
        raise HTTPException(status_code=400, detail="Missing order_id")

    # ── 1. Verify Razorpay signature ────────────────────────────────────────────
    # Signature = HMAC-SHA256( razorpay_order_id + "|" + razorpay_payment_id, secret )
    settings = get_settings()
    if status == "success" and rzp_order_id and rzp_signature and settings.razorpay_key_secret:
        expected_body = f"{rzp_order_id}|{rzp_payment_id}".encode()
        expected_sig  = hmac.new(
            settings.razorpay_key_secret.encode(),
            expected_body,
            hashlib.sha256,
        ).hexdigest()
        if not hmac.compare_digest(expected_sig, rzp_signature):
            raise HTTPException(status_code=400, detail="Invalid payment signature. Payment rejected.")

    # ── 2. Look up our order record ─────────────────────────────────────────────
    order_res = sb.table("orders").select("*").eq("id", order_id).execute()
    if not order_res.data:
        # Fallback: look up by razorpay order id
        order_res = sb.table("orders").select("*").eq("payment_gateway_order_id", order_id).execute()
        if not order_res.data:
            raise HTTPException(status_code=404, detail="Order not found")

    order = order_res.data[0]

    # Idempotency check: if already paid, return early
    if order.get("payment_status") == "PAID" and status == "success":
        return {"message": "Order already processed"}

    if status == "success":
        # ── 3. Mark order as PAID ───────────────────────────────────────────────
        sb.table("orders").update({
            "payment_status": "PAID",
            "payment_id": rzp_payment_id,
        }).eq("id", order["id"]).execute()

        # ── 4. Update property/listing status ───────────────────────────────────
        if order["item_type"] == "LISTING":
            target_status = "RENTED" if order["transaction_type"] == "RENT" else "SOLD"
            sb.table("listings").update({"status": target_status}).eq("id", order["item_id"]).execute()
        elif order["item_type"] == "PROPERTY":
            target_status = "RENTED" if order["transaction_type"] == "RENT" else "SOLD"
            sb.table("properties").update({"status": target_status}).eq("id", order["item_id"]).execute()

        # ── 5. Log payment in the payments ledger (rent payments only) ──────────
        if order["transaction_type"] == "RENT":
            buyer_res = sb.table("app_users").select("*").eq("id", order["buyer_id"]).execute()
            buyer = buyer_res.data[0] if buyer_res.data else {}

            # Resolve or create property
            property_id = order["item_id"] if order["item_type"] == "PROPERTY" else None
            if not property_id:
                mkt_prop = sb.table("properties").select("id").eq("address", "Marketplace Rental Unit").limit(1).execute()
                if mkt_prop.data:
                    property_id = mkt_prop.data[0]["id"]
                else:
                    new_prop_res = sb.table("properties").insert({
                        "address": "Marketplace Rental Unit",
                        "total_units": 999,
                        "rent_amount": order["amount"],
                        "note": "Automatically generated for marketplace transactions",
                    }).execute()
                    property_id = new_prop_res.data[0]["id"]

            # Resolve or create tenant profile
            tenant_res = (
                sb.table("tenants")
                .select("*")
                .eq("property_id", property_id)
                .eq("email", buyer.get("email"))
                .eq("status", "active")
                .execute()
            )
            if tenant_res.data:
                tenant = tenant_res.data[0]
            else:
                from datetime import date
                tenant_insert = sb.table("tenants").insert({
                    "name": buyer.get("full_name") or buyer.get("email") or "Marketplace Tenant",
                    "email": buyer.get("email"),
                    "phone": buyer.get("phone"),
                    "property_id": property_id,
                    "unit_number": "MKT-1",
                    "lease_start": date.today().isoformat(),
                    "status": "active",
                    "outstanding_dues": 0,
                }).execute()
                tenant = tenant_insert.data[0]

            # Log payment — one entry per month
            from datetime import date
            month_covered = payload.get("month_covered") or date.today().strftime("%Y-%m")

            sb.table("payments").delete().eq("tenant_id", tenant["id"]).eq("month_covered", month_covered).execute()
            sb.table("payments").insert({
                "tenant_id": tenant["id"],
                "amount_paid": order["amount"],
                "payment_date": date.today().isoformat(),
                "payment_type": "rent",
                "note": f"Online rent checkout ({rzp_payment_id})",
                "month_covered": month_covered,
            }).execute()

    else:
        sb.table("orders").update({
            "payment_status": "FAILED",
        }).eq("id", order["id"]).execute()

    return {"message": "Webhook processed successfully"}

