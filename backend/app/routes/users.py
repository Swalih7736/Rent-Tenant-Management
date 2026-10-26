"""
Admin-only user management routes.
"""

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.config import get_admin_auth_client, get_db_client
from app.models import AppUserCreate, AppUserOut, AppUserUpdate, AuthUserOut
from app.services.auth import (
    ROLE_ADMIN,
    ROLE_VIEWER,
    require_admin,
    to_auth_http_exception,
)


router = APIRouter(prefix="/api/users", tags=["Users"])


def _get_admin_client_or_503():
    try:
        return get_admin_auth_client()
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


def _metadata_to_dict(metadata: Any) -> dict[str, Any]:
    if metadata is None:
        return {}
    if isinstance(metadata, dict):
        return metadata
    if hasattr(metadata, "model_dump"):
        return metadata.model_dump()
    return dict(metadata)


def _full_name_from_auth_user(auth_user: Any) -> str | None:
    metadata = _metadata_to_dict(getattr(auth_user, "user_metadata", None))
    return metadata.get("full_name") or metadata.get("name")


def _serialize_user(auth_user: Any, profile: dict | None = None) -> AppUserOut:
    profile = profile or {}
    meta = getattr(auth_user, "user_metadata", {}) or {}
    role = profile.get("role") or meta.get("role") or ROLE_VIEWER
    
    if role == ROLE_ADMIN:
        is_approved = True
        is_rejected = False
        rejection_reason = None
    else:
        is_approved = profile.get("is_approved")
        if is_approved is None:
            is_approved = meta.get("is_approved", False)
            
        is_rejected = profile.get("is_rejected")
        if is_rejected is None:
            is_rejected = meta.get("is_rejected", False)
            
        rejection_reason = profile.get("rejection_reason") or meta.get("rejection_reason")

    return AppUserOut(
        id=str(auth_user.id),
        email=getattr(auth_user, "email", None),
        full_name=profile.get("full_name") or _full_name_from_auth_user(auth_user),
        role=role,
        is_active=bool(profile.get("is_active", True)),
        is_approved=is_approved,
        is_rejected=is_rejected,
        rejection_reason=rejection_reason,
        phone=profile.get("phone") or meta.get("phone"),
        company_or_agency=profile.get("company_or_agency") or meta.get("company_or_agency"),
        created_at=getattr(auth_user, "created_at", None),
        last_sign_in_at=getattr(auth_user, "last_sign_in_at", None),
    )


def _get_profile_map() -> dict[str, dict]:
    db = get_db_client()
    rows = db.table("app_users").select("*").execute().data
    return {str(row["id"]): row for row in rows}


def _count_admin_users() -> int:
    db = get_db_client()
    rows = db.table("app_users").select("id").eq("role", ROLE_ADMIN).execute().data
    return len(rows)


def _ensure_profile_exists(auth_user: Any) -> dict:
    db = get_db_client()
    user_id = str(auth_user.id)
    result = db.table("app_users").select("*").eq("id", user_id).execute()
    if result.data:
        return result.data[0]

    inserted = db.table("app_users").insert(
        {
            "id": user_id,
            "email": getattr(auth_user, "email", None),
            "full_name": _full_name_from_auth_user(auth_user),
            "role": ROLE_VIEWER,
            "is_active": True,
        }
    ).execute()
    return inserted.data[0]


@router.get("/", response_model=list[AppUserOut])
async def list_users(_: AuthUserOut = Depends(require_admin)):
    admin_client = _get_admin_client_or_503()
    try:
        auth_users = admin_client.admin.list_users(page=1, per_page=1000)
    except Exception as exc:
        raise to_auth_http_exception(exc) from exc

    profile_map = _get_profile_map()
    users = [
        _serialize_user(auth_user, profile_map.get(str(auth_user.id)))
        for auth_user in auth_users
    ]
    return sorted(users, key=lambda user: ((user.email or "").lower(), user.id))


@router.get("/pending", response_model=list[AppUserOut])
async def list_pending_users(_: AuthUserOut = Depends(require_admin)):
    """Return all users who have registered but are not yet approved or rejected."""
    db = get_db_client()
    result = db.table("app_users").select("*").eq("is_approved", False).eq("is_rejected", False).execute()
    pending_profiles = result.data or []

    admin_client = _get_admin_client_or_503()
    output = []
    for profile in pending_profiles:
        try:
            auth_user = admin_client.admin.get_user_by_id(profile["id"]).user
            output.append(_serialize_user(auth_user, profile))
        except Exception:
            pass
    return output


@router.post("/", response_model=AppUserOut, status_code=status.HTTP_201_CREATED)
async def create_user(
    payload: AppUserCreate,
    _: AuthUserOut = Depends(require_admin),
):
    admin_client = _get_admin_client_or_503()
    try:
        response = admin_client.admin.create_user(
            {
                "email": payload.email,
                "password": payload.password,
                "email_confirm": True,
                "user_metadata": {"full_name": payload.full_name} if payload.full_name else {},
            }
        )
    except Exception as exc:
        raise to_auth_http_exception(exc) from exc

    try:
        profile = get_db_client().table("app_users").insert(
            {
                "id": str(response.user.id),
                "email": payload.email,
                "full_name": payload.full_name,
                "role": payload.role,
                "is_active": payload.is_active,
                "phone": payload.phone,
                "company_or_agency": payload.company_or_agency,
            }
        ).execute().data[0]
        return _serialize_user(response.user, profile)

    except Exception as exc:
        try:
            admin_client.admin.delete_user(str(response.user.id))
        except Exception:
            pass
        raise HTTPException(
            status_code=500,
            detail="User account creation did not complete. Please try again.",
        ) from exc


@router.put("/{user_id}", response_model=AppUserOut)
async def update_user(
    user_id: str,
    payload: AppUserUpdate,
    current_user: AuthUserOut = Depends(require_admin),
):
    admin_client = _get_admin_client_or_503()
    try:
        auth_user = admin_client.admin.get_user_by_id(user_id).user
    except Exception as exc:
        raise to_auth_http_exception(exc) from exc

    profile = _ensure_profile_exists(auth_user)
    target_role = payload.role or profile.get("role", ROLE_VIEWER)

    if current_user.id == user_id and payload.is_active is False:
        raise HTTPException(status_code=409, detail="You cannot disable your own account.")

    if profile.get("role") == ROLE_ADMIN and target_role != ROLE_ADMIN and _count_admin_users() <= 1:
        raise HTTPException(status_code=409, detail="At least one admin user must remain active.")

    auth_payload = {}
    if payload.password:
        auth_payload["password"] = payload.password
    if payload.full_name is not None:
        auth_payload["user_metadata"] = {"full_name": payload.full_name}

    if auth_payload:
        try:
            auth_user = admin_client.admin.update_user_by_id(user_id, auth_payload).user
        except Exception as exc:
            raise to_auth_http_exception(exc) from exc

    profile_payload = {}
    if payload.full_name is not None:
        profile_payload["full_name"] = payload.full_name
    if payload.role is not None:
        profile_payload["role"] = payload.role
    if payload.is_active is not None:
        profile_payload["is_active"] = payload.is_active
    if payload.is_approved is not None:
        profile_payload["is_approved"] = payload.is_approved
    if payload.is_rejected is not None:
        profile_payload["is_rejected"] = payload.is_rejected
    if payload.rejection_reason is not None:
        profile_payload["rejection_reason"] = payload.rejection_reason
    if payload.phone is not None:
        profile_payload["phone"] = payload.phone
    if payload.company_or_agency is not None:
        profile_payload["company_or_agency"] = payload.company_or_agency


    if profile_payload:
        update_result = (
            get_db_client()
            .table("app_users")
            .update(profile_payload)
            .eq("id", user_id)
            .execute()
        )
        if update_result.data:
            profile = update_result.data[0]

    return _serialize_user(auth_user, profile)


@router.post("/{user_id}/approve", response_model=AppUserOut)
async def approve_user(
    user_id: str,
    _: AuthUserOut = Depends(require_admin),
):
    """Admin approves a pending user, granting them login access."""
    admin_client = _get_admin_client_or_503()
    try:
        auth_user = admin_client.admin.get_user_by_id(user_id).user
    except Exception as exc:
        raise to_auth_http_exception(exc) from exc

    db = get_db_client()
    result = db.table("app_users").select("*").eq("id", user_id).execute()
    profile = result.data[0] if result.data else {}
    if profile.get("role") == ROLE_ADMIN:
        raise HTTPException(status_code=409, detail="Admin accounts do not require approval.")

    # 1. Update Supabase Auth user_metadata directly (always succeeds without requiring DB column)
    current_meta = getattr(auth_user, "user_metadata", {}) or {}
    new_meta = {**current_meta, "is_approved": True, "is_rejected": False, "rejection_reason": None}
    try:
        updated_auth = admin_client.admin.update_user_by_id(user_id, {"user_metadata": new_meta})
        auth_user = updated_auth.user
    except Exception as exc:
        raise to_auth_http_exception(exc) from exc

    # 2. Also update app_users table if the column exists
    try:
        updated = (
            db.table("app_users")
            .update({"is_approved": True, "is_rejected": False, "rejection_reason": None})
            .eq("id", user_id)
            .execute()
        )
        if updated.data:
            profile = updated.data[0]
    except Exception:
        pass

    return _serialize_user(auth_user, profile)


class RejectUserRequest(BaseModel):
    rejection_reason: str = Field(default="Your account was not approved.", min_length=1)


@router.post("/{user_id}/reject", response_model=AppUserOut)
async def reject_user(
    user_id: str,
    payload: RejectUserRequest,
    _: AuthUserOut = Depends(require_admin),
):
    """Admin rejects a pending user with an optional reason displayed as a popup."""
    admin_client = _get_admin_client_or_503()
    try:
        auth_user = admin_client.admin.get_user_by_id(user_id).user
    except Exception as exc:
        raise to_auth_http_exception(exc) from exc

    db = get_db_client()
    result = db.table("app_users").select("*").eq("id", user_id).execute()
    profile = result.data[0] if result.data else {}
    if profile.get("role") == ROLE_ADMIN:
        raise HTTPException(status_code=409, detail="Cannot reject an admin account.")
    if _count_admin_users() <= 1 and profile.get("role") == ROLE_ADMIN:
        raise HTTPException(status_code=409, detail="At least one admin must remain.")

    # 1. Update Supabase Auth user_metadata directly
    current_meta = getattr(auth_user, "user_metadata", {}) or {}
    new_meta = {
        **current_meta,
        "is_approved": False,
        "is_rejected": True,
        "rejection_reason": payload.rejection_reason,
    }
    try:
        updated_auth = admin_client.admin.update_user_by_id(user_id, {"user_metadata": new_meta})
        auth_user = updated_auth.user
    except Exception as exc:
        raise to_auth_http_exception(exc) from exc

    # 2. Also update app_users table if the column exists
    try:
        updated = (
            db.table("app_users")
            .update({
                "is_approved": False,
                "is_rejected": True,
                "rejection_reason": payload.rejection_reason,
            })
            .eq("id", user_id)
            .execute()
        )
        if updated.data:
            profile = updated.data[0]
    except Exception:
        pass

    return _serialize_user(auth_user, profile)


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: str,
    current_user: AuthUserOut = Depends(require_admin),
):
    if current_user.id == user_id:
        raise HTTPException(status_code=409, detail="You cannot delete your own account.")

    db = get_db_client()
    profile_result = db.table("app_users").select("*").eq("id", user_id).execute()
    profile = profile_result.data[0] if profile_result.data else None
    if profile and profile.get("role") == ROLE_ADMIN and _count_admin_users() <= 1:
        raise HTTPException(status_code=409, detail="At least one admin user must remain active.")

    admin_client = _get_admin_client_or_503()
    try:
        admin_client.admin.delete_user(user_id)
    except Exception as exc:
        raise to_auth_http_exception(exc) from exc

    db.table("app_users").delete().eq("id", user_id).execute()
    return None
