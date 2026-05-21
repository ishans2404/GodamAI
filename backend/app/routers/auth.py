from fastapi import APIRouter, HTTPException
from app.models.schemas import LoginRequest, SignupRequest
from app.services.supabase_client import get_supabase

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/login")
async def login(data: LoginRequest):
    """Login with email and password via Supabase Auth."""
    supabase = get_supabase()
    try:
        response = supabase.auth.sign_in_with_password({
            "email": data.email,
            "password": data.password
        })
        if response.user is None:
            raise HTTPException(status_code=401, detail="Invalid credentials")

        # Get profile
        profile_resp = supabase.table("profiles").select("*").eq(
            "id", response.user.id
        ).single().execute()

        profile = profile_resp.data if profile_resp else None

        return {
            "access_token": response.session.access_token,
            "refresh_token": response.session.refresh_token,
            "user": {
                "id": response.user.id,
                "email": response.user.email,
                "username": profile.get("username") if profile else response.user.email.split("@")[0],
                "full_name": profile.get("full_name") if profile else "",
                "role": profile.get("role", "admin") if profile else "admin"
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Login failed: {str(e)}")


@router.post("/signup")
async def signup(data: SignupRequest):
    """Register a new user."""
    supabase = get_supabase()
    try:
        response = supabase.auth.sign_up({
            "email": data.email,
            "password": data.password,
            "options": {
                "data": {
                    "username": data.username,
                    "full_name": data.full_name or data.username,
                    "role": "admin"
                }
            }
        })
        if response.user is None:
            raise HTTPException(status_code=400, detail="Signup failed")

        return {
            "message": "User created successfully",
            "user_id": response.user.id
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/refresh")
async def refresh_token(refresh_token: str):
    """Refresh an access token."""
    supabase = get_supabase()
    try:
        response = supabase.auth.refresh_session(refresh_token)
        return {
            "access_token": response.session.access_token,
            "refresh_token": response.session.refresh_token
        }
    except Exception as e:
        raise HTTPException(status_code=401, detail="Token refresh failed")


@router.post("/change-password")
async def change_password(
    data: dict,
    authorization: Optional[str] = Header(None)
):
    """Change password for authenticated user."""
    from fastapi import Header as FHeader
    if not authorization:
        raise HTTPException(status_code=401, detail="Authorization required")
    supabase = get_supabase()
    token = authorization.replace("Bearer ", "")
    try:
        user = supabase.auth.get_user(token)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")

    new_password = data.get("new_password", "")
    if len(new_password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

    try:
        # Sign in with current password to verify
        email = user.user.email
        current_password = data.get("current_password", "")
        verify = supabase.auth.sign_in_with_password({
            "email": email, "password": current_password
        })
        if not verify.user:
            raise HTTPException(status_code=401, detail="Current password is incorrect")

        # Update password via admin
        from app.services.supabase_client import get_supabase_admin
        admin = get_supabase_admin()
        admin.auth.admin.update_user_by_id(
            user.user.id,
            {"password": new_password}
        )
        return {"message": "Password changed successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Password change failed: {str(e)}")


@router.put("/profiles/{user_id}")
async def update_profile(
    user_id: str,
    data: dict,
    authorization: Optional[str] = Header(None)
):
    """Update user profile."""
    if not authorization:
        raise HTTPException(status_code=401, detail="Authorization required")
    supabase = get_supabase()
    token = authorization.replace("Bearer ", "")
    try:
        user = supabase.auth.get_user(token)
        if user.user.id != user_id:
            raise HTTPException(status_code=403, detail="Can only update own profile")
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")

    allowed = {k: v for k, v in data.items() if k in ("full_name", "username")}
    if not allowed:
        raise HTTPException(status_code=400, detail="No valid fields to update")

    resp = supabase.table("profiles").update(allowed).eq("id", user_id).execute()
    return {"data": resp.data[0] if resp.data else {}, "message": "Profile updated"}
