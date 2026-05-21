"""
GodamAI — AI Services Router
Endpoints:
  POST /api/ai/analyse-image   → Claude Vision item analysis
  POST /api/ai/suggest-sku     → Auto SKU generation
  GET  /api/ai/slotting-advice/{warehouse_id} → AI slotting recommendations
"""

import io
import logging
from fastapi import APIRouter, HTTPException, Header, UploadFile, File, Form
from fastapi.responses import JSONResponse
from typing import Optional

from app.services.supabase_client import get_supabase
from app.services.ai_classifier import analyse_item_image, suggest_sku
from app.services.optimizer import compute_space_adjustments, generate_ai_recommendations

logger = logging.getLogger("godamai.router.ai")
router = APIRouter(prefix="/ai", tags=["AI Services"])

ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
MAX_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB


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
# POST /api/ai/analyse-image
# ---------------------------------------------------------------------------
@router.post("/analyse-image")
async def analyse_image(
    file: UploadFile = File(...),
    context: str = Form(default=""),
    authorization: Optional[str] = Header(None),
):
    """
    Upload a photo of an inventory item.
    Returns AI-detected category, estimated dimensions, weight, and storage flags.
    """
    _get_user(authorization)

    content_type = file.content_type or "image/jpeg"
    if content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {content_type}. Use JPEG, PNG, or WebP."
        )

    data = await file.read()
    if len(data) > MAX_SIZE_BYTES:
        raise HTTPException(status_code=413, detail="Image exceeds 10 MB limit.")
    if len(data) < 100:
        raise HTTPException(status_code=400, detail="Image file appears empty.")

    result = await analyse_item_image(
        image_bytes=data,
        media_type=content_type,
        filename=file.filename or "",
        extra_context=context,
    )

    # Map to inventory item fields
    response = {
        "ai_analysis": result,
        "suggested_fields": {
            "name":                   result.get("name_suggestion", ""),
            "category":               result.get("category", "Other"),
            "description":            result.get("description", ""),
            "width_m":                result.get("estimated_width_m", 0.5),
            "depth_m":                result.get("estimated_depth_m", 0.5),
            "height_m":               result.get("estimated_height_m", 0.5),
            "weight_kg":              result.get("estimated_weight_kg", 10),
            "stackable":              result.get("stackable", True),
            "fragile":                result.get("fragile", False),
            "hazardous":              result.get("hazardous", False),
            "temperature_sensitive":  result.get("temperature_sensitive", False),
            "retrieval_frequency":    result.get("retrieval_frequency", "medium"),
        },
        "storage_notes":   result.get("storage_notes", ""),
        "confidence":      result.get("confidence", 0.5),
        "error":           result.get("error"),
    }
    return response


# ---------------------------------------------------------------------------
# POST /api/ai/suggest-sku
# ---------------------------------------------------------------------------
@router.post("/suggest-sku")
async def get_sku_suggestion(
    name: str = Form(...),
    category: str = Form(default="Other"),
    authorization: Optional[str] = Header(None),
):
    _get_user(authorization)
    sku = await suggest_sku(name, category)
    return {"sku": sku}


# ---------------------------------------------------------------------------
# GET /api/ai/slotting-advice/{warehouse_id}
# ---------------------------------------------------------------------------
@router.get("/slotting-advice/{warehouse_id}")
async def get_slotting_advice(
    warehouse_id: str,
    authorization: Optional[str] = Header(None),
):
    """
    Return space-adjustment analysis + relocation suggestions for a warehouse.
    """
    _get_user(authorization)
    supabase = get_supabase()

    zones_resp = supabase.table("zones").select("*").eq("warehouse_id", warehouse_id).execute()
    items_resp = supabase.table("inventory_items").select("*").eq("warehouse_id", warehouse_id).execute()
    placements_resp = supabase.table("placements").select("*").eq("warehouse_id", warehouse_id).execute()
    wh_resp = supabase.table("warehouses").select("*").eq("id", warehouse_id).single().execute()

    zones      = zones_resp.data or []
    items      = items_resp.data or []
    placements = placements_resp.data or []
    warehouse  = wh_resp.data or {}

    if not zones:
        return {"advice": "No zones defined. Add storage zones before requesting slotting advice.",
                "adjustments": {}}

    adjustments = compute_space_adjustments(zones, placements, items)

    # Also pull latest optimization run for score context
    opt_resp = supabase.table("optimization_runs").select("*").eq(
        "warehouse_id", warehouse_id
    ).eq("status", "completed").order("created_at", desc=True).limit(1).execute()

    last_run = opt_resp.data[0] if opt_resp.data else {}
    recs = last_run.get("ai_recommendations") or []

    return {
        "warehouse_id": warehouse_id,
        "adjustments":  adjustments,
        "ai_recommendations": recs,
        "last_optimization_score": last_run.get("optimization_score"),
        "last_run_at": last_run.get("completed_at"),
    }


# ---------------------------------------------------------------------------
# GET /api/ai/dimension-estimate
# ---------------------------------------------------------------------------
@router.get("/dimension-estimate")
async def dimension_estimate_help(authorization: Optional[str] = Header(None)):
    """Return common item dimension presets for the frontend."""
    _get_user(authorization)
    return {
        "presets": [
            {"label": "Small Parcel",       "w": 0.30, "d": 0.20, "h": 0.15, "weight": 1.5},
            {"label": "Medium Carton",      "w": 0.60, "d": 0.40, "h": 0.40, "weight": 8.0},
            {"label": "Large Carton",       "w": 1.00, "d": 0.60, "h": 0.60, "weight": 20.0},
            {"label": "Euro Pallet",        "w": 1.20, "d": 0.80, "h": 1.20, "weight": 250.0},
            {"label": "Half Pallet",        "w": 0.80, "d": 0.60, "h": 1.00, "weight": 120.0},
            {"label": "IBC Tote (1000L)",   "w": 1.20, "d": 1.00, "h": 1.15, "weight": 1300.0},
            {"label": "Steel Drum (200L)",  "w": 0.58, "d": 0.58, "h": 0.88, "weight": 180.0},
            {"label": "Small Electronics",  "w": 0.35, "d": 0.25, "h": 0.20, "weight": 2.0},
            {"label": "Machinery Part",     "w": 1.50, "d": 1.00, "h": 0.80, "weight": 400.0},
            {"label": "Textile Roll",       "w": 0.20, "d": 0.20, "h": 1.50, "weight": 25.0},
        ]
    }
