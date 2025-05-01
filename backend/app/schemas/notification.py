from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class NotificationBase(BaseModel):
    message: str
    notification_type: str
    severity: str
    related_id: Optional[int] = None
    recipient_role: Optional[str] = None

class NotificationCreate(NotificationBase):
    pass

class NotificationResponse(NotificationBase):
    notification_id: int
    user_id: int
    read: bool
    created_at: datetime
    
    class Config:
        orm_mode = True 