from sqlalchemy import Column, Integer, String, TIMESTAMP, ForeignKey, Boolean, Text
from sqlalchemy.orm import relationship
from app.db.base_class import Base
from datetime import datetime

class Notification(Base):
    __tablename__ = "notifications"
    
    notification_id = Column(Integer, primary_key=True, index=True)
    
    # The user who should receive this notification
    user_id = Column(Integer, ForeignKey("users.user_id"), nullable=False)
    
    # Notification content
    message = Column(Text, nullable=False)
    notification_type = Column(String, nullable=False)
    severity = Column(String, nullable=False, default="info")
    read = Column(Boolean, nullable=False, default=False)
    
    # Related object (e.g., a marker_id)
    related_id = Column(Integer, nullable=True)
    
    # Timestamps
    created_at = Column(TIMESTAMP, nullable=False, default=datetime.utcnow)
    
    # Relationship to user
    user = relationship("User", backref="notifications") 