from fastapi import APIRouter, HTTPException, Header
from typing import Optional
from datetime import datetime
from app.models.schemas import OptimizationRequest
from app.services.supabase_client import get_supabase
from app.services.optimizer import optimize_warehouse, generate_ai_recommendations

router = APIRouter(prefix="/optimization", tags=["Optimization"])


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


@router.post("/run")
async def run_optimization(data: OptimizationRequest, authorization: Optional[str] = Header(None)):
    """Run warehouse optimization engine."""
    user_id = get_user_id(authorization)
    supabase = get_supabase()

    # Fetch warehouse
    warehouse_resp = supabase.table("warehouses").select("*").eq(
        "id", data.warehouse_id
    ).single().execute()
    if not warehouse_resp.data:
        raise HTTPException(status_code=404, detail="Warehouse not found")

    # Fetch zones
    zones_resp = supabase.table("zones").select("*").eq(
        "warehouse_id", data.warehouse_id
    ).execute()
    zones = zones_resp.data or []

    if not zones:
        raise HTTPException(status_code=400, detail="No zones defined. Add zones before optimizing.")

    # Fetch items
    items_resp = supabase.table("inventory_items").select("*").eq(
        "warehouse_id", data.warehouse_id
    ).execute()
    items = items_resp.data or []

    if not items:
        raise HTTPException(status_code=400, detail="No inventory items. Add items before optimizing.")

    # Create optimization run record
    run_resp = supabase.table("optimization_runs").insert({
        "warehouse_id": data.warehouse_id,
        "triggered_by": user_id,
        "status": "running",
        "algorithm": "greedy_3d_bin_pack"
    }).execute()
    run_id = run_resp.data[0]["id"]

    try:
        # Run optimization
        result = optimize_warehouse(
            items=items,
            zones=zones,
            warehouse=warehouse_resp.data,
            priorities=data.priorities
        )

        metrics = result["metrics"]
        placements = result["placements"]
        warnings = result["warnings"]

        # Generate AI recommendations
        recommendations = generate_ai_recommendations(result, warehouse_resp.data, items, zones)

        # Clear existing placements if requested
        if data.clear_existing:
            supabase.table("placements").delete().eq(
                "warehouse_id", data.warehouse_id
            ).execute()

        # Save placements
        if placements:
            placement_records = [
                {
                    "optimization_run_id": run_id,
                    "item_id": p["item_id"],
                    "zone_id": p["zone_id"],
                    "warehouse_id": data.warehouse_id,
                    "x_pos": p["x_pos"],
                    "y_pos": p["y_pos"],
                    "z_pos": p["z_pos"],
                    "quantity_placed": p["quantity_placed"]
                }
                for p in placements
            ]
            supabase.table("placements").insert(placement_records).execute()

        # Update optimization run
        supabase.table("optimization_runs").update({
            "status": "completed",
            "space_utilization_pct": metrics["space_utilization_pct"],
            "items_placed": metrics["items_placed"],
            "items_unplaced": metrics["items_unplaced"],
            "optimization_score": metrics["optimization_score"],
            "ai_recommendations": recommendations,
            "run_time_ms": metrics["run_time_ms"],
            "completed_at": datetime.utcnow().isoformat()
        }).eq("id", run_id).execute()

        # Update zone utilizations
        for zone_id, util in result.get("zone_utilization", {}).items():
            zone = next((z for z in zones if z["id"] == zone_id), None)
            if zone:
                used_vol = zone["width_m"] * zone["depth_m"] * zone["height_m"] * (util / 100)
                supabase.table("zones").update({
                    "utilized_m3": round(used_vol, 3)
                }).eq("id", zone_id).execute()

        return {
            "run_id": run_id,
            "warehouse_id": data.warehouse_id,
            "status": "completed",
            "metrics": metrics,
            "placements": placements,
            "ai_recommendations": recommendations,
            "zone_utilization": result.get("zone_utilization", {}),
            "warnings": warnings,
            "unplaced_items": result.get("unplaced_items", [])
        }

    except Exception as e:
        # Mark run as failed
        supabase.table("optimization_runs").update({
            "status": "failed",
            "completed_at": datetime.utcnow().isoformat()
        }).eq("id", run_id).execute()
        raise HTTPException(status_code=500, detail=f"Optimization failed: {str(e)}")


@router.get("/history/{warehouse_id}")
async def get_optimization_history(
    warehouse_id: str,
    authorization: Optional[str] = Header(None)
):
    get_user_id(authorization)
    supabase = get_supabase()
    resp = supabase.table("optimization_runs").select("*").eq(
        "warehouse_id", warehouse_id
    ).order("created_at", desc=True).limit(10).execute()
    return {"data": resp.data}


@router.get("/placements/{warehouse_id}")
async def get_placements(
    warehouse_id: str,
    authorization: Optional[str] = Header(None)
):
    get_user_id(authorization)
    supabase = get_supabase()
    resp = supabase.table("placements").select(
        "*, inventory_items(name, category, width_m, depth_m, height_m, retrieval_frequency), zones(name, zone_type, color, x_pos, y_pos, z_pos)"
    ).eq("warehouse_id", warehouse_id).execute()
    return {"data": resp.data}


@router.get("/space-adjustments/{warehouse_id}")
async def get_space_adjustments(
    warehouse_id: str,
    authorization: Optional[str] = Header(None)
):
    """Compute live space-adjustment analysis without running a full optimisation."""
    get_user_id(authorization)
    supabase = get_supabase()

    from app.services.optimizer import compute_space_adjustments

    zones_r  = supabase.table("zones").select("*").eq("warehouse_id", warehouse_id).execute()
    items_r  = supabase.table("inventory_items").select("*").eq("warehouse_id", warehouse_id).execute()
    place_r  = supabase.table("placements").select("*").eq("warehouse_id", warehouse_id).execute()

    zones      = zones_r.data or []
    items      = items_r.data or []
    placements = place_r.data or []

    if not zones:
        return {"message": "No zones defined", "adjustments": {}}

    adjustments = compute_space_adjustments(zones, placements, items)
    return {"warehouse_id": warehouse_id, "adjustments": adjustments}
