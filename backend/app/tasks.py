# backend/app/tasks.py

from datetime import datetime, timedelta
from app.db.session import SessionLocal
from app.models.marker import Marker, MarkerStatus

def auto_unreserve():
    db = SessionLocal()
    now = datetime.utcnow()
    expired = db.query(Marker).filter(
        Marker.status == MarkerStatus.reserved,
        Marker.reserved_until < now
    ).all()
    for m in expired:
        m.receiver_user_id = None
        m.status = MarkerStatus.available
        m.reserved_until = None
        m.updated_at = now
        # TODO: notify user
    db.commit()
    db.close()

def expire_24h_markers():
    db = SessionLocal()
    cutoff = datetime.utcnow() - timedelta(hours=24)
    old = db.query(Marker).filter(
        Marker.creation_date < cutoff,
        Marker.status.in_([MarkerStatus.available, MarkerStatus.reserved])
    ).all()
    for m in old:
        m.status = MarkerStatus.expired
        m.reserved_until = None
        m.updated_at = datetime.utcnow()
        # TODO: notify donator or reserver
    db.commit()
    db.close()
