from sqlalchemy import Column, Integer, String, TIMESTAMP, ForeignKey, text, JSON
from sqlalchemy.orm import relationship
from app.db.base_class import Base
from geoalchemy2 import Geometry

class Marker(Base):
    __tablename__ = "markers"
    
    marker_id = Column(Integer, primary_key=True, index=True)
    donator_user_id = Column(Integer, ForeignKey("users.user_id"), nullable=False)
    geographic_location = Column(Geometry('POINT', srid=4326), nullable=False)
    creation_date = Column(TIMESTAMP, server_default=text("CURRENT_TIMESTAMP"))
    receiver_user_id = Column(Integer, ForeignKey("users.user_id"), nullable=True)
    food_display_info = Column(JSON, nullable=False)
    
    # Relationships
    donator = relationship("User", foreign_keys=[donator_user_id], backref="donated_markers")
    receiver = relationship("User", foreign_keys=[receiver_user_id], backref="received_markers")
