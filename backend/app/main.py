from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os, logging

load_dotenv()
logging.basicConfig(level=logging.INFO)

from app.routers import auth, warehouses, zones, inventory, optimization
from app.routers.ai import router as ai_router
from app.routers.analytics import router as analytics_router

app = FastAPI(
    title="GodamAI API",
    description="AI-Powered Warehouse Space Planning & Intelligent Storage Allocation",
    version="2.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
)

# CORS
origins = [
    os.getenv("FRONTEND_URL", "http://localhost:5173"),
    "http://localhost:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(auth.router,        prefix="/api")
app.include_router(warehouses.router,  prefix="/api")
app.include_router(zones.router,       prefix="/api")
app.include_router(inventory.router,   prefix="/api")
app.include_router(optimization.router,prefix="/api")
app.include_router(ai_router,          prefix="/api")
app.include_router(analytics_router,   prefix="/api")


@app.get("/")
async def root():
    return {"name": "GodamAI", "version": "2.0.0", "docs": "/api/docs"}

@app.get("/health")
async def health():
    return {"status": "healthy", "service": "godamai-api"}
