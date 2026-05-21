"""
GodamAI — Supabase Client
==========================
Simplified connection using URL + KEY (anon publishable key).
This is the recommended pattern from Supabase docs.

Usage:
    from app.services.supabase_client import get_supabase
    supabase = get_supabase()
    data = supabase.table("todos").select("*").execute()
"""

import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

_client: Client | None = None


def get_supabase() -> Client:
    """Return a singleton Supabase client using URL + KEY from .env."""
    global _client
    if _client is None:
        url = os.environ.get("SUPABASE_URL")
        key = os.environ.get("SUPABASE_KEY")
        if not url or not key:
            raise RuntimeError(
                "SUPABASE_URL and SUPABASE_KEY must be set in backend/.env"
            )
        _client = create_client(url, key)
    return _client