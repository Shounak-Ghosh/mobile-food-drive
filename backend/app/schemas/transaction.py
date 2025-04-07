from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List

class TransactionBase(BaseModel):
    location: str
    address: str
    pickup_time: str
    order_id: str

class TransactionCreate(TransactionBase):
    user_id: int

class TransactionResponse(TransactionBase):
    transaction_id: int
    user_id: int
    transaction_date: datetime
    
    class Config:
        orm_mode = True
