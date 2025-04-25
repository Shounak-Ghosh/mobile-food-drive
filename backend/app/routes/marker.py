# backend/app/routes/marker.py

from datetime import datetime, timedelta
from uuid import uuid4

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

router = APIRouter()  # mounted at /markers


class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.active_connections.append(ws)

    def disconnect(self, ws: WebSocket):
        self.active_connections.remove(ws)

    async def broadcast(self, msg: dict):
        for conn in self.active_connections:
            await conn.send_json(msg)


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
    db: Session = Depends(get_db),
):
    q = (
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
            )
        )
    )
    out = []
    for m, donator_name, lon, lat in q.all():
        out.append(
            MarkerResponse(
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
        )
    return out


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

    payload = {"type": "marker_update", "marker": jsonable_encoder(resp)}
    await manager.broadcast(payload)
    return resp


@router.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await manager.connect(ws)
    try:
        while True:
            await ws.receive_json()
    except WebSocketDisconnect:
        manager.disconnect(ws)
