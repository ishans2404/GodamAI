"""
GodamAI — Analytics Router
GET /api/analytics/overview          → platform-wide KPIs
GET /api/analytics/warehouse/{id}    → per-warehouse drill-down
GET /api/analytics/optimization-trend/{id} → history of scores over time
GET /api/analytics/inventory-breakdown/{id} → category/freq distribution
"""

import logging
from fastapi import APIRouter, HTTPException, Header
from typing import Optional
from app.services.supabase_client import get_supabase

logger = logging.getLogger("godamai.router.analytics")
router = APIRouter(prefix="/analytics", tags=["Analytics"])


def _get_user(authorization: Optional[str]) -> str:
    if not authorization:
        raise HTTPException(status_code=401, detail="Authorization required")
    supabase = get_supabase()
    token = authorization.replace("Bearer ", "")
    try:
        return supabase.auth.get_user(token).user.id
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")


# ---------------------------------------------------------------------------
# Platform overview
# ---------------------------------------------------------------------------
@router.get("/overview")
async def get_overview(authorization: Optional[str] = Header(None)):
    _get_user(authorization)
    sb = get_supabase()

    wh   = sb.table("warehouses").select("*").execute()
    items = sb.table("inventory_items").select("*").execute()
    zones = sb.table("zones").select("*").execute()
    opts  = sb.table("optimization_runs").select("*").eq("status", "completed").execute()
    placements = sb.table("placements").select("*").execute()

    wh_list    = wh.data or []
    item_list  = items.data or []
    zone_list  = zones.data or []
    opt_list   = opts.data or []
    place_list = placements.data or []

    total_cap  = sum(w.get("total_capacity_m3", 0) or 0 for w in wh_list)
    total_units = sum(i.get("quantity", 1) or 1 for i in item_list)
    avg_score  = (sum(o.get("optimization_score", 0) or 0 for o in opt_list) / len(opt_list)
                  if opt_list else 0)
    hazmat_count = sum(1 for i in item_list if i.get("hazardous"))
    fragile_count = sum(1 for i in item_list if i.get("fragile"))
    temp_count   = sum(1 for i in item_list if i.get("temperature_sensitive"))

    total_used_vol = sum(
        z.get("utilized_m3", 0) or 0 for z in zone_list
    )
    total_zone_vol = sum(
        (z.get("width_m",1) or 1) * (z.get("depth_m",1) or 1) * (z.get("height_m",1) or 1)
        for z in zone_list
    )
    platform_util = round((total_used_vol / total_zone_vol * 100) if total_zone_vol > 0 else 0, 1)

    # Category breakdown across all warehouses
    category_map: dict = {}
    for i in item_list:
        cat = i.get("category") or "Other"
        category_map[cat] = category_map.get(cat, 0) + (i.get("quantity", 1) or 1)

    # Zone type breakdown
    zone_type_map: dict = {}
    for z in zone_list:
        zt = z.get("zone_type", "rack")
        zone_type_map[zt] = zone_type_map.get(zt, 0) + 1

    return {
        "warehouses": len(wh_list),
        "active_warehouses": sum(1 for w in wh_list if w.get("status") == "active"),
        "total_capacity_m3": round(total_cap, 2),
        "total_items_skus": len(item_list),
        "total_item_units": total_units,
        "total_zones": len(zone_list),
        "total_placements": len(place_list),
        "total_optimizations": len(opt_list),
        "avg_optimization_score": round(avg_score, 1),
        "platform_utilization_pct": platform_util,
        "hazmat_count": hazmat_count,
        "fragile_count": fragile_count,
        "temp_sensitive_count": temp_count,
        "category_breakdown": [
            {"name": k, "value": v}
            for k, v in sorted(category_map.items(), key=lambda x: -x[1])
        ],
        "zone_type_breakdown": [
            {"name": k, "value": v}
            for k, v in sorted(zone_type_map.items(), key=lambda x: -x[1])
        ],
    }


# ---------------------------------------------------------------------------
# Per-warehouse drill-down
# ---------------------------------------------------------------------------
@router.get("/warehouse/{warehouse_id}")
async def get_warehouse_analytics(
    warehouse_id: str, authorization: Optional[str] = Header(None)
):
    _get_user(authorization)
    sb = get_supabase()

    wh    = sb.table("warehouses").select("*").eq("id", warehouse_id).single().execute()
    zones = sb.table("zones").select("*").eq("warehouse_id", warehouse_id).execute()
    items = sb.table("inventory_items").select("*").eq("warehouse_id", warehouse_id).execute()
    placements = sb.table("placements").select("*").eq("warehouse_id", warehouse_id).execute()
    opts  = sb.table("optimization_runs").select("*").eq(
        "warehouse_id", warehouse_id
    ).eq("status", "completed").order("created_at", desc=True).limit(20).execute()

    if not wh.data:
        raise HTTPException(status_code=404, detail="Warehouse not found")

    zone_list  = zones.data or []
    item_list  = items.data or []
    place_list = placements.data or []
    opt_list   = opts.data or []

    # Per-zone utilization
    zone_utils = []
    for z in zone_list:
        cap = (z.get("width_m",1) or 1) * (z.get("depth_m",1) or 1) * (z.get("height_m",1) or 1)
        used = z.get("utilized_m3", 0) or 0
        util = round((used / cap * 100) if cap > 0 else 0, 1)
        zone_utils.append({
            "name": z.get("name", "?"),
            "type": z.get("zone_type", "rack"),
            "capacity": round(cap, 2),
            "used": round(used, 2),
            "utilization": util,
            "near_exit": z.get("near_exit", False),
        })

    # Freq breakdown
    freq_map = {"high": 0, "medium": 0, "low": 0}
    for i in item_list:
        f = i.get("retrieval_frequency", "medium")
        freq_map[f] = freq_map.get(f, 0) + (i.get("quantity", 1) or 1)

    # Category breakdown
    cat_map: dict = {}
    for i in item_list:
        cat = i.get("category") or "Other"
        cat_map[cat] = cat_map.get(cat, 0) + (i.get("quantity", 1) or 1)

    # Optimization score trend
    score_trend = [
        {
            "date": o.get("created_at", "")[:10],
            "score": o.get("optimization_score", 0),
            "utilization": o.get("space_utilization_pct", 0),
            "placed": o.get("items_placed", 0),
        }
        for o in reversed(opt_list)
    ]

    # Flag counts
    total_units = sum(i.get("quantity", 1) or 1 for i in item_list)
    flags = {
        "hazardous":  sum(1 for i in item_list if i.get("hazardous")),
        "fragile":    sum(1 for i in item_list if i.get("fragile")),
        "temp_sensitive": sum(1 for i in item_list if i.get("temperature_sensitive")),
        "stackable":  sum(1 for i in item_list if i.get("stackable", True)),
    }

    latest = opt_list[0] if opt_list else {}

    return {
        "warehouse": wh.data,
        "total_zones": len(zone_list),
        "total_items": len(item_list),
        "total_units": total_units,
        "total_placements": len(place_list),
        "latest_optimization_score": latest.get("optimization_score"),
        "latest_utilization_pct": latest.get("space_utilization_pct"),
        "zone_utilization": zone_utils,
        "frequency_breakdown": [
            {"name": k.capitalize(), "value": v, "color":
             "#10b981" if k=="high" else "#f59e0b" if k=="medium" else "#6b7280"}
            for k, v in freq_map.items()
        ],
        "category_breakdown": [
            {"name": k, "value": v}
            for k, v in sorted(cat_map.items(), key=lambda x: -x[1])
        ],
        "score_trend": score_trend,
        "item_flags": flags,
    }


# ---------------------------------------------------------------------------
# Optimization trend
# ---------------------------------------------------------------------------
@router.get("/optimization-trend/{warehouse_id}")
async def get_optimization_trend(
    warehouse_id: str, authorization: Optional[str] = Header(None)
):
    _get_user(authorization)
    sb = get_supabase()
    opts = sb.table("optimization_runs").select("*").eq(
        "warehouse_id", warehouse_id
    ).order("created_at", desc=True).limit(30).execute()

    runs = list(reversed(opts.data or []))
    return {
        "runs": [
            {
                "run_id": o["id"],
                "date": o.get("created_at", "")[:16],
                "score": o.get("optimization_score", 0),
                "utilization_pct": o.get("space_utilization_pct", 0),
                "items_placed": o.get("items_placed", 0),
                "items_unplaced": o.get("items_unplaced", 0),
                "status": o.get("status", "?"),
                "run_time_ms": o.get("run_time_ms", 0),
            }
            for o in runs
        ]
    }


# ---------------------------------------------------------------------------
# Inventory breakdown
# ---------------------------------------------------------------------------
@router.get("/inventory-breakdown/{warehouse_id}")
async def get_inventory_breakdown(
    warehouse_id: str, authorization: Optional[str] = Header(None)
):
    _get_user(authorization)
    sb = get_supabase()
    items = sb.table("inventory_items").select("*").eq(
        "warehouse_id", warehouse_id
    ).execute()

    item_list = items.data or []

    # Top items by total volume (qty × vol)
    vol_items = sorted(
        [
            {
                "name": i.get("name", "?"),
                "sku": i.get("sku", ""),
                "category": i.get("category", "Other"),
                "quantity": i.get("quantity", 1),
                "volume_each": round(
                    (i.get("width_m",0.3) or 0.3) *
                    (i.get("depth_m",0.3) or 0.3) *
                    (i.get("height_m",0.3) or 0.3), 4
                ),
                "total_volume": round(
                    (i.get("width_m",0.3) or 0.3) *
                    (i.get("depth_m",0.3) or 0.3) *
                    (i.get("height_m",0.3) or 0.3) *
                    (i.get("quantity",1) or 1), 4
                ),
                "weight_kg": i.get("weight_kg", 0),
                "retrieval_frequency": i.get("retrieval_frequency", "medium"),
            }
            for i in item_list
        ],
        key=lambda x: -x["total_volume"]
    )

    return {
        "items": vol_items[:50],
        "total_skus": len(item_list),
        "total_units": sum(i.get("quantity",1) or 1 for i in item_list),
        "total_volume_m3": round(sum(v["total_volume"] for v in vol_items), 3),
        "total_weight_kg": round(sum(
            (i.get("weight_kg",0) or 0) * (i.get("quantity",1) or 1)
            for i in item_list
        ), 2),
    }
