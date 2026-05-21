from fastapi import APIRouter, HTTPException, Header
from typing import Optional
from app.models.schemas import ZoneCreate, ZoneUpdate
from app.services.supabase_client import get_supabase

router = APIRouter(prefix="/zones", tags=["Zones"])


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
async def list_zones(warehouse_id: str, authorization: Optional[str] = Header(None)):
    get_user_id(authorization)
    supabase = get_supabase()
    resp = supabase.table("zones").select("*").eq(
        "warehouse_id", warehouse_id
    ).order("created_at").execute()
    return {"data": resp.data}


@router.post("/")
async def create_zone(data: ZoneCreate, authorization: Optional[str] = Header(None)):
    get_user_id(authorization)
    supabase = get_supabase()
    capacity = data.width_m * data.depth_m * data.height_m
    payload = {
        **data.model_dump(),
        "capacity_m3": round(capacity, 3),
        "utilized_m3": 0
    }
    resp = supabase.table("zones").insert(payload).execute()
    return {"data": resp.data[0], "message": "Zone created"}


@router.put("/{zone_id}")
async def update_zone(
    zone_id: str,
    data: ZoneUpdate,
    authorization: Optional[str] = Header(None)
):
    get_user_id(authorization)
    supabase = get_supabase()
    payload = {k: v for k, v in data.model_dump().items() if v is not None}
    resp = supabase.table("zones").update(payload).eq("id", zone_id).execute()
    return {"data": resp.data[0], "message": "Zone updated"}


@router.delete("/{zone_id}")
async def delete_zone(zone_id: str, authorization: Optional[str] = Header(None)):
    get_user_id(authorization)
    supabase = get_supabase()
    supabase.table("zones").delete().eq("id", zone_id).execute()
    return {"message": "Zone deleted"}
