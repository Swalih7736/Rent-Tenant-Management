"""
Authentication and authorization helpers.
"""

from typing import Any

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from gotrue.errors import (
    AuthApiError,
    AuthInvalidCredentialsError,
    AuthInvalidJwtError,
    AuthSessionMissingError,
    AuthWeakPasswordError,
)

from app.config import (
    get_admin_auth_client,
    get_auth_client,
    get_db_client,
    get_settings,
)
from app.models import AuthSessionOut, AuthUserOut


ROLE_ADMIN = "admin"
ROLE_MANAGER = "manager"
ROLE_VIEWER = "viewer"
ROLE_OWNER = "owner"
ROLE_USER = "user"


security = HTTPBearer(auto_error=False)


def _metadata_to_dict(metadata: Any) -> dict[str, Any]:
    if metadata is None:
        return {}
    if isinstance(metadata, dict):
        return metadata
    if hasattr(metadata, "model_dump"):
        return metadata.model_dump()
    return dict(metadata)


def _get_user_full_name(auth_user: Any) -> str | None:
    metadata = _metadata_to_dict(getattr(auth_user, "user_metadata", None))
    return metadata.get("full_name") or metadata.get("name")


def _serialize_auth_user(auth_user: Any, profile: dict) -> AuthUserOut:
    meta = getattr(auth_user, "user_metadata", {}) or {}
    role = profile.get("role", ROLE_VIEWER)
    is_approved = profile.get("is_approved") if profile.get("is_approved") is not None else meta.get("is_approved", role == ROLE_ADMIN)
    is_rejected = profile.get("is_rejected") if profile.get("is_rejected") is not None else meta.get("is_rejected", False)
    return AuthUserOut(
        id=str(auth_user.id),
        email=getattr(auth_user, "email", None),
        full_name=profile.get("full_name") or _get_user_full_name(auth_user),
        role=role,
        is_active=bool(profile.get("is_active", True)),
        is_approved=is_approved,
        is_rejected=is_rejected,
        rejection_reason=profile.get("rejection_reason") or meta.get("rejection_reason"),
        phone=profile.get("phone") or meta.get("phone"),
        company_or_agency=profile.get("company_or_agency") or meta.get("company_or_agency"),
    )


def to_auth_http_exception(exc: Exception) -> HTTPException:
    if isinstance(exc, AuthWeakPasswordError):
        return HTTPException(status_code=400, detail=exc.message)
    if isinstance(exc, AuthInvalidCredentialsError):
        return HTTPException(status_code=401, detail=exc.message)
    if isinstance(exc, AuthApiError):
        detail = exc.message or "Authentication failed."
        status_code = exc.status or 401
        return HTTPException(status_code=status_code, detail=detail)
    if isinstance(exc, (AuthInvalidJwtError, AuthSessionMissingError)):
        return HTTPException(status_code=401, detail="Invalid or expired session.")
    return HTTPException(status_code=500, detail="Authentication service is unavailable.")


def _get_app_user_profile(db, auth_user: Any) -> dict:
    user_id = str(auth_user.id)
    result = db.table("app_users").select("*").eq("id", user_id).execute()
    profile = result.data[0] if result.data else None

    if profile is None:
        raise HTTPException(
            status_code=403,
            detail="This account has not been provisioned by an admin yet.",
        )

    email = getattr(auth_user, "email", None)
    full_name = _get_user_full_name(auth_user)
    update_payload = {}
    if email and profile.get("email") != email:
        update_payload["email"] = email
    if full_name is not None and profile.get("full_name") != full_name:
        update_payload["full_name"] = full_name
    if update_payload:
        update_result = db.table("app_users").update(update_payload).eq("id", user_id).execute()
        if update_result.data:
            profile = update_result.data[0]

    return profile


def has_admin_user() -> bool:
    db = get_db_client()
    result = db.table("app_users").select("id").eq("role", ROLE_ADMIN).limit(1).execute()
    return bool(result.data)


def get_setup_state() -> dict[str, bool]:
    settings = get_settings()
    return {
        "needs_bootstrap": not has_admin_user(),
        "has_service_role": bool(settings.supabase_service_role_key),
    }


def login_user(email: str, password: str) -> AuthSessionOut:
    auth_client = get_auth_client()
    try:
        response = auth_client.sign_in_with_password({"email": email, "password": password})
    except Exception as exc:
        raise to_auth_http_exception(exc) from exc

    auth_user = response.user or response.session.user
    profile = _get_app_user_profile(get_db_client(), auth_user)
    if not profile.get("is_active", True):
        raise HTTPException(status_code=403, detail="This user account has been disabled.")

    role = profile.get("role", ROLE_VIEWER).lower()
    # Admins are always allowed through
    if role not in (ROLE_ADMIN,):
        meta = getattr(auth_user, "user_metadata", {}) or {}
        is_rejected = profile.get("is_rejected") if profile.get("is_rejected") is not None else meta.get("is_rejected", False)
        if is_rejected:
            reason = profile.get("rejection_reason") or meta.get("rejection_reason") or "Your account registration was rejected."
            raise HTTPException(
                status_code=403,
                detail=f"ACCOUNT_REJECTED: {reason}",
            )
        is_approved = profile.get("is_approved") if profile.get("is_approved") is not None else meta.get("is_approved", False)
        if not is_approved:
            raise HTTPException(
                status_code=403,
                detail="ACCOUNT_PENDING: Your account is awaiting admin approval. Please wait for an administrator to activate your account.",
            )

    return AuthSessionOut(
        access_token=response.session.access_token,
        refresh_token=response.session.refresh_token,
        expires_at=response.session.expires_at,
        expires_in=response.session.expires_in,
        token_type=response.session.token_type,
        user=_serialize_auth_user(auth_user, profile),
    )


def refresh_user_session(refresh_token: str) -> AuthSessionOut:
    auth_client = get_auth_client()
    try:
        response = auth_client.refresh_session(refresh_token)
    except Exception as exc:
        raise to_auth_http_exception(exc) from exc

    auth_user = response.user or response.session.user
    profile = _get_app_user_profile(get_db_client(), auth_user)
    if not profile.get("is_active", True):
        raise HTTPException(status_code=403, detail="This user account has been disabled.")

    role = profile.get("role", ROLE_VIEWER).lower()
    if role not in (ROLE_ADMIN,):
        meta = getattr(auth_user, "user_metadata", {}) or {}
        is_rejected = profile.get("is_rejected") if profile.get("is_rejected") is not None else meta.get("is_rejected", False)
        if is_rejected:
            reason = profile.get("rejection_reason") or meta.get("rejection_reason") or "Your account registration was rejected."
            raise HTTPException(
                status_code=403,
                detail=f"ACCOUNT_REJECTED: {reason}",
            )
        is_approved = profile.get("is_approved") if profile.get("is_approved") is not None else meta.get("is_approved", False)
        if not is_approved:
            raise HTTPException(
                status_code=403,
                detail="ACCOUNT_PENDING: Your account is awaiting admin approval.",
            )

    return AuthSessionOut(
        access_token=response.session.access_token,
        refresh_token=response.session.refresh_token,
        expires_at=response.session.expires_at,
        expires_in=response.session.expires_in,
        token_type=response.session.token_type,
        user=_serialize_auth_user(auth_user, profile),
    )


def bootstrap_admin(email: str, password: str, full_name: str | None = None) -> AuthSessionOut:
    if has_admin_user():
        raise HTTPException(status_code=409, detail="Admin bootstrap has already been completed.")

    try:
        admin_client = get_admin_auth_client()
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    try:
        response = admin_client.admin.create_user(
            {
                "email": email,
                "password": password,
                "email_confirm": True,
                "user_metadata": {"full_name": full_name, "is_approved": False, "is_rejected": False, "phone": phone, "company_or_agency": company_or_agency},
            }
        )
    except Exception as exc:
        raise to_auth_http_exception(exc) from exc

    db = get_db_client()
    db.table("app_users").insert(
        {
            "id": str(response.user.id),
            "email": email,
            "full_name": full_name,
            "role": ROLE_ADMIN,
            "is_active": True,
            "is_approved": True,  # Admin is always pre-approved
            "is_rejected": False,
        }
    ).execute()

    return login_user(email, password)


def register_new_user(
    email: str,
    password: str,
    full_name: str | None = None,
    role: str = ROLE_VIEWER,
    phone: str | None = None,
    company_or_agency: str | None = None,
) -> dict:
    """Register a new user. Account is created but requires admin approval before login."""
    try:
        admin_client = get_admin_auth_client()
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    try:
        response = admin_client.admin.create_user(
            {
                "email": email,
                "password": password,
                "email_confirm": True,
                "user_metadata": {"full_name": full_name} if full_name else {},
            }
        )
    except Exception as exc:
        err_str = str(exc).lower()
        if "already" in err_str or "exists" in err_str:
            db = get_db_client()
            existing = db.table("app_users").select("*").eq("email", email).execute()
            if existing.data:
                prof = existing.data[0]
                if prof.get("is_rejected"):
                    reason = prof.get("rejection_reason") or "Your registration was rejected by an administrator."
                    raise HTTPException(status_code=409, detail=f"ACCOUNT_REJECTED: {reason}")
                if prof.get("is_approved") is False:
                    raise HTTPException(
                        status_code=409,
                        detail="ACCOUNT_PENDING: Your registration was already submitted and is awaiting administrator approval. Please wait for approval before logging in.",
                    )
                raise HTTPException(status_code=409, detail="An account with this email already exists and is active. Please proceed to Sign In.")
            raise HTTPException(status_code=409, detail="An account with this email already exists. If you recently registered, please wait for admin approval.")
        raise to_auth_http_exception(exc) from exc

    db = get_db_client()
    try:
        db.table("app_users").insert(
            {
                "id": str(response.user.id),
                "email": email,
                "full_name": full_name,
                "role": role.lower(),
                "phone": phone,
                "company_or_agency": company_or_agency,
                "is_active": True,
                "is_approved": False,   # Must be approved by admin before login
                "is_rejected": False,
            }
        ).execute()
    except Exception as db_exc:
        try:
            db.table("app_users").insert(
                {
                    "id": str(response.user.id),
                    "email": email,
                    "full_name": full_name,
                    "role": role.lower(),
                    "phone": phone,
                    "company_or_agency": company_or_agency,
                    "is_active": True,
                }
            ).execute()
        except Exception:
            try:
                admin_client.admin.delete_user(str(response.user.id))
            except Exception:
                pass
            raise to_auth_http_exception(db_exc) from db_exc

    # Return pending message — no access token issued
    return {
        "message": "Registration successful! Your account is awaiting admin approval. You will be able to log in once an admin reviews your request.",
        "email": email,
        "status": "pending_approval",
    }



def _resolve_current_user(token: str) -> AuthUserOut:
    auth_client = get_auth_client()
    try:
        response = auth_client.get_user(token)
    except Exception as exc:
        raise to_auth_http_exception(exc) from exc

    auth_user = response.user
    if auth_user is None:
        raise HTTPException(status_code=401, detail="Invalid or expired session.")

    profile = _get_app_user_profile(get_db_client(), auth_user)
    if not profile.get("is_active", True):
        raise HTTPException(status_code=403, detail="This user account has been disabled.")

    role = profile.get("role", ROLE_VIEWER).lower()
    if role not in (ROLE_ADMIN,):
        meta = getattr(auth_user, "user_metadata", {}) or {}
        is_rejected = profile.get("is_rejected") if profile.get("is_rejected") is not None else meta.get("is_rejected", False)
        if is_rejected:
            reason = profile.get("rejection_reason") or meta.get("rejection_reason") or "Your account registration was rejected."
            raise HTTPException(
                status_code=403,
                detail=f"ACCOUNT_REJECTED: {reason}",
            )
        is_approved = profile.get("is_approved") if profile.get("is_approved") is not None else meta.get("is_approved", False)
        if not is_approved:
            raise HTTPException(
                status_code=403,
                detail="ACCOUNT_PENDING: Your account is awaiting admin approval.",
            )

    return _serialize_auth_user(auth_user, profile)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
) -> AuthUserOut:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=401, detail="Authentication required.")
    return _resolve_current_user(credentials.credentials)


def get_optional_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
) -> AuthUserOut | None:
    if credentials is None or credentials.scheme.lower() != "bearer":
        return None
    try:
        return _resolve_current_user(credentials.credentials)
    except Exception:
        return None



def require_admin(current_user: AuthUserOut = Depends(get_current_user)) -> AuthUserOut:
    if current_user.role != ROLE_ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required.")
    return current_user


def require_manager(current_user: AuthUserOut = Depends(get_current_user)) -> AuthUserOut:
    if current_user.role != ROLE_MANAGER:
        raise HTTPException(status_code=403, detail="Manager access required.")
    return current_user


def require_manager_or_admin(
    current_user: AuthUserOut = Depends(get_current_user),
) -> AuthUserOut:
    if current_user.role not in {ROLE_MANAGER, ROLE_ADMIN, ROLE_OWNER}:
        raise HTTPException(status_code=403, detail="Manager, owner or admin access required.")
    return current_user

