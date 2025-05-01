# backend/app/routes/marker.py

from datetime import datetime, timedelta, timezone
from uuid import uuid4
from typing import Optional, List
import json

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    WebSocket,
    WebSocketDisconnect,
    status,
)
from fastapi.websockets import WebSocketState
from fastapi.encoders import jsonable_encoder
from sqlalchemy.orm import Session
from sqlalchemy import func
from geoalchemy2.functions import ST_MakePoint, ST_SetSRID

from app.db.session import get_db
from app.models.marker import Marker, MarkerStatus
from app.models.transaction import Transaction
from app.models.user import User
from app.schemas.marker import MarkerCreate, MarkerResponse
from app.routes.auth import get_current_user
from app.models.notification import Notification

router = APIRouter()  # mounted at /markers


class ConnectionManager:
    def __init__(self):
        self.active_connections = []
        self.user_connections = {}  # Map user_id to list of connections
        self.connection_last_active = {}  # Track when connections were last active

    async def connect(self, ws: WebSocket, user_id: int = None):
        # Add to active connections list
        if ws not in self.active_connections:
            self.active_connections.append(ws)
        
        # Track last activity time
        self.connection_last_active[ws] = datetime.utcnow()
        
        # Add to user-specific connections if user_id provided
        if user_id is not None:
            if user_id not in self.user_connections:
                self.user_connections[user_id] = []
            if ws not in self.user_connections[user_id]:
                self.user_connections[user_id].append(ws)
            print(f"User {user_id} connected. Total connections for this user: {len(self.user_connections[user_id])}")
            print(f"Active user connections: {list(self.user_connections.keys())}")

    def disconnect(self, ws: WebSocket, user_id: int = None):
        # Remove from active connections
        if ws in self.active_connections:
            self.active_connections.remove(ws)
        
        # Clean up last active tracking
        if ws in self.connection_last_active:
            del self.connection_last_active[ws]
        
        # Remove from user connections if user_id provided
        if user_id is not None and user_id in self.user_connections:
            if ws in self.user_connections[user_id]:
                self.user_connections[user_id].remove(ws)
            
            # Clean up empty user connection lists
            if not self.user_connections[user_id]:
                del self.user_connections[user_id]
                print(f"User {user_id} has no more connections, removed from tracking")
            else:
                print(f"User {user_id} now has {len(self.user_connections[user_id])} remaining connections")
            
            print(f"User {user_id} disconnected. Remaining users: {list(self.user_connections.keys())}")
        else:
            # If we don't have a user_id, check all user connections to remove this websocket
            for uid, connections in list(self.user_connections.items()):
                if ws in connections:
                    connections.remove(ws)
                    print(f"Removed orphaned connection from user {uid}")
                    if not connections:
                        del self.user_connections[uid]
                        print(f"User {uid} has no more connections, removed from tracking")

    async def broadcast(self, msg: dict):
        # Mark connections as active
        now = datetime.utcnow()
        stale_timeout = timedelta(minutes=15)  # Consider connections inactive after 15 minutes
        
        # Clean up stale connections first
        stale_connections = [ws for ws, last_active in self.connection_last_active.items() 
                           if now - last_active > stale_timeout]
        
        for ws in stale_connections:
            print(f"Removing stale connection that's been inactive for >15 minutes")
            # Find user_id for this connection if any
            user_id = None
            for uid, connections in self.user_connections.items():
                if ws in connections:
                    user_id = uid
                    break
            self.disconnect(ws, user_id)
        
        # If user_id is specified, only send to that user's connections
        if "user_id" in msg and msg["user_id"] is not None:
            user_id = msg["user_id"]
            if user_id in self.user_connections:
                print(f"Broadcasting message to user {user_id}, who has {len(self.user_connections[user_id])} connections")
                connections = list(self.user_connections[user_id])  # Create copy to avoid modification during iteration
                for conn in connections:
                    try:
                        await conn.send_json(msg)
                        # Update last active time
                        self.connection_last_active[conn] = now
                        print(f"Message sent to user {user_id}")
                    except Exception as e:
                        print(f"Error sending message to user {user_id}: {str(e)}")
                        # Connection might be stale, remove it
                        self.disconnect(conn, user_id)
            else:
                print(f"User {user_id} has no active connections. Available users: {list(self.user_connections.keys())}")
        # Otherwise, broadcast to all connections
        else:
            print(f"Broadcasting message to all {len(self.active_connections)} connections")
            # Create a copy of active_connections to avoid modification during iteration
            connections = list(self.active_connections)
            for conn in connections:
                try:
                    await conn.send_json(msg)
                    # Update last active time
                    self.connection_last_active[conn] = now
                except Exception as e:
                    print(f"Error sending broadcast message: {str(e)}")
                    # Connection might be dead, remove it
                    self.disconnect(conn)


manager = ConnectionManager()


@router.post("/", response_model=MarkerResponse)
async def create_marker(
    marker_data: MarkerCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # create PostGIS point
    point = ST_SetSRID(
        ST_MakePoint(marker_data.longitude, marker_data.latitude), 4326
    )
    m = Marker(
        donator_user_id=current_user.user_id,
        geographic_location=point,
        food_type=marker_data.food_type,
        quantity=marker_data.quantity,
        description=marker_data.description,
        dietary_tags=marker_data.dietary_tags,
    )
    db.add(m)
    db.commit()
    db.refresh(m)

    # fetch coords
    lon, lat = db.query(
        func.ST_X(m.geographic_location),
        func.ST_Y(m.geographic_location),
    ).one()

    resp = MarkerResponse(
        marker_id=m.marker_id,
        donator_user_id=m.donator_user_id,
        donator_name=current_user.name,
        latitude=lat,
        longitude=lon,
        creation_date=m.creation_date,
        status=m.status,
        updated_at=m.updated_at,
        reserved_until=m.reserved_until,
        food_type=m.food_type,
        quantity=m.quantity,
        description=m.description,
        dietary_tags=m.dietary_tags or [],
        receiver_user_id=m.receiver_user_id,
    )

    payload = {"type": "marker_update", "marker": jsonable_encoder(resp)}
    await manager.broadcast(payload)
    return resp


@router.get("/", response_model=list[MarkerResponse])
async def get_markers_in_bounds(
    north: float,
    south: float,
    east: float,
    west: float,
    tags: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = (
        db.query(
            Marker,
            User.name.label("donator_name"),
            func.ST_X(Marker.geographic_location).label("longitude"),
            func.ST_Y(Marker.geographic_location).label("latitude"),
        )
        .join(User, Marker.donator_user_id == User.user_id)
        .filter(
            func.ST_Within(
                Marker.geographic_location,
                func.ST_MakeEnvelope(west, south, east, north, 4326),
            ),
            # Only show markers that are still available or reserved
            Marker.status.in_([MarkerStatus.available, MarkerStatus.reserved])
        )
    )
    
    # Execute query
    results = query.all()
    
    # Convert tags string to list if provided
    tag_list = [tag.strip() for tag in tags.split(",")] if tags else []
    
    # Format response and filter by tags if provided
    markers = []
    for marker, donator_name, longitude, latitude in results:
        # If tags are provided, only include markers that have ALL the specified tags
        if tag_list and not all(tag in marker.dietary_tags for tag in tag_list):
            continue
            
        markers.append(
            MarkerResponse(
                marker_id=marker.marker_id,
                donator_user_id=marker.donator_user_id,
                donator_name=donator_name,
                latitude=latitude,
                longitude=longitude,
                creation_date=marker.creation_date,
                status=marker.status,
                updated_at=marker.updated_at,
                reserved_until=marker.reserved_until,
                food_type=marker.food_type,
                quantity=marker.quantity,
                description=marker.description,
                dietary_tags=marker.dietary_tags or [],
                receiver_user_id=marker.receiver_user_id,
            )
        )
    return markers


@router.get("/donated", response_model=list[MarkerResponse])
async def get_my_donations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Return all markers created by the current user, with full status info.
    """
    rows = (
        db.query(Marker)
          .filter(Marker.donator_user_id == current_user.user_id)
          .all()
    )
    donations = []
    for m in rows:
        lon, lat = db.query(
            func.ST_X(m.geographic_location),
            func.ST_Y(m.geographic_location),
        ).filter(Marker.marker_id == m.marker_id).one()
        donations.append(
            MarkerResponse(
                marker_id=m.marker_id,
                donator_user_id=m.donator_user_id,
                donator_name=current_user.name,
                latitude=lat,
                longitude=lon,
                creation_date=m.creation_date,
                status=m.status,
                updated_at=m.updated_at,
                reserved_until=m.reserved_until,
                food_type=m.food_type,
                quantity=m.quantity,
                description=m.description,
                dietary_tags=m.dietary_tags or [],
                receiver_user_id=m.receiver_user_id,
            )
        )
    return donations


@router.get("/reserved", response_model=list[MarkerResponse])
async def get_my_reservations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rows = (
        db.query(Marker)
        .filter(
            Marker.receiver_user_id == current_user.user_id,
            Marker.status == MarkerStatus.reserved,
        )
        .all()
    )
    result = []
    for m in rows:
        lon, lat = db.query(
            func.ST_X(m.geographic_location),
            func.ST_Y(m.geographic_location),
        ).filter(Marker.marker_id == m.marker_id).one()

        result.append(
            MarkerResponse(
                marker_id=m.marker_id,
                donator_user_id=m.donator_user_id,
                donator_name=m.donator.name,
                latitude=lat,
                longitude=lon,
                creation_date=m.creation_date,
                status=m.status,
                updated_at=m.updated_at,
                reserved_until=m.reserved_until,
                food_type=m.food_type,
                quantity=m.quantity,
                description=m.description,
                dietary_tags=m.dietary_tags or [],
                receiver_user_id=m.receiver_user_id,
            )
        )
    return result


@router.get("/{marker_id}", response_model=MarkerResponse)
async def get_marker(marker_id: int, db: Session = Depends(get_db)):
    row = (
        db.query(
            Marker,
            User.name.label("donator_name"),
            func.ST_X(Marker.geographic_location).label("longitude"),
            func.ST_Y(Marker.geographic_location).label("latitude"),
        )
        .join(User, Marker.donator_user_id == User.user_id)
        .filter(Marker.marker_id == marker_id)
        .first()
    )
    if not row:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Marker not found")

    m, donator_name, lon, lat = row
    return MarkerResponse(
        marker_id=m.marker_id,
        donator_user_id=m.donator_user_id,
        donator_name=donator_name,
        latitude=lat,
        longitude=lon,
        creation_date=m.creation_date,
        status=m.status,
        updated_at=m.updated_at,
        reserved_until=m.reserved_until,
        food_type=m.food_type,
        quantity=m.quantity,
        description=m.description,
        dietary_tags=m.dietary_tags or [],
        receiver_user_id=m.receiver_user_id,
    )


@router.patch("/{marker_id}", response_model=MarkerResponse)
async def reserve_marker(
    marker_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    print(f"Processing reservation request for marker {marker_id} by user {current_user.user_id}")
    m = db.get(Marker, marker_id)
    if not m:
        print(f"Marker {marker_id} not found")
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Marker not found")

    # Block self‐reservation
    if m.donator_user_id == current_user.user_id:
        print(f"User {current_user.user_id} attempted to reserve their own marker {marker_id}")
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, "You cannot reserve your own donation"
        )

    if m.status is not MarkerStatus.available:
        print(f"Marker {marker_id} is not available for reservation (status: {m.status})")
        raise HTTPException(
            status.HTTP_409_CONFLICT, "Marker is not available"
        )

    # perform reservation
    try:
        print(f"Reserving marker {marker_id} for user {current_user.user_id}")
        m.receiver_user_id = current_user.user_id
        m.status = MarkerStatus.reserved
        m.reserved_until = datetime.utcnow() + timedelta(hours=2)
        m.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(m)
        print(f"Marker {marker_id} successfully reserved by user {current_user.user_id}")
    except Exception as e:
        db.rollback()
        print(f"Error during marker reservation: {str(e)}")
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, f"Error during reservation: {str(e)}")

    # fetch coords so response_model is complete
    try:
        lon, lat = db.query(
            func.ST_X(m.geographic_location),
            func.ST_Y(m.geographic_location),
        ).filter(Marker.marker_id == marker_id).one()
    except Exception as e:
        print(f"Error fetching coordinates for marker {marker_id}: {str(e)}")
        # Default coordinates if unable to fetch
        lon, lat = 0, 0

    resp = MarkerResponse(
        marker_id=m.marker_id,
        donator_user_id=m.donator_user_id,
        donator_name=m.donator.name,
        latitude=lat,
        longitude=lon,
        creation_date=m.creation_date,
        status=m.status,
        updated_at=m.updated_at,
        reserved_until=m.reserved_until,
        food_type=m.food_type,
        quantity=m.quantity,
        description=m.description,
        dietary_tags=m.dietary_tags or [],
        receiver_user_id=m.receiver_user_id,
    )

    # Send notification to the reserver - include additional marker info for client-side verification
    reserver_notification = {
        "type": "notification",
        "user_id": current_user.user_id,
        "message": f"You've reserved {m.food_type}. You have 2 hours to pick it up before the reservation expires.",
        "severity": "success",
        "notificationType": "reservation_expiring",
        "marker_id": marker_id,
        "marker_info": {
            "donator_id": m.donator_user_id,
            "reserver_id": current_user.user_id,
            "food_type": m.food_type,
            "user_role": "reserver"
        }
    }
    
    # Send notification to the donator - include additional marker info for client-side verification
    donator_notification = {
        "type": "notification",
        "user_id": m.donator_user_id,
        "message": f"Someone has reserved your {m.food_type} donation. They have 2 hours to pick it up.",
        "severity": "info",
        "notificationType": "donation_reserved",
        "marker_id": marker_id,
        "marker_info": {
            "donator_id": m.donator_user_id,
            "reserver_id": current_user.user_id,
            "food_type": m.food_type,
            "user_role": "donator"
        }
    }
    
    # First send the marker update to ensure clients get the latest marker status
    # This helps update the UI even if notifications fail
    try:
        print(f"Broadcasting marker update for marker {marker_id}")
        payload = {"type": "marker_update", "marker": jsonable_encoder(resp)}
        await manager.broadcast(payload)
        print(f"Marker update broadcast successful for marker {marker_id}")
    except Exception as e:
        print(f"Error broadcasting marker update: {str(e)}")
    
    # Then handle notifications
    try:
        # Store reserver notification in database
        db_reserver_notification = Notification(
            user_id=current_user.user_id,
            message=f"You've reserved {m.food_type}. You have 2 hours to pick it up before the reservation expires.",
            notification_type="reservation_expiring",
            severity="success",
            related_id=marker_id,
            read=False
        )
        db.add(db_reserver_notification)
        
        # Store donator notification in database
        db_donator_notification = Notification(
            user_id=m.donator_user_id,
            message=f"Someone has reserved your {m.food_type} donation. They have 2 hours to pick it up.",
            notification_type="donation_reserved",
            severity="info",
            related_id=marker_id,
            read=False
        )
        db.add(db_donator_notification)
        
        # Commit the database changes
        db.commit()
        
        # Print info about the users we're sending notifications to
        print(f"Sending notifications for marker {marker_id}:")
        print(f"  - Reserver notification to user {current_user.user_id}")
        print(f"  - Donator notification to user {m.donator_user_id}")
        
        # Check if the users have active WebSocket connections
        reserver_has_connection = current_user.user_id in manager.user_connections
        donator_has_connection = m.donator_user_id in manager.user_connections
        
        print(f"  - Reserver has active connection: {reserver_has_connection}")
        print(f"  - Donator has active connection: {donator_has_connection}")
        
        # Broadcast both notifications
        print(f"Broadcasting reserver notification")
        await manager.broadcast(reserver_notification)
        print(f"Broadcasting donator notification")
        await manager.broadcast(donator_notification)
        print(f"All notifications broadcast successfully for marker {marker_id}")
    except Exception as e:
        print(f"Error handling reservation notifications: {str(e)}")
        # Try to commit any remaining notifications
        try:
            db.commit()
        except:
            pass

    return resp


@router.post("/{marker_id}/pickup", response_model=MarkerResponse)
async def pickup_marker(
    marker_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    m = db.get(Marker, marker_id)
    if not m or m.status is not MarkerStatus.reserved:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, "Cannot pick up this marker"
        )
    if m.receiver_user_id != current_user.user_id:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, "Not your reservation"
        )

    txn = Transaction(
        marker_id=marker_id,
        user_id=current_user.user_id,
        address=None,
        pickup_time=datetime.utcnow(),
        order_id=str(uuid4()),
    )
    db.add(txn)

    m.status = MarkerStatus.picked_up
    m.reserved_until = None
    m.updated_at = datetime.utcnow()
    
    # Create a thank you notification in the database for the donator
    thank_you_message = f"Your donation of {m.food_type} was picked up by {current_user.name}. Thank you for sharing!"
    db_notification = Notification(
        user_id=m.donator_user_id,
        message=thank_you_message,
        notification_type="food_pickup_thank_you",
        severity="success",
        related_id=marker_id,
        read=False
    )
    db.add(db_notification)
    
    # Also create a notification for the person who picked up
    pickup_message = f"You've picked up {m.food_type} from {m.donator.name}. Enjoy your food!"
    db_pickup_notification = Notification(
        user_id=current_user.user_id,
        message=pickup_message,
        notification_type="food_pickup_confirmation",
        severity="success",
        related_id=marker_id,
        read=False
    )
    db.add(db_pickup_notification)
    
    db.commit()
    db.refresh(m)

    lon, lat = db.query(
        func.ST_X(m.geographic_location),
        func.ST_Y(m.geographic_location),
    ).filter(Marker.marker_id == marker_id).one()

    resp = MarkerResponse(
        marker_id=m.marker_id,
        donator_user_id=m.donator_user_id,
        donator_name=m.donator.name,
        latitude=lat,
        longitude=lon,
        creation_date=m.creation_date,
        status=m.status,
        updated_at=m.updated_at,
        reserved_until=m.reserved_until,
        food_type=m.food_type,
        quantity=m.quantity,
        description=m.description,
        dietary_tags=m.dietary_tags or [],
        receiver_user_id=m.receiver_user_id,
    )

    # Send WebSocket notifications as well
    try:
        # Notification for the donator
        thank_you_notification = {
            "type": "notification",
            "user_id": m.donator_user_id,
            "message": thank_you_message,
            "severity": "success",
            "notificationType": "food_pickup_thank_you",
            "marker_id": marker_id,
            "marker_info": {
                "donator_id": m.donator_user_id,
                "reserver_id": current_user.user_id,
                "food_type": m.food_type,
                "user_role": "donator"
            }
        }
        print(f"Sending thank you notification to user ID {m.donator_user_id}")
        await manager.broadcast(thank_you_notification)
        
        # Notification for the person who picked up
        pickup_notification = {
            "type": "notification",
            "user_id": current_user.user_id,
            "message": pickup_message,
            "severity": "success",
            "notificationType": "food_pickup_confirmation",
            "marker_id": marker_id,
            "marker_info": {
                "donator_id": m.donator_user_id,
                "reserver_id": current_user.user_id,
                "food_type": m.food_type,
                "user_role": "reserver"
            }
        }
        await manager.broadcast(pickup_notification)
    except Exception as e:
        print(f"Error sending pickup notifications: {str(e)}")

    # Broadcast the marker update to all clients
    payload = {"type": "marker_update", "marker": jsonable_encoder(resp)}
    await manager.broadcast(payload)
    return resp


@router.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    # Accept the connection first
    await ws.accept()
    print(f"New WebSocket connection accepted")
    user_id = None
    # Track pings to reduce logging noise
    last_ping_log_time = 0
    
    try:
        while True:
            try:
                data = await ws.receive_json()
                # Only log non-ping messages to reduce console spam
                if data.get("type") != "ping":
                    print(f"Received WebSocket message: {data}")
                
                # Handle authentication message
                if data.get("type") == "auth" and "token" in data:
                    try:
                        print(f"Processing WebSocket authentication request")
                        # Verify token and get user_id
                        from app.core.security import decode_token
                        from app.models.user import User
                        
                        token = data["token"]
                        # Truncate token for logging purposes
                        truncated_token = token[:10] + "..." + token[-10:] if len(token) > 20 else token
                        print(f"Authenticating WebSocket with token: {truncated_token}")
                        
                        payload = decode_token(token)
                        if payload and "sub" in payload and "error" not in payload:
                            email = payload["sub"]
                            print(f"Token valid for email: {email}")
                            
                            # Create a dedicated DB session for this authentication check
                            # This ensures we don't leak connections
                            from app.db.session import SessionLocal
                            db = SessionLocal()
                            try:
                                # Get user from database using email
                                user = db.query(User).filter(User.email == email).first()
                                if user:
                                    user_id = user.user_id
                                    user_name = user.name
                                    print(f"User authenticated with WebSocket: ID={user_id}, Name={user_name}")
                                    
                                    # If already connected, update the connection
                                    if user_id in manager.user_connections and ws in manager.user_connections[user_id]:
                                        print(f"User {user_id} already has this WebSocket connection registered")
                                    else:
                                        # Register this connection with the user_id
                                        await manager.connect(ws, user_id)
                                        print(f"WebSocket connection registered for user {user_id}")
                                        print(f"User now has {len(manager.user_connections.get(user_id, []))} active connections")
                                    
                                    # Send confirmation
                                    await ws.send_json({
                                        "type": "auth_success", 
                                        "user_id": user_id,
                                        "name": user_name,
                                        "connections": len(manager.user_connections.get(user_id, []))
                                    })
                                    print(f"Sent auth_success to user {user_id}")
                                else:
                                    print(f"User with email {email} not found in database")
                                    await ws.send_json({"type": "auth_error", "message": "User not found"})
                                    await ws.close(code=4000, reason="User not found")
                            finally:
                                # Always close the database session
                                db.close()
                        else:
                            error = payload.get("error", "Unknown error") if payload else "Invalid token format"
                            print(f"Invalid token: {error}")
                            await ws.send_json({"type": "auth_error", "message": f"Invalid token: {error}"})
                            await ws.close(code=4000, reason="Invalid token")
                    except Exception as e:
                        print(f"WebSocket authentication error: {str(e)}")
                        await ws.send_json({"type": "auth_error", "message": str(e)})
                        await ws.close(code=4000, reason=str(e))
                        break  # Break the loop to disconnect properly
                
                # Handle ping message (keep-alive)
                elif data.get("type") == "ping":
                    # Reduce ping logging to once every 5 minutes per connection
                    now = datetime.utcnow().timestamp()
                    if now - last_ping_log_time > 300:  # 5 minutes
                        if user_id:
                            print(f"Received ping from WebSocket user: {user_id}")
                        last_ping_log_time = now
                        
                    await ws.send_json({"type": "pong", "timestamp": datetime.utcnow().isoformat()})
                
                # Handle other message types as needed
                else:
                    print(f"Received unknown message type: {data.get('type')}")
            except json.JSONDecodeError as e:
                print(f"WebSocket received invalid JSON data: {str(e)}")
                # Don't break for JSON errors, just continue
            except Exception as e:
                print(f"Error processing WebSocket message: {str(e)}")
                # Only break on critical errors
                if isinstance(e, (WebSocketDisconnect, RuntimeError)):
                    raise e
                
    except WebSocketDisconnect as e:
        print(f"WebSocket disconnected for user {user_id} with code {e.code}")
        manager.disconnect(ws, user_id)
    except Exception as e:
        print(f"Unexpected WebSocket error for user {user_id}: {str(e)}")
        try:
            manager.disconnect(ws, user_id)
        except Exception as disconnect_err:
            print(f"Error during disconnect cleanup: {str(disconnect_err)}")
        finally:
            try:
                if ws.client_state != WebSocketState.DISCONNECTED:
                    await ws.close(code=1011, reason=f"Server error: {str(e)}")
            except:
                pass
