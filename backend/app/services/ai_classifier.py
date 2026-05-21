"""
GodamAI — AI Image Classification Service
=========================================
Uses Claude Vision API to analyse uploaded item photos and return:
  • Item category
  • Estimated dimensions (width / depth / height in metres)
  • Estimated weight
  • Storage flags (fragile, stackable, hazardous, temperature-sensitive)
  • Retrieval frequency suggestion
  • Plain-language description
"""

import os
import base64
import json
import logging
import re
from typing import Dict, Any, Optional

logger = logging.getLogger("godamai.ai_classifier")

ANTHROPIC_AVAILABLE = False
try:
    import anthropic
    ANTHROPIC_AVAILABLE = True
except ImportError:
    logger.warning("anthropic package not installed — image classification will use heuristics only")


SYSTEM_PROMPT = """You are an expert warehouse logistics AI for GodamAI.
Your task: analyse the photo of a warehouse item and return a JSON object with these fields:

{
  "category": string,          // e.g. "Electronics", "Raw Materials", "Machinery", "Chemical", "Food & Beverage", "Textile", "Packaging", "Automotive", "Pharma", "Other"
  "name_suggestion": string,   // short descriptive name, max 40 chars
  "description": string,       // 1-2 sentences about the item
  "estimated_width_m": float,  // width in metres (realistic warehouse estimate)
  "estimated_depth_m": float,  // depth in metres
  "estimated_height_m": float, // height in metres
  "estimated_weight_kg": float,// realistic weight estimate
  "stackable": boolean,        // can items be stacked on top?
  "fragile": boolean,          // does it need careful handling?
  "hazardous": boolean,        // is it a chemical / flammable / dangerous good?
  "temperature_sensitive": boolean, // needs refrigeration or climate control?
  "retrieval_frequency": string,    // "high" | "medium" | "low" — how often is this type picked?
  "storage_notes": string,     // brief storage tip, e.g. "Store upright, away from moisture"
  "confidence": float          // 0.0–1.0, how confident you are in these estimates
}

Respond ONLY with the JSON object. No markdown fences, no extra text.
Make realistic metric estimates — consider standard warehouse item sizes.
If the image is unclear, still provide your best estimate and lower the confidence."""


def _fallback_analysis(filename: str = "") -> Dict[str, Any]:
    """Rule-based fallback when Claude API is unavailable."""
    name = filename.lower()
    if any(k in name for k in ["box", "carton", "pkg", "pack"]):
        return {
            "category": "Packaging",
            "name_suggestion": "Cardboard Carton",
            "description": "Standard corrugated cardboard carton for general storage.",
            "estimated_width_m": 0.4, "estimated_depth_m": 0.3, "estimated_height_m": 0.3,
            "estimated_weight_kg": 2.0,
            "stackable": True, "fragile": False, "hazardous": False, "temperature_sensitive": False,
            "retrieval_frequency": "medium",
            "storage_notes": "Can be stacked up to 8 high on pallets.",
            "confidence": 0.45,
        }
    return {
        "category": "Other",
        "name_suggestion": "Warehouse Item",
        "description": "Unclassified item — please verify dimensions manually.",
        "estimated_width_m": 0.5, "estimated_depth_m": 0.5, "estimated_height_m": 0.5,
        "estimated_weight_kg": 10.0,
        "stackable": True, "fragile": False, "hazardous": False, "temperature_sensitive": False,
        "retrieval_frequency": "medium",
        "storage_notes": "Verify storage requirements before placement.",
        "confidence": 0.2,
    }


async def analyse_item_image(
    image_bytes: bytes,
    media_type: str = "image/jpeg",
    filename: str = "",
    extra_context: str = "",
) -> Dict[str, Any]:
    """
    Analyse an item image and return structured metadata.
    Falls back to heuristics if Claude API is unavailable.
    """
    if not ANTHROPIC_AVAILABLE:
        logger.info("Fallback: anthropic not available")
        return _fallback_analysis(filename)

    api_key = os.getenv("ANTHROPIC_API_KEY", "")
    if not api_key:
        logger.warning("ANTHROPIC_API_KEY not set — using fallback")
        return _fallback_analysis(filename)

    try:
        client = anthropic.Anthropic(api_key=api_key)
        image_b64 = base64.standard_b64encode(image_bytes).decode("utf-8")

        user_content = [
            {
                "type": "image",
                "source": {
                    "type": "base64",
                    "media_type": media_type,
                    "data": image_b64,
                },
            },
            {
                "type": "text",
                "text": (
                    f"Analyse this warehouse item image and return JSON as instructed."
                    + (f" Additional context: {extra_context}" if extra_context else "")
                ),
            },
        ]

        response = client.messages.create(
            model="claude-opus-4-5",
            max_tokens=800,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_content}],
        )

        raw = response.content[0].text.strip()
        # Strip any accidental markdown fences
        raw = re.sub(r"^```(?:json)?\s*", "", raw)
        raw = re.sub(r"\s*```$", "", raw)

        data = json.loads(raw)

        # Clamp dimensions to sensible warehouse ranges
        for dim_key in ("estimated_width_m", "estimated_depth_m", "estimated_height_m"):
            data[dim_key] = round(max(0.05, min(float(data.get(dim_key, 0.5)), 20.0)), 3)
        data["estimated_weight_kg"] = round(max(0.1, min(float(data.get("estimated_weight_kg", 5)), 50000)), 2)
        data["confidence"] = round(max(0.0, min(float(data.get("confidence", 0.7)), 1.0)), 2)

        logger.info(f"Image classified: category={data.get('category')}, conf={data.get('confidence')}")
        return data

    except json.JSONDecodeError as e:
        logger.error(f"JSON parse error from Claude: {e}")
        return {**_fallback_analysis(filename), "error": "Could not parse AI response"}
    except Exception as e:
        logger.error(f"Claude API error: {e}")
        return {**_fallback_analysis(filename), "error": str(e)}


async def suggest_sku(name: str, category: str) -> str:
    """Generate a human-readable SKU from item name and category."""
    cat_code = "".join(w[0] for w in category.split()[:2]).upper() or "XX"
    name_code = "".join(c for c in name.upper() if c.isalpha())[:4].ljust(4, "X")
    import random, string
    suffix = "".join(random.choices(string.digits, k=4))
    return f"{cat_code}-{name_code}-{suffix}"
