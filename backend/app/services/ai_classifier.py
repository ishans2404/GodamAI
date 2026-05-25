"""
GodamAI — AI Item Classifier (Zero-cost heuristic version)
==========================================================
No external API calls. Uses filename patterns, image metadata,
and smart category rules to suggest item properties.
All analysis is local and instant.
"""

import os
import re
import logging
import random
import string
from typing import Dict, Any

logger = logging.getLogger("godamai.ai_classifier")

# ---------------------------------------------------------------------------
# Category keyword rules
# ---------------------------------------------------------------------------

CATEGORY_RULES = {
    "Electronics": [
        "laptop", "phone", "mobile", "tablet", "computer", "monitor", "keyboard",
        "mouse", "printer", "camera", "tv", "television", "speaker", "headphone",
        "router", "switch", "server", "battery", "charger", "cable", "usb",
        "hard drive", "ssd", "ram", "cpu", "gpu", "motherboard", "electronic",
        "circuit", "sensor", "display", "screen",
    ],
    "Machinery": [
        "pump", "motor", "engine", "compressor", "generator", "drill", "saw",
        "grinder", "lathe", "press", "conveyor", "crane", "forklift", "machine",
        "equipment", "tool", "wrench", "hammer", "screwdriver", "plier", "valve",
        "gear", "bearing", "shaft", "turbine", "hydraulic",
    ],
    "Chemical": [
        "acid", "base", "solvent", "chemical", "reagent", "paint", "resin",
        "adhesive", "lubricant", "oil", "grease", "fuel", "gas", "detergent",
        "bleach", "alcohol", "peroxide", "flammable", "corrosive",
    ],
    "Food & Beverage": [
        "food", "drink", "beverage", "milk", "juice", "water", "wine", "beer",
        "coffee", "tea", "sugar", "flour", "rice", "cereal", "snack", "chocolate",
        "candy", "fruit", "vegetable", "meat", "fish", "cheese", "butter", "egg",
        "bread", "biscuit", "cookie", "sauce", "oil", "spice",
    ],
    "Textile": [
        "fabric", "textile", "cloth", "cotton", "wool", "silk", "polyester",
        "nylon", "linen", "thread", "yarn", "garment", "shirt", "pant", "dress",
        "jacket", "coat", "uniform", "towel", "bedsheet", "curtain", "carpet",
    ],
    "Packaging": [
        "box", "carton", "pallet", "crate", "bag", "pouch", "wrap", "tape",
        "label", "container", "drum", "barrel", "tote", "bin", "bucket",
        "packaging", "bubble", "foam", "envelope",
    ],
    "Automotive": [
        "tyre", "tire", "wheel", "brake", "engine", "car", "vehicle", "auto",
        "battery", "filter", "oil", "bumper", "door", "seat", "mirror", "lamp",
        "exhaust", "clutch", "transmission", "suspension", "axle",
    ],
    "Pharma": [
        "tablet", "capsule", "syrup", "injection", "medicine", "drug", "pharma",
        "health", "vitamin", "supplement", "medical", "surgical", "bandage",
        "glove", "mask", "syringe", "vial", "ampoule",
    ],
    "Raw Materials": [
        "steel", "iron", "copper", "aluminium", "aluminum", "metal", "wood",
        "timber", "lumber", "stone", "concrete", "sand", "gravel", "coal",
        "ore", "rubber", "plastic", "glass", "ceramic", "paper", "pulp",
    ],
}

STORAGE_FLAGS_RULES = {
    "fragile":             ["glass", "ceramic", "crystal", "electronic", "screen", "monitor",
                            "laptop", "phone", "camera", "fragile", "delicate"],
    "hazardous":           ["acid", "chemical", "solvent", "fuel", "flammable", "explosive",
                            "toxic", "corrosive", "bleach", "paint", "battery acid"],
    "temperature_sensitive":["food", "milk", "juice", "meat", "fish", "dairy", "cheese",
                             "vaccine", "medicine", "pharma", "frozen", "fresh", "cold",
                             "beverage", "drink", "chocolate", "ice cream"],
}

# Typical dimension ranges by category (min_w, max_w, min_d, max_d, min_h, max_h) in metres
CATEGORY_DIMS = {
    "Electronics":    (0.1,  0.6,  0.05, 0.4,  0.01, 0.4,  0.5,  30.0),
    "Machinery":      (0.3,  2.0,  0.2,  1.5,  0.2,  1.5,  10.0, 500.0),
    "Chemical":       (0.15, 0.6,  0.15, 0.6,  0.2,  0.9,  3.0,  25.0),
    "Food & Beverage":(0.05, 0.5,  0.05, 0.4,  0.05, 0.4,  0.2,  10.0),
    "Textile":        (0.2,  1.5,  0.1,  0.5,  0.1,  1.5,  2.0,  30.0),
    "Packaging":      (0.2,  1.2,  0.2,  1.0,  0.1,  0.8,  0.5,  10.0),
    "Automotive":     (0.1,  1.0,  0.1,  0.8,  0.1,  0.8,  0.5,  50.0),
    "Pharma":         (0.05, 0.3,  0.03, 0.2,  0.01, 0.15, 0.05, 2.0),
    "Raw Materials":  (0.3,  2.0,  0.3,  1.5,  0.1,  1.2,  5.0,  200.0),
    "Other":          (0.2,  0.8,  0.2,  0.6,  0.1,  0.6,  2.0,  20.0),
}

# Retrieval frequency by category
CATEGORY_FREQ = {
    "Electronics":     "high",
    "Food & Beverage": "high",
    "Pharma":          "high",
    "Packaging":       "high",
    "Textile":         "medium",
    "Automotive":      "medium",
    "Machinery":       "low",
    "Chemical":        "low",
    "Raw Materials":   "low",
    "Other":           "medium",
}

STORAGE_NOTES = {
    "Electronics":     "Store in anti-static packaging; keep away from moisture and heat.",
    "Machinery":       "Ensure floor-level placement; block wheels if applicable.",
    "Chemical":        "Store in ventilated hazmat zone; segregate from flammables.",
    "Food & Beverage": "Requires temperature-controlled cold storage; check expiry.",
    "Textile":         "Store upright on rolls or flat; protect from moisture.",
    "Packaging":       "Stack on pallets; keep dry.",
    "Automotive":      "Store tyres vertically; keep parts in sealed bags.",
    "Pharma":          "Maintain controlled temperature; track batch/expiry.",
    "Raw Materials":   "Heavy — store on reinforced floor zones.",
    "Other":           "Verify storage requirements before placement.",
}


# ---------------------------------------------------------------------------
# Core classifier
# ---------------------------------------------------------------------------

def _classify_from_text(text: str) -> Dict[str, Any]:
    """Classify item based on name/filename text."""
    text_lower = text.lower()

    # Detect category
    category = "Other"
    best_score = 0
    for cat, keywords in CATEGORY_RULES.items():
        score = sum(1 for kw in keywords if kw in text_lower)
        if score > best_score:
            best_score = score
            category = cat

    # Detect storage flags
    fragile = any(kw in text_lower for kw in STORAGE_FLAGS_RULES["fragile"])
    hazardous = any(kw in text_lower for kw in STORAGE_FLAGS_RULES["hazardous"])
    temperature_sensitive = any(kw in text_lower for kw in STORAGE_FLAGS_RULES["temperature_sensitive"])

    # Determine stackable
    stackable = not any(kw in text_lower for kw in
                        ["drum", "barrel", "non-stack", "do not stack", "heavy", "machinery"])

    # Get dimension range for category
    dims = CATEGORY_DIMS.get(category, CATEGORY_DIMS["Other"])
    min_w, max_w, min_d, max_d, min_h, max_h, min_wt, max_wt = dims

    # Mid-range estimates (deterministic, not random)
    w = round((min_w + max_w) / 2, 2)
    d = round((min_d + max_d) / 2, 2)
    h = round((min_h + max_h) / 2, 2)
    weight = round((min_wt + max_wt) / 3, 1)  # skew lighter

    # Adjust if specific keywords found
    if any(kw in text_lower for kw in ["small", "mini", "micro", "tiny"]):
        w = round(min_w * 1.2, 2); d = round(min_d * 1.2, 2); h = round(min_h * 1.2, 2)
        weight = round(min_wt * 1.5, 1)
    elif any(kw in text_lower for kw in ["large", "big", "heavy", "bulk", "pallet"]):
        w = round(max_w * 0.8, 2); d = round(max_d * 0.8, 2); h = round(max_h * 0.8, 2)
        weight = round(max_wt * 0.6, 1)

    # Build name suggestion from filename
    name_parts = re.sub(r'[_\-\.]+', ' ', text)
    name_parts = re.sub(r'\.(jpg|jpeg|png|webp|gif)$', '', name_parts, flags=re.IGNORECASE)
    name_suggestion = name_parts.strip().title()[:40] or f"{category} Item"

    freq = CATEGORY_FREQ.get(category, "medium")
    confidence = 0.55 if best_score > 0 else 0.25

    return {
        "category":         category,
        "name_suggestion":  name_suggestion,
        "description":      f"{category} item detected by filename analysis.",
        "estimated_width_m":  w,
        "estimated_depth_m":  d,
        "estimated_height_m": h,
        "estimated_weight_kg": weight,
        "stackable":           stackable,
        "fragile":             fragile,
        "hazardous":           hazardous,
        "temperature_sensitive": temperature_sensitive,
        "retrieval_frequency": freq,
        "storage_notes":       STORAGE_NOTES.get(category, "Verify storage requirements."),
        "confidence":          confidence,
    }


def _default_result() -> Dict[str, Any]:
    return {
        "category":            "Other",
        "name_suggestion":     "Warehouse Item",
        "description":         "Item uploaded — please verify details manually.",
        "estimated_width_m":   0.5,
        "estimated_depth_m":   0.5,
        "estimated_height_m":  0.5,
        "estimated_weight_kg": 10.0,
        "stackable":           True,
        "fragile":             False,
        "hazardous":           False,
        "temperature_sensitive": False,
        "retrieval_frequency": "medium",
        "storage_notes":       "Verify storage requirements before placement.",
        "confidence":          0.20,
    }


# ---------------------------------------------------------------------------
# Public API (matches original interface)
# ---------------------------------------------------------------------------

async def analyse_item_image(
    image_bytes: bytes,
    media_type: str = "image/jpeg",
    filename: str = "",
    extra_context: str = "",
) -> Dict[str, Any]:
    """
    Analyse an item image using heuristics only.
    No external API calls — zero cost, instant response.
    """
    # Combine filename + extra context for keyword matching
    search_text = f"{filename} {extra_context}".strip()

    if search_text:
        result = _classify_from_text(search_text)
    else:
        result = _default_result()

    logger.info(
        f"Heuristic classification: category={result['category']}, "
        f"conf={result['confidence']}, file='{filename}'"
    )
    return result


async def suggest_sku(name: str, category: str) -> str:
    """Generate a human-readable SKU from item name and category."""
    cat_code  = "".join(w[0] for w in category.split()[:2]).upper() or "XX"
    name_code = "".join(c for c in name.upper() if c.isalpha())[:4].ljust(4, "X")
    suffix    = "".join(random.choices(string.digits, k=4))
    return f"{cat_code}-{name_code}-{suffix}"