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
    full_name: str | None = None
    date_of_birth: str | None = None
    gender: str | None = None
    sex: str | None = None
    country: str | None = None
    address: str | None = None
    ethnic_group: str | None = None
    long_term_conditions: str | None = None
    medications: str | None = None
    consent_to_data_storage: bool = False


@router.post("/register")
async def register(body: RegisterIn):
    existing = await get_user_by_email(body.email)
    if existing:
        return {"detail": "User exists"}

    async with SessionLocal() as db:
        user_kwargs = dict(email=body.email, hashed_pw=_hash_pw(body.password))
        if body.consent_to_data_storage:
            user_kwargs.update(
                full_name=body.full_name,
                date_of_birth=body.date_of_birth,
                gender=body.gender,
                sex=body.sex,
                country=body.country,
                address=body.address,
                ethnic_group=body.ethnic_group,
                long_term_conditions=body.long_term_conditions,
                medications=body.medications,
                consent_to_data_storage=True
            )
        else:
            user_kwargs["consent_to_data_storage"] = False
        db.add(User(**user_kwargs))
        await db.commit()
    return {"detail": "ok"}


@router.get("/me")
async def me(user=Depends(get_current_user)):
    return {"email": user.email}
