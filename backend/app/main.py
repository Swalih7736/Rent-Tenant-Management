"""
FastAPI application entry point.
Registers CORS, routers, and the revenue endpoint.
"""

from fastapi import Depends, FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from typing import Optional

from app.config import get_cors_origins
from app.routes import auth, payments, properties, tenants, users, marketplace, rental_applications
from app.services.auth import get_current_user
from app.services.tenant_documents import get_uploads_root
from app.services.revenue import calculate_total_revenue
from app.models import AuthUserOut, RevenueResponse

app = FastAPI(
    title="Rent Management API",
    description="Full-stack tenant rent management system",
    version="1.0.0",
)

# ── CORS (allow the React dev server) ──────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=get_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/uploads", StaticFiles(directory=str(get_uploads_root())), name="uploads")

# ── Routers ────────────────────────────────────────────────────────
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(properties.router)
app.include_router(tenants.router)
app.include_router(payments.router)
app.include_router(marketplace.router)
app.include_router(rental_applications.router)



@app.on_event("startup")
async def seed_listing_categories():
    """Seed default listing categories on startup if the table is empty."""
    from app.config import get_supabase_client
    sb = get_supabase_client()
    try:
        res = sb.table("listing_categories").select("id").limit(1).execute()
        if not res.data:
            categories = [
                {"name": "Apartments", "slug": "apartments", "icon": "BuildingOfficeIcon"},
                {"name": "Houses & Villas", "slug": "houses-villas", "icon": "HomeIcon"},
                {"name": "PG & Co-Living", "slug": "pg-coliving", "icon": "UserGroupIcon"},
                {"name": "Commercial Properties", "slug": "commercial", "icon": "BriefcaseIcon"},
                {"name": "Land & Plots", "slug": "land-plots", "icon": "MapIcon"},
                {"name": "Furniture & Appliances", "slug": "furniture-appliances", "icon": "SparklesIcon"},
                {"name": "Electronics", "slug": "electronics", "icon": "DevicePhoneMobileIcon"}
            ]
            sb.table("listing_categories").insert(categories).execute()
            print("Successfully seeded listing categories!")
    except Exception as e:
        print(f"Failed to seed listing categories: {e}")




# ── Revenue endpoint ───────────────────────────────────────────────
@app.get("/api/revenue", response_model=RevenueResponse, tags=["Revenue"])
async def get_revenue(
    property_id: Optional[str] = Query(default=None),
    month: Optional[str] = Query(default=None),
    current_user: AuthUserOut = Depends(get_current_user),
):
    """
    Calculate total revenue collected.
    Optionally filter by property_id and/or month (e.g. '2026-03').
    """
    owner_id = current_user.id if current_user.role.lower() in ("owner", "manager") else None
    return calculate_total_revenue(property_id=property_id, month=month, owner_id=owner_id)



# ── Health check ───────────────────────────────────────────────────
@app.get("/api/health", tags=["Health"])
async def health():
    return {"status": "ok"}
