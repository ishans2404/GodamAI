from fastapi import APIRouter, HTTPException, Header
from typing import Optional
from app.models.schemas import WarehouseCreate, WarehouseUpdate
from app.services.supabase_client import get_supabase

router = APIRouter(prefix="/warehouses", tags=["Warehouses"])


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


@router.get("/")
async def list_warehouses(authorization: Optional[str] = Header(None)):
    get_user_id(authorization)
    supabase = get_supabase()
    resp = supabase.table("warehouses").select(
        "*, zones(count)"
    ).order("created_at", desc=True).execute()
    return {"data": resp.data}


@router.get("/{warehouse_id}")
async def get_warehouse(warehouse_id: str, authorization: Optional[str] = Header(None)):
    get_user_id(authorization)
    supabase = get_supabase()
    resp = supabase.table("warehouses").select("*").eq(
        "id", warehouse_id
    ).single().execute()
    if not resp.data:
        raise HTTPException(status_code=404, detail="Warehouse not found")
    return {"data": resp.data}


@router.post("/")
async def create_warehouse(data: WarehouseCreate, authorization: Optional[str] = Header(None)):
    user_id = get_user_id(authorization)
    supabase = get_supabase()
    total_capacity = data.width_m * data.depth_m * data.height_m
    payload = {
        **data.model_dump(),
        "owner_id": user_id,
        "total_capacity_m3": round(total_capacity, 3)
    }
    resp = supabase.table("warehouses").insert(payload).execute()
    return {"data": resp.data[0], "message": "Warehouse created successfully"}


@router.put("/{warehouse_id}")
async def update_warehouse(
    warehouse_id: str,
    data: WarehouseUpdate,
    authorization: Optional[str] = Header(None)
):
    get_user_id(authorization)
    supabase = get_supabase()
    payload = {k: v for k, v in data.model_dump().items() if v is not None}
    if "width_m" in payload or "depth_m" in payload or "height_m" in payload:
        # Recalculate total capacity
        existing = supabase.table("warehouses").select("*").eq("id", warehouse_id).single().execute()
        if existing.data:
            w = payload.get("width_m", existing.data["width_m"])
            d = payload.get("depth_m", existing.data["depth_m"])
            h = payload.get("height_m", existing.data["height_m"])
            payload["total_capacity_m3"] = round(w * d * h, 3)

    resp = supabase.table("warehouses").update(payload).eq("id", warehouse_id).execute()
    return {"data": resp.data[0], "message": "Warehouse updated"}


@router.delete("/{warehouse_id}")
async def delete_warehouse(warehouse_id: str, authorization: Optional[str] = Header(None)):
    get_user_id(authorization)
    supabase = get_supabase()
    supabase.table("warehouses").delete().eq("id", warehouse_id).execute()
    return {"message": "Warehouse deleted"}


@router.get("/{warehouse_id}/stats")
async def get_warehouse_stats(warehouse_id: str, authorization: Optional[str] = Header(None)):
    get_user_id(authorization)
    supabase = get_supabase()

    warehouse = supabase.table("warehouses").select("*").eq("id", warehouse_id).single().execute()
    zones = supabase.table("zones").select("*").eq("warehouse_id", warehouse_id).execute()
    items = supabase.table("inventory_items").select("*").eq("warehouse_id", warehouse_id).execute()
    placements = supabase.table("placements").select("*").eq("warehouse_id", warehouse_id).execute()
    opt_runs = supabase.table("optimization_runs").select("*").eq(
        "warehouse_id", warehouse_id
    ).order("created_at", desc=True).limit(1).execute()

    total_zone_vol = sum(
        z["width_m"] * z["depth_m"] * z["height_m"]
        for z in (zones.data or [])
    )
    total_items = sum(i.get("quantity", 1) for i in (items.data or []))
    placed_count = len(placements.data or [])

    latest_run = opt_runs.data[0] if opt_runs.data else None

    return {
        "warehouse": warehouse.data,
        "total_zones": len(zones.data or []),
        "total_items": len(items.data or []),
        "total_item_units": total_items,
        "placed_items": placed_count,
        "total_zone_volume_m3": round(total_zone_vol, 2),
        "latest_optimization": latest_run
    }
