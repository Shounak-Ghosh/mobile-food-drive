from sqlalchemy import Column, Integer, String, TIMESTAMP, ForeignKey, text
from sqlalchemy.orm import relationship
from app.db.base_class import Base

class Transaction(Base):
    __tablename__ = "transactions"
    
    transaction_id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.user_id"), nullable=False)
    location = Column(String, nullable=False)
    address = Column(String, nullable=False)
    pickup_time = Column(String, nullable=False)
    order_id = Column(String, nullable=False, unique=True)
    transaction_date = Column(TIMESTAMP, server_default=text("CURRENT_TIMESTAMP"))
    
    # Relationship with User model
    user = relationship("User", back_populates="transactions")
