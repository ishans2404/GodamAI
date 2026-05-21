from fastapi import APIRouter, HTTPException, Header
from typing import Optional
from app.models.schemas import InventoryItemCreate, InventoryItemUpdate
from app.services.supabase_client import get_supabase

router = APIRouter(prefix="/inventory", tags=["Inventory"])


def get_user_id(authorization: Optional[str]) -> str:
    if not authorization:
        raise HTTPException(status_code=401, detail="Authorization required")
    supabase = get_supabase()
    token = authorization.replace("Bearer ", "")
    try:
        user = supabase.auth.get_user(token)
        return user.user.id
    except:
        raise HTTPException(status_code=401, detail="Invalid token")


@router.get("/warehouse/{warehouse_id}")
async def list_items(warehouse_id: str, authorization: Optional[str] = Header(None)):
    get_user_id(authorization)
    supabase = get_supabase()
    resp = supabase.table("inventory_items").select("*").eq(
        "warehouse_id", warehouse_id
    ).order("created_at", desc=True).execute()
    return {"data": resp.data}


@router.get("/all")
async def list_all_items(authorization: Optional[str] = Header(None)):
    get_user_id(authorization)
    supabase = get_supabase()
    resp = supabase.table("inventory_items").select(
        "*, warehouses(name)"
    ).order("created_at", desc=True).execute()
    return {"data": resp.data}


@router.post("/")
async def create_item(data: InventoryItemCreate, authorization: Optional[str] = Header(None)):
    get_user_id(authorization)
    supabase = get_supabase()
    payload = data.model_dump()
    # Auto-generate SKU if not provided
    if not payload.get("sku"):
        import random, string
        payload["sku"] = "SKU-" + "".join(random.choices(string.ascii_uppercase + string.digits, k=8))

    resp = supabase.table("inventory_items").insert(payload).execute()
    return {"data": resp.data[0], "message": "Item created"}


@router.put("/{item_id}")
async def update_item(
    item_id: str,
    data: InventoryItemUpdate,
    authorization: Optional[str] = Header(None)
):
    get_user_id(authorization)
    supabase = get_supabase()
    payload = {k: v for k, v in data.model_dump().items() if v is not None}
    resp = supabase.table("inventory_items").update(payload).eq("id", item_id).execute()
    return {"data": resp.data[0], "message": "Item updated"}


@router.delete("/{item_id}")
async def delete_item(item_id: str, authorization: Optional[str] = Header(None)):
    get_user_id(authorization)
    supabase = get_supabase()
    supabase.table("inventory_items").delete().eq("id", item_id).execute()
    return {"message": "Item deleted"}


@router.get("/summary")
async def get_inventory_summary(authorization: Optional[str] = Header(None)):
    get_user_id(authorization)
    supabase = get_supabase()
    resp = supabase.table("inventory_items").select("*").execute()
    items = resp.data or []

    by_category = {}
    by_frequency = {"high": 0, "medium": 0, "low": 0}
    total_units = 0
    hazmat_count = 0

    for item in items:
        cat = item.get("category", "Uncategorized") or "Uncategorized"
        by_category[cat] = by_category.get(cat, 0) + item.get("quantity", 1)
        freq = item.get("retrieval_frequency", "medium")
        by_frequency[freq] = by_frequency.get(freq, 0) + 1
        total_units += item.get("quantity", 1)
        if item.get("hazardous"):
            hazmat_count += 1

    return {
        "total_items": len(items),
        "total_units": total_units,
        "by_category": by_category,
        "by_frequency": by_frequency,
        "hazmat_count": hazmat_count
    }
