#!/usr/bin/env python3
"""
GodamAI — Seed Script
=====================
Creates demo data in your Supabase project.

Uses the same URL + KEY pattern as the rest of the app
(from docs: create_client(SUPABASE_URL, SUPABASE_KEY)).

If the admin user doesn't exist, use the Supabase Dashboard
(Authentication > Users > Invite user) or SQL Editor to create:
    admin@godamai.com / admin123

Then run this script to populate warehouses, zones, and items.

Usage:
    cd backend
    python -X utf8 seed.py
"""

import os
import sys
from dotenv import load_dotenv
load_dotenv()

from supabase import create_client

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("Set SUPABASE_URL and SUPABASE_KEY in backend/.env")
    sys.exit(1)

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

ADMIN_EMAIL = "admin@godamai.com"
ADMIN_PASS = "admin123"

print("=== GodamAI Seed Script ===")
print("=" * 44)

# Get or create the admin user
print("\n[1/4] Verifying admin user...")

# Try to sign in (user may already exist from Dashboard)
user_id = None
try:
    session = supabase.auth.sign_in_with_password({
        "email": ADMIN_EMAIL, "password": ADMIN_PASS
    })
    user_id = session.user.id
    print(f"  [OK] Signed in as {ADMIN_EMAIL} (id={user_id[:8]}...)")
except Exception as e:
    print(f"  [WARN] Cannot sign in as {ADMIN_EMAIL}: {e}")
    print(f"\n  Please create the admin user in Supabase Dashboard first:")
    print(f"    Authentication > Users > Invite user")
    print(f"    Email: {ADMIN_EMAIL}")
    print(f"    Password: {ADMIN_PASS}")
    print(f"\n  Then re-run this script.")
    sys.exit(1)

# Ensure profile exists
try:
    # Check if profile exists (use execute() not single() to avoid PGRST116 error)
    prof = supabase.table("profiles").select("id").eq("id", user_id).execute()
    if not prof.data:
        # Create profile manually
        supabase.table("profiles").insert({
            "id": user_id,
            "username": "admin",
            "full_name": "GodamAI Admin",
            "role": "admin"
        }).execute()
        print("  [OK] Admin profile created")
    else:
        print(f"  [OK] Admin profile exists")
except Exception as e:
    print(f"  [WARN] Profile creation failed: {e}")
    # Last resort: use raw SQL if anon key can't write to profiles
    print("  [i] Ensure the profiles RLS policy allows insert. Schema from supabase/schema.sql:")
    print('      CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);')
    sys.exit(1)

# ── 2. Create demo warehouse ───────────────────────────────────────────────
print("\n[2/4] Creating demo warehouse...")
try:
    wh_data = {
        "name": "Main Distribution Centre",
        "description": "Primary warehouse for all incoming and outgoing goods",
        "width_m": 50.0,
        "depth_m": 30.0,
        "height_m": 8.0,
        "address": "Industrial Zone, Sector 5",
        "total_capacity_m3": 12000.0,
        "owner_id": user_id,
        "status": "active"
    }
    wh_resp = supabase.table("warehouses").insert(wh_data).execute()
    wh_id = wh_resp.data[0]["id"]
    print(f"  [OK] Warehouse created (id={wh_id[:8]}...)")
except Exception as e:
    print(f"  [WARN] Warehouse creation: {e}")
    try:
        existing = supabase.table("warehouses").select("id").eq("owner_id", user_id).limit(1).execute()
        if existing.data:
            wh_id = existing.data[0]["id"]
            print(f"  [i] Using existing warehouse (id={wh_id[:8]}...)")
        else:
            print("  [ERR] No warehouse found.")
            sys.exit(1)
    except Exception as e2:
        print(f"  [ERR] {e2}")
        sys.exit(1)

# ── 3. Create zones ────────────────────────────────────────────────────────
print("\n[3/4] Creating demo zones...")
ZONES = [
    {"name": "Rack A - High Freq",  "zone_type": "rack",   "x_pos": 0,  "y_pos": 0,  "z_pos": 0, "width_m": 5, "depth_m": 3, "height_m": 6, "near_exit": True,  "color": "#1f7a8c"},
    {"name": "Rack B - High Freq",  "zone_type": "rack",   "x_pos": 6,  "y_pos": 0,  "z_pos": 0, "width_m": 5, "depth_m": 3, "height_m": 6, "near_exit": True,  "color": "#1f7a8c"},
    {"name": "Rack C - Medium",     "zone_type": "rack",   "x_pos": 12, "y_pos": 0,  "z_pos": 0, "width_m": 5, "depth_m": 3, "height_m": 6, "near_exit": False, "color": "#2d9cdb"},
    {"name": "Rack D - Medium",     "zone_type": "rack",   "x_pos": 18, "y_pos": 0,  "z_pos": 0, "width_m": 5, "depth_m": 3, "height_m": 6, "near_exit": False, "color": "#2d9cdb"},
    {"name": "Shelf Row 1",         "zone_type": "shelf",  "x_pos": 0,  "y_pos": 5,  "z_pos": 0, "width_m": 8, "depth_m": 2, "height_m": 4, "near_exit": False, "color": "#7b68ee"},
    {"name": "Shelf Row 2",         "zone_type": "shelf",  "x_pos": 9,  "y_pos": 5,  "z_pos": 0, "width_m": 8, "depth_m": 2, "height_m": 4, "near_exit": False, "color": "#7b68ee"},
    {"name": "Cold Storage Alpha",  "zone_type": "cold",   "x_pos": 30, "y_pos": 0,  "z_pos": 0, "width_m": 6, "depth_m": 4, "height_m": 4, "near_exit": False, "temperature_controlled": True, "color": "#48cae4"},
    {"name": "HAZMAT Zone",         "zone_type": "hazmat", "x_pos": 40, "y_pos": 0,  "z_pos": 0, "width_m": 4, "depth_m": 4, "height_m": 3, "near_exit": False, "color": "#f4a261"},
    {"name": "Bulk Storage A",      "zone_type": "bulk",   "x_pos": 0,  "y_pos": 15, "z_pos": 0, "width_m": 10,"depth_m": 6, "height_m": 4, "near_exit": False, "color": "#a8dadc"},
    {"name": "Bulk Storage B",      "zone_type": "bulk",   "x_pos": 12, "y_pos": 15, "z_pos": 0, "width_m": 10,"depth_m": 6, "height_m": 4, "near_exit": False, "color": "#a8dadc"},
]
zone_ids = {}
for z in ZONES:
    try:
        cap = z["width_m"] * z["depth_m"] * z["height_m"]
        row = supabase.table("zones").insert({
            **z,
            "warehouse_id": wh_id,
            "capacity_m3": round(cap, 3),
            "utilized_m3": 0,
            "max_weight_kg": None,
            "temperature_controlled": z.get("temperature_controlled", False),
        }).execute()
        zone_ids[z["name"]] = row.data[0]["id"]
        print(f"  [OK] {z['name']}")
    except Exception as e:
        print(f"  [WARN] {z['name']}: {e}")

# ── 4. Create inventory items ──────────────────────────────────────────────
print("\n[4/4] Creating demo inventory items...")
ITEMS = [
    {"sku": "ELEC-LAPT-0001", "name": "Laptop - Dell XPS 15",     "category": "Electronics",     "width_m": 0.35, "depth_m": 0.25, "height_m": 0.03, "weight_kg": 1.8,  "quantity": 50,  "fragile": True,  "stackable": True,  "retrieval_frequency": "high",   "temperature_sensitive": False, "hazardous": False},
    {"sku": "ELEC-PHON-0002", "name": "Smartphone - Samsung S24", "category": "Electronics",     "width_m": 0.16, "depth_m": 0.08, "height_m": 0.01, "weight_kg": 0.2,  "quantity": 200, "fragile": True,  "stackable": True,  "retrieval_frequency": "high",   "temperature_sensitive": False, "hazardous": False},
    {"sku": "MACH-PUMP-0003", "name": "Industrial Water Pump",    "category": "Machinery",       "width_m": 0.80, "depth_m": 0.50, "height_m": 0.60, "weight_kg": 85.0, "quantity": 10,  "fragile": False, "stackable": False, "retrieval_frequency": "low",    "temperature_sensitive": False, "hazardous": False},
    {"sku": "CHEM-ACID-0004", "name": "Hydrochloric Acid 35%",    "category": "Chemical",        "width_m": 0.25, "depth_m": 0.25, "height_m": 0.40, "weight_kg": 12.0, "quantity": 30,  "fragile": True,  "stackable": True,  "retrieval_frequency": "low",    "temperature_sensitive": False, "hazardous": True},
    {"sku": "FOOD-MILK-0005", "name": "Fresh Whole Milk 1L",      "category": "Food & Beverage", "width_m": 0.10, "depth_m": 0.10, "height_m": 0.25, "weight_kg": 1.1,  "quantity": 500, "fragile": False, "stackable": True,  "retrieval_frequency": "high",   "temperature_sensitive": True,  "hazardous": False},
    {"sku": "PACK-CTON-0006", "name": "Cardboard Carton Large",   "category": "Packaging",       "width_m": 0.60, "depth_m": 0.40, "height_m": 0.40, "weight_kg": 2.5,  "quantity": 300, "fragile": False, "stackable": True,  "retrieval_frequency": "medium", "temperature_sensitive": False, "hazardous": False},
    {"sku": "RAWM-COIL-0007", "name": "Steel Coil 50kg",          "category": "Raw Materials",   "width_m": 0.60, "depth_m": 0.60, "height_m": 0.30, "weight_kg": 50.0, "quantity": 40,  "fragile": False, "stackable": True,  "retrieval_frequency": "medium", "temperature_sensitive": False, "hazardous": False},
    {"sku": "AUTO-TIRE-0008", "name": "Car Tyre - 195/65R15",     "category": "Automotive",      "width_m": 0.60, "depth_m": 0.20, "height_m": 0.60, "weight_kg": 8.5,  "quantity": 80,  "fragile": False, "stackable": True,  "retrieval_frequency": "medium", "temperature_sensitive": False, "hazardous": False},
    {"sku": "PHAR-TABL-0009", "name": "Paracetamol 500mg Strip",  "category": "Pharma",          "width_m": 0.15, "depth_m": 0.06, "height_m": 0.02, "weight_kg": 0.05, "quantity": 1000,"fragile": False, "stackable": True,  "retrieval_frequency": "high",   "temperature_sensitive": False, "hazardous": False},
    {"sku": "TEXT-ROLL-0010", "name": "Cotton Fabric Roll",        "category": "Textile",         "width_m": 0.20, "depth_m": 0.20, "height_m": 1.50, "weight_kg": 22.0, "quantity": 25,  "fragile": False, "stackable": False, "retrieval_frequency": "low",    "temperature_sensitive": False, "hazardous": False},
    {"sku": "ELEC-SERV-0011", "name": "Network Switch 24-port",   "category": "Electronics",     "width_m": 0.44, "depth_m": 0.26, "height_m": 0.04, "weight_kg": 2.2,  "quantity": 15,  "fragile": True,  "stackable": True,  "retrieval_frequency": "medium", "temperature_sensitive": False, "hazardous": False},
    {"sku": "FOOD-CHOC-0012", "name": "Dark Chocolate Bar 100g",  "category": "Food & Beverage", "width_m": 0.16, "depth_m": 0.08, "height_m": 0.01, "weight_kg": 0.1,  "quantity": 800, "fragile": False, "stackable": True,  "retrieval_frequency": "medium", "temperature_sensitive": True,  "hazardous": False},
    {"sku": "CHEM-SOLV-0013", "name": "Industrial Solvent 5L",    "category": "Chemical",        "width_m": 0.20, "depth_m": 0.20, "height_m": 0.35, "weight_kg": 6.0,  "quantity": 20,  "fragile": False, "stackable": True,  "retrieval_frequency": "low",    "temperature_sensitive": False, "hazardous": True},
    {"sku": "PACK-WRAP-0014", "name": "Bubble Wrap Roll 100m",    "category": "Packaging",       "width_m": 0.50, "depth_m": 0.50, "height_m": 0.30, "weight_kg": 3.0,  "quantity": 60,  "fragile": False, "stackable": True,  "retrieval_frequency": "high",   "temperature_sensitive": False, "hazardous": False},
    {"sku": "MACH-DRLL-0015", "name": "Power Drill - Bosch",      "category": "Machinery",       "width_m": 0.35, "depth_m": 0.15, "height_m": 0.30, "weight_kg": 2.8,  "quantity": 35,  "fragile": False, "stackable": True,  "retrieval_frequency": "medium", "temperature_sensitive": False, "hazardous": False},
]
for item in ITEMS:
    try:
        supabase.table("inventory_items").insert({
            **item,
            "warehouse_id": wh_id,
            "description": f"Demo item: {item['name']}",
        }).execute()
        tag = "[HAZ]" if item["hazardous"] else "[TEMP]" if item["temperature_sensitive"] else "     "
        print(f"  [OK] {tag} [{item['sku']}] {item['name']}")
    except Exception as e:
        print(f"  [WARN] {item['name']}: {e}")

print("\n" + "=" * 44)
print("[OK] Seed complete!")
print(f"\n  Admin login:  {ADMIN_EMAIL}")
print(f"  Password:     admin123")
print(f"\n  Warehouse:   Main Distribution Centre")
print(f"  Items:       {len(ITEMS)} SKUs seeded")
print(f"  Zones:       {len(ZONES)} zones created")
print(f"\n  Start backend: uvicorn app.main:app --reload")
print("=" * 44)