# backend/app/models/marker.py

import enum
from sqlalchemy import (
    Column,
    Integer,
    String,
    TIMESTAMP,
    ForeignKey,
    text,
    Enum as SAEnum,
    func,
    ARRAY,
)
from sqlalchemy.orm import relationship
from geoalchemy2 import Geometry
from app.db.base_class import Base


class MarkerStatus(str, enum.Enum):
    available = "available"
    reserved = "reserved"
    picked_up = "picked_up"
    expired = "expired"


class Marker(Base):
    __tablename__ = "markers"

    marker_id = Column(Integer, primary_key=True, index=True)
    donator_user_id = Column(Integer, ForeignKey("users.user_id"), nullable=False)
    receiver_user_id = Column(Integer, ForeignKey("users.user_id"), nullable=True)

    geographic_location = Column(
        Geometry("POINT", srid=4326), nullable=False
    )
    creation_date = Column(
        TIMESTAMP(timezone=True),
        server_default=func.now(),
        nullable=False
    )

    # Workflow fields
    status = Column(
        SAEnum(MarkerStatus, native_enum=False),
        nullable=False,
        server_default=text("'available'")
    )
    updated_at = Column(
        TIMESTAMP(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now()
    )
    reserved_until = Column(
        TIMESTAMP(timezone=True),
        nullable=True
    )

    food_type = Column(String, nullable=False)
    quantity = Column(String, nullable=False)
    description = Column(String, nullable=False)
    dietary_tags = Column(ARRAY(String), nullable=True)

    # Relationships
    donator = relationship(
        "User", foreign_keys=[donator_user_id], backref="donated_markers"
    )
    receiver = relationship(
        "User", foreign_keys=[receiver_user_id], backref="received_markers"
    )
    transactions = relationship(
        "Transaction",
        back_populates="marker",
        cascade="all, delete-orphan",
        lazy="selectin"
    )
