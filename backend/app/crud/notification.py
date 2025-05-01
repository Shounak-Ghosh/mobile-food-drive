from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import desc
from app.models.notification import Notification
from app.schemas.notification import NotificationCreate

def create_notification(db: Session, notification: NotificationCreate, user_id: int):
    """Create a new notification for a user"""
    db_notification = Notification(
        user_id=user_id,
        message=notification.message,
        notification_type=notification.notification_type,
        severity=notification.severity,
        read=False,
        related_id=notification.related_id,
        created_at=datetime.now(),
        recipient_role=notification.recipient_role
    )
    db.add(db_notification)
    db.commit()
    db.refresh(db_notification)
    return db_notification

def get_user_notifications(db: Session, user_id: int):
    """Get all notifications for a user, sorted by most recent first"""
    return (
        db.query(Notification)
        .filter(Notification.user_id == user_id)
        .order_by(desc(Notification.created_at))
        .all()
    )

def mark_notification_as_read(db: Session, notification_id: int, user_id: int):
    """Mark a specific notification as read"""
    db_notification = (
        db.query(Notification)
        .filter(
            Notification.notification_id == notification_id,
            Notification.user_id == user_id
        )
        .first()
    )
    
    if db_notification:
        db_notification.read = True
        db.commit()
        db.refresh(db_notification)
    
    return db_notification

def mark_all_notifications_as_read(db: Session, user_id: int):
    """Mark all unread notifications as read for a user"""
    unread_notifications = (
        db.query(Notification)
        .filter(Notification.user_id == user_id, Notification.read == False)
        .all()
    )
    
    for notification in unread_notifications:
        notification.read = True
    
    db.commit()
    return len(unread_notifications) 