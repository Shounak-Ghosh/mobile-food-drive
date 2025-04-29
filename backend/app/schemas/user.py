from datetime import datetime
from pydantic import BaseModel, EmailStr
from typing import Optional, List

class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    dietaryPreferences: list[str]

class UserResponse(BaseModel):
    user_id: int
    name: str
    email: EmailStr
    account_creation_date: datetime
    dietary_tags: Optional[List[str]] = None

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str
    refresh_token: Optional[str] = None
    user_id: Optional[int] = None
