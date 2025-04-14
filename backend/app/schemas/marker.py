from pydantic import BaseModel, Field
from typing import Dict, Optional, List
from datetime import datetime

class FoodDisplayInfo(BaseModel):
    food_type: str
    quantity: str
    description: str
    dietary_tags: List[str] = []  # Move dietary tags into food_display_info

class MarkerCreate(BaseModel):
    latitude: float
    longitude: float
    food_display_info: FoodDisplayInfo

class MarkerUpdate(BaseModel):
    receiver_user_id: Optional[int] = None

class MarkerResponse(BaseModel):
    marker_id: int
    donator_user_id: int
    donator_name: str
    latitude: float  # Extracted from geographic_location for frontend
    longitude: float  # Extracted from geographic_location for frontend
    creation_date: datetime
    food_display_info: FoodDisplayInfo
    receiver_user_id: Optional[int] = None
    
    class Config:
        orm_mode = True
