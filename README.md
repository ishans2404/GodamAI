# GodamAI — AI-Powered Warehouse Space Planning

> Intelligent 3D bin-packing · Dynamic slotting optimisation · Claude Vision item analysis

---

## Quick Start

### 1 — Supabase setup (2 minutes)
1. Create a free project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** → paste the entire contents of `supabase/schema.sql` → **Run**
3. Copy your **Project URL**, **anon key**, and **service_role key** from *Project Settings → API*

### 2 — Backend
```bash
cd backend
cp .env.example .env          # fill in your Supabase keys + Anthropic key
pip install -r requirements.txt
uvicorn app.main:app --reload  # → http://localhost:8000
# API docs: http://localhost:8000/api/docs
```

### 3 — Seed demo data
```bash
cd backend
python seed.py
# Creates: admin@godamai.com / admin123 + demo warehouse + 15 items
```

### 4 — Frontend
```bash
cd frontend
npm install
npm run dev                    # → http://localhost:5173
```

### 5 — Login
```
Email:    admin@godamai.com
Password: admin123
```

---

## Architecture

```
GodamAI
├── backend/                   Python 3.11 · FastAPI 0.115
│   ├── app/
│   │   ├── main.py            CORS, router registration
│   │   ├── routers/
│   │   │   ├── auth.py        Login · Signup · Change password
│   │   │   ├── warehouses.py  CRUD · Stats
│   │   │   ├── zones.py       CRUD per warehouse
│   │   │   ├── inventory.py   CRUD · Bulk delete · CSV export data
│   │   │   ├── optimization.py Run · History · Placements · Space adjustments
│   │   │   ├── ai.py          Image analysis · SKU generation · Slotting advice
│   │   │   └── analytics.py   Platform KPIs · Warehouse drill-down · Trends
│   │   ├── services/
│   │   │   ├── optimizer.py   3D Extreme-Point Bin Packing engine
│   │   │   ├── ai_classifier.py Claude Vision item analysis
│   │   │   └── supabase_client.py
│   │   └── models/
│   │       └── schemas.py     Pydantic v2 request/response models
│   ├── seed.py                One-shot demo data seeder
│   └── requirements.txt
│
├── frontend/                  React 18 · Vite 5 · Tailwind 3
│   └── src/
│       ├── pages/
│       │   ├── Login.jsx      Animated auth with demo-fill button
│       │   ├── Dashboard.jsx  KPI cards · Category & frequency charts
│       │   ├── Warehouses.jsx Create/edit/delete warehouses
│       │   ├── WarehouseDetail.jsx
│       │   │                  3D viewer · Space heatmap · Zones · Placements
│       │   ├── Inventory.jsx  AI image upload · Dimension presets · Full CRUD
│       │   ├── Optimization.jsx
│       │   │                  Priority sliders · Live results · AI advice · History
│       │   ├── Analytics.jsx  Platform overview · Per-warehouse drill-down
│       │   └── Settings.jsx   Profile · Password · Notification prefs
│       └── components/
│           ├── WarehouseViewer3D.jsx  Three.js / React Three Fiber
│           ├── SpaceHeatmap.jsx       Zone utilisation heat cards
│           ├── ImageAnalyzer.jsx      Drag-drop AI image analysis
│           ├── Sidebar.jsx
│           └── Layout.jsx
│
├── supabase/
│   └── schema.sql             Full DB schema with RLS policies
├── docker-compose.yml
├── start_backend.sh
└── start_frontend.sh
```

---

## Key Features

### 🤖 AI Image Analysis
Upload a photo of any item — Claude Vision returns:
- Detected category, name suggestion, description
- Estimated width / depth / height (metres)
- Estimated weight (kg)
- Storage flags: stackable, fragile, hazardous, temperature-sensitive
- Retrieval frequency recommendation
- Storage notes

All fields are applied to the inventory form in one click.

### 📦 3D Bin Packing Optimizer
Implements **3D Extreme-Point Bin Packing** with:
- **6-orientation item rotation** — tries all valid rotations to fit items tighter
- **Zone-type routing** — hazmat→hazmat zones, cold items→temperature-controlled zones
- **Weight-stacking validation** — respects `max_weight_kg` per zone
- **Frequency-exit pairing** — high-frequency items are automatically placed near exit zones
- **Fragile floor preference** — fragile items placed at z=0 first
- **Support validation** — items must rest on floor or on top of placed items

### 🌡️ Space Heatmap & Adjustments
Live analysis of current placements:
- Per-zone utilisation with heat colouring (green → amber → red)
- Critical zone detection (≥90% full)
- **Relocation suggestions** — moves low-frequency items out of hot zones
- **Fragile elevation warnings** — fragile items placed above ground level
- **Stacking violations** — non-stackable items placed at z > 0
- Estimated recoverable space (m³)

### 📊 Analytics
- Platform-wide KPIs: total warehouses, SKUs, optimisation score, utilisation %
- Per-warehouse drill-down: zone bars, frequency pie, score trend chart
- Top-items-by-volume table
- Optimisation score trend (area chart)

---

## Environment Variables

### backend/.env
```
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_KEY=eyJ...
ANTHROPIC_API_KEY=sk-ant-...      # optional — enables real AI image analysis
FRONTEND_URL=http://localhost:5173
SECRET_KEY=change-in-production
```

> **AI Image Analysis** works without an Anthropic key — falls back to rule-based heuristics.  
> Set `ANTHROPIC_API_KEY` for full Claude Vision analysis.

---

## Docker

```bash
# Set credentials in backend/.env first
docker compose up --build
# Backend: http://localhost:8000
# Frontend: http://localhost:5173
```

---

## Database Tables

| Table | Purpose |
|---|---|
| `profiles` | User profiles (linked to Supabase auth) |
| `warehouses` | Warehouse facilities |
| `zones` | Storage zones/racks within warehouses |
| `inventory_items` | Inventory SKUs with dimensions & flags |
| `placements` | Item → zone assignments from optimisation |
| `optimization_runs` | Audit log of all optimisation runs |

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| POST | `/api/auth/login` | Login |
| POST | `/api/auth/signup` | Register |
| POST | `/api/auth/change-password` | Change password |
| GET | `/api/warehouses/` | List warehouses |
| POST | `/api/warehouses/` | Create warehouse |
| GET | `/api/warehouses/{id}/stats` | Warehouse KPIs |
| GET | `/api/zones/warehouse/{id}` | List zones |
| POST | `/api/zones/` | Create zone |
| GET | `/api/inventory/all` | All inventory items |
| POST | `/api/inventory/` | Create item |
| POST | `/api/optimization/run` | Run AI optimisation |
| GET | `/api/optimization/placements/{id}` | Get current placements |
| GET | `/api/optimization/space-adjustments/{id}` | Space analysis |
| POST | `/api/ai/analyse-image` | Claude Vision item analysis |
| GET | `/api/ai/slotting-advice/{id}` | AI slotting advice |
| GET | `/api/ai/dimension-estimate` | Dimension presets |
| GET | `/api/analytics/overview` | Platform KPIs |
| GET | `/api/analytics/warehouse/{id}` | Warehouse analytics |

Full interactive docs: `http://localhost:8000/api/docs`

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite 5, Tailwind CSS 3 |
| 3D Visualisation | Three.js, @react-three/fiber, @react-three/drei |
| Charts | Recharts |
| Animations | Framer Motion |
| State | Zustand |
| Backend | Python 3.11, FastAPI 0.115 |
| AI | Anthropic Claude (Vision + Text) |
| Database | Supabase (PostgreSQL 15) |
| Auth | Supabase Auth (JWT) |
| Optimisation | Custom 3D Extreme-Point Bin Packing |

---

## Colour Palette

| Name | Hex |
|---|---|
| Navy | `#022b3a` |
| Teal | `#1f7a8c` |
| Sky | `#bfdbf7` |
| Frost | `#e1e5f2` |
| White | `#ffffff` |
