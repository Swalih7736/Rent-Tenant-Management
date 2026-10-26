from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from typing import Optional
from datetime import date
from pathlib import Path


from app.config import get_supabase_client
from app.models import (
    AuthUserOut,
    CommercialListingCreate,
    ListingCategoryOut,
    ListingCreate,
    ListingUpdate,
    ListingOut,
    ChatConversationCreate,
    ChatConversationOut,
    ChatMessageCreate,
    ChatMessageOut,
    OfferStatusUpdate,
    VisitBookingCreate,
    VisitBookingOut,
    BookingStatusUpdate,
)
from app.services.auth import get_current_user, require_manager_or_admin

router = APIRouter(prefix="/api/marketplace", tags=["Marketplace"])


# ── Listing Categories ───────────────────────────────────────────────

@router.get("/categories", response_model=list[ListingCategoryOut])
async def list_categories():
    """List all classified categories."""
    sb = get_supabase_client()
    result = sb.table("listing_categories").select("*").execute()
    return result.data


# ── Listings CRUD ────────────────────────────────────────────────────

@router.get("/listings", response_model=list[ListingOut])
async def list_listings(
    city: Optional[str] = Query(default=None),
    category_id: Optional[str] = Query(default=None),
    listing_type: Optional[str] = Query(default=None, pattern="^(RENT|SALE)$"),
    property_type: Optional[str] = Query(default=None, pattern="^(residential|commercial)$"),
    min_price: Optional[float] = Query(default=None),
    max_price: Optional[float] = Query(default=None),
    status: Optional[str] = Query(default="ACTIVE"),
):
    """Public search endpoint for listings with filtering."""
    sb = get_supabase_client()
    query = sb.table("listings").select("*")
    
    if status:
        query = query.eq("status", status)
    if city:
        query = query.ilike("city", f"%{city}%")
    if category_id:
        query = query.eq("category_id", category_id)
    if listing_type:
        query = query.eq("listing_type", listing_type)
    if property_type:
        query = query.eq("property_type", property_type)
    if min_price is not None:
        query = query.gte("price", min_price)
    if max_price is not None:
        query = query.lte("price", max_price)
        
    result = query.order("created_at", desc=True).execute()
    return result.data


@router.get("/listings/{listing_id}", response_model=ListingOut)
async def get_listing(listing_id: str):
    """Retrieve details for a single listing."""
    sb = get_supabase_client()
    result = sb.table("listings").select("*").eq("id", listing_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Listing not found.")
    return result.data[0]


@router.post("/listings", response_model=ListingOut, status_code=201)
async def create_listing(
    payload: ListingCreate,
    current_user: AuthUserOut = Depends(get_current_user),
):
    """Create a new residential listing. Requires authentication."""
    sb = get_supabase_client()
    data = payload.model_dump()
    data["seller_id"] = current_user.id
    data["status"] = "ACTIVE"
    data["property_type"] = data.get("property_type", "residential")
    
    result = sb.table("listings").insert(data).execute()
    return result.data[0]


@router.post("/commercial-listings", response_model=ListingOut, status_code=201)
async def create_commercial_listing(
    payload: CommercialListingCreate,
    current_user: AuthUserOut = Depends(get_current_user),
):
    """
    Create a new commercial space listing.
    Only owners and admins can post commercial listings.
    Supports extra fields: square footage, zoning type, lease terms, floor, parking.
    """
    if current_user.role.lower() not in ("owner", "admin", "manager"):
        raise HTTPException(
            status_code=403,
            detail="Only property owners or admins can post commercial space listings.",
        )
    sb = get_supabase_client()
    data = payload.model_dump(exclude={"commercial_details"})
    data["seller_id"] = current_user.id
    data["status"] = "ACTIVE"
    data["property_type"] = "commercial"
    # Store commercial-specific details as JSONB
    commercial_details = payload.commercial_details.model_dump(exclude_none=False)
    data["commercial_details"] = commercial_details

    result = sb.table("listings").insert(data).execute()
    return result.data[0]


@router.put("/listings/{listing_id}", response_model=ListingOut)
async def update_listing(
    listing_id: str,
    payload: ListingUpdate,
    current_user: AuthUserOut = Depends(get_current_user),
):
    """Update a listing. Only the owner/seller or admin can perform this."""
    sb = get_supabase_client()
    listing_res = sb.table("listings").select("*").eq("id", listing_id).execute()
    if not listing_res.data:
        raise HTTPException(status_code=404, detail="Listing not found.")
    listing = listing_res.data[0]
    
    if current_user.role.lower() != "admin" and listing["seller_id"] != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to edit this listing.")
        
    data = payload.model_dump(exclude_none=True)
    if not data:
        raise HTTPException(status_code=400, detail="No fields to update.")
        
    result = sb.table("listings").update(data).eq("id", listing_id).execute()
    return result.data[0]


@router.delete("/listings/{listing_id}", status_code=204)
async def delete_listing(
    listing_id: str,
    current_user: AuthUserOut = Depends(get_current_user),
):
    """Delete a listing. Only the owner/seller or admin can perform this."""
    sb = get_supabase_client()
    listing_res = sb.table("listings").select("*").eq("id", listing_id).execute()
    if not listing_res.data:
        raise HTTPException(status_code=404, detail="Listing not found.")
    listing = listing_res.data[0]
    
    if current_user.role.lower() != "admin" and listing["seller_id"] != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this listing.")
        
    sb.table("listings").delete().eq("id", listing_id).execute()
    return None


# ── In-App Chats ─────────────────────────────────────────────────────

@router.get("/conversations", response_model=list[ChatConversationOut])
async def list_conversations(current_user: AuthUserOut = Depends(get_current_user)):
    """List all chat conversations involving the logged-in user."""
    sb = get_supabase_client()
    # Fetch conversations where current_user is buyer or seller
    res = sb.table("chat_conversations").select("*").or_(f"buyer_id.eq.{current_user.id},seller_id.eq.{current_user.id}").execute()
    conversations = res.data
    
    if not conversations:
        return []
        
    # Hydrate references
    hydrated = []
    for conv in conversations:
        # Listing
        listing_res = sb.table("listings").select("*").eq("id", conv["listing_id"]).execute()
        listing = listing_res.data[0] if listing_res.data else None
        
        # Buyer
        buyer_res = sb.table("app_users").select("*").eq("id", conv["buyer_id"]).execute()
        buyer = buyer_res.data[0] if buyer_res.data else None
        
        # Seller
        seller_res = sb.table("app_users").select("*").eq("id", conv["seller_id"]).execute()
        seller = seller_res.data[0] if seller_res.data else None
        
        hydrated.append(
            ChatConversationOut(
                id=conv["id"],
                listing_id=conv["listing_id"],
                buyer_id=conv["buyer_id"],
                seller_id=conv["seller_id"],
                created_at=conv["created_at"],
                listing=listing,
                buyer=buyer,
                seller=seller,
            )
        )
        
    return hydrated


@router.post("/conversations", response_model=ChatConversationOut)
async def get_or_create_conversation(
    payload: ChatConversationCreate,
    current_user: AuthUserOut = Depends(get_current_user),
):
    """Retrieve an existing conversation or start a new thread."""
    sb = get_supabase_client()
    listing_res = sb.table("listings").select("*").eq("id", payload.listing_id).execute()
    if not listing_res.data:
        raise HTTPException(status_code=404, detail="Listing not found.")
    listing = listing_res.data[0]
    
    if listing["seller_id"] == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot start a conversation with yourself.")
        
    # Check if a conversation already exists between this buyer, seller, and listing
    existing = sb.table("chat_conversations") \
                 .select("*") \
                 .eq("listing_id", payload.listing_id) \
                 .eq("buyer_id", current_user.id) \
                 .eq("seller_id", listing["seller_id"]) \
                 .execute()
                 
    if existing.data:
        conv = existing.data[0]
    else:
        # Create new conversation
        insert_res = sb.table("chat_conversations").insert({
            "listing_id": payload.listing_id,
            "buyer_id": current_user.id,
            "seller_id": listing["seller_id"]
        }).execute()
        conv = insert_res.data[0]
        
    # Fetch user accounts for serialization
    buyer_res = sb.table("app_users").select("*").eq("id", conv["buyer_id"]).execute()
    buyer = buyer_res.data[0] if buyer_res.data else None
    
    seller_res = sb.table("app_users").select("*").eq("id", conv["seller_id"]).execute()
    seller = seller_res.data[0] if seller_res.data else None
    
    return ChatConversationOut(
        id=conv["id"],
        listing_id=conv["listing_id"],
        buyer_id=conv["buyer_id"],
        seller_id=conv["seller_id"],
        created_at=conv["created_at"],
        listing=listing,
        buyer=buyer,
        seller=seller,
    )


@router.get("/conversations/{conversation_id}/messages", response_model=list[ChatMessageOut])
async def list_messages(
    conversation_id: str,
    current_user: AuthUserOut = Depends(get_current_user),
):
    """Retrieve message history for a conversation thread."""
    sb = get_supabase_client()
    # Check membership
    conv_res = sb.table("chat_conversations").select("*").eq("id", conversation_id).execute()
    if not conv_res.data:
        raise HTTPException(status_code=404, detail="Conversation not found.")
    conv = conv_res.data[0]
    
    if current_user.id not in (conv["buyer_id"], conv["seller_id"]):
        raise HTTPException(status_code=403, detail="Access denied.")
        
    result = sb.table("chat_messages").select("*").eq("conversation_id", conversation_id).order("created_at", desc=False).execute()
    return result.data


@router.post("/conversations/{conversation_id}/messages", response_model=ChatMessageOut)
async def send_message(
    conversation_id: str,
    payload: ChatMessageCreate,
    current_user: AuthUserOut = Depends(get_current_user),
):
    """Post a message and/or initiate an offer in a conversation."""
    sb = get_supabase_client()
    # Check membership
    conv_res = sb.table("chat_conversations").select("*").eq("id", conversation_id).execute()
    if not conv_res.data:
        raise HTTPException(status_code=404, detail="Conversation not found.")
    conv = conv_res.data[0]
    
    if current_user.id not in (conv["buyer_id"], conv["seller_id"]):
        raise HTTPException(status_code=403, detail="Access denied.")
        
    data = payload.model_dump()
    data["conversation_id"] = conversation_id
    data["sender_id"] = current_user.id
    data["offer_status"] = "PENDING" if payload.offer_amount is not None else "NONE"
    
    result = sb.table("chat_messages").insert(data).execute()
    return result.data[0]


@router.post("/offers/{message_id}/status", response_model=ChatMessageOut)
async def respond_to_offer(
    message_id: str,
    payload: OfferStatusUpdate,
    current_user: AuthUserOut = Depends(get_current_user),
):
    """Accept or reject a counter-offer proposal."""
    sb = get_supabase_client()
    msg_res = sb.table("chat_messages").select("*").eq("id", message_id).execute()
    if not msg_res.data:
        raise HTTPException(status_code=404, detail="Message not found.")
    msg = msg_res.data[0]
    
    if msg["offer_status"] != "PENDING":
        raise HTTPException(status_code=400, detail="This message does not contain a pending offer.")
        
    # Check conversation participants
    conv_res = sb.table("chat_conversations").select("*").eq("id", msg["conversation_id"]).execute()
    conv = conv_res.data[0]
    
    # Only the user who did NOT submit the offer can accept/reject it
    if current_user.id not in (conv["buyer_id"], conv["seller_id"]):
        raise HTTPException(status_code=403, detail="Access denied.")
    if current_user.id == msg["sender_id"]:
        raise HTTPException(status_code=400, detail="You cannot respond to your own offer.")
        
    result = sb.table("chat_messages").update({"offer_status": payload.offer_status}).eq("id", message_id).execute()
    return result.data[0]


# ── Walkthrough / Visit Bookings ─────────────────────────────────────

@router.get("/bookings", response_model=list[VisitBookingOut])
async def list_bookings(current_user: AuthUserOut = Depends(get_current_user)):
    """List bookings scheduled by or received by the user."""
    sb = get_supabase_client()
    res = sb.table("visit_bookings").select("*").or_(f"buyer_id.eq.{current_user.id},seller_id.eq.{current_user.id}").order("preferred_date", desc=True).execute()
    bookings = res.data
    
    if not bookings:
        return []
        
    hydrated = []
    for bk in bookings:
        listing_res = sb.table("listings").select("*").eq("id", bk["listing_id"]).execute()
        listing = listing_res.data[0] if listing_res.data else None
        
        buyer_res = sb.table("app_users").select("*").eq("id", bk["buyer_id"]).execute()
        buyer = buyer_res.data[0] if buyer_res.data else None
        
        seller_res = sb.table("app_users").select("*").eq("id", bk["seller_id"]).execute()
        seller = seller_res.data[0] if seller_res.data else None
        
        hydrated.append(
            VisitBookingOut(
                id=bk["id"],
                listing_id=bk["listing_id"],
                buyer_id=bk["buyer_id"],
                seller_id=bk["seller_id"],
                preferred_date=date.fromisoformat(bk["preferred_date"]) if isinstance(bk["preferred_date"], str) else bk["preferred_date"],
                preferred_slot=bk["preferred_slot"],
                status=bk["status"],
                created_at=bk["created_at"],
                listing=listing,
                buyer=buyer,
                seller=seller,
            )
        )
    return hydrated


@router.post("/bookings", response_model=VisitBookingOut, status_code=201)
async def create_booking(
    payload: VisitBookingCreate,
    current_user: AuthUserOut = Depends(get_current_user),
):
    """Schedule a site walkthrough visit."""
    sb = get_supabase_client()
    listing_res = sb.table("listings").select("*").eq("id", payload.listing_id).execute()
    if not listing_res.data:
        raise HTTPException(status_code=404, detail="Listing not found.")
    listing = listing_res.data[0]
    
    if listing["seller_id"] == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot schedule a visit for your own listing.")
        
    data = payload.model_dump()
    data["buyer_id"] = current_user.id
    data["seller_id"] = listing["seller_id"]
    data["preferred_date"] = payload.preferred_date.isoformat()
    data["status"] = "PENDING"
    
    result = sb.table("visit_bookings").insert(data).execute()
    bk = result.data[0]
    
    # Hydrate for response
    buyer_res = sb.table("app_users").select("*").eq("id", bk["buyer_id"]).execute()
    buyer = buyer_res.data[0] if buyer_res.data else None
    
    seller_res = sb.table("app_users").select("*").eq("id", bk["seller_id"]).execute()
    seller = seller_res.data[0] if seller_res.data else None
    
    return VisitBookingOut(
        id=bk["id"],
        listing_id=bk["listing_id"],
        buyer_id=bk["buyer_id"],
        seller_id=bk["seller_id"],
        preferred_date=date.fromisoformat(bk["preferred_date"]) if isinstance(bk["preferred_date"], str) else bk["preferred_date"],
        preferred_slot=bk["preferred_slot"],
        status=bk["status"],
        created_at=bk["created_at"],
        listing=listing,
        buyer=buyer,
        seller=seller,
    )


@router.post("/bookings/{booking_id}/status", response_model=VisitBookingOut)
async def update_booking_status(
    booking_id: str,
    payload: BookingStatusUpdate,
    current_user: AuthUserOut = Depends(get_current_user),
):
    """Approve, reject, or cancel walkthrough bookings."""
    sb = get_supabase_client()
    bk_res = sb.table("visit_bookings").select("*").eq("id", booking_id).execute()
    if not bk_res.data:
        raise HTTPException(status_code=404, detail="Booking not found.")
    bk = bk_res.data[0]
    
    # Validation logic:
    # Sellers can APPROVE or REJECT.
    # Buyers can CANCEL.
    if payload.status in ("APPROVED", "REJECTED"):
        if current_user.id != bk["seller_id"] and current_user.role.lower() != "admin":
            raise HTTPException(status_code=403, detail="Only sellers can approve or reject bookings.")
    elif payload.status == "CANCELLED":
        if current_user.id != bk["buyer_id"] and current_user.role.lower() != "admin":
            raise HTTPException(status_code=403, detail="Only buyers can cancel bookings.")
            
    result = sb.table("visit_bookings").update({"status": payload.status}).eq("id", booking_id).execute()
    updated = result.data[0]
    
    # Hydrate for response
    listing_res = sb.table("listings").select("*").eq("id", updated["listing_id"]).execute()
    listing = listing_res.data[0] if listing_res.data else None
    
    buyer_res = sb.table("app_users").select("*").eq("id", updated["buyer_id"]).execute()
    buyer = buyer_res.data[0] if buyer_res.data else None
    
    seller_res = sb.table("app_users").select("*").eq("id", updated["seller_id"]).execute()
    seller = seller_res.data[0] if seller_res.data else None
    
    return VisitBookingOut(
        id=updated["id"],
        listing_id=updated["listing_id"],
        buyer_id=updated["buyer_id"],
        seller_id=updated["seller_id"],
        preferred_date=date.fromisoformat(updated["preferred_date"]) if isinstance(updated["preferred_date"], str) else updated["preferred_date"],
        preferred_slot=updated["preferred_slot"],
        status=updated["status"],
        created_at=updated["created_at"],
        listing=listing,
        buyer=buyer,
        seller=seller,
    )


@router.post("/upload-images", response_model=list[str])
async def upload_marketplace_images(
    files: list[UploadFile] = File(...),
    current_user: AuthUserOut = Depends(get_current_user),
):
    """Upload one or more listing images and return their relative URLs."""
    import shutil
    import uuid
    from app.services.tenant_documents import get_uploads_root
    
    urls = []
    marketplace_dir = get_uploads_root() / "marketplace-images"
    marketplace_dir.mkdir(parents=True, exist_ok=True)
    
    for file in files:
        filename = file.filename or ""
        ext = Path(filename).suffix.lower()
        if ext not in {".png", ".jpg", ".jpeg", ".webp"}:
            raise HTTPException(status_code=400, detail=f"Unsupported file format: {ext}")
            
        stored_name = f"{uuid.uuid4().hex}{ext}"
        target_path = marketplace_dir / stored_name
        
        with target_path.open("wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        urls.append(f"/uploads/marketplace-images/{stored_name}")
        
    return urls

