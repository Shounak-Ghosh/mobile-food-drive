from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from typing import List, Optional

from app.db.session import get_db
from app.models.transaction import Transaction
from app.schemas.transaction import TransactionCreate, TransactionResponse
from app.core.security import decode_token

router = APIRouter(
    tags=["transactions"]
)

def get_bearer_token(request: Request) -> Optional[str]:
    auth_header = request.headers.get("Authorization")
    if not auth_header:
        return None
    parts = auth_header.split(" ")
    if len(parts) == 2 and parts[0].lower() == "bearer":
        return parts[1]
    return None

@router.post("/", response_model=TransactionResponse)
def create_transaction(
    transaction: TransactionCreate,
    db: Session = Depends(get_db)
):
    db_txn = Transaction(
        marker_id   = transaction.marker_id,
        user_id     = transaction.user_id,
        address     = transaction.address,
        pickup_time = transaction.pickup_time,
        order_id    = transaction.order_id,
    )
    db.add(db_txn)
    db.commit()
    db.refresh(db_txn)
    return db_txn

@router.get("/user", response_model=List[TransactionResponse])
def get_user_transactions(
    db: Session = Depends(get_db),
    token: str = Depends(get_bearer_token)
):
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated"
        )

    payload = decode_token(token)
    if not payload or "sub" not in payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token"
        )

    user_email = payload["sub"]
    from app.models.user import User
    user = db.query(User).filter(User.email == user_email).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    txns = (
        db.query(Transaction)
          .filter(Transaction.user_id == user.user_id)
          .all()
    )
    return txns
