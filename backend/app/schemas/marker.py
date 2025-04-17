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

class MarkerUpdate(BaseModel):
    receiver_user_id: Optional[int] = None

class MarkerResponse(BaseModel):
    marker_id: int
    donator_user_id: int
    donator_name: str
    latitude: float
    longitude: float
    creation_date: datetime
    food_type: str
    quantity: str
    description: str
    dietary_tags: List[str]
    receiver_user_id: Optional[int] = None

    class Config:
        orm_mode = True
