# backend/app/tasks.py

from datetime import datetime, timedelta
from app.db.session import SessionLocal
from app.models.marker import Marker, MarkerStatus
from app.routes.marker import manager

async def auto_unreserve():
    db = SessionLocal()
    now = datetime.utcnow()
    
    # Check for reservations about to expire (30, 15, and 5 minute warnings)
    expiry_warnings = [
        (30, "Your food reservation will expire in 30 minutes. Please pick it up soon!"),
        (15, "Your food reservation will expire in 15 minutes. Don't miss out!"),
        (5, "Your food reservation will expire in 5 minutes! Hurry to pick it up.")
    ]
    
    for minutes, message in expiry_warnings:
        warning_threshold = now + timedelta(minutes=minutes)
        # Find reservations that will expire in 'minutes' minutes (+/- 1 minute buffer)
        about_to_expire = db.query(Marker).filter(
            Marker.status == MarkerStatus.reserved,
            Marker.reserved_until >= warning_threshold - timedelta(minutes=1),
            Marker.reserved_until <= warning_threshold + timedelta(minutes=1)
        ).all()
        
        # Send notifications for each reservation about to expire
        for marker in about_to_expire:
            # Create notification payload for the receiver
            notification_payload = {
                "type": "notification",
                "user_id": marker.receiver_user_id,
                "message": message,
                "marker_id": marker.marker_id,
                "severity": "warning",
                "food_type": marker.food_type
            }
            
            # Broadcast notification
            await manager.broadcast(notification_payload)
    
    # Process expired reservations
    expired = db.query(Marker).filter(
        Marker.status == MarkerStatus.reserved,
        Marker.reserved_until < now
    ).all()
    
    for m in expired:
        m.receiver_user_id = None
        m.status = MarkerStatus.available
        m.reserved_until = None
        m.updated_at = now
        
        # Notify users that reservation has expired
        notification_payload = {
            "type": "notification",
            "user_id": m.receiver_user_id,  # This will be the previous reserver
            "message": f"Your reservation for {m.food_type} has expired.",
            "marker_id": m.marker_id,
            "severity": "error"
        }
        
        # Broadcast notification
        await manager.broadcast(notification_payload)
        
    db.commit()
    db.close()

async def notify_unclaimed_donations():
    db = SessionLocal()
    # Find donations made 24 hours ago that were never picked up
    cutoff = datetime.utcnow() - timedelta(hours=24)
    unclaimed_donations = db.query(Marker).filter(
        Marker.creation_date <= cutoff,
        Marker.creation_date >= cutoff - timedelta(minutes=5),  # Only check donations in a 5-minute window
        Marker.status.in_([MarkerStatus.available, MarkerStatus.reserved])
    ).all()
    
    for marker in unclaimed_donations:
        # Notify donator that food was not picked up
        notification_payload = {
            "type": "notification",
            "user_id": marker.donator_user_id,
            "message": f"Your donation of {marker.food_type} has not been picked up in 24 hours. " +
                      "Please consider retrieving it or marking it as expired.",
            "marker_id": marker.marker_id,
            "severity": "info"
        }
        
        # Broadcast notification
        await manager.broadcast(notification_payload)
    
    db.close()

async def expire_old_markers():
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
    
    db.commit()
    db.close()
