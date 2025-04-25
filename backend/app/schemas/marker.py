# backend/app/schemas/marker.py

from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime


class MarkerCreate(BaseModel):
    latitude: float
    longitude: float
    food_type: str
    quantity: str
    description: str
    dietary_tags: List[str] = []


class MarkerResponse(BaseModel):
    marker_id: int
    donator_user_id: int
    donator_name: str

    latitude: float
    longitude: float

    creation_date: datetime
    status: str
    updated_at: datetime
    reserved_until: Optional[datetime] = None

    food_type: str
    quantity: str
    description: str
    dietary_tags: List[str]

    receiver_user_id: Optional[int] = None

    class Config:
        from_attributes = True
