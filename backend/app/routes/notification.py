from fastapi import APIRouter, Depends, HTTPException, status, WebSocket, WebSocketDisconnect
from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import desc
from datetime import datetime

from app.db.session import get_db
from app.models.notification import Notification
from app.schemas.notification import NotificationResponse, NotificationCreate
from app.routes.auth import get_current_user
from app.models.user import User
from app.crud.notification import (
    create_notification,
    get_user_notifications,
    mark_notification_as_read,
    mark_all_notifications_as_read,
)
from app.core.security import decode_token

router = APIRouter()  # mounted at /notifications

# WebSocket connection manager for notifications
class NotificationConnectionManager:
    def __init__(self):
        self.active_connections = {}  # Map user_id to list of connections
        self.connection_count = 0
        
    async def connect(self, websocket: WebSocket, user_id: int):
        if user_id not in self.active_connections:
            self.active_connections[user_id] = []
        
        # Check if we already have too many connections for this user
        if len(self.active_connections[user_id]) >= 3:
            # Keep only the most recent 2 connections
            excess = len(self.active_connections[user_id]) - 2
            for _ in range(excess):
                old_conn = self.active_connections[user_id].pop(0)
                try:
                    await old_conn.close(code=1000, reason="Too many connections")
                except Exception:
                    pass  # Already closed
            
        self.active_connections[user_id].append(websocket)
        self.connection_count += 1
        print(f"Notification WebSocket connected for user {user_id}, active connections: {len(self.active_connections[user_id])}, total: {self.connection_count}")
        
    def disconnect(self, websocket: WebSocket, user_id: int):
        if user_id in self.active_connections:
            if websocket in self.active_connections[user_id]:
                self.active_connections[user_id].remove(websocket)
                self.connection_count -= 1
                print(f"Notification WebSocket disconnected for user {user_id}, remaining connections: {len(self.active_connections[user_id])}, total: {self.connection_count}")
            # Clean up empty lists
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]
                
    async def send_notification(self, user_id: int, message: dict):
        if user_id in self.active_connections:
            disconnected = []
            for connection in self.active_connections[user_id]:
                try:
                    await connection.send_json(message)
                except Exception:
                    disconnected.append(connection)
            
            # Clean up any disconnected connections
            for conn in disconnected:
                if conn in self.active_connections[user_id]:
                    self.active_connections[user_id].remove(conn)
                    self.connection_count -= 1
            
            # Remove the user if no connections remain
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]

notification_manager = NotificationConnectionManager()

@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    user_id = None
    connection_active = False
    # Track pings to reduce logging noise
    last_ping_log_time = 0
    
    try:
        while True:
            data = await websocket.receive_json()
            
            if data.get("type") == "auth" and "token" in data:
                try:
                    # Verify token
                    token = data["token"]
                    payload = decode_token(token)
                    email = payload.get("sub")
                    
                    # Get user from database
                    db = next(get_db())
                    user = db.query(User).filter(User.email == email).first()
                    
                    if not user:
                        await websocket.send_json({"type": "auth_error", "message": "User not found"})
                        continue
                        
                    user_id = user.user_id
                    await notification_manager.connect(websocket, user_id)
                    connection_active = True
                    await websocket.send_json({"type": "auth_success", "user_id": user_id})
                    
                    # Send initial unread notifications count
                    notifications = get_user_notifications(db, user_id)
                    unread_count = sum(1 for n in notifications if not n.read)
                    await websocket.send_json({"type": "unread_count", "count": unread_count})
                    
                except Exception as e:
                    print(f"Notification WebSocket authentication error: {e}")
                    await websocket.send_json({"type": "auth_error", "message": str(e)})
                    
            elif data.get("type") == "ping":
                # Respond to ping with pong to keep connection alive
                await websocket.send_json({"type": "pong"})
                
                # Reduce logging frequency - only log pings once every 5 minutes per connection
                now = datetime.now().timestamp()
                if now - last_ping_log_time > 300:  # 5 minutes
                    if user_id:
                        print(f"Received ping from WebSocket user: {user_id}")
                    last_ping_log_time = now
                    
    except WebSocketDisconnect:
        if user_id and connection_active:
            notification_manager.disconnect(websocket, user_id)
    except Exception as e:
        print(f"Unexpected error in notification WebSocket: {e}")
        if user_id and connection_active:
            notification_manager.disconnect(websocket, user_id)

# Helper function to broadcast a notification via WebSocket
async def broadcast_notification(notification, user_id):
    await notification_manager.send_notification(
        user_id,
        {
            "type": "notification",
            "notification_id": notification.notification_id,
            "message": notification.message,
            "severity": notification.severity,
            "notification_type": notification.notification_type,
            "read": notification.read,
            "created_at": notification.created_at.isoformat(),
            "user_id": user_id
        }
    )

@router.get("/", response_model=List[NotificationResponse])
async def get_notifications(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return get_user_notifications(db, current_user.user_id)

@router.post("/", response_model=NotificationResponse)
async def create_user_notification(
    notification: NotificationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    db_notification = create_notification(db, notification, current_user.user_id)
    
    # Broadcast the notification via WebSocket
    await broadcast_notification(db_notification, current_user.user_id)
    
    return db_notification

@router.post("/{notification_id}/read", response_model=NotificationResponse)
async def mark_as_read(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return mark_notification_as_read(db, notification_id, current_user.user_id)

@router.post("/mark-read")
async def mark_all_read(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    mark_all_notifications_as_read(db, current_user.user_id)
    return {"message": "All notifications marked as read"}

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