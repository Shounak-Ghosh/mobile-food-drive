# backend/app/routes/marker.py

from datetime import datetime, timedelta
from uuid import uuid4
from typing import Optional

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    WebSocket,
    WebSocketDisconnect,
    status,
)
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

    async def connect(self, ws: WebSocket, user_id: int = None):
        await ws.accept()
        self.active_connections.append(ws)
        
        # If user_id is provided, register this connection for the user
        if user_id is not None:
            if user_id not in self.user_connections:
                self.user_connections[user_id] = []
            self.user_connections[user_id].append(ws)
            print(f"User {user_id} connected. Total connections for this user: {len(self.user_connections[user_id])}")
            print(f"Active user connections: {list(self.user_connections.keys())}")

    def disconnect(self, ws: WebSocket, user_id: int = None):
        if ws in self.active_connections:
            self.active_connections.remove(ws)
        
        # If user_id is provided, remove this connection from user's connections
        if user_id is not None and user_id in self.user_connections:
            if ws in self.user_connections[user_id]:
                self.user_connections[user_id].remove(ws)
            
            # Clean up empty lists
            if not self.user_connections[user_id]:
                del self.user_connections[user_id]
            print(f"User {user_id} disconnected. Remaining users: {list(self.user_connections.keys())}")

    async def broadcast(self, msg: dict):
        # If user_id is specified, only send to that user's connections
        if "user_id" in msg and msg["user_id"] is not None:
            user_id = msg["user_id"]
            if user_id in self.user_connections:
                print(f"Broadcasting message to user {user_id}, who has {len(self.user_connections[user_id])} connections")
                connections = self.user_connections[user_id]
                for conn in connections:
                    try:
                        await conn.send_json(msg)
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
            for conn in self.active_connections:
                try:
                    await conn.send_json(msg)
                except Exception as e:
                    print(f"Error sending broadcast message: {str(e)}")
                    # Connection might be dead, remove it
                    if conn in self.active_connections:
                        self.active_connections.remove(conn)


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
    m = db.get(Marker, marker_id)
    if not m:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Marker not found")

    # Block self‐reservation
    if m.donator_user_id == current_user.user_id:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, "You cannot reserve your own donation"
        )

    if m.status is not MarkerStatus.available:
        raise HTTPException(
            status.HTTP_409_CONFLICT, "Marker is not available"
        )

    # perform reservation
    m.receiver_user_id = current_user.user_id
    m.status = MarkerStatus.reserved
    m.reserved_until = datetime.utcnow() + timedelta(hours=2)
    m.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(m)

    # fetch coords so response_model is complete
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

    payload = {"type": "marker_update", "marker": jsonable_encoder(resp)}
    await manager.broadcast(payload)
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
    
    # Create a thank you notification in the database
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

    # Send a notification to the donator about the pickup
    try:
        thank_you_notification = {
            "type": "notification",
            "user_id": m.donator_user_id,
            "message": thank_you_message,
            "severity": "success",
            "notificationType": "food_pickup_thank_you",
            "marker_id": marker_id
        }
        print(f"Sending thank you notification to user ID {m.donator_user_id}")
        await manager.broadcast(thank_you_notification)
        
        # Also broadcast a general notification for testing
        general_notification = {
            "type": "notification",
            "message": f"A donation of {m.food_type} was picked up. Thank you for using the app!",
            "severity": "info",
            "notificationType": "food_pickup_thank_you"
        }
        await manager.broadcast(general_notification)
    except Exception as e:
        print(f"Error sending thank you notification: {str(e)}")

    # Broadcast the marker update to all clients
    payload = {"type": "marker_update", "marker": jsonable_encoder(resp)}
    await manager.broadcast(payload)
    return resp


@router.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await manager.connect(ws)
    user_id = None
    
    try:
        while True:
            data = await ws.receive_json()
            print(f"Received WebSocket message: {data}")
            
            # Handle authentication message
            if data.get("type") == "auth" and "token" in data:
                try:
                    # Verify token and get user_id
                    from app.core.security import verify_token
                    payload = verify_token(data["token"])
                    if payload and "sub" in payload:
                        user_id = int(payload["sub"])
                        print(f"User authenticated with websocket: {user_id}")
                        # Register this connection with the user_id
                        await manager.connect(ws, user_id)
                        # Send confirmation
                        await ws.send_json({"type": "auth_success", "user_id": user_id})
                    else:
                        print("Invalid token: payload missing or 'sub' not found")
                        await ws.send_json({"type": "auth_error", "message": "Invalid token"})
                except Exception as e:
                    print(f"WebSocket authentication error: {str(e)}")
                    await ws.send_json({"type": "auth_error", "message": str(e)})
            
            # Handle other message types
            # ...
            
    except WebSocketDisconnect:
        print(f"WebSocket disconnected for user: {user_id}")
        manager.disconnect(ws, user_id)
    except Exception as e:
        print(f"Unexpected WebSocket error: {str(e)}")
        manager.disconnect(ws, user_id)
