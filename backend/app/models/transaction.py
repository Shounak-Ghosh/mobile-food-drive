from sqlalchemy import Column, Integer, String, TIMESTAMP, ForeignKey, text
from sqlalchemy.orm import relationship
from app.db.base_class import Base

class Transaction(Base):
    __tablename__ = "transactions"
    
    transaction_id = Column(Integer, primary_key=True, index=True)
    
    # link to the Marker table
    marker_id = Column(Integer, ForeignKey("markers.marker_id"), nullable=False)
    
    # link to the User who performed the transaction
    user_id = Column(Integer, ForeignKey("users.user_id"), nullable=False)
    
    address = Column(String, nullable=True)
    pickup_time = Column(TIMESTAMP, nullable=True)
    order_id = Column(String, nullable=False, unique=True)
    
    # auto‐generated timestamp of when the transaction was created
    transaction_date = Column(
        TIMESTAMP,
        server_default=text("CURRENT_TIMESTAMP"),
        nullable=False
    )
    
    # ORM relationships
    marker = relationship("Marker", back_populates="transactions")
    user   = relationship("User",   back_populates="transactions")
