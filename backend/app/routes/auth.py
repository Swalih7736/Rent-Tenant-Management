"""
Authentication routes.
"""

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse

from app.models import (
    AuthSessionOut,
    AuthSetupResponse,
    AuthUserOut,
    BootstrapAdminRequest,
    LoginRequest,
    RefreshRequest,
    RegisterPendingResponse,
    UserRegisterRequest,
)
from app.services.auth import (
    bootstrap_admin,
    get_current_user,
    get_setup_state,
    login_user,
    refresh_user_session,
    register_new_user,
)


router = APIRouter(prefix="/api/auth", tags=["Auth"])


@router.get("/setup", response_model=AuthSetupResponse)
async def get_auth_setup():
    return get_setup_state()


@router.post("/bootstrap-admin", response_model=AuthSessionOut)
async def bootstrap_admin_account(payload: BootstrapAdminRequest):
    return bootstrap_admin(payload.email, payload.password, payload.full_name)


@router.post("/register", response_model=RegisterPendingResponse, status_code=202)
async def register(payload: UserRegisterRequest):
    """Register a new user. Account will be inactive until an admin approves it."""
    result = register_new_user(
        email=payload.email,
        password=payload.password,
        full_name=payload.full_name,
        role=payload.role,
        phone=payload.phone,
        company_or_agency=payload.company_or_agency,
    )
    return JSONResponse(status_code=202, content=result)


@router.post("/login", response_model=AuthSessionOut)
async def login(payload: LoginRequest):
    return login_user(payload.email, payload.password)



@router.post("/refresh", response_model=AuthSessionOut)
async def refresh_session(payload: RefreshRequest):
    return refresh_user_session(payload.refresh_token)


@router.get("/me", response_model=AuthUserOut)
async def me(current_user: AuthUserOut = Depends(get_current_user)):
    return current_user
