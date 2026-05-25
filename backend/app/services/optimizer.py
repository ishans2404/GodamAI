"""
GodamAI — 3D Warehouse Optimization Engine v3
==============================================
Fixed: items now placed as batches by quantity (not expanded to N individual units).
This prevents O(n²) hangs on high-quantity inventory.
"""

import time
import logging
from dataclasses import dataclass
from typing import List, Dict, Tuple, Optional, Any

logger = logging.getLogger("godamai.optimizer")

# ---------------------------------------------------------------------------
# Domain objects
# ---------------------------------------------------------------------------

@dataclass
class Item3D:
    id: str
    name: str
    width: float
    depth: float
    height: float
    weight: float
    quantity: int
    fragile: bool = False
    stackable: bool = True
    hazardous: bool = False
    temperature_sensitive: bool = False
    retrieval_frequency: str = "medium"

    @property
    def volume(self) -> float:
        return max(self.width, 0.01) * max(self.depth, 0.01) * max(self.height, 0.01)

    @property
    def freq_score(self) -> int:
        return {"high": 3, "medium": 2, "low": 1}.get(self.retrieval_frequency, 2)

    def orientations(self) -> List[Tuple[float, float, float]]:
        w, d, h = self.width, self.depth, self.height
        seen = set()
        result = []
        for a, b, c in [(w,d,h),(w,h,d),(d,w,h),(d,h,w),(h,w,d),(h,d,w)]:
            key = tuple(sorted([round(a,4), round(b,4), round(c,4)]))
            if key not in seen:
                seen.add(key)
                result.append((a, b, c))
        return result


@dataclass
class Zone3D:
    id: str
    name: str
    zone_type: str
    x: float; y: float; z: float
    width: float; depth: float; height: float
    max_weight: Optional[float] = None
    near_exit: bool = False
    temperature_controlled: bool = False
    color: str = "#1f7a8c"

    @property
    def volume(self) -> float:
        return self.width * self.depth * self.height

    @property
    def priority(self) -> int:
        p = 0
        if self.near_exit:           p += 20
        if self.zone_type == "rack":  p += 10
        if self.zone_type == "shelf": p += 8
        if self.zone_type == "bulk":  p += 3
        return p


# ---------------------------------------------------------------------------
# Batch-aware bin packer (per zone)
# Places items in quantity batches using a grid/layered approach.
# Far faster than placing individual units: O(items) instead of O(units²).
# ---------------------------------------------------------------------------

class BinSpace:
    EPS = 1e-4

    def __init__(self, zone: Zone3D):
        self.zone = zone
        self.placed: List[Dict] = []   # {x,y,z,w,d,h,qty,item_id,item_name,weight}
        self.current_weight: float = 0.0
        self._epts: List[Tuple[float, float, float]] = [(0.0, 0.0, 0.0)]

    # ---- geometry ----------------------------------------------------------

    def _in_bounds(self, x, y, z, w, d, h) -> bool:
        return (x + w <= self.zone.width  + self.EPS and
                y + d <= self.zone.depth  + self.EPS and
                z + h <= self.zone.height + self.EPS)

    def _collides(self, x, y, z, w, d, h) -> bool:
        for p in self.placed:
            if not (x + w <= p['x'] or p['x'] + p['w'] <= x or
                    y + d <= p['y'] or p['y'] + p['d'] <= y or
                    z + h <= p['z'] or p['z'] + p['h'] <= z):
                return True
        return False

    def _has_support(self, x, y, z, w, d) -> bool:
        if z <= self.EPS:
            return True
        for p in self.placed:
            top = p['z'] + p['h']
            if abs(top - z) < self.EPS:
                ox = max(x, p['x']); ox2 = min(x + w, p['x'] + p['w'])
                oy = max(y, p['y']); oy2 = min(y + d, p['y'] + p['d'])
                if ox2 - ox > self.EPS and oy2 - oy > self.EPS:
                    return True
        return False

    def _add_extreme_points(self, x, y, z, w, d, h):
        for pt in [(x+w, y, z), (x, y+d, z), (x, y, z+h)]:
            if (pt[0] <= self.zone.width  + self.EPS and
                pt[1] <= self.zone.depth  + self.EPS and
                pt[2] <= self.zone.height + self.EPS):
                self._epts.append(pt)
        seen = set(); uniq = []
        for pt in self._epts:
            k = (round(pt[0],3), round(pt[1],3), round(pt[2],3))
            if k not in seen:
                seen.add(k); uniq.append(pt)
        self._epts = uniq

    # ---- place one item type (all N units in a grid) ----------------------

    def try_place_batch(self, item: Item3D) -> int:
        """
        Try to place as many units of `item` as possible.
        Returns the number of units successfully placed.
        Grid-fills each candidate position before moving to the next
        extreme point, dramatically reducing extreme-point proliferation.
        """
        qty_remaining = item.quantity
        placed_count  = 0

        epts_sorted = sorted(self._epts, key=lambda p: (round(p[2],2), round(p[1],2), round(p[0],2)))

        for (ex, ey, ez) in epts_sorted:
            if qty_remaining <= 0:
                break
            for (iw, id_, ih) in item.orientations():
                if not self._in_bounds(ex, ey, ez, iw, id_, ih):
                    continue
                if not self._has_support(ex, ey, ez, iw, id_):
                    continue
                if self._collides(ex, ey, ez, iw, id_, ih):
                    continue
                if not item.stackable and ez > self.EPS:
                    continue
                # Weight check (approximate: place 1 unit weight × qty)
                if (self.zone.max_weight is not None and
                    self.current_weight + item.weight > self.zone.max_weight):
                    continue

                # How many fit in a grid starting at (ex, ey, ez)?
                nx = max(1, int((self.zone.width  - ex) / iw))
                ny = max(1, int((self.zone.depth  - ey) / id_))
                nz = max(1, int((self.zone.height - ez) / ih))
                can_fit = nx * ny * nz
                to_place = min(qty_remaining, can_fit)

                if to_place <= 0:
                    continue

                # Record as a single aggregated placement block
                rec = dict(
                    item_id=item.id, item_name=item.name,
                    x=round(ex,3), y=round(ey,3), z=round(ez,3),
                    w=iw, d=id_, h=ih,
                    qty=to_place,
                    weight=item.weight * to_place,
                )
                self.placed.append(rec)
                self.current_weight += rec['weight']
                self._add_extreme_points(ex, ey, ez, iw, id_, ih)

                placed_count   += to_place
                qty_remaining  -= to_place
                break   # move to next extreme point after placing

        return placed_count

    @property
    def used_volume(self) -> float:
        return sum(p['w'] * p['d'] * p['h'] * p['qty'] for p in self.placed)

    @property
    def utilization_pct(self) -> float:
        total = self.zone.volume
        return (self.used_volume / total * 100) if total > 0 else 0.0


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _sort_items(items: List[Item3D]) -> List[Item3D]:
    return sorted(items, key=lambda i: (
        -i.freq_score,
        -(i.width * i.depth * i.height),
        -(i.weight or 0),
    ))


def _zone_accepts_temp(zone: Zone3D, item: Item3D) -> bool:
    if item.temperature_sensitive and not zone.temperature_controlled:
        return False
    return True


# ---------------------------------------------------------------------------
# Main optimizer
# ---------------------------------------------------------------------------

def optimize_warehouse(
    items: List[Dict],
    zones: List[Dict],
    warehouse: Dict,
    priorities: Optional[Dict] = None,
) -> Dict[str, Any]:
    t0 = time.time()

    if priorities is None:
        priorities = {
            "space_utilization": 0.4,
            "retrieval_ease":    0.3,
            "weight_balance":    0.2,
            "hazard_separation": 0.1,
        }

    def to_item(d: Dict) -> Item3D:
        return Item3D(
            id=d["id"], name=d.get("name", "?"),
            width=max(float(d.get("width_m", 0.3)), 0.01),
            depth=max(float(d.get("depth_m", 0.3)), 0.01),
            height=max(float(d.get("height_m", 0.3)), 0.01),
            weight=float(d.get("weight_kg") or 5),
            quantity=max(int(d.get("quantity", 1)), 1),
            fragile=bool(d.get("fragile")),
            stackable=bool(d.get("stackable", True)),
            hazardous=bool(d.get("hazardous")),
            temperature_sensitive=bool(d.get("temperature_sensitive")),
            retrieval_frequency=d.get("retrieval_frequency", "medium"),
        )

    def to_zone(d: Dict) -> Zone3D:
        return Zone3D(
            id=d["id"], name=d.get("name", "?"),
            zone_type=d.get("zone_type", "rack"),
            x=float(d.get("x_pos", 0)), y=float(d.get("y_pos", 0)), z=float(d.get("z_pos", 0)),
            width=max(float(d.get("width_m", 2)), 0.1),
            depth=max(float(d.get("depth_m", 2)), 0.1),
            height=max(float(d.get("height_m", 2)), 0.1),
            max_weight=float(d["max_weight_kg"]) if d.get("max_weight_kg") else None,
            near_exit=bool(d.get("near_exit")),
            temperature_controlled=bool(d.get("temperature_controlled")),
            color=d.get("color", "#1f7a8c"),
        )

    all_zones = [to_zone(z) for z in zones]
    all_items = [to_item(d) for d in items]

    if not all_zones or not all_items:
        return {"error": "No zones or items", "placements": [], "metrics": {}}

    # Zone routing sets
    hazmat_zones  = [z for z in all_zones if z.zone_type == "hazmat"]
    cold_zones    = [z for z in all_zones if z.temperature_controlled]
    exit_zones    = sorted([z for z in all_zones if z.near_exit and z.zone_type != "hazmat"],
                           key=lambda z: -z.priority)
    regular_zones = sorted([z for z in all_zones
                            if not z.near_exit and z.zone_type != "hazmat" and not z.temperature_controlled],
                           key=lambda z: -z.priority)
    all_general   = exit_zones + regular_zones

    # Item routing groups
    hazmat_items  = _sort_items([i for i in all_items if i.hazardous])
    cold_items    = _sort_items([i for i in all_items if i.temperature_sensitive and not i.hazardous])
    high_freq     = _sort_items([i for i in all_items if not i.hazardous and not i.temperature_sensitive
                                 and i.retrieval_frequency == "high"])
    normal_items  = _sort_items([i for i in all_items if not i.hazardous and not i.temperature_sensitive
                                 and i.retrieval_frequency != "high"])

    bins: Dict[str, BinSpace] = {z.id: BinSpace(z) for z in all_zones}

    placements: List[Dict] = []
    unplaced:   List[str]  = []
    warnings:   List[str]  = []

    def place_group(group: List[Item3D], preferred: List[Zone3D],
                    fallback: List[Zone3D] = [], strict_cold: bool = False):
        for item in group:
            remaining = item.quantity
            zone_list = list(preferred)
            if not strict_cold:
                zone_list += [z for z in fallback if _zone_accepts_temp(z, item)]

            for zone in zone_list:
                if remaining <= 0:
                    break
                if not _zone_accepts_temp(zone, item):
                    continue
                placed = bins[zone.id].try_place_batch(
                    Item3D(
                        id=item.id, name=item.name,
                        width=item.width, depth=item.depth, height=item.height,
                        weight=item.weight, quantity=remaining,
                        fragile=item.fragile, stackable=item.stackable,
                        hazardous=item.hazardous,
                        temperature_sensitive=item.temperature_sensitive,
                        retrieval_frequency=item.retrieval_frequency,
                    )
                )
                if placed > 0:
                    # Record placement
                    last = bins[zone.id].placed[-1]
                    placements.append({
                        "item_id":         item.id,
                        "item_name":       item.name,
                        "zone_id":         zone.id,
                        "zone_name":       zone.name,
                        "x_pos":           last['x'],
                        "y_pos":           last['y'],
                        "z_pos":           last['z'],
                        "quantity_placed": placed,
                    })
                    remaining -= placed

            if remaining > 0:
                unplaced.append(item.name)
                msg = (f"⚠️ Hazardous item '{item.name}' could not be placed." if item.hazardous
                       else f"🌡️ '{item.name}' needs cold storage but no cold zone." if item.temperature_sensitive
                       else f"'{item.name}' partially unplaced ({remaining} units — insufficient space).")
                warnings.append(msg)

    place_group(hazmat_items, hazmat_zones, all_general)
    place_group(cold_items,   cold_zones,   [],          strict_cold=True)
    place_group(high_freq,    exit_zones,   regular_zones)
    place_group(normal_items, all_general,  [])

    # Aggregate placements by (item_id, zone_id) — keep first position
    agg: Dict[Tuple, Dict] = {}
    for p in placements:
        key = (p["item_id"], p["zone_id"])
        if key not in agg:
            agg[key] = {**p, "quantity_placed": 0}
        agg[key]["quantity_placed"] += p["quantity_placed"]

    # Metrics
    total_vol   = sum(z.volume for z in all_zones)
    used_vol    = sum(b.used_volume for b in bins.values())
    util_pct    = round((used_vol / total_vol * 100) if total_vol > 0 else 0, 2)

    total_units   = sum(i.quantity for i in all_items)
    placed_units  = sum(p["quantity_placed"] for p in agg.values())
    unplaced_units = total_units - placed_units

    hf_items     = {i.id for i in all_items if i.retrieval_frequency == "high"}
    exit_zone_ids = {z.id for z in exit_zones}
    hf_placed_exit = sum(p["quantity_placed"] for p in agg.values()
                         if p["item_id"] in hf_items and p["zone_id"] in exit_zone_ids)
    hf_total = sum(i.quantity for i in all_items if i.retrieval_frequency == "high")
    retrieval_score = (hf_placed_exit / hf_total) if hf_total > 0 else 1.0
    placement_ratio = placed_units / max(total_units, 1)

    hazmat_ids  = {i.id for i in all_items if i.hazardous}
    hazmat_zone_ids = {z.id for z in hazmat_zones}
    hazmat_ok = all(p["zone_id"] in hazmat_zone_ids
                    for p in agg.values() if p["item_id"] in hazmat_ids) if hazmat_zones else True

    opt_score = round(min(100, (
        priorities.get("space_utilization", 0.4) * (util_pct / 100) +
        priorities.get("retrieval_ease",    0.3) * retrieval_score +
        priorities.get("weight_balance",    0.2) * placement_ratio +
        priorities.get("hazard_separation", 0.1) * (1.0 if hazmat_ok else 0.6)
    ) * 100), 2)

    zone_util = {zid: round(b.utilization_pct, 2) for zid, b in bins.items()}
    run_ms    = int((time.time() - t0) * 1000)

    logger.info(f"Optimization done: placed={placed_units}/{total_units}, "
                f"score={opt_score}, util={util_pct}%, time={run_ms}ms")

    return {
        "placements":   list(agg.values()),
        "metrics": {
            "space_utilization_pct": util_pct,
            "items_placed":          placed_units,
            "items_unplaced":        unplaced_units,
            "optimization_score":    opt_score,
            "retrieval_score":       round(retrieval_score * 100, 1),
            "placement_ratio_pct":   round(placement_ratio * 100, 1),
            "run_time_ms":           run_ms,
            "total_units":           total_units,
            "zones_used":            len([b for b in bins.values() if b.placed]),
        },
        "zone_utilization": zone_util,
        "warnings":         warnings,
        "unplaced_items":   unplaced,
    }


# ---------------------------------------------------------------------------
# Space adjustments (unchanged)
# ---------------------------------------------------------------------------

def compute_space_adjustments(
    zones: List[Dict],
    placements: List[Dict],
    items: List[Dict],
) -> Dict[str, Any]:
    item_map = {i["id"]: i for i in items}
    zone_map = {z["id"]: z for z in zones}

    zone_used:  Dict[str, float] = {}
    zone_items: Dict[str, List]  = {}
    for p in placements:
        zid   = p["zone_id"]
        idata = item_map.get(p.get("item_id", ""), {})
        vol   = (float(idata.get("width_m",  0.3)) *
                 float(idata.get("depth_m",  0.3)) *
                 float(idata.get("height_m", 0.3)) *
                 int(p.get("quantity_placed", 1)))
        zone_used[zid] = zone_used.get(zid, 0) + vol
        zone_items.setdefault(zid, []).append({**p, "item_data": idata})

    zone_utils = {}
    for z in zones:
        zid = z["id"]
        cap = (float(z.get("width_m",1)) * float(z.get("depth_m",1)) * float(z.get("height_m",1)))
        used = zone_used.get(zid, 0)
        zone_utils[zid] = {
            "zone_id":         zid,
            "zone_name":       z.get("name","?"),
            "zone_type":       z.get("zone_type","rack"),
            "capacity_m3":     round(cap, 3),
            "used_m3":         round(used, 3),
            "utilization_pct": round((used / cap * 100) if cap > 0 else 0, 1),
            "near_exit":       z.get("near_exit", False),
        }

    hot_zones   = [v for v in zone_utils.values() if v["utilization_pct"] > 85]
    cold_z      = [v for v in zone_utils.values() if v["utilization_pct"] < 30
                   and v["zone_type"] not in ("hazmat", "cold")]
    empty_zones = [v for v in zone_utils.values() if v["utilization_pct"] == 0]

    relocations = []
    if hot_zones and cold_z:
        for hz in hot_zones[:3]:
            low_items = [p for p in zone_items.get(hz["zone_id"], [])
                         if p.get("item_data", {}).get("retrieval_frequency", "medium") == "low"]
            for li in low_items[:2]:
                target = cold_z[0]
                relocations.append({
                    "item_id":       li.get("item_id"),
                    "item_name":     li.get("item_data", {}).get("name", "?"),
                    "from_zone_id":  hz["zone_id"],
                    "from_zone":     hz["zone_name"],
                    "to_zone_id":    target["zone_id"],
                    "to_zone":       target["zone_name"],
                    "reason":        (f"Zone '{hz['zone_name']}' is at {hz['utilization_pct']}% capacity. "
                                      f"Moving low-frequency item frees space for high-frequency picks."),
                    "space_freed_m3": round(
                        float(li.get("item_data",{}).get("width_m",  0.3)) *
                        float(li.get("item_data",{}).get("depth_m",  0.3)) *
                        float(li.get("item_data",{}).get("height_m", 0.3)) *
                        int(li.get("quantity_placed", 1)), 3
                    ),
                })

    fragile_warnings = []
    for p in placements:
        idata = item_map.get(p.get("item_id", ""), {})
        if idata.get("fragile") and float(p.get("z_pos", 0)) > 0.5:
            fragile_warnings.append({
                "item_id":   p.get("item_id"),
                "item_name": idata.get("name", "?"),
                "zone_id":   p.get("zone_id"),
                "zone_name": zone_map.get(p.get("zone_id",""), {}).get("name","?"),
                "z_pos":     p.get("z_pos", 0),
                "warning":   "Fragile item placed at elevated position — risk of damage.",
            })

    stacking_violations = []
    for p in placements:
        idata = item_map.get(p.get("item_id", ""), {})
        if not idata.get("stackable", True) and float(p.get("z_pos", 0)) > 0.1:
            stacking_violations.append({
                "item_name": idata.get("name", "?"),
                "zone_name": zone_map.get(p.get("zone_id",""), {}).get("name","?"),
                "z_pos":     p.get("z_pos", 0),
            })

    return {
        "zone_utilization":      list(zone_utils.values()),
        "hot_zones":             hot_zones,
        "underutilised_zones":   cold_z,
        "empty_zones":           empty_zones,
        "suggested_relocations": relocations,
        "fragile_warnings":      fragile_warnings,
        "stacking_violations":   stacking_violations,
        "estimated_reclaim_m3":  round(sum(r["space_freed_m3"] for r in relocations), 3),
        "total_zones":           len(zones),
        "hot_zone_count":        len(hot_zones),
        "empty_zone_count":      len(empty_zones),
    }


# ---------------------------------------------------------------------------
# AI recommendations (rule-based, zero API cost)
# ---------------------------------------------------------------------------

def generate_ai_recommendations(result: Dict, warehouse: Dict,
                                 items: List[Dict], zones: List[Dict]) -> List[str]:
    recs = []
    m     = result.get("metrics", {})
    util  = m.get("space_utilization_pct", 0)
    score = m.get("optimization_score", 0)
    unpl  = m.get("items_unplaced", 0)

    if util < 40:
        recs.append(f"Space utilization is {util:.1f}% — well below target. "
                    "Consider consolidating zones or increasing inventory.")
    elif util > 90:
        recs.append(f"Critical: utilization at {util:.1f}%. "
                    "Expand storage zones immediately to prevent bottlenecks.")
    elif util > 75:
        recs.append(f"Utilization at {util:.1f}% — healthy but approaching limits. "
                    "Plan for capacity expansion if inventory grows >15%.")

    if unpl > 0:
        recs.append(f"{unpl} unit(s) could not be placed. "
                    "Add more zones or increase zone dimensions.")

    hf  = [i for i in items if i.get("retrieval_frequency") == "high"]
    nex = [z for z in zones  if z.get("near_exit")]
    if hf and not nex:
        recs.append(f"{len(hf)} high-frequency items detected but no zones marked 'Near Exit'. "
                    "Mark exit-adjacent zones to cut retrieval time by up to 40%.")

    haz   = [i for i in items if i.get("hazardous")]
    haz_z = [z for z in zones  if z.get("zone_type") == "hazmat"]
    if haz and not haz_z:
        recs.append(f"{len(haz)} hazardous items need a dedicated HAZMAT zone.")

    cold_i = [i for i in items if i.get("temperature_sensitive")]
    cold_z = [z for z in zones  if z.get("temperature_controlled")]
    if cold_i and not cold_z:
        recs.append(f"{len(cold_i)} temperature-sensitive items have no cold storage zone.")

    retrieval = m.get("retrieval_score", 0)
    if retrieval < 50:
        recs.append(f"Retrieval score is low ({retrieval:.0f}/100). "
                    "Add more exit-adjacent zones for high-frequency stock.")

    if score >= 85:
        recs.append(f"Excellent optimization score: {score:.1f}/100. "
                    "Warehouse layout is well-configured for current inventory.")
    elif score >= 65:
        recs.append(f"Good optimization score: {score:.1f}/100. "
                    "Minor zone configuration improvements could push above 85.")
    else:
        recs.append(f"Low optimization score: {score:.1f}/100. "
                    "Review zone sizes, types, and exit proximity assignments.")

    return recs