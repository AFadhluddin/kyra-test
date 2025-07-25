import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
import asyncio
from backend.app.db.models import SessionLocal, User

async def make_admin(email: str):
    async with SessionLocal() as db:
        user = (await db.execute(
            User.__table__.select().where(User.email == email)
        )).fetchone()
        if not user:
            print(f"User with email {email} not found.")
            return
        user_obj = await db.get(User, user.id)
        user_obj.is_admin = True
        await db.commit()
        print(f"User {email} is now an admin.")

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python make_user_admin.py user@example.com")
        sys.exit(1)
    email = sys.argv[1]
    asyncio.run(make_admin(email)) 