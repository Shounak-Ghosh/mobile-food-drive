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
        (30, "Your food reservation for {food_type} will expire in 30 minutes. Please pick it up soon!"),
        (15, "Your {food_type} reservation will expire in 15 minutes. Please hurry to pick it up!"),
        (5, "URGENT: Your {food_type} reservation expires in 5 minutes! Please pick it up immediately.")
    ]
    
    for minutes, message_template in expiry_warnings:
        warning_threshold = now + timedelta(minutes=minutes)
        # Find reservations that will expire in 'minutes' minutes (+/- 1 minute buffer)
        about_to_expire = db.query(Marker).filter(
            Marker.status == MarkerStatus.reserved,
            Marker.reserved_until >= warning_threshold - timedelta(minutes=1),
            Marker.reserved_until <= warning_threshold + timedelta(minutes=1)
        ).all()
        
        # Send notifications for each reservation about to expire
        for marker in about_to_expire:
            # Create personalized message
            personalized_message = message_template.format(food_type=marker.food_type)
            
            # Create notification payload for the receiver
            notification_payload = {
                "type": "notification",
                "user_id": marker.receiver_user_id,
                "message": personalized_message,
                "marker_id": marker.marker_id,
                "severity": "warning",
                "notificationType": "reservation_expiring",
                "food_type": marker.food_type,
                "marker_info": {
                    "donator_id": marker.donator_user_id,
                    "reserver_id": marker.receiver_user_id,
                    "food_type": marker.food_type,
                    "user_role": "reserver"
                }
            }
            
            # Broadcast notification
            await manager.broadcast(notification_payload)
    
    # Process expired reservations
    expired = db.query(Marker).filter(
        Marker.status == MarkerStatus.reserved,
        Marker.reserved_until < now
    ).all()
    
    for m in expired:
        # Store the receiver ID before nullifying it
        previous_receiver_id = m.receiver_user_id
        
        # Update marker status
        m.status = MarkerStatus.available
        m.receiver_user_id = None  
        m.reserved_until = None
        m.updated_at = now
        
        # Only notify if we have a valid previous receiver
        if previous_receiver_id:
            # Notify the previous reserver that their reservation has expired
            reserver_notification = {
                "type": "notification",
                "user_id": previous_receiver_id,
                "message": f"Your reservation for {m.food_type} has expired. The food is now available for others.",
                "marker_id": m.marker_id,
                "severity": "error",
                "notificationType": "reservation_expired",
                "marker_info": {
                    "donator_id": m.donator_user_id,
                    "reserver_id": previous_receiver_id,
                    "food_type": m.food_type,
                    "user_role": "reserver"
                }
            }
            
            # Notify the donator that the reservation expired
            donator_notification = {
                "type": "notification",
                "user_id": m.donator_user_id,
                "message": f"The reservation for your {m.food_type} donation has expired. It's now available for others.",
                "marker_id": m.marker_id,
                "severity": "info",
                "notificationType": "donation_available_again",
                "marker_info": {
                    "donator_id": m.donator_user_id,
                    "reserver_id": previous_receiver_id,
                    "food_type": m.food_type,
                    "user_role": "donator"
                }
            }
            
            # Broadcast notifications
            await manager.broadcast(reserver_notification)
            await manager.broadcast(donator_notification)
        
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
            "severity": "info",
            "notificationType": "food_expiring",
            "marker_info": {
                "donator_id": marker.donator_user_id,
                "reserver_id": marker.receiver_user_id,
                "food_type": marker.food_type,
                "user_role": "donator"
            }
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
        # Update marker status to expired
        previous_status = m.status
        m.status = MarkerStatus.expired
        m.reserved_until = None
        m.updated_at = datetime.utcnow()
        
        # Send notification to the donator
        donator_notification = {
            "type": "notification",
            "user_id": m.donator_user_id,
            "message": f"Your donation of {m.food_type} has expired after 24 hours. If the food is still good, consider creating a new donation.",
            "marker_id": m.marker_id,
            "severity": "info",
            "notificationType": "marker_expired",
            "marker_info": {
                "donator_id": m.donator_user_id,
                "reserver_id": m.receiver_user_id,
                "food_type": m.food_type,
                "user_role": "donator"
            }
        }
        
        # If the marker was reserved, also notify the reserver
        if previous_status == MarkerStatus.reserved and m.receiver_user_id:
            reserver_notification = {
                "type": "notification",
                "user_id": m.receiver_user_id,
                "message": f"Your reservation for {m.food_type} has expired as the donation was posted over 24 hours ago.",
                "marker_id": m.marker_id,
                "severity": "error",
                "notificationType": "marker_expired",
                "marker_info": {
                    "donator_id": m.donator_user_id,
                    "reserver_id": m.receiver_user_id,
                    "food_type": m.food_type,
                    "user_role": "reserver"
                }
            }
            
            # Broadcast notification to reserver
            await manager.broadcast(reserver_notification)
        
        # Broadcast notification to donator
        await manager.broadcast(donator_notification)
    
    db.commit()
    db.close()
