from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, EmailStr
from app.database import get_db
from app.models.user import User, UserRole
from app.services.security import hash_password, verify_password, create_token
from app.deps import get_current_user

router = APIRouter(prefix="/auth", tags=["auth"])

COOKIE_MAX_AGE = 7 * 24 * 3600


class RegisterBody(BaseModel):
    email: EmailStr
    name: str
    password: str
    role: UserRole = UserRole.employee


class LoginBody(BaseModel):
    email: EmailStr
    password: str


def _token_response(user: User, response: Response) -> dict:
    token = create_token({"sub": str(user.id)})
    response.set_cookie("access_token", token, httponly=True, max_age=COOKIE_MAX_AGE, samesite="lax")
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": str(user.id), "email": user.email, "name": user.name,
            "role": user.role, "skill_profile": user.skill_profile,
            "created_at": user.created_at.isoformat(),
        },
    }


@router.post("/register")
async def register(body: RegisterBody, response: Response, db: AsyncSession = Depends(get_db)):
    if await db.scalar(select(User).where(User.email == body.email)):
        raise HTTPException(400, "Email already registered")
    user = User(email=body.email, name=body.name, role=body.role, hashed_password=hash_password(body.password))
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return _token_response(user, response)


@router.post("/login")
async def login(body: LoginBody, response: Response, db: AsyncSession = Depends(get_db)):
    user = await db.scalar(select(User).where(User.email == body.email))
    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(401, "Invalid credentials")
    return _token_response(user, response)


@router.post("/logout")
async def logout(response: Response):
    response.delete_cookie("access_token")
    return {"detail": "ok"}


@router.get("/me")
async def me(user: User = Depends(get_current_user)):
    return {"id": str(user.id), "email": user.email, "name": user.name, "role": user.role,
            "skill_profile": user.skill_profile, "created_at": user.created_at.isoformat()}
