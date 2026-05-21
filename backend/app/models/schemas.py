from pydantic import BaseModel, Field
from typing import Optional, List, Any
from datetime import datetime
from uuid import UUID


# Auth
class LoginRequest(BaseModel):
    email: str
    password: str


class SignupRequest(BaseModel):
    email: str
    password: str
    username: str
    full_name: Optional[str] = None


# Warehouse
class WarehouseCreate(BaseModel):
    name: str
    description: Optional[str] = None
    width_m: float = Field(gt=0)
    depth_m: float = Field(gt=0)
    height_m: float = Field(gt=0)
    address: Optional[str] = None
    status: str = "active"


class WarehouseUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    width_m: Optional[float] = None
    depth_m: Optional[float] = None
    height_m: Optional[float] = None
    address: Optional[str] = None
    status: Optional[str] = None


# Zone
class ZoneCreate(BaseModel):
    warehouse_id: str
    name: str
    zone_type: str = "rack"
    x_pos: float = 0
    y_pos: float = 0
    z_pos: float = 0
    width_m: float = Field(gt=0)
    depth_m: float = Field(gt=0)
    height_m: float = Field(gt=0)
    max_weight_kg: Optional[float] = None
    temperature_controlled: bool = False
    near_exit: bool = False
    color: str = "#1f7a8c"


class ZoneUpdate(BaseModel):
    name: Optional[str] = None
    zone_type: Optional[str] = None
    x_pos: Optional[float] = None
    y_pos: Optional[float] = None
    z_pos: Optional[float] = None
    width_m: Optional[float] = None
    depth_m: Optional[float] = None
    height_m: Optional[float] = None
    max_weight_kg: Optional[float] = None
    near_exit: Optional[bool] = None
    color: Optional[str] = None


# Inventory Item
class InventoryItemCreate(BaseModel):
    warehouse_id: str
    sku: Optional[str] = None
    name: str
    category: Optional[str] = None
    description: Optional[str] = None
    width_m: float = Field(gt=0)
    depth_m: float = Field(gt=0)
    height_m: float = Field(gt=0)
    weight_kg: Optional[float] = None
    quantity: int = 1
    fragile: bool = False
    stackable: bool = True
    hazardous: bool = False
    temperature_sensitive: bool = False
    retrieval_frequency: str = "medium"
    image_url: Optional[str] = None


class InventoryItemUpdate(BaseModel):
    sku: Optional[str] = None
    name: Optional[str] = None
    category: Optional[str] = None
    description: Optional[str] = None
    width_m: Optional[float] = None
    depth_m: Optional[float] = None
    height_m: Optional[float] = None
    weight_kg: Optional[float] = None
    quantity: Optional[int] = None
    fragile: Optional[bool] = None
    stackable: Optional[bool] = None
    hazardous: Optional[bool] = None
    temperature_sensitive: Optional[bool] = None
    retrieval_frequency: Optional[str] = None
    image_url: Optional[str] = None


# Optimization
class OptimizationRequest(BaseModel):
    warehouse_id: str
    priorities: Optional[dict] = {
        "space_utilization": 0.4,
        "retrieval_ease": 0.3,
        "weight_balance": 0.2,
        "hazard_separation": 0.1
    }
    clear_existing: bool = True


class PlacementResult(BaseModel):
    item_id: str
    item_name: str
    zone_id: str
    zone_name: str
    x_pos: float
    y_pos: float
    z_pos: float
    quantity_placed: int


class OptimizationResult(BaseModel):
    run_id: str
    warehouse_id: str
    status: str
    space_utilization_pct: float
    items_placed: int
    items_unplaced: int
    optimization_score: float
    placements: List[PlacementResult]
    ai_recommendations: Optional[List[str]] = []
    run_time_ms: int
    warnings: List[str] = []
