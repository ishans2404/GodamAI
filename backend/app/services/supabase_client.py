import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

_supabase_client: Client = None
_supabase_admin: Client = None


def get_supabase() -> Client:
    global _supabase_client
    if _supabase_client is None:
        url = os.getenv("SUPABASE_URL")
        key = os.getenv("SUPABASE_ANON_KEY")
        if not url or not key:
            raise ValueError("SUPABASE_URL and SUPABASE_ANON_KEY must be set")
        _supabase_client = create_client(url, key)
    return _supabase_client


def get_supabase_admin() -> Client:
    global _supabase_admin
    if _supabase_admin is None:
        url = os.getenv("SUPABASE_URL")
        key = os.getenv("SUPABASE_SERVICE_KEY")
        if not url or not key:
            raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set")
        _supabase_admin = create_client(url, key)
    return _supabase_admin
