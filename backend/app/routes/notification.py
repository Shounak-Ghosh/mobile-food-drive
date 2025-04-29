from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.db.session import get_db
from app.models.notification import Notification
from app.schemas.notification import NotificationResponse
from app.routes.auth import get_current_user
from app.models.user import User

router = APIRouter()  # mounted at /notifications

@router.get("/", response_model=List[NotificationResponse])
async def get_my_notifications(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get all notifications for the current user, sorted by most recent first
    """
    notifications = (
        db.query(Notification)
        .filter(Notification.user_id == current_user.user_id)
        .order_by(desc(Notification.created_at))
        .all()
    )
    return notifications

@router.post("/mark-read", response_model=dict)
async def mark_notifications_as_read(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Mark all unread notifications as read for the current user
    """
    # Find unread notifications
    unread_notifications = (
        db.query(Notification)
        .filter(Notification.user_id == current_user.user_id, Notification.read == False)
        .all()
    )
    
    # Mark them as read
    for notification in unread_notifications:
        notification.read = True
    
    db.commit()
    
    return {"message": f"Marked {len(unread_notifications)} notifications as read"}

@router.get("/unread-count", response_model=dict)
async def get_unread_count(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get count of unread notifications for the current user
    """
    count = (
        db.query(Notification)
        .filter(Notification.user_id == current_user.user_id, Notification.read == False)
        .count()
    )
    
    return {"unread_count": count} 