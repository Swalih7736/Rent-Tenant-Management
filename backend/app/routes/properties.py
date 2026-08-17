"""
CRUD routes for Properties.
"""

from fastapi import APIRouter, Depends, HTTPException
from app.config import get_supabase_client
from app.models import AuthUserOut, PropertyCreate, PropertyOut, PropertyUpdate
from app.services.auth import get_current_user, require_manager_or_admin
from app.services.validation import (
    ensure_non_empty_text,
    ensure_property_units_not_below_active_tenants,
    get_property_or_404,
    normalize_optional_text,
)

router = APIRouter(prefix="/api/properties", tags=["Properties"])

TABLE = "properties"


@router.get("/", response_model=list[PropertyOut])
async def list_properties(current_user: AuthUserOut = Depends(get_current_user)):
    """Return all properties."""
    sb = get_supabase_client()
    query = sb.table(TABLE).select("*")
    if current_user.role.lower() in ("owner", "manager"):
        query = query.eq("owner_id", current_user.id)
    result = query.execute()
    return result.data


@router.get("/{property_id}", response_model=PropertyOut)
async def get_property(property_id: str, current_user: AuthUserOut = Depends(get_current_user)):
    """Return a single property by ID."""
    sb = get_supabase_client()
    prop = get_property_or_404(sb, property_id)
    if current_user.role.lower() in ("owner", "manager"):
        if prop.get("owner_id") != current_user.id:
            raise HTTPException(status_code=403, detail="Access denied.")
    return prop



@router.post("/", response_model=PropertyOut, status_code=201)
async def create_property(
    payload: PropertyCreate,
    current_user: AuthUserOut = Depends(require_manager_or_admin),
):
    """Create a new property."""
    sb = get_supabase_client()
    data = payload.model_dump()
    data["address"] = ensure_non_empty_text(data.get("address"), "Property name")
    data["note"] = normalize_optional_text(data.get("note"))
    if current_user.role.lower() in ("owner", "manager"):
        data["owner_id"] = current_user.id
    result = sb.table(TABLE).insert(data).execute()
    return result.data[0]


@router.put("/{property_id}", response_model=PropertyOut)
async def update_property(
    property_id: str,
    payload: PropertyUpdate,
    current_user: AuthUserOut = Depends(require_manager_or_admin),
):
    """Update an existing property."""
    sb = get_supabase_client()
    existing = get_property_or_404(sb, property_id)
    if current_user.role.lower() in ("owner", "manager"):
        if existing.get("owner_id") != current_user.id:
            raise HTTPException(status_code=403, detail="Access denied.")

    data = payload.model_dump(exclude_none=True)
    if not data:
        raise HTTPException(status_code=400, detail="No fields to update")
    if "address" in data:
        data["address"] = ensure_non_empty_text(data.get("address"), "Property name")
    if "note" in data:
        data["note"] = normalize_optional_text(data.get("note"))
    if "total_units" in data:
        ensure_property_units_not_below_active_tenants(sb, property_id, data["total_units"])
    result = (
        sb.table(TABLE).update(data).eq("id", property_id).execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Property not found")
    return result.data[0]


@router.delete("/{property_id}", status_code=204)
async def delete_property(
    property_id: str,
    current_user: AuthUserOut = Depends(require_manager_or_admin),
):
    """Delete a property."""
    sb = get_supabase_client()
    existing = get_property_or_404(sb, property_id)
    if current_user.role.lower() in ("owner", "manager"):
        if existing.get("owner_id") != current_user.id:
            raise HTTPException(status_code=403, detail="Access denied.")
            
    sb.table(TABLE).delete().eq("id", property_id).execute()
    return None

