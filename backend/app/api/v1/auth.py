from fastapi import APIRouter, Depends
from pydantic import BaseModel, EmailStr

from ...services.auth import authenticate, _hash_pw, get_user_by_email, get_current_user
from ...db.models import SessionLocal, User

router = APIRouter()


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class LoginOut(BaseModel):
    access_token: str
    token_type: str = "bearer"


@router.post("/login", response_model=LoginOut)
async def login(body: LoginIn):
    token = await authenticate(body.email, body.password)
    return {"access_token": token}


class RegisterIn(LoginIn):
    pass


@router.post("/register")
async def register(body: RegisterIn):
    existing = await get_user_by_email(body.email)
    if existing:
        return {"detail": "User exists"}

    async with SessionLocal() as db:
        db.add(User(email=body.email, hashed_pw=_hash_pw(body.password)))
        await db.commit()
    return {"detail": "ok"}


@router.get("/me")
async def me(user=Depends(get_current_user)):
    return {"email": user.email}
