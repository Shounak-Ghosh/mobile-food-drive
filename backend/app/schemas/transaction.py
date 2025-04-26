from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class TransactionBase(BaseModel):
    marker_id:   int
    address:     Optional[str]
    pickup_time: Optional[datetime]
    order_id:    str

class TransactionCreate(TransactionBase):
    user_id: int

class TransactionResponse(TransactionBase):
    transaction_id:   int
    user_id:          int
    transaction_date: datetime

    class Config:
        orm_mode = True
